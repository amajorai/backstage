import Konva from "konva";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Circle,
  Group,
  Image as KonvaImage,
  Layer,
  Line,
  Rect,
  Stage,
  Transformer,
} from "react-konva";
import { toast } from "sonner";
import {
  renderAnimatedImageLayer,
  renderDrawLayer,
  renderImageLayer,
  renderShapeLayer,
  renderSvgLayer,
  renderTextLayer,
} from "@/components/editor/layer-renderers";
import type { SelectionSegments } from "@/lib/magic-select";
import {
  type AnimatedImageLayer as AnimatedImageLayerType,
  type DrawLayer as DrawLayerType,
  type Layer as EditorLayer,
  type ImageLayer as ImageLayerType,
  type ShapeLayer as ShapeLayerType,
  type SvgLayer as SvgLayerType,
  type TextLayer as TextLayerType,
  useEditorStore,
} from "@/stores/use-editor-store";

interface MagicSelection {
  mask: Uint8Array;
  segments: SelectionSegments;
  layerId: string;
  imgW: number;
  imgH: number;
  layerX: number;
  layerY: number;
  layerScaleX: number;
  layerScaleY: number;
}

interface ContextMenu {
  x: number;
  y: number;
  canvasX: number;
  canvasY: number;
  layerId: string | null;
}

interface KonvaCanvasProps {
  width: number;
  height: number;
  scale?: number;
  onExportRef?: React.MutableRefObject<(() => string) | null>;
  startPendingGuideRef?: React.MutableRefObject<
    ((type: "h" | "v") => void) | null
  >;
  workspaceWidth: number;
  workspaceHeight: number;
  showGrid?: boolean;
  panOffset?: { x: number; y: number };
}

const SNAP_THRESHOLD = 20;
const UI_COLOR = "oklch(0.685 0.169 237.323)";

/** Returns the effective width/height of a layer. */
function getLayerDimensions(l: EditorLayer): { w: number; h: number } {
  if (l.type === "text") return { w: l.width ?? 300, h: 0 };
  return { w: l.width, h: l.height };
}

function resolveClickedLayerId(target: Konva.Node): string {
  let node: Konva.Node | null = target;
  while (node && node.nodeType !== "Stage" && node.nodeType !== "Layer") {
    const id = node.id();
    if (id) return id;
    node = node.parent as Konva.Node | null;
  }
  return "";
}

interface SnapGuides {
  vertical: number[];
  horizontal: number[];
}

interface SelectionBox {
  startX: number;
  startY: number;
  width: number;
  height: number;
}

interface PaintPreviewProps {
  x: number;
  y: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
  width: number;
  height: number;
  targetLayerId: string;
}

export function KonvaCanvas({
  width,
  height,
  scale = 1,
  onExportRef,
  startPendingGuideRef,
  workspaceWidth,
  workspaceHeight,
  showGrid = false,
  panOffset,
}: KonvaCanvasProps) {
  const inv = 1 / scale;
  const offsetX = (workspaceWidth - width * scale) / 2 + (panOffset?.x ?? 0);
  const offsetY = (workspaceHeight - height * scale) / 2 + (panOffset?.y ?? 0);
  const toCanvasPos = (p: { x: number; y: number }) => ({
    x: (p.x - offsetX) / scale,
    y: (p.y - offsetY) / scale,
  });
  const stageRef = useRef<Konva.Stage>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  const cornerHandlesGroupRef = useRef<Konva.Group>(null);
  const imageCache = useRef<Map<string, HTMLImageElement>>(new Map());
  const stageContainerRef = useRef<HTMLDivElement>(null);
  const [snapGuides, setSnapGuides] = useState<SnapGuides>({
    vertical: [],
    horizontal: [],
  });
  const [pendingGuideType, setPendingGuideType] = useState<"h" | "v" | null>(
    null
  );
  const pendingGuideHRef = useRef<HTMLDivElement>(null);
  const pendingGuideVRef = useRef<HTMLDivElement>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const [selectionBox, setSelectionBox] = useState<SelectionBox | null>(null);
  const justDragSelectedRef = useRef(false);
  const selectedNodesInitialPos = useRef<
    { id: string; x: number; y: number }[]
  >([]);
  const isCustomDragging = useRef(false);
  const customDragHasMoved = useRef(false);
  const customDragStartPointer = useRef<{ x: number; y: number } | null>(null);
  const customDragStartPositions = useRef<
    { id: string; x: number; y: number }[]
  >([]);
  const justFinishedCustomDragRef = useRef(false);
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null);

  // Crop tool state
  const cropRectNodeRef = useRef<Konva.Rect>(null);
  const cropTransformerRef = useRef<Konva.Transformer>(null);
  const overlayTopRef = useRef<Konva.Rect>(null);
  const overlayBottomRef = useRef<Konva.Rect>(null);
  const overlayLeftRef = useRef<Konva.Rect>(null);
  const overlayRightRef = useRef<Konva.Rect>(null);
  const [cropRect, setCropRect] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
    layerId: string;
  } | null>(null);

  // Brush painting refs and state
  const isPainting = useRef(false);
  const paintCanvas = useRef<HTMLCanvasElement | null>(null);
  const lastBrushPos = useRef<{ x: number; y: number } | null>(null);
  const paintPreviewNodeRef = useRef<Konva.Image | null>(null);
  const brushCursorRef = useRef<HTMLDivElement>(null);
  const [paintPreviewProps, setPaintPreviewProps] =
    useState<PaintPreviewProps | null>(null);

  // Magic select state
  const [magicSelection, setMagicSelection] = useState<MagicSelection | null>(
    null
  );
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);

  // Lasso drag state
  const [isLassoing, setIsLassoing] = useState(false);
  const isLassoingRef = useRef(false);
  const lassoPointsRef = useRef<{ x: number; y: number }[]>([]);
  const lassoTargetLayerRef = useRef<ImageLayerType | null>(null);
  const lassoModifiersRef = useRef<{ add: boolean; sub: boolean }>({
    add: false,
    sub: false,
  });
  const lassoHandledRef = useRef(false);

  const {
    layers,
    activeLayerIds,
    activeTool,
    setActiveTool,
    setActiveLayers,
    toggleLayerSelection,
    updateLayer,
    addTextLayer,
    addShapeLayer,
    addImageLayer,
    addDrawLayer,
    removeLayer,
    copyLayers,
    duplicateLayer,
    setLayerAsBackground,
    moveLayer,
    reorderLayers,
    pushHistory,
    brushSize,
    brushColor,
    brushOpacity,
    toggleRulers,
    toggleGrid,
    userGuides,
    addGuide,
    moveGuide,
    removeGuide,
  } = useEditorStore();

  // ── Crop tool logic ────────────────────────────────────────────────────────

  const activeLayersKey = activeLayerIds.join(",");
  useEffect(() => {
    if (activeTool !== "crop") {
      setCropRect(null);
      return;
    }
    const storeState = useEditorStore.getState();
    const layer = storeState.layers.find(
      (l) => activeLayerIds.includes(l.id) && l.type === "image"
    );
    if (!layer || layer.type !== "image") {
      setCropRect(null);
      return;
    }
    if (layer.rotation !== 0) {
      toast.error("Reset image rotation before cropping");
      setActiveTool("select");
      setCropRect(null);
      return;
    }
    setCropRect({
      x: layer.x,
      y: layer.y,
      width: layer.width * layer.scaleX,
      height: layer.height * layer.scaleY,
      layerId: layer.id,
    });
  }, [activeTool, activeLayersKey]);

  const updateOverlayFromNode = useCallback(() => {
    const node = cropRectNodeRef.current;
    if (!node) return;
    const nx = node.x();
    const ny = node.y();
    const nw = node.width() * node.scaleX();
    const nh = node.height() * node.scaleY();
    overlayTopRef.current?.height(10_000 + ny);
    overlayLeftRef.current?.setAttrs({ y: ny, width: 10_000 + nx, height: nh });
    overlayRightRef.current?.setAttrs({ x: nx + nw, y: ny, height: nh });
    overlayBottomRef.current?.setAttrs({ y: ny + nh });
    node.getLayer()?.batchDraw();
  }, []);

  const applyCrop = useCallback(() => {
    const node = cropRectNodeRef.current;
    if (!(node && cropRect)) return;
    const storeState = useEditorStore.getState();
    const layer = storeState.layers.find((l) => l.id === cropRect.layerId);
    if (!layer || layer.type !== "image") return;

    const cropX = node.x();
    const cropY = node.y();
    const cropW = node.width() * node.scaleX();
    const cropH = node.height() * node.scaleY();

    const imgLeft = layer.x;
    const imgTop = layer.y;
    const imgRight = layer.x + layer.width * layer.scaleX;
    const imgBottom = layer.y + layer.height * layer.scaleY;

    const clampedX = Math.max(cropX, imgLeft);
    const clampedY = Math.max(cropY, imgTop);
    const clampedRight = Math.min(cropX + cropW, imgRight);
    const clampedBottom = Math.min(cropY + cropH, imgBottom);
    const clampedW = clampedRight - clampedX;
    const clampedH = clampedBottom - clampedY;

    if (clampedW < 1 || clampedH < 1) {
      setCropRect(null);
      setActiveTool("select");
      return;
    }

    const imgSrcX = (clampedX - layer.x) / layer.scaleX;
    const imgSrcY = (clampedY - layer.y) / layer.scaleY;
    const imgSrcW = clampedW / layer.scaleX;
    const imgSrcH = clampedH / layer.scaleY;

    const doApply = (img: HTMLImageElement) => {
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(imgSrcW);
      canvas.height = Math.round(imgSrcH);
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(
        img,
        imgSrcX,
        imgSrcY,
        imgSrcW,
        imgSrcH,
        0,
        0,
        canvas.width,
        canvas.height
      );
      const newDataUrl = canvas.toDataURL("image/png");
      pushHistory("Crop");
      updateLayer(cropRect.layerId, {
        dataUrl: newDataUrl,
        x: clampedX,
        y: clampedY,
        width: canvas.width,
        height: canvas.height,
      });
      setCropRect(null);
      setActiveTool("select");
    };

    const cached = imageCache.current.get(layer.dataUrl);
    if (cached?.complete) {
      doApply(cached);
    } else {
      const img = new window.Image();
      img.crossOrigin = "anonymous";
      img.onload = () => doApply(img);
      img.src = layer.dataUrl;
    }
  }, [cropRect, pushHistory, updateLayer, setActiveTool]);

  useEffect(() => {
    if (!cropRect) return;
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "Enter") {
        e.preventDefault();
        applyCrop();
      } else if (e.key === "Escape") {
        e.preventDefault();
        setCropRect(null);
        setActiveTool("select");
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [cropRect, applyCrop, setActiveTool]);

  useEffect(() => {
    if (!cropTransformerRef.current) return;
    if (cropRect && cropRectNodeRef.current) {
      cropTransformerRef.current.nodes([cropRectNodeRef.current]);
    } else {
      cropTransformerRef.current.nodes([]);
    }
    cropTransformerRef.current.getLayer()?.batchDraw();
  }, [cropRect]);

  // ── End crop tool logic ────────────────────────────────────────────────────

  const handleRemoveBackground = useCallback(
    async (layerId: string) => {
      const layer = layers.find((l) => l.id === layerId);
      if (!layer || layer.type !== "image") return;
      const toastId = toast.loading("Removing background…");
      try {
        const { runBgRemovalPipeline } = await import(
          "@/lib/bg-removal-pipeline"
        );
        const result = await runBgRemovalPipeline(
          (layer as import("@/stores/use-editor-store").ImageLayer).dataUrl
        );
        const img = new window.Image();
        img.onload = () => {
          addImageLayer(result.dataUrl, img.width, img.height);
          const newId = useEditorStore.getState().activeLayerIds[0];
          if (newId) updateLayer(newId, { x: layer.x, y: layer.y });
          const message =
            result.kind === "gemini-only"
              ? "Background replaced with color"
              : "Background removed";
          toast.success(message, { id: toastId });
        };
        img.src = result.dataUrl;
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Failed to remove background",
          { id: toastId }
        );
      }
    },
    [layers, addImageLayer, updateLayer]
  );

  const pasteImageFromClipboard = useCallback(
    async (offsetX?: number, offsetY?: number) => {
      try {
        const items = await navigator.clipboard.read();
        for (const item of items) {
          const imageType = item.types.find((t) => t.startsWith("image/"));
          if (!imageType) continue;
          const blob = await item.getType(imageType);
          const url = URL.createObjectURL(blob);
          const img = new Image();
          img.onload = () => {
            const dataUrl = (() => {
              const c = document.createElement("canvas");
              c.width = img.width;
              c.height = img.height;
              c.getContext("2d")?.drawImage(img, 0, 0);
              return c.toDataURL("image/png");
            })();
            URL.revokeObjectURL(url);
            addImageLayer(dataUrl, img.width, img.height);
            const newId = useEditorStore.getState().activeLayerIds[0];
            if (newId) {
              const cx = offsetX ?? width / 2 - img.width / 2;
              const cy = offsetY ?? height / 2 - img.height / 2;
              updateLayer(newId, { x: cx, y: cy });
            }
          };
          img.src = url;
          return;
        }
      } catch {
        // clipboard API not available or denied; silently ignore
      }
    },
    [addImageLayer, updateLayer, width, height]
  );

  useEffect(() => {
    const handleViewShortcuts = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.shiftKey && (e.key === "r" || e.key === "R")) {
        e.preventDefault();
        toggleRulers();
      }
      if (e.shiftKey && (e.key === "g" || e.key === "G")) {
        e.preventDefault();
        toggleGrid();
      }
    };
    window.addEventListener("keydown", handleViewShortcuts);
    return () => window.removeEventListener("keydown", handleViewShortcuts);
  }, [toggleRulers, toggleGrid]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isV = e.key === "v" || e.key === "V";
      if (!(isV && (e.ctrlKey || e.metaKey))) return;
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      e.preventDefault();
      pasteImageFromClipboard();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [pasteImageFromClipboard]);

  useEffect(() => {
    const handleBrushShortcuts = (e: KeyboardEvent) => {
      const {
        activeTool,
        brushSize,
        brushOpacity,
        setBrushSize,
        setBrushOpacity,
      } = useEditorStore.getState();
      if (activeTool !== "brush" && activeTool !== "eraser") return;
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      if (e.key === "[" && !e.shiftKey) {
        e.preventDefault();
        const next = Math.max(1, brushSize - 5);
        setBrushSize(next);
        toast(`Brush size: ${next}px`, { duration: 1000, id: "brush-size" });
      } else if (e.key === "]" && !e.shiftKey) {
        e.preventDefault();
        const next = Math.min(200, brushSize + 5);
        setBrushSize(next);
        toast(`Brush size: ${next}px`, { duration: 1000, id: "brush-size" });
      } else if (e.key === "{") {
        e.preventDefault();
        const next = Math.max(
          0.01,
          Math.round((brushOpacity - 0.1) * 100) / 100
        );
        setBrushOpacity(next);
        toast(`Opacity: ${Math.round(next * 100)}%`, {
          duration: 1000,
          id: "brush-opacity",
        });
      } else if (e.key === "}") {
        e.preventDefault();
        const next = Math.min(1, Math.round((brushOpacity + 0.1) * 100) / 100);
        setBrushOpacity(next);
        toast(`Opacity: ${Math.round(next * 100)}%`, {
          duration: 1000,
          id: "brush-opacity",
        });
      }
    };
    window.addEventListener("keydown", handleBrushShortcuts);
    return () => window.removeEventListener("keydown", handleBrushShortcuts);
  }, []);

  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [contextMenu]);

  const handleTextDblClick = useCallback(
    (id: string) => {
      setActiveLayers([id]);
      setEditingId(id);
      setTimeout(() => {
        if (textAreaRef.current) {
          textAreaRef.current.focus();
          textAreaRef.current.select();
        }
      }, 10);
    },
    [setActiveLayers]
  );

  const handleTextBlur = useCallback(() => {
    setEditingId(null);
    pushHistory("Edit Text");
  }, [pushHistory]);

  // Wire up startPendingGuideRef so ImageEditor rulers can trigger guide creation
  useEffect(() => {
    if (startPendingGuideRef) {
      startPendingGuideRef.current = setPendingGuideType;
    }
  });

  useEffect(() => {
    if (!pendingGuideType) return;

    const buildHSnapPoints = (): number[] => {
      const pts = [0, height, height / 2, ...userGuides.h];
      const activeSet = new Set(activeLayerIds);
      for (const l of layers) {
        if (activeSet.has(l.id) || !l.visible) continue;
        const { h: lh } = getLayerDimensions(l);
        const scaledLh = lh * l.scaleY;
        pts.push(l.y, l.y + scaledLh, l.y + scaledLh / 2);
      }
      return pts;
    };

    const buildVSnapPoints = (): number[] => {
      const pts = [0, width, width / 2, ...userGuides.v];
      const activeSet = new Set(activeLayerIds);
      for (const l of layers) {
        if (activeSet.has(l.id) || !l.visible) continue;
        const { w: lw } = getLayerDimensions(l);
        const scaledLw = lw * l.scaleX;
        pts.push(l.x, l.x + scaledLw, l.x + scaledLw / 2);
      }
      return pts;
    };

    const snapToNearest = (canvasPos: number, points: number[]): number => {
      const threshold = SNAP_THRESHOLD * inv;
      let best = threshold;
      let snapped = canvasPos;
      for (const p of points) {
        const d = Math.abs(canvasPos - p);
        if (d < best) {
          best = d;
          snapped = p;
        }
      }
      return snapped;
    };

    const handleMouseMove = (e: MouseEvent) => {
      const container = stageContainerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      if (pendingGuideType === "h") {
        const rawPos = e.clientY - rect.top;
        const canvasY = (rawPos - offsetY) / scale;
        const snappedY = snapToNearest(canvasY, buildHSnapPoints());
        const pos = snappedY * scale + offsetY;
        const div = pendingGuideHRef.current;
        if (div) {
          div.style.top = `${pos}px`;
          div.style.display =
            pos >= 0 && pos <= workspaceHeight ? "block" : "none";
        }
      } else {
        const rawPos = e.clientX - rect.left;
        const canvasX = (rawPos - offsetX) / scale;
        const snappedX = snapToNearest(canvasX, buildVSnapPoints());
        const pos = snappedX * scale + offsetX;
        const div = pendingGuideVRef.current;
        if (div) {
          div.style.left = `${pos}px`;
          div.style.display =
            pos >= 0 && pos <= workspaceWidth ? "block" : "none";
        }
      }
    };
    const handleMouseUp = (e: MouseEvent) => {
      const container = stageContainerRef.current;
      if (container) {
        const rect = container.getBoundingClientRect();
        if (pendingGuideType === "h") {
          const rawPos = e.clientY - rect.top;
          if (rawPos >= 0 && rawPos <= workspaceHeight) {
            const canvasY = (rawPos - offsetY) / scale;
            const snappedY = snapToNearest(canvasY, buildHSnapPoints());
            if (snappedY >= -height && snappedY <= height * 2)
              addGuide("h", snappedY);
          }
          if (pendingGuideHRef.current)
            pendingGuideHRef.current.style.display = "none";
        } else {
          const rawPos = e.clientX - rect.left;
          if (rawPos >= 0 && rawPos <= workspaceWidth) {
            const canvasX = (rawPos - offsetX) / scale;
            const snappedX = snapToNearest(canvasX, buildVSnapPoints());
            if (snappedX >= -width && snappedX <= width * 2)
              addGuide("v", snappedX);
          }
          if (pendingGuideVRef.current)
            pendingGuideVRef.current.style.display = "none";
        }
      }
      setPendingGuideType(null);
    };
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [
    pendingGuideType,
    width,
    height,
    workspaceWidth,
    workspaceHeight,
    offsetX,
    offsetY,
    scale,
    inv,
    layers,
    activeLayerIds,
    userGuides,
    addGuide,
  ]);

  const editingLayer = layers.find((l) => l.id === editingId) as
    | TextLayerType
    | undefined;

  useEffect(() => {
    if (onExportRef) {
      onExportRef.current = () => {
        if (!stageRef.current) {
          throw new Error("Canvas not ready");
        }
        transformerRef.current?.hide();
        cornerHandlesGroupRef.current?.hide();
        const dataUrl = stageRef.current.toDataURL({
          pixelRatio: 1 / scale,
          x: offsetX,
          y: offsetY,
          width: width * scale,
          height: height * scale,
        });
        transformerRef.current?.show();
        cornerHandlesGroupRef.current?.show();
        return dataUrl;
      };
    }
  }, [onExportRef, scale, offsetX, offsetY, width, height]);

  useEffect(() => {
    if (!(transformerRef.current && stageRef.current)) {
      return;
    }

    if (editingId) {
      transformerRef.current.nodes([]);
      return;
    }

    if (activeTool === "select") {
      const selectedNodes = activeLayerIds
        .map((id) => stageRef.current?.findOne(`#${id}`))
        .filter((node): node is Konva.Node => !!node);
      transformerRef.current.nodes(selectedNodes);
    } else {
      transformerRef.current.nodes([]);
    }
    transformerRef.current.getLayer()?.batchDraw();
  }, [activeLayerIds, activeTool, editingId]);

  // Keep corner-radius handle Group in sync with its target layer node.
  // We do this imperatively (like Konva's Transformer) so position stays
  // correct even during drag, without needing React state updates.
  useEffect(() => {
    const stage = stageRef.current;
    const handlesGroup = cornerHandlesGroupRef.current;
    if (!(stage && handlesGroup) || activeLayerIds.length !== 1) return;

    const layerId = activeLayerIds[0];
    const targetNode = stage.findOne<Konva.Node>(`#${layerId}`);
    if (!targetNode) return;

    const sync = () => {
      handlesGroup.x(targetNode.x());
      handlesGroup.y(targetNode.y());
      handlesGroup.rotation(targetNode.rotation());
      handlesGroup.scaleX(targetNode.scaleX());
      handlesGroup.scaleY(targetNode.scaleY());
      handlesGroup.getLayer()?.batchDraw();
    };

    sync();
    targetNode.on("dragmove.ch transform.ch", sync);
    return () => {
      targetNode.off("dragmove.ch transform.ch");
    };
  });

  // Update canvas cursor for brush/eraser/magic-select tools
  useEffect(() => {
    const container = stageRef.current?.container();
    if (!container) return;
    if (activeTool === "brush" || activeTool === "eraser") {
      container.style.cursor = "none";
    } else if (activeTool === "eyedropper" || activeTool === "magic-select") {
      container.style.cursor = "crosshair";
    } else {
      container.style.cursor = "";
    }
  }, [activeTool]);

  // Clear magic selection and lasso state when switching away from magic-select tool
  useEffect(() => {
    if (activeTool !== "magic-select") {
      setMagicSelection(null);
      isLassoingRef.current = false;
      setIsLassoing(false);
      lassoPointsRef.current = [];
      lassoTargetLayerRef.current = null;
    }
  }, [activeTool]);

  // Marching ants animation + live lasso outline
  useEffect(() => {
    const canvas = overlayCanvasRef.current;
    if (!canvas) return;
    if (!(magicSelection || isLassoing)) {
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }
    let rafId = 0;
    let cancelled = false;
    let dashOffset = 0;
    const sel = magicSelection;

    // screen pixels per image pixel — used to scale dash sizes with zoom
    const pixelSize = sel
      ? Math.sqrt(Math.abs(sel.layerScaleX * sel.layerScaleY)) * scale
      : scale;
    const dashPeriod = 10 * pixelSize;
    const dashInc = 0.4 * pixelSize;

    const toScreenX = sel
      ? (x: number) => (sel.layerX + x * sel.layerScaleX) * scale + offsetX
      : () => 0;
    const toScreenY = sel
      ? (y: number) => (sel.layerY + y * sel.layerScaleY) * scale + offsetY
      : () => 0;

    import("@/lib/magic-select").then(({ drawMarchingAnts }) => {
      if (cancelled) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const animate = () => {
        if (cancelled) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (sel) {
          drawMarchingAnts(
            ctx,
            sel.segments,
            dashOffset,
            toScreenX,
            toScreenY,
            pixelSize
          );
        }

        // Draw live lasso outline
        const tl = lassoTargetLayerRef.current;
        const pts = lassoPointsRef.current;
        if (isLassoing && tl && pts.length > 1) {
          const lPx = Math.sqrt(Math.abs(tl.scaleX * tl.scaleY)) * scale;
          const lDash = Math.max(2, 4 * lPx);
          const lsx = (x: number) => (tl.x + x * tl.scaleX) * scale + offsetX;
          const lsy = (y: number) => (tl.y + y * tl.scaleY) * scale + offsetY;
          ctx.save();
          ctx.lineWidth = Math.max(1, lPx);
          for (let pass = 0; pass < 2; pass++) {
            ctx.setLineDash([lDash, lDash]);
            ctx.lineDashOffset =
              pass === 0 ? -dashOffset : -(dashOffset + lDash);
            ctx.strokeStyle = pass === 0 ? "#fff" : "#000";
            ctx.beginPath();
            ctx.moveTo(lsx(pts[0].x), lsy(pts[0].y));
            for (let i = 1; i < pts.length; i++) {
              ctx.lineTo(lsx(pts[i].x), lsy(pts[i].y));
            }
            ctx.lineTo(lsx(pts[0].x), lsy(pts[0].y));
            ctx.stroke();
          }
          ctx.restore();
        }

        dashOffset = (dashOffset + dashInc) % dashPeriod;
        rafId = requestAnimationFrame(animate);
      };
      rafId = requestAnimationFrame(animate);
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
    };
  }, [magicSelection, isLassoing, scale, offsetX, offsetY]);

  // Magic select keyboard: Delete → erase, Escape/Ctrl+D → deselect
  useEffect(() => {
    if (!magicSelection) return;
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      const isCtrlOrMeta = e.ctrlKey || e.metaKey;
      if (e.key === "Escape" || (isCtrlOrMeta && e.key.toLowerCase() === "d")) {
        e.preventDefault();
        setMagicSelection(null);
      } else if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        const {
          layers: ls,
          pushHistory: ph,
          updateLayer: ul,
        } = useEditorStore.getState();
        const layer = ls.find((l) => l.id === magicSelection.layerId);
        if (!layer || layer.type !== "image") return;
        import("@/lib/magic-select").then(({ eraseSelectedPixels }) => {
          eraseSelectedPixels(
            layer.dataUrl,
            magicSelection.mask,
            magicSelection.imgW,
            magicSelection.imgH
          ).then((newDataUrl) => {
            ph("Magic Erase");
            ul(magicSelection.layerId, { dataUrl: newDataUrl });
            setMagicSelection(null);
          });
        });
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [magicSelection]);

  type BoundBox = {
    x: number;
    y: number;
    width: number;
    height: number;
    rotation: number;
  };
  const snapBoundBoxFunc = useCallback(
    (oldBox: BoundBox, newBox: BoundBox) => {
      if (newBox.width < 10 || newBox.height < 10) return oldBox;
      if (
        Math.abs(newBox.rotation % 90) > 1 &&
        Math.abs(newBox.rotation % 90) < 89
      )
        return newBox;

      const newLeft = newBox.x;
      const newRight = newBox.x + newBox.width;
      const newTop = newBox.y;
      const newBottom = newBox.y + newBox.height;
      const leftMoving = Math.abs(newLeft - oldBox.x) > 0.01;
      const rightMoving = Math.abs(newRight - (oldBox.x + oldBox.width)) > 0.01;
      const topMoving = Math.abs(newTop - oldBox.y) > 0.01;
      const bottomMoving =
        Math.abs(newBottom - (oldBox.y + oldBox.height)) > 0.01;

      let { x, y, rotation } = newBox;
      let w = newBox.width;
      let h = newBox.height;

      // boundBoxFunc receives absolute stage-pixel coords, so convert canvas
      // snap points (canvas units) → stage pixels before comparing
      const threshold = SNAP_THRESHOLD;
      const activeSet = new Set(activeLayerIds);
      const layerVCanvas: number[] = [];
      const layerHCanvas: number[] = [];
      for (const l of layers) {
        if (activeSet.has(l.id) || !l.visible) continue;
        const { w: lw, h: lh } = getLayerDimensions(l);
        const scaledLw = lw * l.scaleX;
        const scaledLh = lh * l.scaleY;
        layerVCanvas.push(l.x, l.x + scaledLw, l.x + scaledLw / 2);
        layerHCanvas.push(l.y, l.y + scaledLh, l.y + scaledLh / 2);
      }
      const vPoints = [
        0,
        width,
        width / 2,
        ...userGuides.v,
        ...layerVCanvas,
      ].map((p) => p * scale + offsetX);
      if (leftMoving) {
        let best = threshold;
        for (const p of vPoints) {
          const d = Math.abs(newLeft - p);
          if (d < best) {
            best = d;
            x = p;
            w = newRight - p;
          }
        }
      } else if (rightMoving) {
        let best = threshold;
        for (const p of vPoints) {
          const d = Math.abs(newRight - p);
          if (d < best) {
            best = d;
            w = p - x;
          }
        }
      }

      const hPoints = [
        0,
        height,
        height / 2,
        ...userGuides.h,
        ...layerHCanvas,
      ].map((p) => p * scale + offsetY);
      if (topMoving) {
        let best = threshold;
        for (const p of hPoints) {
          const d = Math.abs(newTop - p);
          if (d < best) {
            best = d;
            y = p;
            h = newBottom - p;
          }
        }
      } else if (bottomMoving) {
        let best = threshold;
        for (const p of hPoints) {
          const d = Math.abs(newBottom - p);
          if (d < best) {
            best = d;
            h = p - y;
          }
        }
      }

      if (w < 10 || h < 10) return oldBox;
      return { x, y, width: w, height: h, rotation };
    },
    [width, height, userGuides, scale, offsetX, offsetY, layers, activeLayerIds]
  );

  const handleTransformerTransform = useCallback(() => {
    const tr = transformerRef.current;
    if (!tr) return;
    const box = tr.getClientRect();
    const left = box.x;
    const right = box.x + box.width;
    const top = box.y;
    const bottom = box.y + box.height;
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;

    const threshold = SNAP_THRESHOLD * inv;
    const guides: SnapGuides = { vertical: [], horizontal: [] };
    const activeSet = new Set(activeLayerIds);
    const layerVPoints: number[] = [];
    const layerHPoints: number[] = [];
    for (const l of layers) {
      if (activeSet.has(l.id) || !l.visible) continue;
      const { w: lw, h: lh } = getLayerDimensions(l);
      const scaledLw = lw * l.scaleX;
      const scaledLh = lh * l.scaleY;
      layerVPoints.push(l.x, l.x + scaledLw, l.x + scaledLw / 2);
      layerHPoints.push(l.y, l.y + scaledLh, l.y + scaledLh / 2);
    }
    const vPoints = [0, width, width / 2, ...userGuides.v, ...layerVPoints];
    let bestX = threshold;
    for (const p of vPoints) {
      for (const edge of [left, right, cx]) {
        const d = Math.abs(edge - p);
        if (d < bestX) {
          bestX = d;
          guides.vertical = [p];
        }
      }
    }
    const hPoints = [0, height, height / 2, ...userGuides.h, ...layerHPoints];
    let bestY = threshold;
    for (const p of hPoints) {
      for (const edge of [top, bottom, cy]) {
        const d = Math.abs(edge - p);
        if (d < bestY) {
          bestY = d;
          guides.horizontal = [p];
        }
      }
    }
    setSnapGuides(guides);
  }, [width, height, userGuides, inv, layers, activeLayerIds]);

  const calculateSnap = useCallback(
    (node: Konva.Node) => {
      const layer = node.getLayer();
      const box = layer
        ? node.getClientRect({ relativeTo: layer })
        : node.getClientRect();
      const left = box.x;
      const right = box.x + box.width;
      const top = box.y;
      const bottom = box.y + box.height;
      const cx = box.x + box.width / 2;
      const cy = box.y + box.height / 2;

      const guides: SnapGuides = { vertical: [], horizontal: [] };
      let snapDeltaX = 0;
      let snapDeltaY = 0;

      const threshold = SNAP_THRESHOLD * inv;
      const activeSet = new Set(activeLayerIds);
      const layerVPoints: number[] = [];
      const layerHPoints: number[] = [];
      for (const l of layers) {
        if (activeSet.has(l.id) || !l.visible) continue;
        const { w: lw, h: lh } = getLayerDimensions(l);
        const scaledLw = lw * l.scaleX;
        const scaledLh = lh * l.scaleY;
        layerVPoints.push(l.x, l.x + scaledLw, l.x + scaledLw / 2);
        layerHPoints.push(l.y, l.y + scaledLh, l.y + scaledLh / 2);
      }
      const vPoints = [0, width, width / 2, ...userGuides.v, ...layerVPoints];
      let bestX = threshold;
      for (const p of vPoints) {
        for (const [edge, delta] of [
          [left, p - left],
          [right, p - right],
          [cx, p - cx],
        ] as [number, number][]) {
          const d = Math.abs(edge - p);
          if (d < bestX) {
            bestX = d;
            snapDeltaX = delta;
            guides.vertical = [p];
          }
        }
      }

      const hPoints = [0, height, height / 2, ...userGuides.h, ...layerHPoints];
      let bestY = threshold;
      for (const p of hPoints) {
        for (const [edge, delta] of [
          [top, p - top],
          [bottom, p - bottom],
          [cy, p - cy],
        ] as [number, number][]) {
          const d = Math.abs(edge - p);
          if (d < bestY) {
            bestY = d;
            snapDeltaY = delta;
            guides.horizontal = [p];
          }
        }
      }

      return { snapDeltaX, snapDeltaY, guides };
    },
    [width, height, userGuides, inv, layers, activeLayerIds]
  );

  // ── Brush helpers ──────────────────────────────────────────────────────────

  const worldToLocal = useCallback(
    (
      px: number,
      py: number,
      layer: {
        x: number;
        y: number;
        rotation: number;
        scaleX: number;
        scaleY: number;
      }
    ) => {
      let lx = px - layer.x;
      let ly = py - layer.y;
      if (layer.rotation !== 0) {
        const rad = (-layer.rotation * Math.PI) / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);
        [lx, ly] = [lx * cos - ly * sin, lx * sin + ly * cos];
      }
      return { x: lx / layer.scaleX, y: ly / layer.scaleY };
    },
    []
  );

  const applyBrushStroke = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      x1: number,
      y1: number,
      x2: number | null,
      y2: number | null,
      radius: number,
      isEraser: boolean
    ) => {
      ctx.save();
      ctx.globalAlpha = brushOpacity;
      ctx.globalCompositeOperation = isEraser
        ? "destination-out"
        : "source-over";
      ctx.strokeStyle = isEraser ? "rgba(0,0,0,1)" : brushColor;
      ctx.fillStyle = isEraser ? "rgba(0,0,0,1)" : brushColor;
      ctx.lineWidth = radius * 2;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      if (x2 === null || y2 === null) {
        ctx.beginPath();
        ctx.arc(x1, y1, radius, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }
      ctx.restore();
    },
    [brushColor, brushOpacity]
  );

  const handleBrushMouseDown = useCallback(
    (_e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
      const stage = stageRef.current;
      const pos = stage?.getPointerPosition();
      if (!pos) return;

      const isEraser = activeTool === "eraser";
      const storeState = useEditorStore.getState();
      const activeId = storeState.activeLayerIds[0];
      const targetLayer = activeId
        ? (storeState.layers.find(
            (l) =>
              l.id === activeId &&
              !l.locked &&
              (l.type === "image" || l.type === "draw")
          ) as ImageLayerType | DrawLayerType | undefined)
        : undefined;

      if (!targetLayer && isEraser) return;

      let layerX = 0;
      let layerY = 0;
      let layerRotation = 0;
      let layerScaleX = 1;
      let layerScaleY = 1;
      let layerW: number;
      let layerH: number;
      let existingDataUrl: string | undefined;
      let targetLayerId: string;

      if (targetLayer) {
        targetLayerId = targetLayer.id;
        layerX = targetLayer.x;
        layerY = targetLayer.y;
        layerRotation = targetLayer.rotation;
        layerScaleX = targetLayer.scaleX;
        layerScaleY = targetLayer.scaleY;
        layerW = targetLayer.width;
        layerH = targetLayer.height;
        existingDataUrl = targetLayer.dataUrl;
      } else {
        targetLayerId = "__new__";
        layerW = width;
        layerH = height;
      }

      const canvas = document.createElement("canvas");
      canvas.width = layerW;
      canvas.height = layerH;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      if (existingDataUrl) {
        const cached = imageCache.current.get(existingDataUrl);
        if (cached?.complete) {
          ctx.drawImage(cached, 0, 0);
        } else {
          const tmpImg = new window.Image();
          tmpImg.crossOrigin = "anonymous";
          tmpImg.src = existingDataUrl;
          if (tmpImg.complete) ctx.drawImage(tmpImg, 0, 0);
        }
      }

      paintCanvas.current = canvas;

      const cp0 = toCanvasPos(pos);
      const localPos = worldToLocal(cp0.x, cp0.y, {
        x: layerX,
        y: layerY,
        rotation: layerRotation,
        scaleX: layerScaleX,
        scaleY: layerScaleY,
      });
      const avgScale = Math.sqrt(Math.abs(layerScaleX * layerScaleY));
      const localRadius = Math.max(1, brushSize / 2 / avgScale);

      applyBrushStroke(
        ctx,
        localPos.x,
        localPos.y,
        null,
        null,
        localRadius,
        isEraser
      );
      lastBrushPos.current = localPos;
      isPainting.current = true;

      setPaintPreviewProps({
        x: layerX,
        y: layerY,
        rotation: layerRotation,
        scaleX: layerScaleX,
        scaleY: layerScaleY,
        width: layerW,
        height: layerH,
        targetLayerId,
      });
    },
    [activeTool, width, height, brushSize, worldToLocal, applyBrushStroke]
  );

  const handleBrushMouseMove = useCallback(
    (_e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
      if (!(isPainting.current && paintCanvas.current && paintPreviewProps))
        return;

      const stage = stageRef.current;
      const pos = stage?.getPointerPosition();
      if (!pos) return;

      const isEraser = activeTool === "eraser";
      const ctx = paintCanvas.current.getContext("2d");
      if (!ctx) return;

      const cp1 = toCanvasPos(pos);
      const localPos = worldToLocal(cp1.x, cp1.y, paintPreviewProps);
      const avgScale = Math.sqrt(
        Math.abs(paintPreviewProps.scaleX * paintPreviewProps.scaleY)
      );
      const localRadius = Math.max(1, brushSize / 2 / avgScale);

      applyBrushStroke(
        ctx,
        lastBrushPos.current?.x ?? localPos.x,
        lastBrushPos.current?.y ?? localPos.y,
        localPos.x,
        localPos.y,
        localRadius,
        isEraser
      );
      lastBrushPos.current = localPos;

      if (paintPreviewNodeRef.current) {
        paintPreviewNodeRef.current.getLayer()?.batchDraw();
      }
    },
    [activeTool, brushSize, worldToLocal, applyBrushStroke, paintPreviewProps]
  );

  const handleBrushMouseUp = useCallback(() => {
    if (!(isPainting.current && paintCanvas.current && paintPreviewProps))
      return;

    isPainting.current = false;
    const finalDataUrl = paintCanvas.current.toDataURL("image/png");
    const { targetLayerId, width: lw, height: lh } = paintPreviewProps;

    if (targetLayerId === "__new__") {
      addDrawLayer(finalDataUrl, lw, lh);
    } else {
      pushHistory("Draw");
      updateLayer(targetLayerId, { dataUrl: finalDataUrl });
    }

    paintCanvas.current = null;
    lastBrushPos.current = null;
    setPaintPreviewProps(null);
  }, [paintPreviewProps, addDrawLayer, updateLayer, pushHistory]);

  // ── Stage mouse handlers ───────────────────────────────────────────────────

  const handleStageMouseDown = (
    e: Konva.KonvaEventObject<MouseEvent | TouchEvent>
  ) => {
    if (activeTool === "crop") return;
    if (activeTool === "brush" || activeTool === "eraser") {
      handleBrushMouseDown(e);
      return;
    }
    if (activeTool === "magic-select") {
      const stage = e.target.getStage();
      const pos = stage?.getPointerPosition();
      if (!pos) return;
      const cp = toCanvasPos(pos);
      const { layers: ls } = useEditorStore.getState();
      const tl = [...ls].reverse().find((l) => {
        if (l.type !== "image" || !l.visible || l.locked) return false;
        return (
          cp.x >= l.x &&
          cp.x <= l.x + l.width * l.scaleX &&
          cp.y >= l.y &&
          cp.y <= l.y + l.height * l.scaleY
        );
      }) as ImageLayerType | undefined;
      if (tl) {
        const imgX = (cp.x - tl.x) / tl.scaleX;
        const imgY = (cp.y - tl.y) / tl.scaleY;
        lassoTargetLayerRef.current = tl;
        lassoPointsRef.current = [{ x: imgX, y: imgY }];
        lassoModifiersRef.current = {
          add: e.evt.shiftKey,
          sub: e.evt.altKey,
        };
        isLassoingRef.current = true;
        setIsLassoing(true);
      }
      return;
    }
    if (editingId || activeTool !== "select") return;

    const stage = e.target.getStage();
    const pos = stage?.getPointerPosition();
    if (!pos) return;

    // If the hit node is NOT an active layer, check if an active layer is at this
    // position so we can drag it even when something else is visually on top.
    const hitId = e.target === stage ? null : resolveClickedLayerId(e.target);
    const hitIsActive = hitId ? activeLayerIds.includes(hitId) : false;

    if (!hitIsActive && activeLayerIds.length > 0) {
      const activeAtPos = activeLayerIds.find((id) => {
        const node = stageRef.current?.findOne(`#${id}`);
        if (!node) return false;
        const rect = node.getClientRect({ relativeTo: stageRef.current! });
        return (
          pos.x >= rect.x &&
          pos.x <= rect.x + rect.width &&
          pos.y >= rect.y &&
          pos.y <= rect.y + rect.height
        );
      });

      if (activeAtPos) {
        pushHistory("Move");
        isCustomDragging.current = true;
        customDragHasMoved.current = false;
        customDragStartPointer.current = pos;
        customDragStartPositions.current = activeLayerIds.map((id) => {
          const layer = layers.find((l) => l.id === id);
          return { id, x: layer?.x ?? 0, y: layer?.y ?? 0 };
        });
        return;
      }
    }

    if (e.target === stage) {
      const cp2 = toCanvasPos(pos);
      setSelectionBox({
        startX: cp2.x,
        startY: cp2.y,
        width: 0,
        height: 0,
      });
      if (!(e.evt.shiftKey || e.evt.ctrlKey || e.evt.metaKey)) {
        setActiveLayers([]);
      }
    }
  };

  const handleStageMouseMove = (
    e: Konva.KonvaEventObject<MouseEvent | TouchEvent>
  ) => {
    if (activeTool === "brush" || activeTool === "eraser") {
      handleBrushMouseMove(e);
      return;
    }
    if (activeTool === "magic-select" && isLassoingRef.current) {
      const stage = e.target.getStage();
      const pos = stage?.getPointerPosition();
      if (!pos) return;
      const tl = lassoTargetLayerRef.current;
      if (!tl) return;
      const cp = toCanvasPos(pos);
      const imgX = Math.max(0, Math.min(tl.width, (cp.x - tl.x) / tl.scaleX));
      const imgY = Math.max(0, Math.min(tl.height, (cp.y - tl.y) / tl.scaleY));
      const pts = lassoPointsRef.current;
      const last = pts[pts.length - 1];
      const dx = imgX - last.x;
      const dy = imgY - last.y;
      // thin path: only add if moved ≥2px in image space
      if (dx * dx + dy * dy >= 4) {
        lassoPointsRef.current = [...pts, { x: imgX, y: imgY }];
      }
      return;
    }

    if (isCustomDragging.current && customDragStartPointer.current) {
      const stage = e.target.getStage();
      const pos = stage?.getPointerPosition();
      if (!pos) return;
      customDragHasMoved.current = true;
      const dx = pos.x - customDragStartPointer.current.x;
      const dy = pos.y - customDragStartPointer.current.y;

      customDragStartPositions.current.forEach(({ id, x, y }) => {
        const node = stageRef.current?.findOne(`#${id}`);
        if (node) {
          node.x(x + dx);
          node.y(y + dy);
        }
      });

      const firstId = customDragStartPositions.current[0]?.id;
      const firstNode = firstId
        ? stageRef.current?.findOne(`#${firstId}`)
        : null;
      if (firstNode) {
        const { snapDeltaX, snapDeltaY, guides } = calculateSnap(firstNode);
        if (snapDeltaX !== 0 || snapDeltaY !== 0) {
          customDragStartPositions.current.forEach(({ id }) => {
            const node = stageRef.current?.findOne(`#${id}`);
            if (node) {
              node.x(node.x() + snapDeltaX);
              node.y(node.y() + snapDeltaY);
            }
          });
        }
        setSnapGuides(guides);
      }

      stageRef.current?.batchDraw();
      return;
    }

    if (!selectionBox) return;

    const stage = e.target.getStage();
    const pos = stage?.getPointerPosition();
    if (!pos) return;

    const cp3 = toCanvasPos(pos);
    setSelectionBox((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        width: cp3.x - prev.startX,
        height: cp3.y - prev.startY,
      };
    });
  };

  const handleStageMouseUp = (
    e: Konva.KonvaEventObject<MouseEvent | TouchEvent>
  ) => {
    if (activeTool === "brush" || activeTool === "eraser") {
      handleBrushMouseUp();
      return;
    }
    if (activeTool === "magic-select" && isLassoingRef.current) {
      isLassoingRef.current = false;
      setIsLassoing(false);
      const tl = lassoTargetLayerRef.current;
      const pts = lassoPointsRef.current;
      lassoPointsRef.current = [];
      lassoTargetLayerRef.current = null;

      // If fewer than 5 points, treat as a plain click → let handleStageClick fire
      if (!tl || pts.length < 5) return;

      lassoHandledRef.current = true;
      const { sub } = lassoModifiersRef.current;

      import("@/lib/magic-select").then(
        ({
          fillPolygon,
          buildSelectionSegments,
          addToMask,
          subtractFromMask,
        }) => {
          const newFill = fillPolygon(pts, tl.width, tl.height);
          const existing =
            magicSelection?.layerId === tl.id ? magicSelection.mask : null;
          let mask = newFill;
          if (existing) {
            if (sub) mask = subtractFromMask(existing, newFill);
            else mask = addToMask(existing, newFill); // drag always extends selection
          }
          const segments = buildSelectionSegments(mask, tl.width, tl.height);
          setMagicSelection({
            mask,
            segments,
            layerId: tl.id,
            imgW: tl.width,
            imgH: tl.height,
            layerX: tl.x,
            layerY: tl.y,
            layerScaleX: tl.scaleX,
            layerScaleY: tl.scaleY,
          });
        }
      );
      return;
    }

    if (isCustomDragging.current) {
      isCustomDragging.current = false;
      setSnapGuides({ vertical: [], horizontal: [] });
      if (customDragHasMoved.current) {
        customDragStartPositions.current.forEach(({ id }) => {
          const node = stageRef.current?.findOne(`#${id}`);
          if (node) updateLayer(id, { x: node.x(), y: node.y() });
        });
      }
      customDragHasMoved.current = false;
      customDragStartPointer.current = null;
      customDragStartPositions.current = [];
      justFinishedCustomDragRef.current = true;
      return;
    }

    if (!selectionBox) return;

    const sb = selectionBox;
    setSelectionBox(null);

    if (Math.abs(sb.width) < 5 && Math.abs(sb.height) < 5) return;

    justDragSelectedRef.current = true;

    const stage = stageRef.current;
    if (!stage) return;

    const boxRect = {
      x: Math.min(sb.startX, sb.startX + sb.width),
      y: Math.min(sb.startY, sb.startY + sb.height),
      width: Math.abs(sb.width),
      height: Math.abs(sb.height),
    };

    // Convert canvas-coords boxRect to stage pixel coords for correct intersection
    const stagePxBox = {
      x: boxRect.x * scale + offsetX,
      y: boxRect.y * scale + offsetY,
      width: boxRect.width * scale,
      height: boxRect.height * scale,
    };

    const selectedIds: string[] = [];
    layers.forEach((layer) => {
      if (!layer.visible) return;
      const node = stage.findOne(`#${layer.id}`);
      if (node) {
        const nodeRect = node.getClientRect({ relativeTo: stage });
        if (Konva.Util.haveIntersection(stagePxBox, nodeRect)) {
          selectedIds.push(layer.id);
        }
      }
    });

    if (e.evt.shiftKey || e.evt.ctrlKey || e.evt.metaKey) {
      const newIds = Array.from(new Set([...activeLayerIds, ...selectedIds]));
      setActiveLayers(newIds);
    } else {
      setActiveLayers(selectedIds);
    }
  };

  const handleStageClick = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
      if (activeTool === "eyedropper") {
        const stage = e.target.getStage();
        const pos = stage?.getPointerPosition();
        if (!(pos && stage)) return;
        const dataUrl = stage.toDataURL({ pixelRatio: 1 });
        const img = new Image();
        img.onload = () => {
          const temp = document.createElement("canvas");
          temp.width = stage.width();
          temp.height = stage.height();
          const ctx = temp.getContext("2d");
          if (!ctx) return;
          ctx.drawImage(img, 0, 0);
          const pixel = ctx.getImageData(
            Math.round(pos.x),
            Math.round(pos.y),
            1,
            1
          ).data;
          const r = pixel[0].toString(16).padStart(2, "0");
          const g = pixel[1].toString(16).padStart(2, "0");
          const b = pixel[2].toString(16).padStart(2, "0");
          const hex = `#${r}${g}${b}`;
          const {
            setBrushColor: sbc,
            updateLayer: ul,
            activeLayerIds: aids,
            layers: ls,
            setActiveTool: sat,
          } = useEditorStore.getState();
          sbc(hex);
          const activeLayer = ls.find((l) => aids.includes(l.id));
          if (
            activeLayer &&
            (activeLayer.type === "text" || activeLayer.type === "shape")
          ) {
            ul(activeLayer.id, { fill: hex });
          }
          sat("select");
          toast.success(`Sampled: ${hex}`, { duration: 2000 });
        };
        img.src = dataUrl;
        return;
      }
      if (activeTool === "magic-select") {
        if (lassoHandledRef.current) {
          lassoHandledRef.current = false;
          return;
        }
        const stage = e.target.getStage();
        const pos = stage?.getPointerPosition();
        if (!pos) return;
        const cp = toCanvasPos(pos);
        const { layers: ls, magicSelectTolerance: tol } =
          useEditorStore.getState();
        const isAdd = e.evt.shiftKey;
        const isSub = e.evt.altKey;

        const targetLayer = [...ls].reverse().find((l) => {
          if (l.type !== "image" || !l.visible || l.locked) return false;
          const lw = l.width * l.scaleX;
          const lh = l.height * l.scaleY;
          return (
            cp.x >= l.x && cp.x <= l.x + lw && cp.y >= l.y && cp.y <= l.y + lh
          );
        }) as ImageLayerType | undefined;

        if (!targetLayer) {
          setMagicSelection(null);
          return;
        }

        const imgX = (cp.x - targetLayer.x) / targetLayer.scaleX;
        const imgY = (cp.y - targetLayer.y) / targetLayer.scaleY;

        const doFill = (img: HTMLImageElement) => {
          import("@/lib/magic-select").then(
            ({
              floodFill,
              buildSelectionSegments,
              addToMask,
              subtractFromMask,
            }) => {
              const offscreen = document.createElement("canvas");
              offscreen.width = targetLayer.width;
              offscreen.height = targetLayer.height;
              const ctx = offscreen.getContext("2d");
              if (!ctx) return;
              ctx.drawImage(img, 0, 0, targetLayer.width, targetLayer.height);
              const imageData = ctx.getImageData(
                0,
                0,
                targetLayer.width,
                targetLayer.height
              );
              const newFill = floodFill(
                imageData.data,
                targetLayer.width,
                targetLayer.height,
                imgX,
                imgY,
                tol
              );

              // Merge with existing selection if same layer + modifier held
              const existing =
                magicSelection?.layerId === targetLayer.id
                  ? magicSelection.mask
                  : null;
              let mask = newFill;
              if (existing) {
                if (isAdd) mask = addToMask(existing, newFill);
                else if (isSub) mask = subtractFromMask(existing, newFill);
              }

              const segments = buildSelectionSegments(
                mask,
                targetLayer.width,
                targetLayer.height
              );
              setMagicSelection({
                mask,
                segments,
                layerId: targetLayer.id,
                imgW: targetLayer.width,
                imgH: targetLayer.height,
                layerX: targetLayer.x,
                layerY: targetLayer.y,
                layerScaleX: targetLayer.scaleX,
                layerScaleY: targetLayer.scaleY,
              });
            }
          );
        };

        const cached = imageCache.current.get(targetLayer.dataUrl);
        if (cached?.complete) {
          doFill(cached);
        } else {
          const img = new window.Image();
          img.crossOrigin = "anonymous";
          img.onload = () => {
            imageCache.current.set(targetLayer.dataUrl, img);
            doFill(img);
          };
          img.src = targetLayer.dataUrl;
        }
        return;
      }
      if (
        activeTool === "brush" ||
        activeTool === "eraser" ||
        activeTool === "crop"
      )
        return;
      if (justDragSelectedRef.current) {
        justDragSelectedRef.current = false;
        return;
      }
      if (editingId) return;

      if (e.target === e.target.getStage()) {
        if (activeTool === "text") {
          const pos = e.target.getStage()?.getPointerPosition();
          if (pos) {
            addTextLayer("Your Text");
            const newLayerId = useEditorStore.getState().activeLayerIds[0];
            if (newLayerId) {
              const cp4 = toCanvasPos(pos);
              updateLayer(newLayerId, { x: cp4.x, y: cp4.y });
            }
          }
        } else if (activeTool === "rect" || activeTool === "ellipse") {
          const pos = e.target.getStage()?.getPointerPosition();
          if (pos) {
            addShapeLayer(activeTool);
            const newLayerId = useEditorStore.getState().activeLayerIds[0];
            if (newLayerId) {
              const cp5 = toCanvasPos(pos);
              updateLayer(newLayerId, { x: cp5.x, y: cp5.y });
            }
          }
        } else {
          setActiveLayers([]);
        }
        return;
      }

      const clickedId = resolveClickedLayerId(e.target);
      if (clickedId) {
        if (e.evt.metaKey || e.evt.ctrlKey || e.evt.shiftKey) {
          toggleLayerSelection(clickedId);
        } else if (justFinishedCustomDragRef.current) {
          // Click was on top of an active layer; keep current selection
          justFinishedCustomDragRef.current = false;
        } else if (!activeLayerIds.includes(clickedId)) {
          // Clicking a non-active node: only change selection if no active
          // layer is also at this click position (allows click-through)
          const pos = stageRef.current?.getPointerPosition();
          const activeAtPos =
            pos &&
            activeLayerIds.some((id) => {
              const node = stageRef.current?.findOne(`#${id}`);
              if (!node) return false;
              const rect = node.getClientRect({
                relativeTo: stageRef.current!,
              });
              return (
                pos.x >= rect.x &&
                pos.x <= rect.x + rect.width &&
                pos.y >= rect.y &&
                pos.y <= rect.y + rect.height
              );
            });
          if (!activeAtPos) setActiveLayers([clickedId]);
        }
      } else {
        justFinishedCustomDragRef.current = false;
        setActiveLayers([]);
      }
    },
    [
      activeTool,
      activeLayerIds,
      setActiveLayers,
      toggleLayerSelection,
      addTextLayer,
      addShapeLayer,
      updateLayer,
      editingId,
      magicSelection,
    ]
  );

  const handleDragStart = useCallback(
    (e: Konva.KonvaEventObject<DragEvent>) => {
      pushHistory("Move");
      const draggedNode = e.target;
      if (activeLayerIds.includes(draggedNode.id())) {
        const selectedNodes = transformerRef.current?.nodes() || [];
        selectedNodesInitialPos.current = selectedNodes.map((node) => ({
          id: node.id(),
          x: node.x(),
          y: node.y(),
        }));
      }
    },
    [activeLayerIds, pushHistory]
  );

  const handleDragMove = useCallback(
    (e: Konva.KonvaEventObject<DragEvent>) => {
      const node = e.target;
      const { snapDeltaX, snapDeltaY, guides } = calculateSnap(node);

      if (snapDeltaX !== 0) {
        node.x(node.x() + snapDeltaX);
      }
      if (snapDeltaY !== 0) {
        node.y(node.y() + snapDeltaY);
      }

      setSnapGuides(guides);

      if (activeLayerIds.length > 1 && activeLayerIds.includes(node.id())) {
        const initialPos = selectedNodesInitialPos.current.find(
          (p) => p.id === node.id()
        );
        if (initialPos && stageRef.current) {
          const dx = node.x() - initialPos.x;
          const dy = node.y() - initialPos.y;

          selectedNodesInitialPos.current.forEach((p) => {
            if (p.id !== node.id()) {
              const sibling = stageRef.current?.findOne(`#${p.id}`);
              if (sibling) {
                sibling.x(p.x + dx);
                sibling.y(p.y + dy);
              }
            }
          });
        }
      }
    },
    [calculateSnap, activeLayerIds]
  );

  const handleDragEnd = useCallback(
    (_e: Konva.KonvaEventObject<DragEvent>, _layerId: string) => {
      setSnapGuides({ vertical: [], horizontal: [] });
      const nodes = transformerRef.current?.nodes() || [];
      nodes.forEach((node) => {
        updateLayer(node.id(), { x: node.x(), y: node.y() });
      });
      selectedNodesInitialPos.current = [];
    },
    [updateLayer]
  );

  const handleTransformEnd = useCallback(
    (e: Konva.KonvaEventObject<Event>, layer: EditorLayer) => {
      const node = e.target;

      if (layer.type === "text") {
        const scaleX = node.scaleX();
        const scaleY = node.scaleY();
        node.scaleX(1);
        node.scaleY(1);
        const textLayer = layer as TextLayerType;
        const currentWidth = textLayer.width ?? 300;
        const proportional = Math.abs(scaleX - scaleY) < 0.02;
        if (proportional && Math.abs(scaleX - 1) > 0.001) {
          // Corner drag: scale both font size and box width proportionally
          updateLayer(layer.id, {
            x: node.x(),
            y: node.y(),
            rotation: node.rotation(),
            fontSize: Math.max(1, Math.round(textLayer.fontSize * scaleX)),
            width: Math.max(10, Math.round(currentWidth * scaleX)),
          });
        } else if (Math.abs(scaleX - 1) > 0.001) {
          // Horizontal edge drag: resize box width, keep font size
          updateLayer(layer.id, {
            x: node.x(),
            y: node.y(),
            rotation: node.rotation(),
            width: Math.max(10, Math.round(currentWidth * scaleX)),
          });
        } else {
          // Rotation only or vertical edge (vertical ignored — height is auto)
          updateLayer(layer.id, {
            x: node.x(),
            y: node.y(),
            rotation: node.rotation(),
          });
        }
      } else {
        updateLayer(layer.id, {
          x: node.x(),
          y: node.y(),
          rotation: node.rotation(),
          scaleX: node.scaleX(),
          scaleY: node.scaleY(),
        });
      }
    },
    [updateLayer]
  );

  const onTransformerEnd = () => {
    setSnapGuides({ vertical: [], horizontal: [] });
    const nodes = transformerRef.current?.nodes();
    if (nodes) {
      nodes.forEach((node) => {
        const scaleX = node.scaleX();
        const scaleY = node.scaleY();
        node.scaleX(1);
        node.scaleY(1);

        const layerState = layers.find((l) => l.id === node.id());
        if (layerState?.type === "text") {
          // handleTransformEnd already ran and reset scale to 1 — skip to avoid overwrite
          if (Math.abs(scaleX - 1) < 0.001 && Math.abs(scaleY - 1) < 0.001) {
            // already handled
          } else {
            const currentWidth = (layerState as TextLayerType).width ?? 300;
            const proportional = Math.abs(scaleX - scaleY) < 0.02;
            if (proportional && Math.abs(scaleX - 1) > 0.001) {
              updateLayer(node.id(), {
                x: node.x(),
                y: node.y(),
                rotation: node.rotation(),
                fontSize: Math.max(1, Math.round(layerState.fontSize * scaleX)),
                width: Math.max(10, Math.round(currentWidth * scaleX)),
              });
            } else if (Math.abs(scaleX - 1) > 0.001) {
              updateLayer(node.id(), {
                x: node.x(),
                y: node.y(),
                rotation: node.rotation(),
                width: Math.max(10, Math.round(currentWidth * scaleX)),
              });
            } else {
              updateLayer(node.id(), {
                x: node.x(),
                y: node.y(),
                rotation: node.rotation(),
              });
            }
          }
        } else if (layerState) {
          node.scaleX(scaleX);
          node.scaleY(scaleY);
          updateLayer(node.id(), {
            x: node.x(),
            y: node.y(),
            rotation: node.rotation(),
            scaleX,
            scaleY,
          });
        }
      });
      pushHistory("Transform");
    }
  };

  const renderLayer = (layer: EditorLayer) => {
    if (!layer.visible) return null;
    // Hide the layer being actively painted on (preview node takes over)
    if (
      paintPreviewProps?.targetLayerId === layer.id &&
      paintPreviewProps.targetLayerId !== "__new__"
    ) {
      return null;
    }

    const commonProps = {
      layer,
      activeTool,
      isActive: activeLayerIds.includes(layer.id),
      imageCache,
      onDragStart: handleDragStart,
      onDragMove: handleDragMove,
      onDragEnd: handleDragEnd,
      onTransformStart: () => pushHistory("Transform"),
      onTransformEnd: handleTransformEnd,
      onSelect: (id: string) => {
        setActiveLayers([id]);
      },
      onDblClick: handleTextDblClick,
    };

    switch (layer.type) {
      case "image":
        return renderImageLayer({
          ...commonProps,
          layer: layer as ImageLayerType,
        });
      case "text":
        return renderTextLayer({
          ...commonProps,
          layer: {
            ...(layer as TextLayerType),
            opacity: layer.id === editingId ? 0 : layer.opacity,
          },
        });
      case "shape":
        return renderShapeLayer({
          ...commonProps,
          layer: layer as ShapeLayerType,
        });
      case "animated-image":
        return renderAnimatedImageLayer({
          ...commonProps,
          layer: layer as AnimatedImageLayerType,
        });
      case "draw":
        return renderDrawLayer({
          ...commonProps,
          layer: layer as DrawLayerType,
        });
      case "svg":
        return renderSvgLayer({
          ...commonProps,
          layer: layer as SvgLayerType,
        });
      default:
        return null;
    }
  };

  return (
    <div
      onMouseLeave={() => {
        const div = brushCursorRef.current;
        if (div) div.style.display = "none";
      }}
      onMouseMove={(e) => {
        if (activeTool !== "brush" && activeTool !== "eraser") return;
        const rect = stageContainerRef.current?.getBoundingClientRect();
        if (!rect) return;
        const div = brushCursorRef.current;
        if (div) {
          div.style.left = `${e.clientX - rect.left}px`;
          div.style.top = `${e.clientY - rect.top}px`;
          div.style.display = "block";
        }
      }}
      ref={stageContainerRef}
      style={{
        position: "relative",
        width: workspaceWidth,
        height: workspaceHeight,
        overflow: "visible",
      }}
    >
      <Stage
        height={workspaceHeight}
        onClick={handleStageClick}
        onContextMenu={(e) => {
          e.evt.preventDefault();
          const stage = stageRef.current;
          const pos = stage?.getPointerPosition();
          const container = stageContainerRef.current;
          if (!(container && pos)) return;
          const rect = container.getBoundingClientRect();
          const rawId = resolveClickedLayerId(e.target);
          const clickedId =
            e.target === e.target.getStage() ? null : rawId || null;
          if (clickedId && !activeLayerIds.includes(clickedId)) {
            setActiveLayers([clickedId]);
          }
          const cp6 = toCanvasPos(pos);
          setContextMenu({
            x: e.evt.clientX - rect.left,
            y: e.evt.clientY - rect.top,
            canvasX: cp6.x,
            canvasY: cp6.y,
            layerId: clickedId,
          });
        }}
        onMouseDown={handleStageMouseDown}
        onMouseMove={handleStageMouseMove}
        onMouseUp={handleStageMouseUp}
        onTap={handleStageClick}
        onTouchEnd={handleStageMouseUp}
        onTouchMove={handleStageMouseMove}
        onTouchStart={handleStageMouseDown}
        ref={stageRef}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          background: "transparent",
        }}
        width={workspaceWidth}
      >
        <Layer scaleX={scale} scaleY={scale} x={offsetX} y={offsetY}>
          {/* Covers full workspace area with dark background */}
          <Rect
            fill="#171717"
            height={workspaceHeight / scale}
            listening={false}
            width={workspaceWidth / scale}
            x={-offsetX / scale}
            y={-offsetY / scale}
          />
          <Group
            clipFunc={(ctx) => {
              const r = 8 / scale;
              ctx.beginPath();
              ctx.moveTo(r, 0);
              ctx.lineTo(width - r, 0);
              ctx.quadraticCurveTo(width, 0, width, r);
              ctx.lineTo(width, height);
              ctx.lineTo(0, height);
              ctx.lineTo(0, r);
              ctx.quadraticCurveTo(0, 0, r, 0);
              ctx.closePath();
            }}
          >
            <Rect
              fill="#262626"
              height={height}
              listening={false}
              width={width}
              x={0}
              y={0}
            />

            {showGrid &&
              (() => {
                const step = 50;
                const lines = [];
                for (let x = step; x < width; x += step) {
                  lines.push(
                    <Line
                      key={`grid-v-${x}`}
                      listening={false}
                      points={[x, 0, x, height]}
                      stroke="rgba(255,255,255,0.08)"
                      strokeWidth={inv}
                    />
                  );
                }
                for (let y = step; y < height; y += step) {
                  lines.push(
                    <Line
                      key={`grid-h-${y}`}
                      listening={false}
                      points={[0, y, width, y]}
                      stroke="rgba(255,255,255,0.08)"
                      strokeWidth={inv}
                    />
                  );
                }
                return lines;
              })()}

            {layers.map(renderLayer)}

            {/* Live paint preview during brush/eraser strokes */}
            {paintPreviewProps && paintCanvas.current && (
              <KonvaImage
                height={paintPreviewProps.height}
                image={paintCanvas.current as unknown as HTMLImageElement}
                listening={false}
                ref={paintPreviewNodeRef}
                rotation={paintPreviewProps.rotation}
                scaleX={paintPreviewProps.scaleX}
                scaleY={paintPreviewProps.scaleY}
                width={paintPreviewProps.width}
                x={paintPreviewProps.x}
                y={paintPreviewProps.y}
              />
            )}
          </Group>

          {/* Individual layer selection outlines (multi-select) */}
          {activeTool === "select" &&
            !editingId &&
            activeLayerIds.length > 1 &&
            activeLayerIds.map((id) => {
              const layer = layers.find((l) => l.id === id);
              if (!layer?.visible) return null;
              return (
                <Rect
                  fill="transparent"
                  height={"height" in layer ? layer.height : 0}
                  key={`sel-outline-${id}`}
                  listening={false}
                  rotation={layer.rotation}
                  scaleX={layer.scaleX}
                  scaleY={layer.scaleY}
                  stroke={UI_COLOR}
                  strokeScaleEnabled={false}
                  strokeWidth={inv * 1.5}
                  width={"width" in layer ? layer.width : 0}
                  x={layer.x}
                  y={layer.y}
                />
              );
            })}

          {/* User-created guide lines */}
          {userGuides.h.map((y, i) => (
            <Line
              dragBoundFunc={(pos) => ({ x: offsetX, y: pos.y })}
              draggable={activeTool === "select"}
              hitStrokeWidth={8 * inv}
              key={`user-guide-h-${i}`}
              listening={activeTool === "select"}
              onDragEnd={(e) => {
                const newY = e.target.y();
                e.target.y(y);
                stageRef.current
                  ?.container()
                  .style.setProperty("cursor", "default");
                if (newY < -20 || newY > height + 20) {
                  removeGuide("h", i);
                } else {
                  moveGuide("h", i, newY);
                }
              }}
              onMouseEnter={() =>
                stageRef.current
                  ?.container()
                  .style.setProperty("cursor", "ns-resize")
              }
              onMouseLeave={() =>
                stageRef.current
                  ?.container()
                  .style.setProperty("cursor", "default")
              }
              points={[0, 0, width, 0]}
              stroke={UI_COLOR}
              strokeWidth={inv}
              x={0}
              y={y}
            />
          ))}
          {userGuides.v.map((x, i) => (
            <Line
              dragBoundFunc={(pos) => ({ x: pos.x, y: offsetY })}
              draggable={activeTool === "select"}
              hitStrokeWidth={8 * inv}
              key={`user-guide-v-${i}`}
              listening={activeTool === "select"}
              onDragEnd={(e) => {
                const newX = e.target.x();
                e.target.x(x);
                stageRef.current
                  ?.container()
                  .style.setProperty("cursor", "default");
                if (newX < -20 || newX > width + 20) {
                  removeGuide("v", i);
                } else {
                  moveGuide("v", i, newX);
                }
              }}
              onMouseEnter={() =>
                stageRef.current
                  ?.container()
                  .style.setProperty("cursor", "ew-resize")
              }
              onMouseLeave={() =>
                stageRef.current
                  ?.container()
                  .style.setProperty("cursor", "default")
              }
              points={[0, 0, 0, height]}
              stroke={UI_COLOR}
              strokeWidth={inv}
              x={x}
              y={0}
            />
          ))}

          {/* Selection Box */}
          {selectionBox && (
            <Rect
              fill="oklch(0.685 0.169 237.323 / 0.15)"
              height={Math.abs(selectionBox.height)}
              listening={false}
              stroke={UI_COLOR}
              strokeWidth={1}
              width={Math.abs(selectionBox.width)}
              x={Math.min(
                selectionBox.startX,
                selectionBox.startX + selectionBox.width
              )}
              y={Math.min(
                selectionBox.startY,
                selectionBox.startY + selectionBox.height
              )}
            />
          )}

          {snapGuides.vertical.map((x) => (
            <Line
              key={`snap-v-${x}`}
              listening={false}
              opacity={0.9}
              points={[
                x,
                -offsetY / scale,
                x,
                (workspaceHeight - offsetY) / scale,
              ]}
              stroke={UI_COLOR}
              strokeWidth={1.5 * inv}
            />
          ))}
          {snapGuides.horizontal.map((y) => (
            <Line
              key={`snap-h-${y}`}
              listening={false}
              opacity={0.9}
              points={[
                -offsetX / scale,
                y,
                (workspaceWidth - offsetX) / scale,
                y,
              ]}
              stroke={UI_COLOR}
              strokeWidth={1.5 * inv}
            />
          ))}

          {/* Crop tool overlay */}
          {cropRect && (
            <>
              <Rect
                fill="rgba(0,0,0,0.55)"
                height={10_000 + cropRect.y}
                listening={false}
                ref={overlayTopRef}
                width={20_000}
                x={-10_000}
                y={-10_000}
              />
              <Rect
                fill="rgba(0,0,0,0.55)"
                height={10_000}
                listening={false}
                ref={overlayBottomRef}
                width={20_000}
                x={-10_000}
                y={cropRect.y + cropRect.height}
              />
              <Rect
                fill="rgba(0,0,0,0.55)"
                height={cropRect.height}
                listening={false}
                ref={overlayLeftRef}
                width={10_000 + cropRect.x}
                x={-10_000}
                y={cropRect.y}
              />
              <Rect
                fill="rgba(0,0,0,0.55)"
                height={cropRect.height}
                listening={false}
                ref={overlayRightRef}
                width={10_000}
                x={cropRect.x + cropRect.width}
                y={cropRect.y}
              />
              <Rect
                draggable
                fill="transparent"
                height={cropRect.height}
                onClick={(e) => {
                  e.cancelBubble = true;
                }}
                onDragEnd={() => {
                  const node = cropRectNodeRef.current;
                  if (node)
                    setCropRect((prev) =>
                      prev ? { ...prev, x: node.x(), y: node.y() } : null
                    );
                }}
                onDragMove={updateOverlayFromNode}
                onTap={(e) => {
                  e.cancelBubble = true;
                }}
                ref={cropRectNodeRef}
                stroke={UI_COLOR}
                strokeWidth={1.5 * inv}
                width={cropRect.width}
                x={cropRect.x}
                y={cropRect.y}
              />
              <Transformer
                anchorCornerRadius={2}
                anchorFill="#fff"
                anchorSize={10}
                anchorStroke={UI_COLOR}
                anchorStrokeWidth={1.5}
                borderStroke={UI_COLOR}
                borderStrokeWidth={1.5}
                boundBoxFunc={(oldBox, newBox) =>
                  newBox.width < 10 || newBox.height < 10 ? oldBox : newBox
                }
                onTransform={updateOverlayFromNode}
                onTransformEnd={() => {
                  const node = cropRectNodeRef.current;
                  if (!node) return;
                  const newW = node.width() * node.scaleX();
                  const newH = node.height() * node.scaleY();
                  node.width(newW);
                  node.height(newH);
                  node.scaleX(1);
                  node.scaleY(1);
                  setCropRect((prev) =>
                    prev
                      ? {
                          ...prev,
                          x: node.x(),
                          y: node.y(),
                          width: newW,
                          height: newH,
                        }
                      : null
                  );
                }}
                ref={cropTransformerRef}
                rotateEnabled={false}
              />
            </>
          )}

          {/* Corner radius drag handles — position kept in sync imperatively */}
          {activeTool === "select" &&
            activeLayerIds.length === 1 &&
            (() => {
              const handleLayer = layers.find(
                (l) => l.id === activeLayerIds[0]
              );
              if (
                !handleLayer?.visible ||
                (handleLayer.type !== "image" &&
                  handleLayer.type !== "animated-image")
              )
                return null;

              const cr = handleLayer.cornerRadius;
              const isLinked = typeof cr === "number";
              const radii: [number, number, number, number] = isLinked
                ? [cr, cr, cr, cr]
                : cr;
              const maxR = Math.min(handleLayer.width, handleLayer.height) / 2;
              const handleRadius = 5 / scale;
              // Always keep handles MIN_OFFSET local-units inside the corner so
              // they're visible even when cornerRadius === 0.
              const MIN_OFFSET = 14 / scale;
              const cornerCursors = [
                "nwse-resize",
                "nesw-resize",
                "nwse-resize",
                "nesw-resize",
              ] as const;

              const cx = [
                (r: number) => Math.max(r, MIN_OFFSET),
                (r: number) => handleLayer.width - Math.max(r, MIN_OFFSET),
                (r: number) => handleLayer.width - Math.max(r, MIN_OFFSET),
                (r: number) => Math.max(r, MIN_OFFSET),
              ];
              const cy = [
                (r: number) => Math.max(r, MIN_OFFSET),
                (r: number) => Math.max(r, MIN_OFFSET),
                (r: number) => handleLayer.height - Math.max(r, MIN_OFFSET),
                (r: number) => handleLayer.height - Math.max(r, MIN_OFFSET),
              ];

              return (
                // No position props — synced imperatively via useEffect below
                <Group ref={cornerHandlesGroupRef}>
                  {([0, 1, 2, 3] as const).map((idx) => {
                    const r = Math.min(radii[idx], maxR);
                    return (
                      <Circle
                        draggable
                        fill="#fff"
                        hitStrokeWidth={0}
                        key={idx}
                        onDragMove={(e: Konva.KonvaEventObject<DragEvent>) => {
                          const node = e.target as Konva.Circle;
                          const lx = node.x();
                          const ly = node.y();
                          let newR: number;
                          if (idx === 0)
                            newR = Math.max(0, Math.min(lx, ly, maxR));
                          else if (idx === 1)
                            newR = Math.max(
                              0,
                              Math.min(handleLayer.width - lx, ly, maxR)
                            );
                          else if (idx === 2)
                            newR = Math.max(
                              0,
                              Math.min(
                                handleLayer.width - lx,
                                handleLayer.height - ly,
                                maxR
                              )
                            );
                          else
                            newR = Math.max(
                              0,
                              Math.min(lx, handleLayer.height - ly, maxR)
                            );
                          node.x(cx[idx](newR));
                          node.y(cy[idx](newR));
                          if (isLinked) {
                            updateLayer(handleLayer.id, {
                              cornerRadius: newR,
                            });
                          } else {
                            const next: [number, number, number, number] = [
                              ...radii,
                            ];
                            next[idx] = newR;
                            updateLayer(handleLayer.id, {
                              cornerRadius: next,
                            });
                          }
                        }}
                        onMouseEnter={() => {
                          const container = stageRef.current?.container();
                          if (container)
                            container.style.cursor = cornerCursors[idx];
                        }}
                        onMouseLeave={() => {
                          const container = stageRef.current?.container();
                          if (container) container.style.cursor = "default";
                        }}
                        radius={handleRadius}
                        stroke={UI_COLOR}
                        strokeScaleEnabled={false}
                        strokeWidth={1.5}
                        x={cx[idx](r)}
                        y={cy[idx](r)}
                      />
                    );
                  })}
                </Group>
              );
            })()}

          <Transformer
            anchorCornerRadius={2}
            anchorFill="#fff"
            anchorSize={10}
            anchorStroke={UI_COLOR}
            anchorStrokeWidth={1.5}
            borderEnabled={activeLayerIds.length <= 1}
            borderStroke={UI_COLOR}
            borderStrokeWidth={1.5}
            boundBoxFunc={snapBoundBoxFunc}
            enabledAnchors={
              activeLayerIds.length > 0 &&
              activeLayerIds.every(
                (id) => layers.find((l) => l.id === id)?.type === "text"
              )
                ? [
                    "top-left",
                    "top-right",
                    "bottom-left",
                    "bottom-right",
                    "middle-left",
                    "middle-right",
                  ]
                : undefined
            }
            onTransform={handleTransformerTransform}
            onTransformEnd={onTransformerEnd}
            ref={transformerRef}
            rotateAnchorOffset={28}
            rotateEnabled={true}
          />
        </Layer>
      </Stage>

      {editingLayer &&
        editingId &&
        (() => {
          const editingNode = stageRef.current?.findOne(`#${editingId}`);
          const nodeRect = editingNode
            ? editingNode.getClientRect({ relativeTo: stageRef.current! })
            : null;
          return (
            <textarea
              className="absolute m-0 resize-none border-none bg-transparent p-0 outline-1 focus:outline-blue-500"
              onBlur={handleTextBlur}
              onChange={(e) => {
                updateLayer(editingId, { text: e.target.value });
                e.target.style.height = "0px";
                e.target.style.height = `${e.target.scrollHeight}px`;
              }}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setEditingId(null);
                } else if (e.key === "Enter" && e.shiftKey) {
                  e.preventDefault();
                  setEditingId(null);
                  pushHistory("Edit Text");
                }
              }}
              ref={textAreaRef}
              style={{
                left: nodeRect ? nodeRect.x : offsetX + editingLayer.x * scale,
                top: nodeRect ? nodeRect.y : offsetY + editingLayer.y * scale,
                width: (editingLayer.width ?? 300) * scale,
                height: "auto",
                minHeight:
                  editingLayer.fontSize *
                  (editingLayer.lineHeight ?? 1) *
                  scale,
                overflow: "hidden",
                overflowWrap: "break-word",
                whiteSpace: "pre-wrap",
                fontSize: editingLayer.fontSize * scale,
                fontFamily: editingLayer.fontFamily,
                fontWeight: editingLayer.fontStyle.includes("bold")
                  ? "bold"
                  : "normal",
                fontStyle: editingLayer.fontStyle.includes("italic")
                  ? "italic"
                  : "normal",
                color: editingLayer.fill,
                lineHeight: editingLayer.lineHeight ?? 1,
                letterSpacing: `${editingLayer.letterSpacing ?? 0}px`,
                transform: `rotate(${editingLayer.rotation}deg)`,
                transformOrigin: "top left",
                textAlign: editingLayer.align ?? "left",
              }}
              value={editingLayer.text}
            />
          );
        })()}

      {/* Pending guide overlays */}
      <div
        ref={pendingGuideHRef}
        style={{
          display: "none",
          position: "absolute",
          left: 0,
          top: 0,
          width: "100%",
          height: "1px",
          background: UI_COLOR,
          opacity: 0.85,
          pointerEvents: "none",
          zIndex: 5,
        }}
      />
      <div
        ref={pendingGuideVRef}
        style={{
          display: "none",
          position: "absolute",
          left: 0,
          top: 0,
          width: "1px",
          height: "100%",
          background: UI_COLOR,
          opacity: 0.85,
          pointerEvents: "none",
          zIndex: 5,
        }}
      />

      {/* Crop hint */}
      {cropRect && (
        <div
          style={{
            position: "absolute",
            bottom: 78,
            left: "50%",
            transform: "translateX(-50%)",
            background: "rgba(0,0,0,0.72)",
            color: "white",
            fontSize: 12,
            padding: "4px 12px",
            borderRadius: 6,
            pointerEvents: "none",
            zIndex: 60,
            whiteSpace: "nowrap",
          }}
        >
          Enter to apply · Esc to cancel
        </div>
      )}

      {/* Brush cursor indicator */}
      <div
        ref={brushCursorRef}
        style={{
          display: "none",
          position: "absolute",
          width: brushSize * scale,
          height: brushSize * scale,
          border: "1.5px solid rgba(255,255,255,0.9)",
          boxShadow: "0 0 0 1px rgba(0,0,0,0.6)",
          borderRadius: "50%",
          transform: "translate(-50%, -50%)",
          pointerEvents: "none",
          zIndex: 20,
        }}
      />

      {/* Marching ants overlay for magic select */}
      <canvas
        height={workspaceHeight}
        ref={overlayCanvasRef}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          pointerEvents: "none",
          zIndex: 15,
        }}
        width={workspaceWidth}
      />

      {/* Magic select hint */}
      {magicSelection && (
        <div
          style={{
            position: "absolute",
            bottom: 78,
            left: "50%",
            transform: "translateX(-50%)",
            background: "rgba(0,0,0,0.72)",
            color: "white",
            fontSize: 12,
            padding: "4px 12px",
            borderRadius: 6,
            pointerEvents: "none",
            zIndex: 60,
            whiteSpace: "nowrap",
          }}
        >
          Delete to erase · Esc to clear
        </div>
      )}

      {contextMenu &&
        (() => {
          const cm = contextMenu;
          const targetLayer = cm.layerId
            ? layers.find((l) => l.id === cm.layerId)
            : null;
          const layerIndex = targetLayer
            ? layers.findIndex((l) => l.id === cm.layerId)
            : -1;
          const isLocked = targetLayer?.locked ?? false;
          const isImage = targetLayer?.type === "image";

          const menuItem = (
            label: string,
            onClick: () => void,
            danger = false
          ) => (
            <button
              className={`flex w-full items-center px-4 py-2 text-left text-sm ${danger ? "text-red-400 hover:bg-red-900/30" : "text-neutral-100 hover:bg-neutral-700"}`}
              key={label}
              onClick={() => {
                setContextMenu(null);
                onClick();
              }}
              type="button"
            >
              {label}
            </button>
          );

          const divider = (key: string) => (
            <div className="my-1 border-neutral-700 border-t" key={key} />
          );

          return (
            <div
              className="absolute z-50 min-w-[200px] overflow-hidden rounded-lg border border-neutral-600 bg-neutral-800 py-1 shadow-xl"
              onClick={(e) => e.stopPropagation()}
              style={{
                left: cm.x,
                top: cm.y,
                transformOrigin: "top left",
              }}
            >
              {targetLayer ? (
                <>
                  {menuItem("Copy", () => copyLayers())}
                  {menuItem("Duplicate", () => duplicateLayer(cm.layerId!))}
                  {divider("d1")}
                  {menuItem("Bring to Front", () =>
                    reorderLayers(layerIndex, layers.length - 1)
                  )}
                  {menuItem("Move Forward", () => moveLayer(cm.layerId!, "up"))}
                  {menuItem("Move Backward", () =>
                    moveLayer(cm.layerId!, "down")
                  )}
                  {menuItem("Send to Back", () => reorderLayers(layerIndex, 0))}
                  {divider("d2")}
                  {isImage &&
                    menuItem("Set as Background", () =>
                      setLayerAsBackground(cm.layerId!)
                    )}
                  {isImage &&
                    menuItem("Remove Background", () =>
                      handleRemoveBackground(cm.layerId!)
                    )}
                  {isImage && divider("d3")}
                  {menuItem("Reset Transform", () => {
                    pushHistory("Reset Transform");
                    updateLayer(cm.layerId!, {
                      x: 0,
                      y: 0,
                      rotation: 0,
                      scaleX: 1,
                      scaleY: 1,
                    });
                  })}
                  {menuItem("Center on Canvas", () => {
                    const l = layers.find((lay) => lay.id === cm.layerId!);
                    if (!l) return;
                    const { w: lw, h: lh } = getLayerDimensions(l);
                    pushHistory("Center on Canvas");
                    updateLayer(cm.layerId!, {
                      x: (width - lw * l.scaleX) / 2,
                      y: (height - lh * l.scaleY) / 2,
                    });
                  })}
                  {menuItem("Fit to Canvas", () => {
                    const l = layers.find((lay) => lay.id === cm.layerId!);
                    if (!l) return;
                    const { w: lw, h: lh } = getLayerDimensions(l);
                    pushHistory("Fit to Canvas");
                    const s =
                      lw > 0 && lh > 0 ? Math.min(width / lw, height / lh) : 1;
                    updateLayer(cm.layerId!, {
                      scaleX: s,
                      scaleY: s,
                      rotation: 0,
                      x: (width - lw * s) / 2,
                      y: (height - lh * s) / 2,
                    });
                  })}
                  {menuItem("Stretch to Canvas", () => {
                    const l = layers.find((lay) => lay.id === cm.layerId!);
                    if (!l) return;
                    const { w: lw, h: lh } = getLayerDimensions(l);
                    pushHistory("Stretch to Canvas");
                    updateLayer(cm.layerId!, {
                      scaleX: lw > 0 ? width / lw : 1,
                      scaleY: lh > 0 ? height / lh : 1,
                      rotation: 0,
                      x: 0,
                      y: 0,
                    });
                  })}
                  {divider("d-transform")}
                  {menuItem(isLocked ? "Unlock Layer" : "Lock Layer", () =>
                    updateLayer(cm.layerId!, { locked: !isLocked })
                  )}
                  {divider("d4")}
                  {menuItem("Paste Image", () =>
                    pasteImageFromClipboard(cm.canvasX, cm.canvasY)
                  )}
                  {menuItem("Delete", () => removeLayer(cm.layerId!), true)}
                </>
              ) : (
                menuItem("Paste Image", () =>
                  pasteImageFromClipboard(cm.canvasX, cm.canvasY)
                )
              )}
            </div>
          );
        })()}
    </div>
  );
}
