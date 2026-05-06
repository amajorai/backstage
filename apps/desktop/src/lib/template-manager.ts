import { open, save } from "@tauri-apps/plugin-dialog";
import { readFile, writeFile } from "@tauri-apps/plugin-fs";
import JSZip from "jszip";
import type {
  AnimatedImageLayer,
  ImageLayer,
  Page,
} from "@/stores/use-editor-store";

interface LayoutFile {
  version: number;
  canvasWidth: number;
  canvasHeight: number;
  pages: Page[];
}

/**
 * Validates if the imported object is a valid LayoutFile
 */
function isLayoutFile(data: any): data is LayoutFile {
  return (
    typeof data === "object" &&
    data !== null &&
    typeof data.version === "number" &&
    Array.isArray(data.pages)
  );
}

export async function exportTemplate(
  projectName: string,
  pages: Page[],
  width: number,
  height: number
): Promise<void> {
  const zip = new JSZip();
  const assetsFolder = zip.folder("assets");

  if (!assetsFolder) {
    throw new Error("Failed to create assets folder in ZIP");
  }

  // Deep clone to avoid mutating original state
  const pagesClone: Page[] = JSON.parse(JSON.stringify(pages));

  // Process all layers to extract images
  for (const page of pagesClone) {
    for (const layer of page.layers) {
      if (layer.type === "image") {
        const imgLayer = layer as unknown as ImageLayer & {
          assetPath?: string;
        };
        if (imgLayer.dataUrl.startsWith("data:")) {
          const fileName = `${layer.id}.png`;
          const base64Data = imgLayer.dataUrl.split(",")[1];
          assetsFolder.file(fileName, base64Data, { base64: true });

          // Replace dataUrl with relative path for the JSON
          imgLayer.assetPath = `assets/${fileName}`;
          imgLayer.dataUrl = ""; // Clear heavy data
        }
      } else if (layer.type === "animated-image") {
        const animLayer = layer as unknown as AnimatedImageLayer & {
          assetPaths?: string[];
        };
        animLayer.assetPaths = [];

        // Save each frame
        for (let i = 0; i < animLayer.frames.length; i++) {
          const frameDataUrl = animLayer.frames[i];
          if (frameDataUrl.startsWith("data:")) {
            const fileName = `${layer.id}_frame_${i}.png`;
            const base64Data = frameDataUrl.split(",")[1];
            assetsFolder.file(fileName, base64Data, { base64: true });
            animLayer.assetPaths.push(`assets/${fileName}`);
          }
        }
        animLayer.frames = []; // Clear heavy data
      }
    }
  }

  const layout: LayoutFile = {
    version: 1,
    canvasWidth: width,
    canvasHeight: height,
    pages: pagesClone,
  };

  zip.file("layout.json", JSON.stringify(layout, null, 2));

  // Generate ZIP blob
  const zipBlob = await zip.generateAsync({ type: "blob" });
  const buffer = await zipBlob.arrayBuffer();
  const minimalName = projectName.toLowerCase().replace(/[^a-z0-9]/g, "-");

  // Save dialog
  const filePath = await save({
    defaultPath: `${minimalName}-template.zip`,
    filters: [
      {
        name: "Pulse Template",
        extensions: ["zip"],
      },
    ],
  });

  if (filePath) {
    await writeFile(filePath, new Uint8Array(buffer));
  }
}

export async function importTemplate(): Promise<{
  pages: Page[];
  width: number;
  height: number;
  name: string;
} | null> {
  const selected = await open({
    multiple: false,
    filters: [
      {
        name: "Pulse Template",
        extensions: ["zip"],
      },
    ],
  });

  if (!selected || typeof selected !== "string") {
    return null;
  }

  const fileData = await readFile(selected);
  const zip = await JSZip.loadAsync(fileData);

  const layoutFile = zip.file("layout.json");
  if (!layoutFile) {
    throw new Error("Invalid template: missing layout.json");
  }

  const layoutText = await layoutFile.async("string");
  const layout = JSON.parse(layoutText);

  if (!isLayoutFile(layout)) {
    throw new Error("Invalid template: layout.json format is incorrect");
  }

  // Rehydrate assets
  for (const page of layout.pages) {
    for (const layer of page.layers) {
      if (layer.type === "image") {
        const imgLayer = layer as unknown as ImageLayer & {
          assetPath?: string;
        };
        if (imgLayer.assetPath) {
          const assetFile = zip.file(imgLayer.assetPath);
          if (assetFile) {
            const base64 = await assetFile.async("base64");
            imgLayer.dataUrl = `data:image/png;base64,${base64}`;
          }
          delete imgLayer.assetPath;
        }
      } else if (layer.type === "animated-image") {
        const animLayer = layer as unknown as AnimatedImageLayer & {
          assetPaths?: string[];
        };
        if (animLayer.assetPaths && animLayer.assetPaths.length > 0) {
          animLayer.frames = [];
          for (const path of animLayer.assetPaths) {
            const assetFile = zip.file(path);
            if (assetFile) {
              const base64 = await assetFile.async("base64");
              animLayer.frames.push(`data:image/png;base64,${base64}`);
            }
          }
          delete animLayer.assetPaths;
        }
      }
    }
  }

  // Extract name from filename
  // Normalized path separators
  const fileName = selected.split(/[/\\]/).pop() || "Imported Template";
  const name = fileName.replace(/-template\.zip$/i, "").replace(/\.zip$/i, "");

  return {
    pages: layout.pages,
    width: layout.canvasWidth,
    height: layout.canvasHeight,
    name: name.charAt(0).toUpperCase() + name.slice(1).replace(/-/g, " "),
  };
}
