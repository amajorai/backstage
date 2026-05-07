export interface SelectionSegments {
  hSegs: Array<{ y: number; x1: number; x2: number }>;
  vSegs: Array<{ x: number; y1: number; y2: number }>;
}

export function floodFill(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  startX: number,
  startY: number,
  tolerance: number
): Uint8Array {
  const mask = new Uint8Array(width * height);
  const sx = Math.round(Math.max(0, Math.min(width - 1, startX)));
  const sy = Math.round(Math.max(0, Math.min(height - 1, startY)));
  const si = (sy * width + sx) * 4;

  const tr = data[si];
  const tg = data[si + 1];
  const tb = data[si + 2];
  const ta = data[si + 3];
  const tol = tolerance * tolerance * 4;

  const matches = (i: number) => {
    const dr = data[i] - tr;
    const dg = data[i + 1] - tg;
    const db = data[i + 2] - tb;
    const da = data[i + 3] - ta;
    return dr * dr + dg * dg + db * db + da * da <= tol;
  };

  const startIdx = sy * width + sx;
  mask[startIdx] = 1;

  // Use typed array stack for perf on large images
  const stack = new Int32Array(width * height);
  let top = 0;
  stack[top++] = startIdx;

  while (top > 0) {
    const idx = stack[--top];
    const x = idx % width;
    const y = (idx / width) | 0;

    if (y > 0) {
      const n = idx - width;
      if (!mask[n] && matches(n * 4)) {
        mask[n] = 1;
        stack[top++] = n;
      }
    }
    if (y < height - 1) {
      const n = idx + width;
      if (!mask[n] && matches(n * 4)) {
        mask[n] = 1;
        stack[top++] = n;
      }
    }
    if (x > 0) {
      const n = idx - 1;
      if (!mask[n] && matches(n * 4)) {
        mask[n] = 1;
        stack[top++] = n;
      }
    }
    if (x < width - 1) {
      const n = idx + 1;
      if (!mask[n] && matches(n * 4)) {
        mask[n] = 1;
        stack[top++] = n;
      }
    }
  }

  return mask;
}

export function buildSelectionSegments(
  mask: Uint8Array,
  width: number,
  height: number
): SelectionSegments {
  const hSegs: SelectionSegments["hSegs"] = [];
  const vSegs: SelectionSegments["vSegs"] = [];

  for (let y = 0; y <= height; y++) {
    let inSeg = false;
    let segStart = 0;
    for (let x = 0; x <= width; x++) {
      const above = y > 0 && x < width ? mask[(y - 1) * width + x] : 0;
      const below = y < height && x < width ? mask[y * width + x] : 0;
      const edge = above !== below;
      if (edge && !inSeg) {
        inSeg = true;
        segStart = x;
      } else if (!edge && inSeg) {
        hSegs.push({ y, x1: segStart, x2: x });
        inSeg = false;
      }
    }
  }

  for (let x = 0; x <= width; x++) {
    let inSeg = false;
    let segStart = 0;
    for (let y = 0; y <= height; y++) {
      const left = x > 0 && y < height ? mask[y * width + (x - 1)] : 0;
      const right = x < width && y < height ? mask[y * width + x] : 0;
      const edge = left !== right;
      if (edge && !inSeg) {
        inSeg = true;
        segStart = y;
      } else if (!edge && inSeg) {
        vSegs.push({ x, y1: segStart, y2: y });
        inSeg = false;
      }
    }
  }

  return { hSegs, vSegs };
}

export function drawMarchingAnts(
  ctx: CanvasRenderingContext2D,
  segments: SelectionSegments,
  dashOffset: number,
  // transform: image pixel → screen pixel
  toScreenX: (x: number) => number,
  toScreenY: (y: number) => number,
  // screen pixels per image pixel — scales dash size with zoom
  pixelSize = 1
): void {
  const DASH = Math.max(2, 5 * pixelSize);

  ctx.save();
  ctx.lineWidth = Math.max(1, pixelSize);

  for (let pass = 0; pass < 2; pass++) {
    ctx.setLineDash([DASH, DASH]);
    ctx.lineDashOffset = pass === 0 ? -dashOffset : -(dashOffset + DASH);
    ctx.strokeStyle = pass === 0 ? "#fff" : "#000";

    ctx.beginPath();
    for (const { y, x1, x2 } of segments.hSegs) {
      ctx.moveTo(toScreenX(x1), toScreenY(y));
      ctx.lineTo(toScreenX(x2), toScreenY(y));
    }
    for (const { x, y1, y2 } of segments.vSegs) {
      ctx.moveTo(toScreenX(x), toScreenY(y1));
      ctx.lineTo(toScreenX(x), toScreenY(y2));
    }
    ctx.stroke();
  }

  ctx.restore();
}

export function fillPolygon(
  points: Array<{ x: number; y: number }>,
  width: number,
  height: number
): Uint8Array {
  const mask = new Uint8Array(width * height);
  if (points.length < 3) return mask;
  const n = points.length;
  for (let y = 0; y < height; y++) {
    const xs: number[] = [];
    for (let i = 0; i < n; i++) {
      const p1 = points[i];
      const p2 = points[(i + 1) % n];
      if ((p1.y <= y && p2.y > y) || (p2.y <= y && p1.y > y)) {
        xs.push(p1.x + ((y - p1.y) / (p2.y - p1.y)) * (p2.x - p1.x));
      }
    }
    xs.sort((a, b) => a - b);
    for (let i = 0; i + 1 < xs.length; i += 2) {
      const x1 = Math.max(0, Math.ceil(xs[i]));
      const x2 = Math.min(width - 1, Math.floor(xs[i + 1]));
      for (let x = x1; x <= x2; x++) {
        mask[y * width + x] = 1;
      }
    }
  }
  return mask;
}

export function addToMask(base: Uint8Array, addition: Uint8Array): Uint8Array {
  const result = new Uint8Array(base.length);
  for (let i = 0; i < base.length; i++) {
    result[i] = base[i] | addition[i];
  }
  return result;
}

export function subtractFromMask(
  base: Uint8Array,
  subtraction: Uint8Array
): Uint8Array {
  const result = new Uint8Array(base.length);
  for (let i = 0; i < base.length; i++) {
    result[i] = base[i] & (subtraction[i] ^ 1);
  }
  return result;
}

export function eraseSelectedPixels(
  sourceDataUrl: string,
  mask: Uint8Array,
  width: number,
  height: number
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("no 2d context"));
        return;
      }
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, width, height);
      for (let i = 0; i < mask.length; i++) {
        if (mask[i]) imageData.data[i * 4 + 3] = 0;
      }
      ctx.putImageData(imageData, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = reject;
    img.src = sourceDataUrl;
  });
}
