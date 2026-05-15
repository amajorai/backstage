import { open } from "@tauri-apps/plugin-dialog";
import { readFile } from "@tauri-apps/plugin-fs";

/** Image file extensions supported by the app */
export const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "webp", "gif"];

/**
 * Convert a Uint8Array to a data URL string.
 */
export function fileToDataUrl(data: Uint8Array): Promise<string> {
  // Create a new Uint8Array copy to ensure we have a proper ArrayBuffer (not SharedArrayBuffer)
  const copy = new Uint8Array(data);
  const blob = new Blob([copy]);
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
  return filePath.split(/[/\\]/).pop() || "Image";
}

/**
 * Load image files dropped via HTML drag-and-drop as data URLs.
 * Returns an array of objects with dataUrl and fileName.
 */
export async function loadDroppedImageFiles(
  files: FileList | File[]
): Promise<Array<{ dataUrl: string; fileName: string }>> {
  const arr = Array.from(files);
  const results: Array<{ dataUrl: string; fileName: string }> = [];

  for (const file of arr) {
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (!IMAGE_EXTENSIONS.includes(ext)) continue;
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      results.push({ dataUrl, fileName: file.name });
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
export async function openAndLoadImages(): Promise<
  Array<{ dataUrl: string; fileName: string }>
> {
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
  const results: Array<{ dataUrl: string; fileName: string }> = [];

  for (const filePath of files) {
    try {
      const data = await readFile(filePath);
      const dataUrl = await fileToDataUrl(data);
      const fileName = getFileNameFromPath(filePath);
      results.push({ dataUrl, fileName });
    } catch (error) {
      console.error("Failed to load image:", error);
    }
  }

  return results;
}
