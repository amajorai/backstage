import parseAPNG from "apng-js";

export interface ParsedAPNG {
  frames: string[]; // Data URLs for each frame
  delays: number[]; // Delay for each frame in ms
  width: number;
  height: number;
  isAnimated: boolean;
}

/**
 * Parse an APNG file and extract frames as data URLs
 * Uses the apng-js player to properly render each frame
 */
export async function parseAPNGFromUrl(url: string): Promise<ParsedAPNG> {
  // Fetch the APNG data
  const response = await fetch(url);
  const arrayBuffer = await response.arrayBuffer();

  // Parse the APNG
  const apng = parseAPNG(arrayBuffer);

  if (apng instanceof Error) {
    throw apng;
  }

  // Check if it's actually animated
  const isAnimated = apng.frames.length > 1;

  // If only one frame or not animated, just return the original as single frame
  if (!isAnimated || apng.frames.length <= 1) {
    // Convert the original image to data URL
    const blob = new Blob([arrayBuffer], { type: "image/png" });
    const dataUrl = await blobToDataUrl(blob);
    return {
      frames: [dataUrl],
      delays: [apng.frames[0]?.delay || 100],
      width: apng.width,
      height: apng.height,
      isAnimated: false,
    };
  }

  // Create a canvas for rendering frames
  const canvas = document.createElement("canvas");
  canvas.width = apng.width;
  canvas.height = apng.height;
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("Failed to get canvas context");
  }

  // Use the apng-js player to render frames properly
  // The player handles all the compositing logic internally
  const player = await apng.getPlayer(ctx, false);

  const frames: string[] = [];
  const delays: number[] = [];

  // Render each frame by stepping through the animation
  for (let i = 0; i < apng.frames.length; i++) {
    // Render frame at index i
    player.renderNextFrame();

    // Capture the canvas as a data URL
    frames.push(canvas.toDataURL("image/png"));
    delays.push(apng.frames[i].delay);
  }

  // Reset the player
  player.stop();

  return {
    frames,
    delays,
    width: apng.width,
    height: apng.height,
    isAnimated: true,
  };
}

/**
 * Convert a Blob to a data URL
 */
function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Parse APNG from an ArrayBuffer
 */
export async function parseAPNGFromBuffer(
  buffer: ArrayBuffer
): Promise<ParsedAPNG> {
  const apng = parseAPNG(buffer);

  if (apng instanceof Error) {
    throw apng;
  }

  const isAnimated = apng.frames.length > 1;

  if (!isAnimated || apng.frames.length <= 1) {
    const blob = new Blob([buffer], { type: "image/png" });
    const dataUrl = await blobToDataUrl(blob);
    return {
      frames: [dataUrl],
      delays: [apng.frames[0]?.delay || 100],
      width: apng.width,
      height: apng.height,
      isAnimated: false,
    };
  }

  const canvas = document.createElement("canvas");
  canvas.width = apng.width;
  canvas.height = apng.height;
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("Failed to get canvas context");
  }

  const player = await apng.getPlayer(ctx, false);

  const frames: string[] = [];
  const delays: number[] = [];

  for (let i = 0; i < apng.frames.length; i++) {
    player.renderNextFrame();
    frames.push(canvas.toDataURL("image/png"));
    delays.push(apng.frames[i].delay);
  }

  player.stop();

  return {
    frames,
    delays,
    width: apng.width,
    height: apng.height,
    isAnimated: true,
  };
}
