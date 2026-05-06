import Konva from "konva";
import { useCallback, useEffect, useRef, useState } from "react";
import {
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
  renderTextLayer,
} from "@/components/editor/layer-renderers";
import {
  type AnimatedImageLayer as AnimatedImageLayerType,
  type DrawLayer as DrawLayerType,
  type Layer as EditorLayer,
  type ImageLayer as ImageLayerType,
  type ShapeLayer as ShapeLayerType,
  type TextLayer as TextLayerType,
  useEditorStore,
} from "@/stores/use-editor-store";

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
}

const SNAP_THRESHOLD = 16;
const RULER_SIZE = 24;
const UI_COLOR = "#7dd3fc";

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
}: KonvaCanvasProps) {
  const inv = 1 / scale;
  const stageRef = useRef<Konva.Stage>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  const imageCache = useRef<Map<string, HTMLImageElement>>(new Map());
  const stageContainerRef = useRef<HTMLDivElement>(null);
  const topRulerRef = useRef<HTMLCanvasElement>(null);
  const leftRulerRef = useRef<HTMLCanvasElement>(null);
  const [snapGuides, setSnapGuides] = useState<SnapGuides>({
    vertical: [],
    horizontal: [],
  });
  const [userGuides, setUserGuides] = useState<{ h: number[]; v: number[] }>({
    h: [],
    v: [],
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
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null);

  // Brush painting refs and state
  const isPainting = useRef(false);
  const paintCanvas = useRef<HTMLCanvasElement | null>(null);
  const lastBrushPos = useRef<{ x: number; y: number } | null>(null);
  const paintPreviewNodeRef = useRef<Konva.Image | null>(null);
  const brushCursorRef = useRef<HTMLDivElement>(null);
  const [paintPreviewProps, setPaintPreviewProps] =
    useState<PaintPreviewProps | null>(null);

  const {
    layers,
    activeLayerIds,
    activeTool,
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
  } = useEditorStore();

  const handleRemoveBackground = useCallback(
    async (layerId: string) => {
      const layer = layers.find((l) => l.id === layerId);
      if (!layer || layer.type !== "image") return;
      const toastId = toast.loading("Removing background…");
      try {
        const { removeBackgroundAsync } = await import(
          "@/lib/background-removal"
        );
        const resultDataUrl = await removeBackgroundAsync(layer.dataUrl);
        const img = new window.Image();
        img.onload = () => {
          addImageLayer(resultDataUrl, img.width, img.height);
          const newId = useEditorStore.getState().activeLayerIds[0];
          if (newId) updateLayer(newId, { x: layer.x, y: layer.y });
          toast.success("Background removed", { id: toastId });
        };
        img.src = resultDataUrl;
      } catch {
        toast.error("Failed to remove background", { id: toastId });
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
        // clipboard API not available or denied — silently ignore
      }
    },
    [addImageLayer, updateLayer, width, height]
  );

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
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [contextMenu]);

  const handleTextDblClick = useCallback((id: string) => {
    setEditingId(id);
    setTimeout(() => {
      if (textAreaRef.current) {
        textAreaRef.current.focus();
        textAreaRef.current.select();
      }
    }, 10);
  }, []);

  const handleTextBlur = useCallback(() => {
    setEditingId(null);
    pushHistory();
  }, [pushHistory]);

  // Draw top ruler
  useEffect(() => {
    const canvas = topRulerRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, width, RULER_SIZE);
    ctx.fillStyle = "#111";
    ctx.fillRect(0, 0, width, RULER_SIZE);
    ctx.strokeStyle = "#555";
    ctx.fillStyle = "#777";
    ctx.font = "8px sans-serif";
    ctx.textAlign = "center";
    for (let x = 0; x <= width; x += 5) {
      const isMajor = x % 100 === 0;
      const isMid = x % 50 === 0;
      const tickH = isMajor ? 10 : isMid ? 7 : 4;
      ctx.beginPath();
      ctx.moveTo(x + 0.5, RULER_SIZE);
      ctx.lineTo(x + 0.5, RULER_SIZE - tickH);
      ctx.stroke();
      if (isMajor && x > 0) ctx.fillText(String(x), x, RULER_SIZE - tickH - 2);
    }
  }, [width]);

  // Draw left ruler
  useEffect(() => {
    const canvas = leftRulerRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, RULER_SIZE, height);
    ctx.fillStyle = "#111";
    ctx.fillRect(0, 0, RULER_SIZE, height);
    ctx.strokeStyle = "#555";
    ctx.fillStyle = "#777";
    ctx.font = "8px sans-serif";
    for (let y = 0; y <= height; y += 5) {
      const isMajor = y % 100 === 0;
      const isMid = y % 50 === 0;
      const tickW = isMajor ? 10 : isMid ? 7 : 4;
      ctx.beginPath();
      ctx.moveTo(RULER_SIZE, y + 0.5);
      ctx.lineTo(RULER_SIZE - tickW, y + 0.5);
      ctx.stroke();
      if (isMajor && y > 0) {
        ctx.save();
        ctx.translate(RULER_SIZE - tickW - 2, y);
        ctx.rotate(-Math.PI / 2);
        ctx.textAlign = "center";
        ctx.fillText(String(y), 0, 0);
        ctx.restore();
      }
    }
  }, [height]);

  useEffect(() => {
    if (!pendingGuideType) return;
    const handleMouseMove = (e: MouseEvent) => {
      const container = stageContainerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      if (pendingGuideType === "h") {
        const pos = e.clientY - rect.top;
        const div = pendingGuideHRef.current;
        if (div) {
          div.style.top = `${pos}px`;
          div.style.display = pos >= 0 && pos <= height ? "block" : "none";
        }
      } else {
        const pos = e.clientX - rect.left;
        const div = pendingGuideVRef.current;
        if (div) {
          div.style.left = `${pos}px`;
          div.style.display = pos >= 0 && pos <= width ? "block" : "none";
        }
      }
    };
    const handleMouseUp = (e: MouseEvent) => {
      const container = stageContainerRef.current;
      if (container) {
        const rect = container.getBoundingClientRect();
        if (pendingGuideType === "h") {
          const pos = e.clientY - rect.top;
          if (pos >= 0 && pos <= height)
            setUserGuides((prev) => ({ ...prev, h: [...prev.h, pos] }));
          if (pendingGuideHRef.current)
            pendingGuideHRef.current.style.display = "none";
        } else {
          const pos = e.clientX - rect.left;
          if (pos >= 0 && pos <= width)
            setUserGuides((prev) => ({ ...prev, v: [...prev.v, pos] }));
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
  }, [pendingGuideType, width, height]);

  const handleTopRulerMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const container = stageContainerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const pos = e.clientY - rect.top;
      const div = pendingGuideHRef.current;
      if (div) {
        div.style.top = `${pos}px`;
        div.style.display = "none";
      }
      setPendingGuideType("h");
    },
    []
  );

  const handleLeftRulerMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const container = stageContainerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const pos = e.clientX - rect.left;
      const div = pendingGuideVRef.current;
      if (div) {
        div.style.left = `${pos}px`;
        div.style.display = "none";
      }
      setPendingGuideType("v");
    },
    []
  );

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
        const dataUrl = stageRef.current.toDataURL({ pixelRatio: 1 });
        transformerRef.current?.show();
        return dataUrl;
      };
    }
  }, [onExportRef]);

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

  // Update canvas cursor for brush/eraser tools
  useEffect(() => {
    const container = stageRef.current?.container();
    if (!container) return;
    if (activeTool === "brush" || activeTool === "eraser") {
      container.style.cursor = "none";
    } else {
      container.style.cursor = "";
    }
  }, [activeTool]);

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

      const vPoints = [0, width, width / 2, ...userGuides.v];
      if (leftMoving) {
        let best = SNAP_THRESHOLD;
        for (const p of vPoints) {
          const d = Math.abs(newLeft - p);
          if (d < best) {
            best = d;
            x = p;
            w = newRight - p;
          }
        }
      } else if (rightMoving) {
        let best = SNAP_THRESHOLD;
        for (const p of vPoints) {
          const d = Math.abs(newRight - p);
          if (d < best) {
            best = d;
            w = p - x;
          }
        }
      }

      const hPoints = [0, height, height / 2, ...userGuides.h];
      if (topMoving) {
        let best = SNAP_THRESHOLD;
        for (const p of hPoints) {
          const d = Math.abs(newTop - p);
          if (d < best) {
            best = d;
            y = p;
            h = newBottom - p;
          }
        }
      } else if (bottomMoving) {
        let best = SNAP_THRESHOLD;
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
    [width, height, userGuides]
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

    const guides: SnapGuides = { vertical: [], horizontal: [] };
    const vPoints = [0, width, width / 2, ...userGuides.v];
    let bestX = SNAP_THRESHOLD;
    for (const p of vPoints) {
      for (const edge of [left, right, cx]) {
        const d = Math.abs(edge - p);
        if (d < bestX) {
          bestX = d;
          guides.vertical = [p];
        }
      }
    }
    const hPoints = [0, height, height / 2, ...userGuides.h];
    let bestY = SNAP_THRESHOLD;
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
  }, [width, height, userGuides]);

  const calculateSnap = useCallback(
    (node: Konva.Node) => {
      const box = node.getClientRect();
      const left = box.x;
      const right = box.x + box.width;
      const top = box.y;
      const bottom = box.y + box.height;
      const cx = box.x + box.width / 2;
      const cy = box.y + box.height / 2;

      const guides: SnapGuides = { vertical: [], horizontal: [] };
      let snapDeltaX = 0;
      let snapDeltaY = 0;

      const vPoints = [0, width, width / 2, ...userGuides.v];
      let bestX = SNAP_THRESHOLD;
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

      const hPoints = [0, height, height / 2, ...userGuides.h];
      let bestY = SNAP_THRESHOLD;
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
    [width, height, userGuides]
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
          tmpImg.src = existingDataUrl;
          if (tmpImg.complete) ctx.drawImage(tmpImg, 0, 0);
        }
      }

      paintCanvas.current = canvas;

      const localPos = worldToLocal(pos.x, pos.y, {
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

      const localPos = worldToLocal(pos.x, pos.y, paintPreviewProps);
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
      pushHistory();
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
    if (activeTool === "brush" || activeTool === "eraser") {
      handleBrushMouseDown(e);
      return;
    }
    if (editingId || activeTool !== "select") return;

    const stage = e.target.getStage();
    const pos = stage?.getPointerPosition();
    if (!pos) return;

    if (e.target === stage) {
      setSelectionBox({
        startX: pos.x,
        startY: pos.y,
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
    if (!selectionBox) return;

    const stage = e.target.getStage();
    const pos = stage?.getPointerPosition();
    if (!pos) return;

    setSelectionBox((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        width: pos.x - prev.startX,
        height: pos.y - prev.startY,
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

    const selectedIds: string[] = [];
    layers.forEach((layer) => {
      const node = stage.findOne(`#${layer.id}`);
      if (node) {
        const nodeRect = node.getClientRect();
        if (Konva.Util.haveIntersection(boxRect, nodeRect)) {
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
      if (activeTool === "brush" || activeTool === "eraser") return;
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
              updateLayer(newLayerId, { x: pos.x, y: pos.y });
            }
          }
        } else if (activeTool === "rect" || activeTool === "ellipse") {
          const pos = e.target.getStage()?.getPointerPosition();
          if (pos) {
            addShapeLayer(activeTool);
            const newLayerId = useEditorStore.getState().activeLayerIds[0];
            if (newLayerId) {
              updateLayer(newLayerId, { x: pos.x, y: pos.y });
            }
          }
        } else {
          setActiveLayers([]);
        }
        return;
      }

      const clickedId = e.target.id();
      if (clickedId) {
        if (e.evt.metaKey || e.evt.ctrlKey || e.evt.shiftKey) {
          toggleLayerSelection(clickedId);
        } else {
          setActiveLayers([clickedId]);
        }
      } else {
        setActiveLayers([]);
      }
    },
    [
      activeTool,
      setActiveLayers,
      toggleLayerSelection,
      addTextLayer,
      addShapeLayer,
      updateLayer,
      editingId,
    ]
  );

  const handleDragStart = useCallback(
    (e: Konva.KonvaEventObject<DragEvent>) => {
      pushHistory();
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
        node.scaleX(1);
        node.scaleY(1);
        if (scaleX !== 1) {
          updateLayer(layer.id, {
            x: node.x(),
            y: node.y(),
            rotation: node.rotation(),
            fontSize: Math.round((layer as TextLayerType).fontSize * scaleX),
          });
        } else {
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
          updateLayer(node.id(), {
            x: node.x(),
            y: node.y(),
            rotation: node.rotation(),
            fontSize: Math.round(layerState.fontSize * scaleX),
          });
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
      pushHistory();
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
      imageCache,
      onDragStart: handleDragStart,
      onDragMove: handleDragMove,
      onDragEnd: handleDragEnd,
      onTransformStart: pushHistory,
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
      style={{ position: "relative", width, height }}
    >
      {/* Corner piece */}
      <div
        style={{
          position: "absolute",
          top: -RULER_SIZE * inv,
          left: -RULER_SIZE * inv,
          width: RULER_SIZE * inv,
          height: RULER_SIZE * inv,
          background: "#111",
          zIndex: 11,
        }}
      />
      {/* Top ruler */}
      <canvas
        height={RULER_SIZE}
        onMouseDown={handleTopRulerMouseDown}
        ref={topRulerRef}
        style={{
          position: "absolute",
          top: -RULER_SIZE * inv,
          left: 0,
          height: RULER_SIZE * inv,
          width,
          cursor: "s-resize",
          zIndex: 10,
        }}
        width={width}
      />
      {/* Left ruler */}
      <canvas
        height={height}
        onMouseDown={handleLeftRulerMouseDown}
        ref={leftRulerRef}
        style={{
          position: "absolute",
          top: 0,
          left: -RULER_SIZE * inv,
          width: RULER_SIZE * inv,
          height,
          cursor: "e-resize",
          zIndex: 10,
        }}
        width={RULER_SIZE}
      />

      <Stage
        height={height}
        onClick={handleStageClick}
        onContextMenu={(e) => {
          e.evt.preventDefault();
          const stage = stageRef.current;
          const pos = stage?.getPointerPosition();
          const container = stageContainerRef.current;
          if (!(container && pos)) return;
          const rect = container.getBoundingClientRect();
          const clickedId =
            e.target === e.target.getStage() ? null : e.target.id() || null;
          if (clickedId && !activeLayerIds.includes(clickedId)) {
            setActiveLayers([clickedId]);
          }
          setContextMenu({
            x: (e.evt.clientX - rect.left) / scale,
            y: (e.evt.clientY - rect.top) / scale,
            canvasX: pos.x,
            canvasY: pos.y,
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
        style={{ background: "#1a1a1a" }}
        width={width}
      >
        <Layer>
          <Rect
            fill="#262626"
            height={height}
            listening={false}
            width={width}
            x={0}
            y={0}
          />

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

          {/* User-created guide lines */}
          {userGuides.h.map((y, i) => (
            <Line
              dragBoundFunc={(pos) => ({ x: 0, y: pos.y })}
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
                  setUserGuides((prev) => ({
                    ...prev,
                    h: prev.h.filter((_, idx) => idx !== i),
                  }));
                } else {
                  setUserGuides((prev) => ({
                    ...prev,
                    h: prev.h.map((v, idx) => (idx === i ? newY : v)),
                  }));
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
              dragBoundFunc={(pos) => ({ x: pos.x, y: 0 })}
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
                  setUserGuides((prev) => ({
                    ...prev,
                    v: prev.v.filter((_, idx) => idx !== i),
                  }));
                } else {
                  setUserGuides((prev) => ({
                    ...prev,
                    v: prev.v.map((v, idx) => (idx === i ? newX : v)),
                  }));
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
              fill="rgba(125, 211, 252, 0.15)"
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
              points={[x, 0, x, height]}
              stroke={UI_COLOR}
              strokeWidth={2 * inv}
            />
          ))}
          {snapGuides.horizontal.map((y) => (
            <Line
              key={`snap-h-${y}`}
              listening={false}
              points={[0, y, width, y]}
              stroke={UI_COLOR}
              strokeWidth={2 * inv}
            />
          ))}

          <Transformer
            anchorCornerRadius={2 * inv}
            anchorFill="#fff"
            anchorSize={10 * inv}
            anchorStroke={UI_COLOR}
            anchorStrokeWidth={1.5 * inv}
            borderStroke={UI_COLOR}
            borderStrokeWidth={1.5 * inv}
            boundBoxFunc={snapBoundBoxFunc}
            onTransform={handleTransformerTransform}
            onTransformEnd={onTransformerEnd}
            ref={transformerRef}
            rotateAnchorOffset={28 * inv}
            rotateEnabled={true}
          />
        </Layer>
      </Stage>

      {editingLayer && editingId && (
        <textarea
          className="absolute m-0 resize-none overflow-hidden border-none bg-transparent p-0 outline-1 focus:outline-blue-500"
          onBlur={handleTextBlur}
          onChange={(e) => {
            updateLayer(editingId, { text: e.target.value });
            e.target.style.width = "0px";
            e.target.style.height = "0px";
            e.target.style.width = `${e.target.scrollWidth + 10}px`;
            e.target.style.height = `${e.target.scrollHeight}px`;
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setEditingId(null);
            } else if (e.key === "Enter" && e.shiftKey) {
              e.preventDefault();
              setEditingId(null);
              pushHistory();
            }
          }}
          ref={textAreaRef}
          style={{
            left: editingLayer.x,
            top: editingLayer.y,
            width: Math.max(
              100,
              (editingLayer.text.length + 1) * editingLayer.fontSize * 0.6
            ),
            height: "auto",
            fontSize: editingLayer.fontSize,
            fontFamily: editingLayer.fontFamily,
            fontWeight: editingLayer.fontStyle.includes("bold")
              ? "bold"
              : "normal",
            fontStyle: editingLayer.fontStyle.includes("italic")
              ? "italic"
              : "normal",
            color: editingLayer.fill,
            lineHeight: 1,
            transform: `rotate(${editingLayer.rotation}deg)`,
            transformOrigin: "top left",
          }}
          value={editingLayer.text}
        />
      )}

      {/* Pending guide overlays */}
      <div
        ref={pendingGuideHRef}
        style={{
          display: "none",
          position: "absolute",
          left: 0,
          top: 0,
          width: "100%",
          height: `${inv}px`,
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
          width: `${inv}px`,
          height: "100%",
          background: UI_COLOR,
          opacity: 0.85,
          pointerEvents: "none",
          zIndex: 5,
        }}
      />

      {/* Brush cursor indicator */}
      <div
        ref={brushCursorRef}
        style={{
          display: "none",
          position: "absolute",
          width: brushSize,
          height: brushSize,
          border: "1.5px solid rgba(255,255,255,0.9)",
          boxShadow: "0 0 0 1px rgba(0,0,0,0.6)",
          borderRadius: "50%",
          transform: "translate(-50%, -50%)",
          pointerEvents: "none",
          zIndex: 20,
        }}
      />

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
                transform: `scale(${inv})`,
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
