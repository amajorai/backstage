import type { LayerAdjustments } from "@/stores/use-editor-store";

const SAMPLE_SIZE = 64;

export async function computeAutoAdjustments(
  dataUrl: string
): Promise<Partial<LayerAdjustments>> {
  const img = new window.Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = dataUrl;
  });

  const canvas = document.createElement("canvas");
  canvas.width = SAMPLE_SIZE;
  canvas.height = SAMPLE_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) return {};

  ctx.drawImage(img, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
  const { data } = ctx.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE);

  let lumaSum = 0;
  let lumaMin = 255;
  let lumaMax = 0;
  let satSum = 0;
  let count = 0;

  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 10) continue;

    const r = data[i] / 255;
    const g = data[i + 1] / 255;
    const b = data[i + 2] / 255;

    const luma = r * 0.299 + g * 0.587 + b * 0.114;
    const lumaRaw = Math.round(luma * 255);
    lumaSum += luma;
    lumaMin = Math.min(lumaMin, lumaRaw);
    lumaMax = Math.max(lumaMax, lumaRaw);

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const lightness = (max + min) / 2;
    const sat =
      max === min
        ? 0
        : lightness < 0.5
          ? (max - min) / (max + min)
          : (max - min) / (2 - max - min);
    satSum += sat;

    count++;
  }

  if (count === 0) return {};

  const meanLuma = lumaSum / count;
  const meanSat = satSum / count;
  const histRange = lumaMax - lumaMin;

  // Brightness: nudge mean luma toward 0.5
  const lumaDelta = 0.5 - meanLuma;
  const brightness = Math.max(-80, Math.min(80, Math.round(lumaDelta * 80)));

  // Contrast: widen narrow histograms
  const contrastBoost = histRange < 200 ? Math.round((200 - histRange) / 3) : 0;
  const contrast = Math.min(50, contrastBoost);

  // Saturation: boost undersaturated, gently pull oversaturated
  const satDelta = 0.35 - meanSat;
  const saturation = Math.max(
    -30,
    Math.min(60, Math.round(satDelta > 0 ? satDelta * 60 : satDelta * 30))
  );

  return {
    brightness,
    contrast,
    saturation,
    hue: 0,
    blur: 0,
    sharpen: 0,
    invert: false,
    sepia: false,
    grayscale: false,
  };
}
