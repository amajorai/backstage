import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";

let ffmpegInstance: FFmpeg | null = null;
let loadPromise: Promise<FFmpeg> | null = null;

/**
 * Load and initialize FFmpeg WASM
 */
export async function loadFFmpeg(): Promise<FFmpeg> {
  if (ffmpegInstance) {
    return ffmpegInstance;
  }

  if (loadPromise) {
    return loadPromise;
  }

  loadPromise = (async () => {
    const ffmpeg = new FFmpeg();

    const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd";

    await ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
      wasmURL: await toBlobURL(
        `${baseURL}/ffmpeg-core.wasm`,
        "application/wasm"
      ),
    });

    ffmpegInstance = ffmpeg;
    return ffmpeg;
  })();

  return loadPromise;
}

export interface VideoExportOptions {
  width: number;
  height: number;
  fps?: number;
  bitrate?: string; // e.g., "2M" for 2 Mbps
}

/**
 * Export a sequence of canvas frames as an MP4 video
 */
export async function exportCanvasFramesToMp4(
  frames: { canvas: HTMLCanvasElement; delay: number }[],
  options: VideoExportOptions,
  onProgress?: (progress: number) => void
): Promise<Blob> {
  const ffmpeg = await loadFFmpeg();
  const { width, height, fps = 30, bitrate = "2M" } = options;

  // Clear any previous files
  try {
    await ffmpeg.deleteFile("output.mp4");
  } catch {
    // File might not exist
  }

  // Write each frame as a PNG file
  for (let i = 0; i < frames.length; i++) {
    const { canvas } = frames[i];
    const blob = await new Promise<Blob>((resolve) => {
      canvas.toBlob((b) => resolve(b!), "image/png");
    });
    const data = await fetchFile(blob);
    await ffmpeg.writeFile(`frame${String(i).padStart(5, "0")}.png`, data);

    if (onProgress) {
      onProgress((i / frames.length) * 0.5); // First 50% is writing frames
    }
  }

  // Calculate average frame duration for consistent framerate
  const totalDuration = frames.reduce((sum, f) => sum + f.delay, 0);
  const avgFps = Math.round((frames.length / totalDuration) * 1000) || fps;

  // Run FFmpeg to create MP4
  await ffmpeg.exec([
    "-framerate",
    String(avgFps),
    "-i",
    "frame%05d.png",
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-b:v",
    bitrate,
    "-s",
    `${width}x${height}`,
    "output.mp4",
  ]);

  if (onProgress) {
    onProgress(0.9); // 90% done
  }

  // Read the output file
  const data = await ffmpeg.readFile("output.mp4");

  // Clean up frame files
  for (let i = 0; i < frames.length; i++) {
    try {
      await ffmpeg.deleteFile(`frame${String(i).padStart(5, "0")}.png`);
    } catch {
      // Ignore cleanup errors
    }
  }

  if (onProgress) {
    onProgress(1); // 100% done
  }

  return new Blob([data], { type: "video/mp4" });
}

/**
 * Check if FFmpeg is loaded and ready
 */
export function isFFmpegLoaded(): boolean {
  return ffmpegInstance !== null;
}
