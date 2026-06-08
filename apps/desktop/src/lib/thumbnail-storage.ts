import { appDataDir, join } from "@tauri-apps/api/path";
import {
  exists,
  readFile,
  remove,
  rename,
  writeFile,
} from "@tauri-apps/plugin-fs";
import { bytesToDataUrl, dataUrlToBytes, ensureDir } from "@/lib/fs-utils";
import { logger } from "@/lib/logger";
import { migrate } from "@/lib/schema-migration";

const THUMBNAILS_DIR = "thumbnails";
const LAYERS_SCHEMA_VERSION = 1;
const PREVIEW_SIZE = 1920; // Preview thumbnail max dimension in pixels
const FULL_IMAGE_QUALITY = 0.92;
const PREVIEW_IMAGE_QUALITY = 0.8;

/**
 * Get the base thumbnails directory path
 */
async function getThumbnailsBaseDir(): Promise<string> {
  const appData = await appDataDir();
  return await join(appData, THUMBNAILS_DIR);
}

/**
 * Get the directory path for a specific thumbnail
 */
async function getThumbDir(id: string): Promise<string> {
  const baseDir = await getThumbnailsBaseDir();
  return await join(baseDir, id);
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      resolve(img);
    };
    img.onerror = () => reject(new Error("Failed to load image data URL"));
    img.src = dataUrl;
  });
}

function getScaledDimensions(
  width: number,
  height: number,
  maxDimension?: number
): { width: number; height: number } {
  if (!maxDimension || Math.max(width, height) <= maxDimension) {
    return { width, height };
  }

  if (width > height) {
    return {
      width: maxDimension,
      height: Math.round((height * maxDimension) / width),
    };
  }

  return {
    width: Math.round((width * maxDimension) / height),
    height: maxDimension,
  };
}

async function encodeImageAsWebp(
  dataUrl: string,
  quality: number,
  maxDimension?: number
): Promise<string> {
  const img = await loadImage(dataUrl);
  const dimensions = getScaledDimensions(img.width, img.height, maxDimension);

  const canvas = document.createElement("canvas");
  canvas.width = dimensions.width;
  canvas.height = dimensions.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Could not get canvas context");
  }

  ctx.drawImage(img, 0, 0, dimensions.width, dimensions.height);
  const encoded = canvas.toDataURL("image/webp", quality);
  if (!encoded.startsWith("data:image/webp;base64,")) {
    throw new Error("Failed to encode image as WebP");
  }
  return encoded;
}

/**
 * Generate a preview thumbnail from a data URL.
 */
function generatePreview(dataUrl: string): Promise<string> {
  return encodeImageAsWebp(dataUrl, PREVIEW_IMAGE_QUALITY, PREVIEW_SIZE);
}

/**
 * Regenerate preview.webp for an existing thumbnail from its full.webp.
 * Returns the new preview data URL, or null if full image not found.
 */
export async function regeneratePreviewFromFull(
  id: string
): Promise<string | null> {
  try {
    const fullDataUrl = await loadFullImage(id);
    if (!fullDataUrl) {
      return null;
    }

    const previewDataUrl = await generatePreview(fullDataUrl);
    const thumbDir = await getThumbDir(id);
    const previewPath = await join(thumbDir, "preview.webp");
    await writeFile(previewPath, dataUrlToBytes(previewDataUrl));
    return previewDataUrl;
  } catch (error) {
    logger.error(
      { err: error, thumbnailId: id },
      "[ThumbnailStorage] Failed to regenerate preview"
    );
    return null;
  }
}

/**
 * Save a thumbnail (full image + preview) to file storage
 */
export async function saveThumbnail(
  id: string,
  dataUrl: string
): Promise<{ previewUrl: string }> {
  const thumbDir = await getThumbDir(id);
  await ensureDir(thumbDir);

  const fullDataUrl = await encodeImageAsWebp(dataUrl, FULL_IMAGE_QUALITY);

  // Save full image
  const fullPath = await join(thumbDir, "full.webp");
  const fullBytes = dataUrlToBytes(fullDataUrl);
  await writeFile(fullPath, fullBytes);

  // Generate and save preview
  const previewDataUrl = await generatePreview(fullDataUrl);
  const previewPath = await join(thumbDir, "preview.webp");
  const previewBytes = dataUrlToBytes(previewDataUrl);
  await writeFile(previewPath, previewBytes);

  return { previewUrl: previewDataUrl };
}

/**
 * Load preview image for gallery display
 */
export async function loadPreview(id: string): Promise<string | null> {
  try {
    const thumbDir = await getThumbDir(id);
    const previewPath = await join(thumbDir, "preview.webp");

    if (!(await exists(previewPath))) {
      return null;
    }

    const bytes = await readFile(previewPath);
    return bytesToDataUrl(bytes, "image/webp");
  } catch (error) {
    logger.error(
      { err: error, thumbnailId: id },
      "[ThumbnailStorage] Failed to load preview"
    );
    return null;
  }
}

/**
 * Load full image for editor
 */
export async function loadFullImage(id: string): Promise<string | null> {
  try {
    const thumbDir = await getThumbDir(id);
    const fullPath = await join(thumbDir, "full.webp");

    if (!(await exists(fullPath))) {
      return null;
    }

    const bytes = await readFile(fullPath);
    return bytesToDataUrl(bytes, "image/webp");
  } catch (error) {
    logger.error(
      { err: error, thumbnailId: id },
      "[ThumbnailStorage] Failed to load full image"
    );
    return null;
  }
}

interface LayerFileV1 {
  schemaVersion: 1;
  layers: unknown[];
}

const layerMigrations = {
  0: (d: Record<string, unknown>) => ({ ...d, schemaVersion: 1 }),
} as const;

/**
 * Save layer data to file
 */
export async function saveLayerData(
  id: string,
  layers: unknown[]
): Promise<void> {
  const thumbDir = await getThumbDir(id);
  await ensureDir(thumbDir);

  const layersPath = await join(thumbDir, "layers.json");
  const data: LayerFileV1 = { schemaVersion: LAYERS_SCHEMA_VERSION, layers };
  await writeFile(layersPath, new TextEncoder().encode(JSON.stringify(data)));
}

/**
 * Load layer data from file
 */
export async function loadLayerData(id: string): Promise<unknown[] | null> {
  try {
    const thumbDir = await getThumbDir(id);
    const layersPath = await join(thumbDir, "layers.json");

    if (!(await exists(layersPath))) {
      return null;
    }

    const bytes = await readFile(layersPath);
    const raw = JSON.parse(new TextDecoder().decode(bytes));
    // v0 wrote a bare layer array
    if (Array.isArray(raw)) {
      return raw;
    }
    const data = migrate<LayerFileV1>(
      raw,
      layerMigrations,
      LAYERS_SCHEMA_VERSION
    );
    return data.layers;
  } catch (error) {
    logger.error(
      { err: error, thumbnailId: id },
      "[ThumbnailStorage] Failed to load layers"
    );
    return null;
  }
}

/**
 * Delete a thumbnail and all its files
 */
export async function deleteThumbnailFiles(id: string): Promise<void> {
  try {
    const thumbDir = await getThumbDir(id);
    if (await exists(thumbDir)) {
      await remove(thumbDir, { recursive: true });
    }
  } catch (error) {
    logger.error(
      { err: error, thumbnailId: id },
      "[ThumbnailStorage] Failed to delete"
    );
  }
}

/**
 * Check if a thumbnail's files exist
 */
export async function thumbnailFilesExist(id: string): Promise<boolean> {
  try {
    const thumbDir = await getThumbDir(id);
    const fullPath = await join(thumbDir, "full.webp");
    return await exists(fullPath);
  } catch {
    return false;
  }
}

// ============ TRASH FUNCTIONS ============

const TRASH_DIR = "trash";

/**
 * Get the base trash directory path
 */
async function getTrashBaseDir(): Promise<string> {
  const appData = await appDataDir();
  return await join(appData, TRASH_DIR);
}

/**
 * Get the directory path for a specific trashed thumbnail
 */
async function getTrashDir(id: string): Promise<string> {
  const baseDir = await getTrashBaseDir();
  return await join(baseDir, id);
}

/**
 * Move thumbnail files to trash (fast directory rename)
 */
export async function moveFilesToTrash(id: string): Promise<void> {
  try {
    const thumbDir = await getThumbDir(id);
    const trashDir = await getTrashDir(id);

    if (!(await exists(thumbDir))) {
      logger.warn(
        { thumbnailId: id },
        "[ThumbnailStorage] Source dir not found"
      );
      return;
    }

    // Ensure parent trash directory exists
    const trashBaseDir = await getTrashBaseDir();
    await ensureDir(trashBaseDir);

    // Use rename for instant move (no read/write needed)
    await rename(thumbDir, trashDir);
    logger.info({ thumbnailId: id }, "[ThumbnailStorage] Moved to trash");
  } catch (error) {
    logger.error(
      { err: error, thumbnailId: id },
      "[ThumbnailStorage] Failed to move to trash"
    );
  }
}

/**
 * Restore thumbnail files from trash (fast directory rename)
 */
export async function restoreFilesFromTrash(id: string): Promise<void> {
  try {
    const trashDir = await getTrashDir(id);
    const thumbDir = await getThumbDir(id);

    if (!(await exists(trashDir))) {
      logger.warn(
        { thumbnailId: id },
        "[ThumbnailStorage] Trash dir not found"
      );
      return;
    }

    // Ensure parent thumbnails directory exists
    const thumbBaseDir = await getThumbnailsBaseDir();
    await ensureDir(thumbBaseDir);

    // Use rename for instant move
    await rename(trashDir, thumbDir);
    logger.info({ thumbnailId: id }, "[ThumbnailStorage] Restored from trash");
  } catch (error) {
    logger.error(
      { err: error, thumbnailId: id },
      "[ThumbnailStorage] Failed to restore from trash"
    );
  }
}

/**
 * Permanently delete files from trash
 */
export async function deleteFromTrash(id: string): Promise<void> {
  try {
    const trashDir = await getTrashDir(id);
    if (await exists(trashDir)) {
      await remove(trashDir, { recursive: true });
      logger.info(
        { thumbnailId: id },
        "[ThumbnailStorage] Permanently deleted from trash"
      );
    }
  } catch (error) {
    logger.error(
      { err: error, thumbnailId: id },
      "[ThumbnailStorage] Failed to delete from trash"
    );
  }
}

/**
 * Load preview from trash
 */
export async function loadTrashPreview(id: string): Promise<string | null> {
  try {
    const trashDir = await getTrashDir(id);
    const previewPath = await join(trashDir, "preview.webp");

    if (!(await exists(previewPath))) {
      return null;
    }

    const bytes = await readFile(previewPath);
    return bytesToDataUrl(bytes, "image/webp");
  } catch (error) {
    logger.error(
      { err: error, thumbnailId: id },
      "[ThumbnailStorage] Failed to load trash preview"
    );
    return null;
  }
}
