import { applyPalette, GIFEncoder, quantize } from "gifenc";

export interface GifExportOptions {
  width: number;
  height: number;
  fps?: number;
  quality?: number; // 1-30, lower is better quality
}

/**
 * Create a GIF encoder for exporting animated content
 */
export function createGifEncoder(options: GifExportOptions) {
  const { width, height } = options;
  const gif = GIFEncoder();

  return {
    /**
     * Add a frame to the GIF
     * @param canvas - Canvas element with the frame content
     * @param delay - Delay in milliseconds for this frame
     */
    addFrame(canvas: HTMLCanvasElement, delay: number) {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const imageData = ctx.getImageData(0, 0, width, height);
      const { data } = imageData;

      // Convert RGBA to RGB for quantization
      const rgb = new Uint8Array(width * height * 3);
      for (let i = 0, j = 0; i < data.length; i += 4, j += 3) {
        rgb[j] = data[i]; // R
        rgb[j + 1] = data[i + 1]; // G
        rgb[j + 2] = data[i + 2]; // B
      }

      // Quantize to 256 colors
      const palette = quantize(rgb, 256);
      const index = applyPalette(rgb, palette);

      // Write frame with delay in centiseconds (GIF uses 1/100th seconds)
      gif.writeFrame(index, width, height, {
        palette,
        delay: Math.round(delay / 10), // Convert ms to centiseconds
        transparent: false,
      });
    },

    /**
     * Finish encoding and return the GIF as a Blob
     */
    finish(): Blob {
      gif.finish();
      const bytes = gif.bytes();
      return new Blob([bytes], { type: "image/gif" });
    },

    /**
     * Get the raw bytes of the GIF
     */
    getBytes(): Uint8Array {
      gif.finish();
      return gif.bytes();
    },
  };
}

/**
 * Export a sequence of canvas frames as a GIF
 */
export async function exportCanvasFramesToGif(
  frames: { canvas: HTMLCanvasElement; delay: number }[],
  options: GifExportOptions
): Promise<Blob> {
  const encoder = createGifEncoder(options);

  for (const frame of frames) {
    encoder.addFrame(frame.canvas, frame.delay);
  }

  return encoder.finish();
}
