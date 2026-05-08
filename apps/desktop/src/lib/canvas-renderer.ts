import type { Layer, LayerAdjustments } from "@/stores/use-editor-store";

function wordWrapLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number | undefined
): string[] {
  const paragraphs = text.split("\n");
  if (!maxWidth) return paragraphs;
  const result: string[] = [];
  for (const paragraph of paragraphs) {
    if (paragraph === "") {
      result.push("");
      continue;
    }
    const words = paragraph.split(" ");
    let current = "";
    for (const word of words) {
      const test = current ? `${current} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth && current) {
        result.push(current);
        current = word;
      } else {
        current = test;
      }
    }
    result.push(current);
  }
  return result;
}

function buildCSSFilter(adj: LayerAdjustments): string {
  const parts: string[] = [];
  if (adj.brightness !== 0)
    parts.push(`brightness(${1 + adj.brightness / 100})`);
  if (adj.contrast !== 0) parts.push(`contrast(${100 + adj.contrast}%)`);
  if (adj.hue !== 0) parts.push(`hue-rotate(${adj.hue}deg)`);
  if (adj.saturation !== 0)
    parts.push(`saturate(${Math.max(0, 1 + adj.saturation / 100)})`);
  if (adj.blur > 0) parts.push(`blur(${adj.blur}px)`);
  if (adj.invert) parts.push("invert(1)");
  if (adj.sepia) parts.push("sepia(1)");
  if (adj.grayscale) parts.push("grayscale(1)");
  return parts.join(" ");
}

function applyConvolutionSharpen(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  amount: number
): void {
  if (amount <= 0 || w < 3 || h < 3) return;
  const imageData = ctx.getImageData(x, y, w, h);
  const src = new Uint8ClampedArray(imageData.data);
  const dst = imageData.data;
  const k = amount * 1.5;
  const kernel = [0, -k, 0, -k, 1 + 4 * k, -k, 0, -k, 0];

  for (let row = 1; row < h - 1; row++) {
    for (let col = 1; col < w - 1; col++) {
      const idx = (row * w + col) * 4;
      for (let c = 0; c < 3; c++) {
        let val = 0;
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            val +=
              src[((row + ky) * w + (col + kx)) * 4 + c] *
              kernel[(ky + 1) * 3 + (kx + 1)];
          }
        }
        dst[idx + c] = Math.max(0, Math.min(255, Math.round(val)));
      }
    }
  }
  ctx.putImageData(imageData, x, y);
}

export async function renderLayersToCanvas(
  layers: Layer[],
  width: number,
  height: number,
  canvas: HTMLCanvasElement
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  // Clear canvas
  ctx.clearRect(0, 0, width, height);

  for (const layer of layers) {
    if (!layer.visible) continue;

    ctx.save();

    // Apply common transforms
    ctx.translate(layer.x, layer.y);
    ctx.rotate((layer.rotation * Math.PI) / 180);
    ctx.scale(layer.scaleX || 1, layer.scaleY || 1);
    ctx.globalAlpha = layer.opacity;

    if (layer.type === "shape") {
      ctx.fillStyle = layer.fill;
      if (layer.shapeType === "rect") {
        if (layer.cornerRadius) {
          // Simplified rounded rect
          ctx.beginPath();
          ctx.roundRect(0, 0, layer.width, layer.height, layer.cornerRadius);
          ctx.fill();
        } else {
          ctx.fillRect(0, 0, layer.width, layer.height);
        }
        if (layer.strokeWidth > 0) {
          ctx.strokeStyle = layer.stroke;
          ctx.lineWidth = layer.strokeWidth;
          ctx.strokeRect(0, 0, layer.width, layer.height);
        }
      } else if (layer.shapeType === "ellipse") {
        ctx.beginPath();
        ctx.ellipse(
          layer.width / 2,
          layer.height / 2,
          layer.width / 2,
          layer.height / 2,
          0,
          0,
          Math.PI * 2
        );
        ctx.fill();
        if (layer.strokeWidth > 0) {
          ctx.strokeStyle = layer.stroke;
          ctx.lineWidth = layer.strokeWidth;
          ctx.stroke();
        }
      }
    } else if (
      layer.type === "image" ||
      layer.type === "draw" ||
      layer.type === "animated-image"
    ) {
      const img = new Image();
      // For animated images, use the current frame or the first frame
      if (layer.type === "animated-image") {
        const frameIndex = layer.currentFrame ?? 0;
        img.src = layer.frames[frameIndex];
      } else {
        img.src = layer.dataUrl;
      }

      await new Promise((resolve) => {
        img.onload = () => {
          const adj = (layer as { adjustments?: LayerAdjustments }).adjustments;
          const filterStr = adj ? buildCSSFilter(adj) : "";
          const needsSharpen = (adj?.sharpen ?? 0) > 0;

          let source: HTMLImageElement | HTMLCanvasElement = img;
          if (needsSharpen) {
            const offscreen = document.createElement("canvas");
            offscreen.width = layer.width;
            offscreen.height = layer.height;
            const offCtx = offscreen.getContext("2d");
            if (offCtx) {
              offCtx.drawImage(img, 0, 0, layer.width, layer.height);
              applyConvolutionSharpen(
                offCtx,
                0,
                0,
                layer.width,
                layer.height,
                adj?.sharpen ?? 0
              );
              source = offscreen;
            }
          }

          if (filterStr) ctx.filter = filterStr;
          const cornerRadius = "cornerRadius" in layer ? layer.cornerRadius : 0;
          if (cornerRadius) {
            ctx.save();
            ctx.beginPath();
            ctx.roundRect(0, 0, layer.width, layer.height, cornerRadius);
            ctx.clip();
            ctx.drawImage(source, 0, 0, layer.width, layer.height);
            ctx.restore();
          } else {
            ctx.drawImage(source, 0, 0, layer.width, layer.height);
          }
          if (filterStr) ctx.filter = "none";
          resolve(null);
        };
        img.onerror = () => resolve(null);
      });
    } else if (layer.type === "text") {
      const fontStyle = layer.fontStyle || "normal";
      ctx.font = `${fontStyle} ${layer.fontSize}px ${layer.fontFamily || "Inter, sans-serif"}`;
      ctx.textBaseline = "top";
      ctx.textAlign = (layer.align as CanvasTextAlign) || "left";

      // Apply letter spacing if supported
      if ("letterSpacing" in ctx) {
        (
          ctx as CanvasRenderingContext2D & { letterSpacing: string }
        ).letterSpacing = `${layer.letterSpacing ?? 0}px`;
      }

      // Apply text transform
      let displayText = layer.text;
      const tt = layer.textTransform;
      if (tt === "uppercase") displayText = displayText.toUpperCase();
      else if (tt === "lowercase") displayText = displayText.toLowerCase();
      else if (tt === "capitalize")
        displayText = displayText.replace(/\b\w/g, (c) => c.toUpperCase());

      // Glow overrides shadow
      const hasGlow = (layer.glowSize ?? 0) > 0 && layer.glowColor;
      if (hasGlow) {
        ctx.shadowColor = layer.glowColor ?? "transparent";
        ctx.shadowBlur = layer.glowSize ?? 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
      } else if (layer.shadowBlur > 0) {
        ctx.shadowColor = layer.shadowColor;
        ctx.shadowBlur = layer.shadowBlur;
        ctx.shadowOffsetX = layer.shadowOffsetX;
        ctx.shadowOffsetY = layer.shadowOffsetY;
      }

      const lineH = layer.lineHeight ?? 1;
      const lines = wordWrapLines(ctx, displayText, layer.width);
      const lineHeightPx = layer.fontSize * lineH;

      // Background
      if (
        layer.backgroundColor &&
        layer.backgroundColor !== "#00000000" &&
        !layer.backgroundColor.match(/,\s*0\)$/)
      ) {
        const pad = layer.backgroundPadding ?? 4;
        const maxWidth = Math.max(
          ...lines.map((l) => ctx.measureText(l).width)
        );
        const totalHeight = lines.length * lineHeightPx;
        ctx.save();
        ctx.shadowColor = "transparent";
        ctx.shadowBlur = 0;
        ctx.fillStyle = layer.backgroundColor;
        const bgRadius = layer.backgroundCornerRadius ?? 0;
        if (bgRadius > 0) {
          ctx.beginPath();
          ctx.roundRect(
            -pad,
            -pad,
            maxWidth + pad * 2,
            totalHeight + pad * 2,
            bgRadius
          );
          ctx.fill();
        } else {
          ctx.fillRect(-pad, -pad, maxWidth + pad * 2, totalHeight + pad * 2);
        }
        ctx.restore();
        // Re-apply shadow after background
        if (hasGlow) {
          ctx.shadowColor = layer.glowColor ?? "transparent";
          ctx.shadowBlur = layer.glowSize ?? 0;
          ctx.shadowOffsetX = 0;
          ctx.shadowOffsetY = 0;
        } else if (layer.shadowBlur > 0) {
          ctx.shadowColor = layer.shadowColor;
          ctx.shadowBlur = layer.shadowBlur;
          ctx.shadowOffsetX = layer.shadowOffsetX;
          ctx.shadowOffsetY = layer.shadowOffsetY;
        }
      }

      ctx.fillStyle = layer.fill;
      for (let i = 0; i < lines.length; i++) {
        const y = i * lineHeightPx;
        ctx.fillText(lines[i], 0, y);

        // Underline / strikethrough
        if (layer.textDecoration) {
          const metrics = ctx.measureText(lines[i]);
          const tw = metrics.width;
          ctx.save();
          ctx.shadowColor = "transparent";
          ctx.shadowBlur = 0;
          ctx.strokeStyle = layer.fill;
          ctx.lineWidth = Math.max(1, layer.fontSize / 15);
          if (layer.textDecoration.includes("underline")) {
            const uy = y + layer.fontSize * 1.1;
            ctx.beginPath();
            ctx.moveTo(0, uy);
            ctx.lineTo(tw, uy);
            ctx.stroke();
          }
          if (layer.textDecoration.includes("line-through")) {
            const sy = y + layer.fontSize * 0.55;
            ctx.beginPath();
            ctx.moveTo(0, sy);
            ctx.lineTo(tw, sy);
            ctx.stroke();
          }
          ctx.restore();
        }
      }

      if (layer.strokeWidth > 0) {
        ctx.strokeStyle = layer.stroke;
        ctx.lineWidth = layer.strokeWidth;
        for (let i = 0; i < lines.length; i++) {
          ctx.strokeText(lines[i], 0, i * lineHeightPx);
        }
      }
    }

    ctx.restore();
  }
}
