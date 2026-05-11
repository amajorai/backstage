import { useRef } from "react";
import { Layer, Rect, Stage } from "react-konva";
import {
  renderAnimatedImageLayer,
  renderDrawLayer,
  renderImageLayer,
  renderShapeLayer,
  renderSvgLayer,
  renderTextLayer,
} from "@/components/editor/layer-renderers";
import type {
  AnimatedImageLayer,
  DrawLayer,
  Layer as EditorLayer,
  ImageLayer,
  ShapeLayer,
  SvgLayer,
  TextLayer,
} from "@/stores/use-editor-store";

interface StaticPageCanvasProps {
  layers: EditorLayer[];
  canvasWidth: number;
  canvasHeight: number;
  scale: number;
  onClick?: () => void;
}

const noop = () => {};
const noopDragEnd = (_e: unknown, _id: string) => {};
const noopTransformEnd = (_e: unknown, _l: unknown) => {};

function StaticLayerNode({
  layer,
  imageCache,
}: {
  layer: EditorLayer;
  imageCache: React.MutableRefObject<Map<string, HTMLImageElement>>;
}) {
  const baseProps = {
    activeTool: "select" as const,
    isActive: false,
    imageCache,
    onDragStart: noop,
    onDragMove: noop,
    onDragEnd: noopDragEnd,
    onTransformStart: noop,
    onTransformEnd: noopTransformEnd,
    onSelect: noop,
    onDblClick: noop,
  };

  switch (layer.type) {
    case "image":
      return renderImageLayer({ ...baseProps, layer: layer as ImageLayer });
    case "text":
      return renderTextLayer({ ...baseProps, layer: layer as TextLayer });
    case "shape":
      return renderShapeLayer({ ...baseProps, layer: layer as ShapeLayer });
    case "animated-image":
      return renderAnimatedImageLayer({
        ...baseProps,
        layer: layer as AnimatedImageLayer,
      });
    case "draw":
      return renderDrawLayer({ ...baseProps, layer: layer as DrawLayer });
    case "svg":
      return renderSvgLayer({ ...baseProps, layer: layer as SvgLayer });
    default:
      return null;
  }
}

export function StaticPageCanvas({
  layers,
  canvasWidth,
  canvasHeight,
  scale,
  onClick,
}: StaticPageCanvasProps) {
  const imageCache = useRef<Map<string, HTMLImageElement>>(new Map());
  const visibleLayers = layers.filter((l) => l.visible && l.type !== "group");

  return (
    <div
      onClick={onClick}
      style={{ lineHeight: 0, cursor: onClick ? "pointer" : "default" }}
    >
      <Stage
        height={canvasHeight * scale}
        listening={false}
        scaleX={scale}
        scaleY={scale}
        width={canvasWidth * scale}
      >
        <Layer>
          <Rect
            fill="white"
            height={canvasHeight}
            width={canvasWidth}
            x={0}
            y={0}
          />
          {visibleLayers.map((layer) => (
            <StaticLayerNode
              imageCache={imageCache}
              key={layer.id}
              layer={layer}
            />
          ))}
        </Layer>
      </Stage>
    </div>
  );
}
