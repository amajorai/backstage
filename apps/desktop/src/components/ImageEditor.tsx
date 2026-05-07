import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { AddColorBackgroundDialog } from "@/components/editor/AddColorBackgroundDialog";
import { CarouselGeneratorDialog } from "@/components/editor/CarouselGeneratorDialog";
import { EditorFooter } from "@/components/editor/EditorFooter";
import { EditorHeader } from "@/components/editor/EditorHeader";
import { EditorToolbar } from "@/components/editor/EditorToolbar";
import { HistoryPanel } from "@/components/editor/HistoryPanel";
import { KonvaCanvas } from "@/components/editor/KonvaCanvas";
import { LayersPanel } from "@/components/editor/LayersPanel";
import { PageCarousel } from "@/components/editor/PageCarousel";
import { PropertiesPanel } from "@/components/editor/PropertiesPanel";
import { GalleryPicker } from "@/components/GalleryPicker";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ResizablePanel } from "@/components/ui/resizable-panel";
import { VerticalResizablePanel } from "@/components/ui/vertical-resizable-panel";
import { getGeminiApiKey } from "@/lib/gemini-store";
import {
  type CanvasContext,
  type CarouselGeneratorConfig,
  type CarouselSlideKonva,
  generateCarouselKonvaFull,
  generateCarouselKonvaTemplate,
  type KonvaLayerSpec,
} from "@/lib/gemini-text";
import {
  resolveFormattedEmoji,
  resolveIconToDataUrl,
} from "@/lib/icon-resolver";
import { exportTemplate, importTemplate } from "@/lib/template-manager";
import type { ImageLayer } from "@/stores/use-editor-store";
import { useEditorStore } from "@/stores/use-editor-store";
import {
  type Layer as GalleryLayer,
  type ThumbnailItem,
  useGalleryStore,
} from "@/stores/use-gallery-store";

interface ImageEditorProps {
  thumbnail: ThumbnailItem;
  onClose: () => void;
  onExport: () => void;
  onAiGenerate: (imageDataUrl: string) => void;
}

export function ImageEditor({
  thumbnail,
  onClose,
  onExport,
  onAiGenerate,
}: ImageEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const exportRef = useRef<(() => string) | null>(null);
  const startPendingGuideRef = useRef<((type: "h" | "v") => void) | null>(null);
  const topRulerRef = useRef<HTMLCanvasElement>(null);
  const leftRulerRef = useRef<HTMLCanvasElement>(null);
  const initializedRef = useRef(false);
  const [projectId, setProjectId] = useState<string | null>(thumbnail.id);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showColorBgDialog, setShowColorBgDialog] = useState(false);
  const [showGalleryPicker, setShowGalleryPicker] = useState(false);
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [showLogoPicker, setShowLogoPicker] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showConfirmClose, setShowConfirmClose] = useState(false);
  const [rightTab, setRightTab] = useState<"layers" | "history">("layers");
  const [savedHistoryIndex, setSavedHistoryIndex] = useState(-1);
  const [canvasSize, setCanvasSize] = useState({
    width: thumbnail.canvasWidth || 1280,
    height: thumbnail.canvasHeight || 720,
  });
  const [zoom, setZoom] = useState(1);
  const [fitScale, setFitScale] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isPanMode, setIsPanMode] = useState(false);
  const [isCurrentlyPanning, setIsCurrentlyPanning] = useState(false);
  const panStartRef = useRef<{
    mouseX: number;
    mouseY: number;
    offsetX: number;
    offsetY: number;
  } | null>(null);
  const [workspaceSize, setWorkspaceSize] = useState({
    width: 800,
    height: 600,
  });
  const saveProject = useGalleryStore((s) => s.saveProject);
  const updateThumbnailName = useGalleryStore((s) => s.updateThumbnailName);
  const addThumbnail = useGalleryStore((s) => s.addThumbnail);
  const [projectName, setProjectName] = useState(thumbnail.name);
  const {
    layers,
    activeLayerIds,
    addImageLayer,
    setCanvasSize: setStoreCanvasSize,
    reset,
    undo,
    redo,
    historyIndex,
    showRulers,
    showGrid,
  } = useEditorStore();
  const activeLayerId = activeLayerIds[0] ?? null;

  const hasUnsavedChanges = historyIndex !== savedHistoryIndex;

  const loadFullImageForId = useGalleryStore((s) => s.loadFullImageForId);
  const loadLayerDataForId = useGalleryStore((s) => s.loadLayerDataForId);

  const [, setIsLoadingEditor] = useState(true);

  // Initialize - load from files
  useEffect(() => {
    if (initializedRef.current) {
      return;
    }
    initializedRef.current = true;
    reset();
    setSavedHistoryIndex(-1);
    setIsLoadingEditor(true);

    const loadProject = async () => {
      try {
        const savedData = await loadLayerDataForId(thumbnail.id);
        if (savedData && savedData.length > 0) {
          // Detect if it's new Page[] format or old Layer[] format
          const isPageFormat = "layers" in savedData[0];
          const pages = isPageFormat
            ? (savedData as unknown as any[])
            : [{ id: crypto.randomUUID(), layers: savedData }];

          const initialLayers = pages[0].layers;

          useEditorStore.setState({
            pages,
            activePageIndex: 0,
            layers: initialLayers,
            activeLayerId: initialLayers[0]?.id || null,
            canvasWidth: thumbnail.canvasWidth || 1280,
            canvasHeight: thumbnail.canvasHeight || 720,
          });
          setCanvasSize({
            width: thumbnail.canvasWidth || 1280,
            height: thumbnail.canvasHeight || 720,
          });
          setStoreCanvasSize(
            thumbnail.canvasWidth || 1280,
            thumbnail.canvasHeight || 720
          );
          setSavedHistoryIndex(useEditorStore.getState().historyIndex);
        } else {
          const fullImageUrl = await loadFullImageForId(thumbnail.id);
          if (!fullImageUrl) {
            console.error("[ImageEditor] Failed to load full image");
            setIsLoadingEditor(false);
            return;
          }
          const img = new window.Image();
          img.onload = () => {
            const w = img.naturalWidth;
            const h = img.naturalHeight;
            addImageLayer(fullImageUrl, w, h);
            setCanvasSize({ width: w, height: h });
            setStoreCanvasSize(w, h);
            setSavedHistoryIndex(useEditorStore.getState().historyIndex);
            setIsLoadingEditor(false);
          };
          img.onerror = () => {
            console.error("[ImageEditor] Failed to load image");
            setIsLoadingEditor(false);
          };
          img.src = fullImageUrl;
          return;
        }
      } catch (error) {
        console.error("[ImageEditor] Failed to load project:", error);
      }
      setIsLoadingEditor(false);
    };

    loadProject();
  }, [
    thumbnail.id,
    thumbnail.canvasWidth,
    thumbnail.canvasHeight,
    addImageLayer,
    reset,
    setStoreCanvasSize,
    loadFullImageForId,
    loadLayerDataForId,
  ]);

  // Calculate fit scale
  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        const padding = 60;
        const newFitScale = Math.min(
          (width - padding * 2) / canvasSize.width,
          (height - padding * 2) / canvasSize.height,
          1
        );
        setFitScale(newFitScale);
        setWorkspaceSize({ width, height });
      }
    });
    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, [canvasSize]);

  // Space = pan mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code !== "Space") return;
      const tag = (document.activeElement as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      e.preventDefault();
      setIsPanMode(true);
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code !== "Space") return;
      setIsPanMode(false);
      setIsCurrentlyPanning(false);
      panStartRef.current = null;
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  const handleWheel = useCallback((e: WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      setZoom((prev) => Math.max(0.1, Math.min(5, prev + delta)));
    }
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [handleWheel]);

  const handleZoomIn = () => setZoom((prev) => Math.min(5, prev + 0.25));
  const handleZoomOut = () => setZoom((prev) => Math.max(0.1, prev - 0.25));
  const handleZoomFit = () => setZoom(1);

  const RULER_SIZE = 24;

  // Draw workspace-fixed rulers whenever canvas position or zoom changes
  useEffect(() => {
    const topCanvas = topRulerRef.current;
    const leftCanvas = leftRulerRef.current;
    if (!(topCanvas && leftCanvas)) return;

    const rulerW = Math.max(1, workspaceSize.width - RULER_SIZE);
    const rulerH = Math.max(1, workspaceSize.height - RULER_SIZE);
    topCanvas.width = rulerW;
    topCanvas.height = RULER_SIZE;
    leftCanvas.width = RULER_SIZE;
    leftCanvas.height = rulerH;

    const effectiveScale = fitScale * zoom;
    const canvasLeft =
      (workspaceSize.width - canvasSize.width * effectiveScale) / 2 -
      RULER_SIZE +
      panOffset.x;
    const canvasTop =
      (workspaceSize.height - canvasSize.height * effectiveScale) / 2 -
      RULER_SIZE +
      panOffset.y;

    // Adaptive label interval so ticks don't collide at low zoom
    const minLabelPx = 50;
    const rawInterval = minLabelPx / effectiveScale;
    const magnitude = 10 ** Math.floor(Math.log10(rawInterval));
    const majorInterval = Math.ceil(rawInterval / magnitude) * magnitude;
    const minorStep = Math.max(1, Math.floor(majorInterval / 20));

    const topCtx = topCanvas.getContext("2d");
    if (topCtx) {
      topCtx.clearRect(0, 0, rulerW, RULER_SIZE);
      topCtx.fillStyle = "#111";
      topCtx.fillRect(0, 0, rulerW, RULER_SIZE);
      topCtx.strokeStyle = "#555";
      topCtx.fillStyle = "#777";
      topCtx.font = "8px sans-serif";
      topCtx.textAlign = "center";
      const startX =
        Math.ceil(-canvasLeft / effectiveScale / minorStep) * minorStep;
      const endX = Math.floor((rulerW - canvasLeft) / effectiveScale);
      for (let x = startX; x <= endX; x += minorStep) {
        const px = canvasLeft + x * effectiveScale;
        if (px < 0 || px > rulerW) continue;
        const isMajor = x % majorInterval === 0;
        const isMid = x % (majorInterval / 2) === 0;
        const tickH = isMajor ? 10 : isMid ? 7 : 4;
        topCtx.beginPath();
        topCtx.moveTo(px + 0.5, RULER_SIZE);
        topCtx.lineTo(px + 0.5, RULER_SIZE - tickH);
        topCtx.stroke();
        if (isMajor)
          topCtx.fillText(String(Math.round(x)), px, RULER_SIZE - tickH - 2);
      }
    }

    const leftCtx = leftCanvas.getContext("2d");
    if (leftCtx) {
      leftCtx.clearRect(0, 0, RULER_SIZE, rulerH);
      leftCtx.fillStyle = "#111";
      leftCtx.fillRect(0, 0, RULER_SIZE, rulerH);
      leftCtx.strokeStyle = "#555";
      leftCtx.fillStyle = "#777";
      leftCtx.font = "8px sans-serif";
      const startY =
        Math.ceil(-canvasTop / effectiveScale / minorStep) * minorStep;
      const endY = Math.floor((rulerH - canvasTop) / effectiveScale);
      for (let y = startY; y <= endY; y += minorStep) {
        const py = canvasTop + y * effectiveScale;
        if (py < 0 || py > rulerH) continue;
        const isMajor = y % majorInterval === 0;
        const isMid = y % (majorInterval / 2) === 0;
        const tickW = isMajor ? 10 : isMid ? 7 : 4;
        leftCtx.beginPath();
        leftCtx.moveTo(RULER_SIZE, py + 0.5);
        leftCtx.lineTo(RULER_SIZE - tickW, py + 0.5);
        leftCtx.stroke();
        if (isMajor) {
          leftCtx.save();
          leftCtx.translate(RULER_SIZE - tickW - 2, py);
          leftCtx.rotate(-Math.PI / 2);
          leftCtx.textAlign = "center";
          leftCtx.fillText(String(Math.round(y)), 0, 0);
          leftCtx.restore();
        }
      }
    }
  }, [
    canvasSize.width,
    canvasSize.height,
    fitScale,
    zoom,
    workspaceSize.width,
    workspaceSize.height,
    panOffset.x,
    panOffset.y,
  ]);

  const handleTopRulerMouseDown = useCallback(() => {
    startPendingGuideRef.current?.("h");
  }, []);

  const handleLeftRulerMouseDown = useCallback(() => {
    startPendingGuideRef.current?.("v");
  }, []);

  const handleAddFromGallery = useCallback(
    (dataUrl: string) => {
      const img = new window.Image();
      img.onload = () => {
        let w = img.width;
        let h = img.height;
        const maxSize = Math.min(canvasSize.width, canvasSize.height) * 0.4;
        if (w > maxSize || h > maxSize) {
          const scale = Math.min(maxSize / w, maxSize / h);
          w *= scale;
          h *= scale;
        }
        addImageLayer(dataUrl, w, h);
      };
      img.src = dataUrl;
      setShowGalleryPicker(false);
    },
    [addImageLayer, canvasSize]
  );

  const handleRemoveBackground = useCallback(async () => {
    const activeLayer = layers.find((l) => l.id === activeLayerId);
    if (!activeLayer || activeLayer.type !== "image") {
      return;
    }
    setIsProcessing(true);
    const toastId = toast.loading("Removing background...");
    try {
      const { runBgRemovalPipeline } = await import(
        "@/lib/bg-removal-pipeline"
      );
      const result = await runBgRemovalPipeline(
        (activeLayer as ImageLayer).dataUrl
      );
      const img = new window.Image();
      img.onload = () => addImageLayer(result.dataUrl, img.width, img.height);
      img.src = result.dataUrl;
      const message =
        result.kind === "gemini-only"
          ? "Background replaced with color"
          : "Background removed";
      toast.success(message, { id: toastId });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to remove background",
        { id: toastId }
      );
    } finally {
      setIsProcessing(false);
    }
  }, [activeLayerId, layers, addImageLayer]);

  const handleAddColorBackground = useCallback(
    async (color: string, extraPrompt: string) => {
      const activeLayer = layers.find((l) => l.id === activeLayerId);
      if (!activeLayer || activeLayer.type !== "image") {
        return;
      }
      setShowColorBgDialog(false);
      setIsProcessing(true);
      const toastId = toast.loading("Adding color background...");
      try {
        const apiKey = await getGeminiApiKey();
        if (!apiKey) {
          throw new Error(
            "Gemini API key not set. Add it in Settings → API Keys."
          );
        }
        const { generateImageWithGemini, base64ToDataUrl } = await import(
          "@/lib/gemini-image"
        );
        const { useAppSettingsStore } = await import(
          "@/stores/use-app-settings-store"
        );
        const model = useAppSettingsStore.getState()
          .bgRemovalGeminiModel as import("@/lib/gemini-image").GeminiImageModel;
        const extra = extraPrompt.trim();
        const prompt = `Replace the background of this image with a solid flat ${color} color. Keep the subject (person, object, or foreground element) exactly as-is. Output the full image with the new solid color background.${extra ? ` Additional instructions: ${extra}` : ""}`;
        const result = await generateImageWithGemini(
          apiKey,
          model,
          prompt,
          (activeLayer as ImageLayer).dataUrl
        );
        const resultDataUrl = base64ToDataUrl(
          result.imageBase64,
          result.mimeType
        );
        const img = new window.Image();
        img.onload = () => addImageLayer(resultDataUrl, img.width, img.height);
        img.src = resultDataUrl;
        toast.success("Color background added", { id: toastId });
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Failed to add background",
          { id: toastId }
        );
      } finally {
        setIsProcessing(false);
      }
    },
    [activeLayerId, layers, addImageLayer]
  );

  const handleSave = useCallback(async () => {
    if (!exportRef.current || isSaving) {
      return;
    }
    setIsSaving(true);
    try {
      const previewDataUrl = exportRef.current();
      await saveProject(
        projectId,
        projectName,
        previewDataUrl,
        layers as unknown as GalleryLayer[],
        canvasSize.width,
        canvasSize.height,
        { pages: useEditorStore.getState().pages }
      );
      toast.success("Project saved");
      setSavedHistoryIndex(useEditorStore.getState().historyIndex);
    } catch (error) {
      console.error("Save failed:", error);
      toast.error("Failed to save");
    } finally {
      setIsSaving(false);
    }
  }, [saveProject, projectId, projectName, layers, canvasSize, isSaving]);

  const handleSaveAsNew = useCallback(async () => {
    if (!exportRef.current) {
      return;
    }
    const previewDataUrl = exportRef.current();
    const newId = await saveProject(
      null,
      `${projectName} (Copy)`,
      previewDataUrl,
      layers as unknown as GalleryLayer[],
      canvasSize.width,
      canvasSize.height,
      { pages: useEditorStore.getState().pages }
    );
    setProjectId(newId);
    setProjectName(`${projectName} (Copy)`);
    toast.success("Saved as new project");
  }, [saveProject, projectName, layers, canvasSize]);

  const handleSaveAsTemplate = useCallback(async () => {
    if (!exportRef.current) {
      return;
    }
    const previewDataUrl = exportRef.current();
    const newId = await saveProject(
      null,
      `${projectName} (Template)`,
      previewDataUrl,
      layers as unknown as GalleryLayer[],
      canvasSize.width,
      canvasSize.height,
      { isTemplate: true, pages: useEditorStore.getState().pages }
    );
    setProjectId(newId);
    setProjectName(`${projectName} (Template)`);
    toast.success("Saved as template");
  }, [saveProject, projectName, layers, canvasSize]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input
      if (
        document.activeElement instanceof HTMLInputElement ||
        document.activeElement instanceof HTMLTextAreaElement
      ) {
        return;
      }

      const isCtrlOrMeta = e.ctrlKey || e.metaKey;

      if (isCtrlOrMeta) {
        if (e.key === "s" && e.shiftKey) {
          e.preventDefault();
          const { activeLayerIds, layers: ls } = useEditorStore.getState();
          const al = ls.find((l) => l.id === activeLayerIds[0]);
          if (al?.type === "image") {
            const imgLayer = al as ImageLayer;
            addThumbnail(imgLayer.dataUrl, `${imgLayer.name} (Saved)`);
            toast.success("Layer saved as new thumbnail");
          }
        } else if (e.key === "s") {
          e.preventDefault();
          handleSave();
        } else if (e.key === "z" && !e.shiftKey) {
          e.preventDefault();
          undo();
        } else if (e.key === "y" || (e.key === "z" && e.shiftKey)) {
          e.preventDefault();
          redo();
        } else if (e.key === "c") {
          e.preventDefault();
          // Copy
          useEditorStore.getState().copyLayers();
        } else if (e.key === "v") {
          e.preventDefault();
          useEditorStore.getState().pasteLayers();
        } else if (e.key === "j" || e.key === "J") {
          e.preventDefault();
          const { activeLayerIds, duplicateLayer } = useEditorStore.getState();
          for (const id of activeLayerIds) duplicateLayer(id);
        }
      } else if (e.key === "Backspace" || e.key === "Delete") {
        e.preventDefault();
        const { activeLayerIds, removeLayers } = useEditorStore.getState();
        if (activeLayerIds.length > 0) {
          removeLayers(activeLayerIds);
        }
      } else if (!isCtrlOrMeta) {
        // Tool shortcuts
        const store = useEditorStore.getState();

        if (e.key.toLowerCase() === "v") {
          e.preventDefault();
          store.setActiveTool("select");
          toast.info("Select Tool (V)");
        } else if (e.key.toLowerCase() === "t") {
          e.preventDefault();
          store.addTextLayer("Your Text");
          // Center the new layer
          const newId = store.activeLayerIds[0];
          if (newId) {
            store.updateLayer(newId, {
              x: store.canvasWidth / 2 - 100,
              y: store.canvasHeight / 2 - 24,
            });
          }
          store.setActiveTool("select");
          toast.info("Added Text (T)");
        } else if (e.key.toLowerCase() === "r") {
          e.preventDefault();
          store.addShapeLayer("rect");
          // Center the new layer
          const newId = store.activeLayerIds[0];
          if (newId) {
            store.updateLayer(newId, {
              x: store.canvasWidth / 2 - 100,
              y: store.canvasHeight / 2 - 75,
            });
          }
          store.setActiveTool("select");
          toast.info("Added Rectangle (R)");
        } else if (e.key.toLowerCase() === "o") {
          e.preventDefault();
          store.addShapeLayer("ellipse");
          // Center the new layer
          const newId = store.activeLayerIds[0];
          if (newId) {
            store.updateLayer(newId, {
              x: store.canvasWidth / 2 - 100,
              y: store.canvasHeight / 2 - 75,
            });
          }
          store.setActiveTool("select");
          toast.info("Added Ellipse (O)");
        } else if (e.key.toLowerCase() === "b") {
          e.preventDefault();
          store.setActiveTool("brush");
          toast.info("Brush Tool (B)");
        } else if (e.key.toLowerCase() === "e") {
          e.preventDefault();
          store.setActiveTool("eraser");
          toast.info("Eraser Tool (E)");
        } else if (e.key.toLowerCase() === "i") {
          e.preventDefault();
          setShowGalleryPicker(true);
          toast.info("Add Image (I)");
        } else if (e.key.toLowerCase() === "k") {
          e.preventDefault();
          setShowIconPicker(true);
          toast.info("Icon Picker (K)");
        } else if (e.key.toLowerCase() === "l") {
          e.preventDefault();
          setShowLogoPicker(true);
          toast.info("Logo Picker (L)");
        } else if (e.key.toLowerCase() === "g") {
          e.preventDefault();
          setShowCarouselGenerator(true);
          toast.info("Generate Carousel (G)");
        } else if (e.key.toLowerCase() === "x") {
          e.preventDefault();
          const { activeLayerIds: ids, layers: ls } = useEditorStore.getState();
          const al = ls.find((l) => l.id === ids[0]);
          if (al?.type === "image") handleRemoveBackground();
          else toast.info("Select an image layer first");
        } else if (e.key.toLowerCase() === "a") {
          e.preventDefault();
          const { activeLayerIds: ids, layers: ls } = useEditorStore.getState();
          const al = ls.find((l) => l.id === ids[0]);
          if (al?.type === "image") {
            const imgLayer = al as ImageLayer;
            onAiGenerate(imgLayer.dataUrl);
          } else {
            toast.info("Select an image layer first");
          }
        } else if (e.key.toLowerCase() === "p") {
          e.preventDefault();
          const { activeLayerIds: ids, layers: ls } = useEditorStore.getState();
          const al = ls.find((l) => l.id === ids[0]);
          if (al?.type === "image") setShowColorBgDialog(true);
          else toast.info("Select an image layer first");
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    handleSave,
    undo,
    redo,
    handleRemoveBackground,
    onAiGenerate,
    addThumbnail,
  ]);

  const handleNameChange = useCallback(
    (name: string) => {
      setProjectName(name);
      if (projectId) {
        updateThumbnailName(projectId, name);
      }
    },
    [projectId, updateThumbnailName]
  );

  const handleCanvasSizeChange = useCallback(
    (size: { width: number; height: number }) => {
      setCanvasSize(size);
      setStoreCanvasSize(size.width, size.height);
    },
    [setStoreCanvasSize]
  );

  const effectiveScale = fitScale * zoom;

  // Helper to apply a single layer spec from AI-generated Konva JSON
  const applyLayerSpec = useCallback((spec: KonvaLayerSpec) => {
    const store = useEditorStore.getState();

    if (spec.type === "text" && spec.text) {
      store.addTextLayer(spec.text);
      const id = store.activeLayerId;
      if (id) {
        store.updateLayer(id, {
          name: spec.name || "Text",
          x: spec.x ?? 50,
          y: spec.y ?? 50,
          fontSize: spec.fontSize ?? 32,
          fontFamily: spec.fontFamily ?? "Inter",
          fontStyle: spec.fontStyle ?? "normal",
          fill: spec.fill ?? "#1f2937",
        });
      }
    } else if (spec.type === "shape") {
      store.addShapeLayer(spec.shapeType ?? "rect");
      const id = store.activeLayerId;
      if (id) {
        store.updateLayer(id, {
          name: spec.name || "Shape",
          x: spec.x ?? 0,
          y: spec.y ?? 0,
          width: spec.width ?? 200,
          height: spec.height ?? 200,
          fill: spec.fill ?? "#3b82f6",
          stroke: spec.stroke ?? "",
          strokeWidth: spec.strokeWidth ?? 0,
          cornerRadius: spec.cornerRadius ?? 0,
        });
      }
    } else if (spec.type === "icon" && spec.iconKeyword) {
      const dataUrl = resolveIconToDataUrl(
        spec.iconKeyword,
        spec.iconLibrary || "lucide",
        spec.iconSize || 64,
        spec.iconColor || spec.fill || "#000000"
      );
      if (dataUrl) {
        store.addImageLayer(dataUrl, spec.width || 64, spec.height || 64);
        const id = store.activeLayerId;
        if (id) {
          store.updateLayer(id, {
            name: spec.name || `Icon: ${spec.iconKeyword}`,
            x: spec.x ?? 0,
            y: spec.y ?? 0,
          });
        }
      }
    } else if (spec.type === "emoji" && spec.emojiKeyword) {
      const emojiData = resolveFormattedEmoji(spec.emojiKeyword);
      if (emojiData) {
        store.addAnimatedImageLayer(
          emojiData.frames,
          emojiData.delays,
          spec.width || 64,
          spec.height || 64
        );
        const id = store.activeLayerId;
        if (id) {
          store.updateLayer(id, {
            name: spec.name || `Emoji: ${spec.emojiKeyword}`,
            x: spec.x ?? 0,
            y: spec.y ?? 0,
          });
        }
      }
    }
  }, []);

  // Get current canvas context for template mode
  const getCanvasContext = useCallback((): CanvasContext => {
    const store = useEditorStore.getState();
    const currentPage = store.pages[store.activePageIndex];
    return {
      width: canvasSize.width,
      height: canvasSize.height,
      layers: (currentPage?.layers || []).map((l) => ({
        name: l.name || "Layer",
        type: l.type,
        x: l.x,
        y: l.y,
        width: l.width,
        height: l.height,
      })),
    };
  }, [canvasSize]);

  const handleGenerateCarousel = useCallback(
    async (config: CarouselGeneratorConfig) => {
      const apiKey = await getGeminiApiKey();
      if (!apiKey) {
        toast.error("Please set your Gemini API key in Settings");
        return;
      }

      setIsProcessing(true);
      setShowCarouselGenerator(false);
      const toastId = toast.loading("Generating carousel with Gemini AI...");

      try {
        let slides: CarouselSlideKonva[];

        if (config.mode === "full") {
          slides = await generateCarouselKonvaFull(
            apiKey,
            config,
            canvasSize.width,
            canvasSize.height
          );
        } else {
          const context = getCanvasContext();
          slides = await generateCarouselKonvaTemplate(
            apiKey,
            config,
            context,
            config.count
          );
        }

        const state = useEditorStore.getState();
        const isPage0Empty =
          state.pages.length === 1 &&
          (state.pages[0].layers.length === 0 ||
            (state.pages[0].layers.length === 1 &&
              state.pages[0].layers[0].name === "Background Layer"));

        for (let i = 0; i < slides.length; i++) {
          const slide = slides[i];

          if (config.mode === "full") {
            // Full mode: Create new pages with all layers
            if (i === 0 && isPage0Empty) {
              // Reuse page 0
            } else {
              useEditorStore.getState().addPage();
            }

            // Apply each layer spec from the AI
            for (const layerSpec of slide.layers) {
              applyLayerSpec(layerSpec);
            }
          } else {
            // Template mode: Duplicate current page and update matching layers
            if (i > 0) {
              useEditorStore.getState().duplicatePage(state.activePageIndex);
            }

            const currentPage =
              useEditorStore.getState().pages[
                useEditorStore.getState().activePageIndex
              ];

            // Update layers by matching names
            for (const update of slide.layers) {
              const targetLayer = currentPage.layers.find(
                (l) => l.name === update.name
              );
              if (targetLayer && update.text) {
                useEditorStore.getState().updateLayer(targetLayer.id, {
                  text: update.text,
                  fill: update.fill || targetLayer.fill,
                });
              }
            }
          }
        }

        // Go back to first page
        useEditorStore.getState().setActivePage(0);

        toast.success(`Generated ${slides.length} slides!`, { id: toastId });
      } catch (error) {
        console.error("Carousel generation failed:", error);
        toast.error("Failed to generate carousel. Check console for details.", {
          id: toastId,
        });
      } finally {
        setIsProcessing(false);
      }
    },
    [canvasSize, applyLayerSpec, getCanvasContext]
  );
  const [showCarouselGenerator, setShowCarouselGenerator] = useState(false);

  const handleAddIcon = useCallback((dataUrl: string) => {
    useEditorStore.getState().addImageLayer(dataUrl);
    const id = useEditorStore.getState().activeLayerId;
    if (id) {
      useEditorStore.getState().updateLayer(id, { name: "Icon" });
    }
  }, []);

  const handleExportTemplate = useCallback(async () => {
    setIsProcessing(true);
    const toastId = toast.loading("Exporting template...");
    try {
      const { pages, canvasWidth, canvasHeight } = useEditorStore.getState();
      await exportTemplate(projectName, pages, canvasWidth, canvasHeight);
      toast.success("Template exported successfully!", { id: toastId });
    } catch (error) {
      console.error("Template export failed:", error);
      toast.error("Failed to export template", { id: toastId });
    } finally {
      setIsProcessing(false);
    }
  }, [projectName]);

  const handleImportTemplate = useCallback(async () => {
    setIsProcessing(true);
    const toastId = toast.loading("Importing template...");
    try {
      const result = await importTemplate();
      if (!result) {
        toast.dismiss(toastId);
        return;
      }

      const { pages, width, height, name } = result;

      // Update store
      setStoreCanvasSize(width, height);
      setCanvasSize({ width, height });
      setProjectName(name);

      // We need to use setState directly to replace pages as there is no "setPages" action
      // But we can reset and then add pages.
      // However, useEditorStore doesn't expose a direct "setPages".
      // Let's use `reset()` then iteratively add if needed, or add a `loadState` action.
      // Since we don't want to modify the store contract right now, we can use `replaceState` pattern if available, or hack it?
      // Actually, standard way is to clear and rebuild.

      // Let's check reset() behavior. It resets pages to [empty_page].
      useEditorStore.getState().reset();

      // Now we intentionally hack/inject the state because rebuilding page-by-page might be tedious
      // if we have complex IDs.
      // But `useEditorStore` is a Zustand store. We can call setState on it directly if exported?
      // It is not exported as a variable we can setState on from here directly without the hook...
      // ACTUALLY `useEditorStore.setState({ pages, ... })` works because it's a zustand store!

      useEditorStore.setState({
        pages,
        canvasWidth: width,
        canvasHeight: height,
        activePageIndex: 0,
        historyPast: [],
        historyFuture: [],
        historyIndex: 0,
      });

      toast.success("Template imported successfully!", { id: toastId });
    } catch (error) {
      console.error("Template import failed:", error);
      toast.error("Failed to import template", { id: toastId });
    } finally {
      setIsProcessing(false);
    }
  }, [setStoreCanvasSize]);

  return (
    <div className="flex h-full flex-col bg-background">
      <EditorHeader
        hasUnsavedChanges={hasUnsavedChanges}
        onClose={onClose}
        onExportTemplate={handleExportTemplate}
        onImportTemplate={handleImportTemplate}
        onNameChange={handleNameChange}
        onShowConfirmClose={() => setShowConfirmClose(true)}
        projectName={projectName}
      />

      <div className="flex flex-1 overflow-hidden">
        <EditorToolbar
          isProcessing={isProcessing}
          onAddColorBackground={() => setShowColorBgDialog(true)}
          onAddIcon={handleAddIcon}
          onAddImage={() => setShowGalleryPicker(true)}
          onAiGenerate={() => {
            const activeLayer = layers.find((l) => l.id === activeLayerId);
            if (activeLayer?.type === "image") {
              const imgLayer = activeLayer as ImageLayer;
              onAiGenerate(imgLayer.dataUrl);
            }
          }}
          onGenerateCarousel={() => setShowCarouselGenerator(true)}
          onRemoveBackground={handleRemoveBackground}
          onSaveLayerAsImage={() => {
            const activeLayer = layers.find((l) => l.id === activeLayerId);
            if (activeLayer?.type === "image") {
              const imgLayer = activeLayer as ImageLayer;
              addThumbnail(imgLayer.dataUrl, `${imgLayer.name} (Saved)`);
              toast.success("Layer saved as new thumbnail");
            }
          }}
          onShowIconPickerChange={setShowIconPicker}
          onShowLogoPickerChange={setShowLogoPicker}
          showIconPicker={showIconPicker}
          showLogoPicker={showLogoPicker}
        />

        <div className="flex flex-1 flex-col overflow-hidden">
          <div
            className="relative flex flex-1 items-center justify-center overflow-hidden bg-neutral-900"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) {
                useEditorStore.getState().setActiveLayers([]);
              }
            }}
            ref={containerRef}
          >
            {/* Corner piece */}
            {showRulers && (
              <div
                className="absolute top-0 left-0 z-[11]"
                style={{
                  width: RULER_SIZE,
                  height: RULER_SIZE,
                  background: "#111",
                }}
              />
            )}
            {/* Top ruler — fixed to workspace top edge */}
            {showRulers && (
              <canvas
                className="absolute top-0 z-10 cursor-s-resize"
                height={RULER_SIZE}
                onMouseDown={handleTopRulerMouseDown}
                ref={topRulerRef}
                style={{ left: RULER_SIZE }}
              />
            )}
            {/* Left ruler — fixed to workspace left edge */}
            {showRulers && (
              <canvas
                className="absolute left-0 z-10 cursor-e-resize"
                onMouseDown={handleLeftRulerMouseDown}
                ref={leftRulerRef}
                style={{ top: RULER_SIZE }}
                width={RULER_SIZE}
              />
            )}
            <KonvaCanvas
              height={canvasSize.height}
              onExportRef={exportRef}
              panOffset={panOffset}
              scale={effectiveScale}
              showGrid={showGrid}
              startPendingGuideRef={startPendingGuideRef}
              width={canvasSize.width}
              workspaceHeight={workspaceSize.height}
              workspaceWidth={workspaceSize.width}
            />
            {isPanMode && (
              <div
                onMouseDown={(e) => {
                  setIsCurrentlyPanning(true);
                  panStartRef.current = {
                    mouseX: e.clientX,
                    mouseY: e.clientY,
                    offsetX: panOffset.x,
                    offsetY: panOffset.y,
                  };
                }}
                onMouseLeave={() => {
                  setIsCurrentlyPanning(false);
                  panStartRef.current = null;
                }}
                onMouseMove={(e) => {
                  if (!(isCurrentlyPanning && panStartRef.current)) return;
                  const dx = e.clientX - panStartRef.current.mouseX;
                  const dy = e.clientY - panStartRef.current.mouseY;
                  setPanOffset({
                    x: panStartRef.current.offsetX + dx,
                    y: panStartRef.current.offsetY + dy,
                  });
                }}
                onMouseUp={() => {
                  setIsCurrentlyPanning(false);
                  panStartRef.current = null;
                }}
                style={{
                  position: "absolute",
                  inset: 0,
                  zIndex: 100,
                  cursor: isCurrentlyPanning ? "grabbing" : "grab",
                }}
              />
            )}
            <div className="absolute bottom-4 left-1/2 z-50 -translate-x-1/2">
              <PageCarousel />
            </div>
          </div>

          <EditorFooter
            canvasSize={canvasSize}
            hasUnsavedChanges={hasUnsavedChanges}
            isSaving={isSaving}
            onCanvasSizeChange={handleCanvasSizeChange}
            onExport={onExport}
            onSave={handleSave}
            onSaveAsNew={handleSaveAsNew}
            onSaveAsTemplate={handleSaveAsTemplate}
            onZoomFit={handleZoomFit}
            onZoomIn={handleZoomIn}
            onZoomOut={handleZoomOut}
            zoom={zoom}
          />
        </div>

        <ResizablePanel
          defaultWidth={260}
          maxWidth={360}
          minWidth={180}
          side="right"
        >
          <VerticalResizablePanel
            bottomPanel={<PropertiesPanel />}
            defaultTopHeight={45}
            maxTopHeight={70}
            minTopHeight={25}
            topPanel={
              <div className="flex h-full flex-col overflow-hidden">
                <div className="flex shrink-0 border-neutral-700 border-b">
                  <button
                    className={`flex-1 py-1.5 text-xs transition-colors ${
                      rightTab === "layers"
                        ? "border-blue-500 border-b-2 text-white"
                        : "text-neutral-400 hover:text-neutral-200"
                    }`}
                    onClick={() => setRightTab("layers")}
                    type="button"
                  >
                    Layers
                  </button>
                  <button
                    className={`flex-1 py-1.5 text-xs transition-colors ${
                      rightTab === "history"
                        ? "border-blue-500 border-b-2 text-white"
                        : "text-neutral-400 hover:text-neutral-200"
                    }`}
                    onClick={() => setRightTab("history")}
                    type="button"
                  >
                    History
                  </button>
                </div>
                {rightTab === "layers" ? <LayersPanel /> : <HistoryPanel />}
              </div>
            }
          />
        </ResizablePanel>
      </div>

      <AddColorBackgroundDialog
        isProcessing={isProcessing}
        onConfirm={handleAddColorBackground}
        onOpenChange={setShowColorBgDialog}
        open={showColorBgDialog}
      />

      <CarouselGeneratorDialog
        currentCanvasContext={
          showCarouselGenerator ? getCanvasContext() : undefined
        }
        onGenerate={handleGenerateCarousel}
        onOpenChange={setShowCarouselGenerator}
        open={showCarouselGenerator}
      />

      {showGalleryPicker && (
        <GalleryPicker
          onClose={() => setShowGalleryPicker(false)}
          onSelect={handleAddFromGallery}
        />
      )}

      <AlertDialog onOpenChange={setShowConfirmClose} open={showConfirmClose}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unsaved Changes</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes. Are you sure you want to leave? Your
              changes will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setShowConfirmClose(false);
                onClose();
              }}
            >
              Leave
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
