import type Konva from "konva";
import { Blur } from "konva/lib/filters/Blur";
import { Brighten } from "konva/lib/filters/Brighten";
import { Contrast } from "konva/lib/filters/Contrast";
import { Enhance } from "konva/lib/filters/Enhance";
import { Grayscale } from "konva/lib/filters/Grayscale";
import { HSL } from "konva/lib/filters/HSL";
import { Invert } from "konva/lib/filters/Invert";
import { Sepia } from "konva/lib/filters/Sepia";
import type { Filter } from "konva/lib/Node";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  Ellipse,
  Group,
  Image,
  Rect,
  RegularPolygon,
  Star,
  Text,
} from "react-konva";
import { applySvgColorMap } from "@/components/editor/svg-properties";
import type {
  AnimatedImageLayer as AnimatedImageLayerType,
  DrawLayer as DrawLayerType,
  Layer as EditorLayer,
  ImageLayer as ImageLayerType,
  LayerAdjustments,
  ShapeLayer as ShapeLayerType,
  SvgLayer as SvgLayerType,
  TextLayer as TextLayerType,
} from "@/stores/use-editor-store";

interface LayerRenderProps {
  layer: EditorLayer;
  activeTool: string;
  isActive: boolean;
  imageCache: React.MutableRefObject<Map<string, HTMLImageElement>>;
  onDragStart: (e: Konva.KonvaEventObject<DragEvent>) => void;
  onDragMove: (e: Konva.KonvaEventObject<DragEvent>) => void;
  onDragEnd: (e: Konva.KonvaEventObject<DragEvent>, layerId: string) => void;
  onTransformStart: () => void;
  onTransformEnd: (
    e: Konva.KonvaEventObject<Event>,
    layer: EditorLayer
  ) => void;
  onSelect: (layerId: string) => void;
  onDblClick?: (layerId: string) => void;
}

// Helper to draw a rounded rect path for clipping
function drawRoundedRectPath(
  ctx: {
    beginPath(): void;
    moveTo(x: number, y: number): void;
    lineTo(x: number, y: number): void;
    arcTo(x1: number, y1: number, x2: number, y2: number, r: number): void;
    closePath(): void;
  },
  width: number,
  height: number,
  cornerRadius: number | [number, number, number, number]
) {
  const radii = Array.isArray(cornerRadius)
    ? cornerRadius
    : [cornerRadius, cornerRadius, cornerRadius, cornerRadius];
  const [tl, tr, br, bl] = radii;

  ctx.beginPath();
  ctx.moveTo(tl, 0);
  ctx.lineTo(width - tr, 0);
  ctx.arcTo(width, 0, width, tr, tr);
  ctx.lineTo(width, height - br);
  ctx.arcTo(width, height, width - br, height, br);
  ctx.lineTo(bl, height);
  ctx.arcTo(0, height, 0, height - bl, bl);
  ctx.lineTo(0, tl);
  ctx.arcTo(0, 0, tl, 0, tl);
  ctx.closePath();
}

function hasNoAdjustments(adj: LayerAdjustments): boolean {
  return (
    adj.brightness === 0 &&
    adj.contrast === 0 &&
    adj.hue === 0 &&
    adj.saturation === 0 &&
    adj.blur === 0 &&
    (adj.sharpen ?? 0) === 0 &&
    !adj.invert &&
    !adj.sepia &&
    !adj.grayscale
  );
}

function applyKonvaFilters(
  node: Konva.Image,
  adj: LayerAdjustments | undefined
) {
  if (!adj || hasNoAdjustments(adj)) {
    node.filters([]);
    node.clearCache();
    return;
  }
  const filters: Filter[] = [];
  if (adj.brightness !== 0) filters.push(Brighten);
  if (adj.contrast !== 0) filters.push(Contrast);
  if (adj.hue !== 0 || adj.saturation !== 0) filters.push(HSL);
  if (adj.blur > 0) filters.push(Blur);
  if (adj.invert) filters.push(Invert);
  if (adj.sepia) filters.push(Sepia);
  if (adj.grayscale) filters.push(Grayscale);
  if ((adj.sharpen ?? 0) > 0) filters.push(Enhance);
  node.filters(filters);
  node.brightness(adj.brightness / 100);
  node.contrast(adj.contrast);
  node.hue(adj.hue);
  node.saturation(adj.saturation / 100);
  node.blurRadius(adj.blur);
  node.enhance(adj.sharpen ?? 0);
  node.cache();
}

function ImageLayerComponent(
  props: LayerRenderProps & { layer: ImageLayerType }
) {
  const {
    layer,
    activeTool,
    isActive,
    imageCache,
    onDragStart,
    onDragMove,
    onDragEnd,
    onTransformStart,
    onTransformEnd,
  } = props;
  const nodeRef = useRef<Konva.Image>(null);

  useEffect(() => {
    const node = nodeRef.current;
    if (!node) return;
    applyKonvaFilters(node, layer.adjustments);
  }, [layer.adjustments]);

  let image = imageCache.current.get(layer.dataUrl);
  if (!(image && image.crossOrigin)) {
    image = new window.Image();
    image.crossOrigin = "anonymous";
    image.src = layer.dataUrl;
    imageCache.current.set(layer.dataUrl, image);
  }

  const hasCornerRadius =
    (typeof layer.cornerRadius === "number" && layer.cornerRadius > 0) ||
    (Array.isArray(layer.cornerRadius) &&
      layer.cornerRadius.some((r: number) => r > 0));

  const hasGlow = (layer.glowSize ?? 0) > 0 && layer.glowColor;
  const shadowColor = hasGlow
    ? (layer.glowColor ?? layer.shadowColor)
    : layer.shadowColor;
  const shadowBlur = hasGlow ? (layer.glowSize ?? 0) : (layer.shadowBlur ?? 0);
  const shadowOffsetX = hasGlow ? 0 : (layer.shadowOffsetX ?? 0);
  const shadowOffsetY = hasGlow ? 0 : (layer.shadowOffsetY ?? 0);
  const hasShadow =
    !!shadowColor &&
    (shadowBlur > 0 || shadowOffsetX !== 0 || shadowOffsetY !== 0);

  const flipH = layer.flipHorizontal ?? false;
  const flipV = layer.flipVertical ?? false;

  // Fill mode: compute crop or fit offset
  const fillMode = layer.fillMode ?? "stretch";
  let cropProp:
    | { x: number; y: number; width: number; height: number }
    | undefined;
  let fitOffsetX = 0;
  let fitOffsetY = 0;
  let renderWidth = layer.width;
  let renderHeight = layer.height;

  if (fillMode !== "stretch" && image && image.naturalWidth) {
    const nw = image.naturalWidth;
    const nh = image.naturalHeight;
    const containerAspect = layer.width / layer.height;
    const imageAspect = nw / nh;

    if (fillMode === "fill") {
      if (imageAspect > containerAspect) {
        const srcH = nh;
        const srcW = nh * containerAspect;
        cropProp = { x: (nw - srcW) / 2, y: 0, width: srcW, height: srcH };
      } else {
        const srcW = nw;
        const srcH = nw / containerAspect;
        cropProp = { x: 0, y: (nh - srcH) / 2, width: srcW, height: srcH };
      }
    } else if (fillMode === "fit") {
      if (imageAspect > containerAspect) {
        renderWidth = layer.width;
        renderHeight = layer.width / imageAspect;
        fitOffsetY = (layer.height - renderHeight) / 2;
      } else {
        renderHeight = layer.height;
        renderWidth = layer.height * imageAspect;
        fitOffsetX = (layer.width - renderWidth) / 2;
      }
    }
  }

  const draggable = !layer.locked && activeTool === "select" && isActive;
  const commonGroupProps = {
    id: layer.id,
    key: layer.id,
    x: layer.x,
    y: layer.y,
    rotation: layer.rotation,
    scaleX: layer.scaleX,
    scaleY: layer.scaleY,
    opacity: layer.opacity,
    draggable,
    onDragStart,
    onDragMove,
    onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) => onDragEnd(e, layer.id),
    onTransformStart,
    onTransformEnd: (e: Konva.KonvaEventObject<Event>) =>
      onTransformEnd(e, layer),
    shadowColor: hasShadow ? shadowColor : undefined,
    shadowBlur: hasShadow ? shadowBlur : undefined,
    shadowOffsetX: hasShadow ? shadowOffsetX : undefined,
    shadowOffsetY: hasShadow ? shadowOffsetY : undefined,
    shadowEnabled: hasShadow,
  };

  const innerGroupProps = {
    clipFunc: hasCornerRadius
      ? (ctx: {
          beginPath(): void;
          moveTo(x: number, y: number): void;
          lineTo(x: number, y: number): void;
          arcTo(
            x1: number,
            y1: number,
            x2: number,
            y2: number,
            r: number
          ): void;
          closePath(): void;
        }) =>
          drawRoundedRectPath(
            ctx,
            layer.width,
            layer.height,
            layer.cornerRadius
          )
      : undefined,
    scaleX: flipH ? -1 : 1,
    scaleY: flipV ? -1 : 1,
    offsetX: flipH ? layer.width : 0,
    offsetY: flipV ? layer.height : 0,
  };

  return (
    <Group {...commonGroupProps}>
      <Group {...innerGroupProps}>
        <Image
          crop={cropProp}
          height={renderHeight}
          image={image}
          ref={nodeRef}
          width={renderWidth}
          x={fitOffsetX}
          y={fitOffsetY}
        />
      </Group>
    </Group>
  );
}

export function renderImageLayer(
  props: LayerRenderProps & { layer: ImageLayerType }
) {
  return <ImageLayerComponent {...props} />;
}

function applyTextTransform(
  text: string,
  transform?: TextLayerType["textTransform"]
): string {
  if (!transform || transform === "none") return text;
  if (transform === "uppercase") return text.toUpperCase();
  if (transform === "lowercase") return text.toLowerCase();
  if (transform === "capitalize")
    return text.replace(/\b\w/g, (c) => c.toUpperCase());
  return text;
}

function TextLayerComponent(
  props: LayerRenderProps & { layer: TextLayerType }
) {
  const {
    layer,
    activeTool,
    isActive,
    onDragStart,
    onDragMove,
    onDragEnd,
    onTransformStart,
    onTransformEnd,
  } = props;

  const textRef = useRef<Konva.Text>(null);
  const [bgSize, setBgSize] = useState({ width: 0, height: 0 });

  useLayoutEffect(() => {
    if (textRef.current && layer.backgroundColor) {
      setBgSize({
        width: textRef.current.width(),
        height: textRef.current.height(),
      });
    }
  }, [
    layer.text,
    layer.fontSize,
    layer.fontFamily,
    layer.fontStyle,
    layer.lineHeight,
    layer.letterSpacing,
    layer.backgroundColor,
    layer.textTransform,
  ]);

  const displayText = applyTextTransform(layer.text, layer.textTransform);
  const padding = layer.backgroundPadding ?? 4;

  // When glow is active it overrides shadow (Konva only supports one shadow)
  const hasGlow = (layer.glowSize ?? 0) > 0 && layer.glowColor;
  const shadowColor = hasGlow
    ? (layer.glowColor ?? layer.shadowColor)
    : layer.shadowColor;
  const shadowBlur = hasGlow ? (layer.glowSize ?? 0) : layer.shadowBlur;
  const shadowOffsetX = hasGlow ? 0 : layer.shadowOffsetX;
  const shadowOffsetY = hasGlow ? 0 : layer.shadowOffsetY;

  const textNode = (
    <Text
      align={layer.align ?? "left"}
      draggable={!layer.locked && activeTool === "select" && isActive}
      fill={layer.fill}
      fontFamily={layer.fontFamily}
      fontSize={layer.fontSize}
      fontStyle={layer.fontStyle}
      id={layer.id}
      key={layer.id}
      letterSpacing={layer.letterSpacing ?? 0}
      lineHeight={layer.lineHeight ?? 1}
      onDblClick={() => props.onDblClick?.(layer.id)}
      onDragEnd={(e) => onDragEnd(e, layer.id)}
      onDragMove={onDragMove}
      onDragStart={onDragStart}
      onTransformEnd={(e) => onTransformEnd(e, layer)}
      onTransformStart={onTransformStart}
      opacity={layer.opacity}
      ref={textRef}
      rotation={layer.rotation}
      shadowBlur={shadowBlur}
      shadowColor={shadowColor}
      shadowOffsetX={shadowOffsetX}
      shadowOffsetY={shadowOffsetY}
      stroke={layer.stroke}
      strokeWidth={layer.strokeWidth}
      text={displayText}
      textDecoration={layer.textDecoration ?? ""}
      width={layer.width ?? 300}
      wrap="word"
      x={layer.x}
      y={layer.y}
    />
  );

  const hasBackground =
    !!layer.backgroundColor && layer.backgroundColor.trim() !== "";
  if (!hasBackground || bgSize.width === 0) {
    return textNode;
  }

  return (
    <Group
      draggable={!layer.locked && activeTool === "select" && isActive}
      id={layer.id}
      key={layer.id}
      onDragEnd={(e) => onDragEnd(e, layer.id)}
      onDragMove={onDragMove}
      onDragStart={onDragStart}
      onTransformEnd={(e) => onTransformEnd(e, layer)}
      onTransformStart={onTransformStart}
      opacity={layer.opacity}
      rotation={layer.rotation}
      x={layer.x}
      y={layer.y}
    >
      <Rect
        cornerRadius={layer.backgroundCornerRadius ?? 0}
        fill={layer.backgroundColor}
        height={bgSize.height + padding * 2}
        width={bgSize.width + padding * 2}
        x={-padding}
        y={-padding}
      />
      <Text
        align={layer.align ?? "left"}
        fill={layer.fill}
        fontFamily={layer.fontFamily}
        fontSize={layer.fontSize}
        fontStyle={layer.fontStyle}
        letterSpacing={layer.letterSpacing ?? 0}
        lineHeight={layer.lineHeight ?? 1}
        onDblClick={() => props.onDblClick?.(layer.id)}
        ref={textRef}
        shadowBlur={shadowBlur}
        shadowColor={shadowColor}
        shadowOffsetX={shadowOffsetX}
        shadowOffsetY={shadowOffsetY}
        stroke={layer.stroke}
        strokeWidth={layer.strokeWidth}
        text={displayText}
        textDecoration={layer.textDecoration ?? ""}
        width={layer.width ?? 300}
        wrap="word"
      />
    </Group>
  );
}

export function renderTextLayer(
  props: LayerRenderProps & { layer: TextLayerType }
) {
  return <TextLayerComponent {...props} />;
}

export function renderShapeLayer(
  props: LayerRenderProps & { layer: ShapeLayerType }
) {
  const {
    layer,
    activeTool,
    isActive: _isActive,
    onDragStart,
    onDragMove,
    onDragEnd,
    onTransformStart,
    onTransformEnd,
    onSelect: _onSelect,
  } = props;

  const commonProps = {
    id: layer.id,
    x: layer.x,
    y: layer.y,
    rotation: layer.rotation,
    opacity: layer.opacity,
    draggable: !layer.locked && activeTool === "select",
    onDragStart,
    onDragMove,
    onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) => onDragEnd(e, layer.id),
    onTransformStart,
    onTransformEnd: (e: Konva.KonvaEventObject<Event>) =>
      onTransformEnd(e, layer),
  };

  if (layer.shapeType === "ellipse") {
    return (
      <Ellipse
        key={layer.id}
        {...commonProps}
        fill={layer.fill}
        radiusX={layer.width / 2}
        radiusY={layer.height / 2}
        scaleX={layer.scaleX}
        scaleY={layer.scaleY}
        stroke={layer.stroke}
        strokeWidth={layer.strokeWidth}
      />
    );
  }

  if (layer.shapeType === "polygon") {
    const radius = Math.min(layer.width, layer.height) / 2;
    return (
      <RegularPolygon
        key={layer.id}
        {...commonProps}
        fill={layer.fill}
        radius={radius}
        scaleX={layer.scaleX}
        scaleY={layer.scaleY}
        sides={layer.sides ?? 6}
        stroke={layer.stroke}
        strokeWidth={layer.strokeWidth}
      />
    );
  }

  if (layer.shapeType === "star") {
    const outerRadius = Math.min(layer.width, layer.height) / 2;
    const innerRadius = outerRadius * (layer.innerRadiusRatio ?? 0.5);
    return (
      <Star
        key={layer.id}
        {...commonProps}
        fill={layer.fill}
        innerRadius={innerRadius}
        numPoints={layer.starPoints ?? 5}
        outerRadius={outerRadius}
        scaleX={layer.scaleX}
        scaleY={layer.scaleY}
        stroke={layer.stroke}
        strokeWidth={layer.strokeWidth}
      />
    );
  }

  return (
    <Rect
      key={layer.id}
      {...commonProps}
      cornerRadius={layer.cornerRadius}
      fill={layer.fill}
      height={layer.height}
      scaleX={layer.scaleX}
      scaleY={layer.scaleY}
      stroke={layer.stroke}
      strokeWidth={layer.strokeWidth}
      width={layer.width}
    />
  );
}

// Animated Image Layer Component for frame-by-frame animation
function AnimatedImageLayerComponent({
  layer,
  activeTool,
  isActive,
  imageCache,
  onDragStart,
  onDragMove,
  onDragEnd,
  onTransformStart,
  onTransformEnd,
  onSelect: _onSelect,
}: LayerRenderProps & { layer: AnimatedImageLayerType }) {
  const [currentFrameIndex, setCurrentFrameIndex] = useState(0);
  const animationRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef<number>(0);
  const nodeRef = useRef<Konva.Image>(null);

  // Preload all frames into cache
  useEffect(() => {
    for (const frameUrl of layer.frames) {
      const cached = imageCache.current.get(frameUrl);
      if (!(cached && cached.crossOrigin)) {
        const img = new window.Image();
        img.crossOrigin = "anonymous";
        img.src = frameUrl;
        imageCache.current.set(frameUrl, img);
      }
    }
  }, [layer.frames, imageCache]);

  // Animation loop
  useEffect(() => {
    if (layer.frames.length <= 1 || !layer.visible) {
      return;
    }

    const animate = (timestamp: number) => {
      if (!lastFrameTimeRef.current) {
        lastFrameTimeRef.current = timestamp;
      }

      const elapsed = timestamp - lastFrameTimeRef.current;
      const currentDelay = layer.delays[currentFrameIndex] || 100;

      if (elapsed >= currentDelay) {
        setCurrentFrameIndex((prev) => (prev + 1) % layer.frames.length);
        lastFrameTimeRef.current = timestamp;
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [layer.frames.length, layer.delays, layer.visible, currentFrameIndex]);

  useEffect(() => {
    const node = nodeRef.current;
    if (!node) return;
    applyKonvaFilters(node, layer.adjustments);
  }, [layer.adjustments]);

  const currentFrameUrl = layer.frames[currentFrameIndex];
  const image = imageCache.current.get(currentFrameUrl);

  // If image not loaded yet, try to get it
  if (!(image && image.crossOrigin)) {
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.src = currentFrameUrl;
    imageCache.current.set(currentFrameUrl, img);
  }

  const hasCornerRadius =
    (typeof layer.cornerRadius === "number" && layer.cornerRadius > 0) ||
    (Array.isArray(layer.cornerRadius) &&
      layer.cornerRadius.some((r: number) => r > 0));

  if (!hasCornerRadius) {
    return (
      <Image
        draggable={!layer.locked && activeTool === "select" && isActive}
        height={layer.height}
        id={layer.id}
        image={image}
        key={layer.id}
        onDragEnd={(e) => onDragEnd(e, layer.id)}
        onDragMove={onDragMove}
        onDragStart={onDragStart}
        onTransformEnd={(e) => onTransformEnd(e, layer)}
        onTransformStart={onTransformStart}
        opacity={layer.opacity}
        ref={nodeRef}
        rotation={layer.rotation}
        scaleX={layer.scaleX}
        scaleY={layer.scaleY}
        width={layer.width}
        x={layer.x}
        y={layer.y}
      />
    );
  }

  return (
    <Group
      clipFunc={(ctx) => {
        drawRoundedRectPath(ctx, layer.width, layer.height, layer.cornerRadius);
      }}
      draggable={!layer.locked && activeTool === "select" && isActive}
      id={layer.id}
      key={layer.id}
      onDragEnd={(e) => onDragEnd(e, layer.id)}
      onDragMove={onDragMove}
      onDragStart={onDragStart}
      onTransformEnd={(e) => onTransformEnd(e, layer)}
      onTransformStart={onTransformStart}
      opacity={layer.opacity}
      rotation={layer.rotation}
      scaleX={layer.scaleX}
      scaleY={layer.scaleY}
      x={layer.x}
      y={layer.y}
    >
      <Image
        height={layer.height}
        image={image}
        ref={nodeRef}
        width={layer.width}
      />
    </Group>
  );
}

export function renderAnimatedImageLayer(
  props: LayerRenderProps & { layer: AnimatedImageLayerType }
) {
  return <AnimatedImageLayerComponent {...props} key={props.layer.id} />;
}

function DrawLayerComponent(
  props: LayerRenderProps & { layer: DrawLayerType }
) {
  const {
    layer,
    activeTool,
    isActive,
    imageCache,
    onDragStart,
    onDragMove,
    onDragEnd,
    onTransformStart,
    onTransformEnd,
  } = props;
  const nodeRef = useRef<Konva.Image>(null);

  useEffect(() => {
    const node = nodeRef.current;
    if (!node) return;
    applyKonvaFilters(node, layer.adjustments);
  }, [layer.adjustments]);

  let image = imageCache.current.get(layer.dataUrl);
  if (!(image && image.crossOrigin)) {
    image = new window.Image();
    image.crossOrigin = "anonymous";
    image.src = layer.dataUrl;
    imageCache.current.set(layer.dataUrl, image);
  }

  return (
    <Image
      draggable={!layer.locked && activeTool === "select" && isActive}
      height={layer.height}
      id={layer.id}
      image={image}
      key={layer.id}
      onDragEnd={(e) => onDragEnd(e, layer.id)}
      onDragMove={onDragMove}
      onDragStart={onDragStart}
      onTransformEnd={(e) => onTransformEnd(e, layer)}
      onTransformStart={onTransformStart}
      opacity={layer.opacity}
      ref={nodeRef}
      rotation={layer.rotation}
      scaleX={layer.scaleX}
      scaleY={layer.scaleY}
      width={layer.width}
      x={layer.x}
      y={layer.y}
    />
  );
}

export function renderDrawLayer(
  props: LayerRenderProps & { layer: DrawLayerType }
) {
  return <DrawLayerComponent {...props} />;
}

// ---- SVG Layer ----

function svgToDataUrl(svgString: string): string {
  return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svgString)))}`;
}

function SvgLayerComponent(props: LayerRenderProps & { layer: SvgLayerType }) {
  const {
    layer,
    activeTool,
    isActive,
    imageCache,
    onDragStart,
    onDragMove,
    onDragEnd,
    onTransformStart,
    onTransformEnd,
  } = props;

  const nodeRef = useRef<Konva.Image>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);

  const cacheKey = `svg:${layer.id}:${JSON.stringify(layer.colorMap)}`;

  useEffect(() => {
    const cached = imageCache.current.get(cacheKey);
    if (cached) {
      setImage(cached);
      return;
    }
    const modified = applySvgColorMap(layer.svgString, layer.colorMap);
    const dataUrl = svgToDataUrl(modified);
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      imageCache.current.set(cacheKey, img);
      setImage(img);
    };
    img.src = dataUrl;
  }, [cacheKey, layer.svgString, layer.colorMap, imageCache]);

  // Always render the node so Konva registers #id for the Transformer,
  // even while the image is still loading. image={undefined} renders nothing visible.
  return (
    <Image
      draggable={!layer.locked && activeTool === "select" && isActive}
      height={layer.height}
      id={layer.id}
      image={image ?? undefined}
      key={layer.id}
      onDragEnd={(e) => onDragEnd(e, layer.id)}
      onDragMove={onDragMove}
      onDragStart={onDragStart}
      onTransformEnd={(e) => onTransformEnd(e, layer)}
      onTransformStart={onTransformStart}
      opacity={layer.opacity}
      ref={nodeRef}
      rotation={layer.rotation}
      scaleX={layer.scaleX}
      scaleY={layer.scaleY}
      width={layer.width}
      x={layer.x}
      y={layer.y}
    />
  );
}

export function renderSvgLayer(
  props: LayerRenderProps & { layer: SvgLayerType }
) {
  return <SvgLayerComponent {...props} />;
}
