import type { Layer, LayerAdjustments } from "@/stores/use-editor-store";

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
          if (filterStr) ctx.filter = filterStr;
          const cornerRadius = "cornerRadius" in layer ? layer.cornerRadius : 0;
          if (cornerRadius) {
            ctx.save();
            ctx.beginPath();
            ctx.roundRect(0, 0, layer.width, layer.height, cornerRadius);
            ctx.clip();
            ctx.drawImage(img, 0, 0, layer.width, layer.height);
            ctx.restore();
          } else {
            ctx.drawImage(img, 0, 0, layer.width, layer.height);
          }
          if (filterStr) ctx.filter = "none";
          resolve(null);
        };
        img.onerror = () => resolve(null);
      });
    } else if (layer.type === "text") {
      const fontStyle = layer.fontStyle || "normal";
      ctx.font = `${fontStyle} ${layer.fontSize}px ${layer.fontFamily || "Inter, sans-serif"}`;
      ctx.fillStyle = layer.fill;
      ctx.textBaseline = "top";

      if (layer.shadowBlur > 0) {
        ctx.shadowColor = layer.shadowColor;
        ctx.shadowBlur = layer.shadowBlur;
        ctx.shadowOffsetX = layer.shadowOffsetX;
        ctx.shadowOffsetY = layer.shadowOffsetY;
      }

      ctx.fillText(layer.text, 0, 0);

      if (layer.strokeWidth > 0) {
        ctx.strokeStyle = layer.stroke;
        ctx.lineWidth = layer.strokeWidth;
        ctx.strokeText(layer.text, 0, 0);
      }
    }

    ctx.restore();
  }
}
