import { appDataDir, join } from "@tauri-apps/api/path";
import {
  exists,
  mkdir,
  readFile,
  remove,
  rename,
  writeFile,
} from "@tauri-apps/plugin-fs";
import { logger } from "@/lib/logger";

const THUMBNAILS_DIR = "thumbnails";
const PREVIEW_SIZE = 300; // Preview thumbnail max dimension in pixels

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

/**
 * Ensure a directory exists, creating it if necessary
 */
async function ensureDir(path: string): Promise<void> {
  if (!(await exists(path))) {
    await mkdir(path, { recursive: true });
  }
}

/**
 * Convert data URL to Uint8Array
 */
function dataUrlToBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(",")[1];
  if (!base64) {
    throw new Error("Invalid data URL: missing base64 content");
  }
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Convert Uint8Array to data URL
 */
function bytesToDataUrl(bytes: Uint8Array, mimeType: string): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  const base64 = btoa(binary);
  return `data:${mimeType};base64,${base64}`;
}

/**
 * Generate a preview thumbnail from a data URL
 * Returns a smaller data URL (max 300px)
 */
async function generatePreview(dataUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      // Calculate new dimensions maintaining aspect ratio
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > PREVIEW_SIZE) {
          height = Math.round((height * PREVIEW_SIZE) / width);
          width = PREVIEW_SIZE;
        }
      } else if (height > PREVIEW_SIZE) {
        width = Math.round((width * PREVIEW_SIZE) / height);
        height = PREVIEW_SIZE;
      }

      // Create canvas and draw resized image
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Could not get canvas context"));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);
      // Use WebP for smaller file size
      resolve(canvas.toDataURL("image/webp", 0.8));
    };
    img.onerror = () => reject(new Error("Failed to load image for preview"));
    img.src = dataUrl;
  });
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

  // Save full image
  const fullPath = await join(thumbDir, "full.webp");
  const fullBytes = dataUrlToBytes(dataUrl);
  await writeFile(fullPath, fullBytes);

  // Generate and save preview
  const previewDataUrl = await generatePreview(dataUrl);
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
  const layersJson = JSON.stringify(layers);
  const encoder = new TextEncoder();
  await writeFile(layersPath, encoder.encode(layersJson));
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
    const decoder = new TextDecoder();
    const json = decoder.decode(bytes);
    return JSON.parse(json);
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
