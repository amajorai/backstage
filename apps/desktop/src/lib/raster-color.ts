const SAMPLE_SIZE = 200;
const MAX_COLORS = 8;
const BUCKET_SIZE = 32;

function rgbToHex(r: number, g: number, b: number): string {
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

function hexToRgb(hex: string): [number, number, number] | null {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return null;
  return [
    Number.parseInt(m[1], 16),
    Number.parseInt(m[2], 16),
    Number.parseInt(m[3], 16),
  ];
}

function colorDist(
  r1: number,
  g1: number,
  b1: number,
  r2: number,
  g2: number,
  b2: number
): number {
  return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2);
}

export async function extractRasterColors(dataUrl: string): Promise<string[]> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const scale = Math.min(1, SAMPLE_SIZE / Math.max(img.width, img.height));
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve([]);
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;

      // Count colors by bucketing into BUCKET_SIZE-sized RGB bins
      const buckets = new Map<
        string,
        { r: number; g: number; b: number; count: number }
      >();
      for (let i = 0; i < data.length; i += 4) {
        const a = data[i + 3];
        if (a < 128) continue; // skip transparent
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        // Skip near-white and near-black as they're usually background/foreground defaults
        if (r > 245 && g > 245 && b > 245) continue;
        if (r < 10 && g < 10 && b < 10) continue;
        const br = Math.round(r / BUCKET_SIZE) * BUCKET_SIZE;
        const bg = Math.round(g / BUCKET_SIZE) * BUCKET_SIZE;
        const bb = Math.round(b / BUCKET_SIZE) * BUCKET_SIZE;
        const key = `${br},${bg},${bb}`;
        const existing = buckets.get(key);
        if (existing) {
          existing.r = Math.round(
            (existing.r * existing.count + r) / (existing.count + 1)
          );
          existing.g = Math.round(
            (existing.g * existing.count + g) / (existing.count + 1)
          );
          existing.b = Math.round(
            (existing.b * existing.count + b) / (existing.count + 1)
          );
          existing.count++;
        } else {
          buckets.set(key, { r, g, b, count: 1 });
        }
      }

      // Sort by frequency, merge similar colors
      const sorted = [...buckets.values()].sort((a, b) => b.count - a.count);
      const result: { r: number; g: number; b: number }[] = [];
      for (const candidate of sorted) {
        if (result.length >= MAX_COLORS) break;
        const tooClose = result.some(
          (c) =>
            colorDist(c.r, c.g, c.b, candidate.r, candidate.g, candidate.b) <
            BUCKET_SIZE * 1.5
        );
        if (!tooClose) result.push(candidate);
      }

      resolve(result.map((c) => rgbToHex(c.r, c.g, c.b)));
    };
    img.onerror = () => resolve([]);
    img.src = dataUrl;
  });
}

export async function applyRasterColorMap(
  baseDataUrl: string,
  colorMap: Record<string, string>,
  tolerance = 40
): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(baseDataUrl);
        return;
      }
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      const entries = Object.entries(colorMap)
        .map(([from, to]) => ({ from: hexToRgb(from), to: hexToRgb(to) }))
        .filter((e) => e.from !== null && e.to !== null) as {
        from: [number, number, number];
        to: [number, number, number];
      }[];

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        for (const { from, to } of entries) {
          if (colorDist(r, g, b, from[0], from[1], from[2]) <= tolerance) {
            data[i] = to[0];
            data[i + 1] = to[1];
            data[i + 2] = to[2];
            break;
          }
        }
      }

      ctx.putImageData(imageData, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => resolve(baseDataUrl);
    img.src = baseDataUrl;
  });
}
