import { open } from "@tauri-apps/plugin-dialog";
import { readFile } from "@tauri-apps/plugin-fs";

/** Image file extensions supported by the app */
export const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "webp", "gif", "svg"];

export interface LoadedImageFile {
  dataUrl: string;
  fileName: string;
  kind: "raster" | "svg";
  svgString?: string;
}

const IMAGE_MIME_TYPES: Record<string, string> = {
  gif: "image/gif",
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  png: "image/png",
  svg: "image/svg+xml",
  webp: "image/webp",
};

const PATH_SEPARATOR_REGEX = /[/\\]/;

function getImageExtension(fileName: string): string {
  return fileName.split(".").pop()?.toLowerCase() ?? "";
}

function svgStringToDataUrl(svgString: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgString)}`;
}

/**
 * Convert a Uint8Array to a data URL string.
 */
export function fileToDataUrl(
  data: Uint8Array,
  mimeType?: string
): Promise<string> {
  // Create a new Uint8Array copy to ensure we have a proper ArrayBuffer (not SharedArrayBuffer)
  const copy = new Uint8Array(data);
  const blob = new Blob([copy], mimeType ? { type: mimeType } : undefined);
  return new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.readAsDataURL(blob);
  });
}

/**
 * Extract the file name from a file path.
 */
export function getFileNameFromPath(filePath: string): string {
  return filePath.split(PATH_SEPARATOR_REGEX).pop() || "Image";
}

/**
 * Load image files dropped via HTML drag-and-drop as data URLs.
 * Returns an array of objects with dataUrl and fileName.
 */
export async function loadDroppedImageFiles(
  files: FileList | File[]
): Promise<LoadedImageFile[]> {
  const arr = Array.from(files);
  const results: LoadedImageFile[] = [];

  for (const file of arr) {
    const ext = getImageExtension(file.name);
    if (!IMAGE_EXTENSIONS.includes(ext)) {
      continue;
    }
    try {
      if (ext === "svg") {
        const svgString = await file.text();
        results.push({
          dataUrl: svgStringToDataUrl(svgString),
          fileName: file.name,
          kind: "svg",
          svgString,
        });
        continue;
      }

      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      results.push({ dataUrl, fileName: file.name, kind: "raster" });
    } catch {
      // skip unreadable files
    }
  }

  return results;
}

/**
 * Open a file picker dialog and load the selected image files as data URLs.
 * Returns an array of objects with dataUrl and fileName.
 */
export async function openAndLoadImages(): Promise<LoadedImageFile[]> {
  const selected = await open({
    multiple: true,
    filters: [
      {
        name: "Images",
        extensions: IMAGE_EXTENSIONS,
      },
    ],
  });

  if (!selected) {
    return [];
  }

  const files = Array.isArray(selected) ? selected : [selected];
  const results: LoadedImageFile[] = [];

  for (const filePath of files) {
    try {
      const data = await readFile(filePath);
      const fileName = getFileNameFromPath(filePath);
      const ext = getImageExtension(fileName);
      const mimeType = IMAGE_MIME_TYPES[ext];

      if (ext === "svg") {
        const svgString = new TextDecoder("utf-8").decode(data);
        results.push({
          dataUrl: svgStringToDataUrl(svgString),
          fileName,
          kind: "svg",
          svgString,
        });
        continue;
      }

      const dataUrl = await fileToDataUrl(data, mimeType);
      results.push({ dataUrl, fileName, kind: "raster" });
    } catch (error) {
      console.error("Failed to load image:", error);
    }
  }

  return results;
}
