import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@repo/ui/alert-dialog";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { sileo } from "sileo";
import { AddColorBackgroundDialog } from "@/components/editor/AddColorBackgroundDialog";
import { ArtboardView } from "@/components/editor/ArtboardView";
import { BgRemovalPreprocessDialog } from "@/components/editor/BgRemovalPreprocessDialog";
import { CarouselGeneratorDialog } from "@/components/editor/CarouselGeneratorDialog";
import {
  EditorFooter,
  type EditorViewMode,
} from "@/components/editor/EditorFooter";
import { EditorHeader } from "@/components/editor/EditorHeader";
import { EditorToolbar } from "@/components/editor/EditorToolbar";
import { HistoryPanel } from "@/components/editor/HistoryPanel";
import { HorizontalSlideView } from "@/components/editor/HorizontalSlideView";
import { KonvaCanvas } from "@/components/editor/KonvaCanvas";
import { LayersPanel } from "@/components/editor/LayersPanel";
import { PageCarousel } from "@/components/editor/PageCarousel";
import { PropertiesPanel } from "@/components/editor/PropertiesPanel";
import { QuickAiEditDialog } from "@/components/editor/QuickAiEditDialog";
import { RevisionPanel } from "@/components/editor/RevisionPanel";
import { VerticalScrollView } from "@/components/editor/VerticalScrollView";
import { GalleryPicker } from "@/components/GalleryPicker";
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
import {
  deleteRecovery,
  loadRecovery,
  saveRecovery,
} from "@/lib/revision-storage";
import * as sounds from "@/lib/sounds";
import { useAppSettingsStore } from "@/stores/use-app-settings-store";
import type {
  EditorSnapshot,
  ImageLayer,
  Page,
} from "@/stores/use-editor-store";
import { useEditorStore } from "@/stores/use-editor-store";
import {
  type Layer as GalleryLayer,
  type ThumbnailItem,
  useGalleryStore,
} from "@/stores/use-gallery-store";
import { useRevisionStore } from "@/stores/use-revision-store";
import { useTabsStore } from "@/stores/use-tabs-store";

interface ImageEditorProps {
  tabId: string;
  snapshot: EditorSnapshot | null;
  thumbnail: ThumbnailItem;
  onClose: () => void;
  onExport: () => void;
  onAiGenerate: () => void;
  onOpenSettings: () => void;
}

export function ImageEditor({
  tabId,
  snapshot,
  thumbnail,
  onClose,
  onExport,
  onAiGenerate,
  onOpenSettings,
}: ImageEditorProps) {
  const theme = useAppSettingsStore((s) => s.theme);
  const isDark =
    theme === "dark" ||
    (theme === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);

  const containerRef = useRef<HTMLDivElement>(null);
  const exportRef = useRef<(() => string) | null>(null);
  const startPendingGuideRef = useRef<((type: "h" | "v") => void) | null>(null);
  const topRulerRef = useRef<HTMLCanvasElement>(null);
  const leftRulerRef = useRef<HTMLCanvasElement>(null);
  const lastTabIdRef = useRef<string | null>(null);
  const tabUIStateRef = useRef<
    Map<
      string,
      {
        zoom: number;
        panOffset: { x: number; y: number };
        editorViewMode: EditorViewMode;
        rightTab: "layers" | "history" | "revisions";
        savedHistoryIndex: number;
        projectName: string;
        projectId: string | null;
        canvasSize: { width: number; height: number };
      }
    >
  >(new Map());
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeToastIdsRef = useRef<Set<string | number>>(new Set());
  const [isDraggingFilesOnEditor, setIsDraggingFilesOnEditor] = useState(false);
  const editorDragCounterRef = useRef(0);
  const [projectId, setProjectId] = useState<string | null>(thumbnail.id);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showColorBgDialog, setShowColorBgDialog] = useState(false);
  const [showQuickAiEditDialog, setShowQuickAiEditDialog] = useState(false);
  const [showBgRemovalPreprocessDialog, setShowBgRemovalPreprocessDialog] =
    useState(false);
  const [showGalleryPicker, setShowGalleryPicker] = useState(false);
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [showLogoPicker, setShowLogoPicker] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showConfirmClose, setShowConfirmClose] = useState(false);
  const [showRecoveryDialog, setShowRecoveryDialog] = useState(false);
  const [recoveryPages, setRecoveryPages] = useState<Page[] | null>(null);
  const [rightTab, setRightTab] = useState<"layers" | "history" | "revisions">(
    "layers"
  );
  const [savedHistoryIndex, setSavedHistoryIndex] = useState(-1);
  const [canvasSize, setCanvasSize] = useState({
    width: thumbnail.canvasWidth || 1280,
    height: thumbnail.canvasHeight || 720,
  });
  const [zoom, setZoom] = useState(1);
  const [editorViewMode, setEditorViewMode] =
    useState<EditorViewMode>("single");
  const [fitScale, setFitScale] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isPanMode, setIsPanMode] = useState(false);
  const [isCurrentlyPanning, setIsCurrentlyPanning] = useState(false);
  const [isMiddleClickPanning, setIsMiddleClickPanning] = useState(false);
  const panStartRef = useRef<{
    mouseX: number;
    mouseY: number;
    offsetX: number;
    offsetY: number;
  } | null>(null);
  const middlePanStartRef = useRef<{
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
  const { createRevision, loadRevisions } = useRevisionStore();
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
  const pages = useEditorStore((s) => s.pages);
  const activePageIndex = useEditorStore((s) => s.activePageIndex);
  const setActivePage = useEditorStore((s) => s.setActivePage);
  const addPage = useEditorStore((s) => s.addPage);
  const removePage = useEditorStore((s) => s.removePage);
  const duplicatePage = useEditorStore((s) => s.duplicatePage);
  const activeLayerId = activeLayerIds[0] ?? null;

  const hasUnsavedChanges = historyIndex !== savedHistoryIndex;

  const loadFullImageForId = useGalleryStore((s) => s.loadFullImageForId);
  const loadLayerDataForId = useGalleryStore((s) => s.loadLayerDataForId);

  const [, setIsLoadingEditor] = useState(true);

  // Dismiss any active loading toasts when this editor unmounts entirely
  useEffect(() => {
    const toastIds = activeToastIdsRef.current;
    return () => {
      for (const id of toastIds) {
        sileo.dismiss(id);
      }
    };
  }, []);

  // Keep refs in sync so the init effect can read current values without deps
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  const panOffsetRef = useRef(panOffset);
  panOffsetRef.current = panOffset;
  const editorViewModeRef = useRef(editorViewMode);
  editorViewModeRef.current = editorViewMode;
  const rightTabRef = useRef(rightTab);
  rightTabRef.current = rightTab;
  const savedHistoryIndexRef = useRef(savedHistoryIndex);
  savedHistoryIndexRef.current = savedHistoryIndex;
  const projectNameRef = useRef(projectName);
  projectNameRef.current = projectName;
  const projectIdRef = useRef(projectId);
  projectIdRef.current = projectId;
  const canvasSizeRef = useRef(canvasSize);
  canvasSizeRef.current = canvasSize;

  useEffect(() => {
    if (isMiddleClickPanning) {
      document.body.style.cursor = "grabbing";
      return () => {
        document.body.style.cursor = "";
      };
    }
  }, [isMiddleClickPanning]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onMiddleDown = (e: MouseEvent) => {
      if (e.button !== 1) return;
      const mode = editorViewModeRef.current;
      if (mode !== "single" && mode !== "horizontal") return;
      e.stopPropagation();
      e.preventDefault();
      setIsMiddleClickPanning(true);
      middlePanStartRef.current = {
        mouseX: e.clientX,
        mouseY: e.clientY,
        offsetX: panOffsetRef.current.x,
        offsetY: panOffsetRef.current.y,
      };
    };

    const onMiddleMove = (e: MouseEvent) => {
      if (!middlePanStartRef.current) return;
      const dx = e.clientX - middlePanStartRef.current.mouseX;
      const dy = e.clientY - middlePanStartRef.current.mouseY;
      setPanOffset({
        x: middlePanStartRef.current.offsetX + dx,
        y: middlePanStartRef.current.offsetY + dy,
      });
    };

    const onMiddleUp = (e: MouseEvent) => {
      if (e.button !== 1 || !middlePanStartRef.current) return;
      setIsMiddleClickPanning(false);
      middlePanStartRef.current = null;
    };

    el.addEventListener("mousedown", onMiddleDown, { capture: true });
    window.addEventListener("mousemove", onMiddleMove);
    window.addEventListener("mouseup", onMiddleUp);
    return () => {
      el.removeEventListener("mousedown", onMiddleDown, { capture: true });
      window.removeEventListener("mousemove", onMiddleMove);
      window.removeEventListener("mouseup", onMiddleUp);
    };
  }, []);

  // Initialize / re-initialize when the active tab changes
  useEffect(() => {
    const prevTabId = lastTabIdRef.current;
    if (prevTabId === tabId) return;

    // Save UI state for the previous tab before switching away (via refs = always fresh)
    if (prevTabId !== null) {
      tabUIStateRef.current.set(prevTabId, {
        zoom: zoomRef.current,
        panOffset: panOffsetRef.current,
        editorViewMode: editorViewModeRef.current,
        rightTab: rightTabRef.current,
        savedHistoryIndex: savedHistoryIndexRef.current,
        projectName: projectNameRef.current,
        projectId: projectIdRef.current,
        canvasSize: canvasSizeRef.current,
      });
    }

    lastTabIdRef.current = tabId;

    // Reset transient dialog/processing state
    setShowColorBgDialog(false);
    setShowGalleryPicker(false);
    setShowIconPicker(false);
    setShowLogoPicker(false);
    setIsProcessing(false);
    setIsSaving(false);
    setShowConfirmClose(false);
    setShowRecoveryDialog(false);
    setRecoveryPages(null);

    // Restore persisted UI state for this tab or apply defaults
    const saved = tabUIStateRef.current.get(tabId);
    if (saved) {
      setZoom(saved.zoom);
      setPanOffset(saved.panOffset);
      setEditorViewMode(saved.editorViewMode);
      setRightTab(saved.rightTab);
      setSavedHistoryIndex(saved.savedHistoryIndex);
      setProjectName(saved.projectName);
      setProjectId(saved.projectId);
      setCanvasSize(saved.canvasSize);
    } else {
      setZoom(1);
      setPanOffset({ x: 0, y: 0 });
      setEditorViewMode("single");
      setRightTab("layers");
      setSavedHistoryIndex(-1);
      setProjectName(thumbnail.name);
      setProjectId(thumbnail.id);
      setCanvasSize({
        width: thumbnail.canvasWidth || 1280,
        height: thumbnail.canvasHeight || 720,
      });
    }

    // Restore editor store from snapshot, or load fresh from disk
    if (snapshot) {
      useEditorStore.setState({
        pages: snapshot.pages,
        activePageIndex: snapshot.activePageIndex,
        layers: snapshot.layers,
        activeLayerIds: snapshot.activeLayerIds,
        activeTool: snapshot.activeTool,
        canvasWidth: snapshot.canvasWidth,
        canvasHeight: snapshot.canvasHeight,
        brushSize: snapshot.brushSize,
        brushColor: snapshot.brushColor,
        brushOpacity: snapshot.brushOpacity,
        magicSelectTolerance: snapshot.magicSelectTolerance,
        historyPast: snapshot.historyPast,
        historyFuture: snapshot.historyFuture,
        historyIndex: snapshot.historyIndex,
        showRulers: snapshot.showRulers,
        showGrid: snapshot.showGrid,
      });
      setCanvasSize({
        width: snapshot.canvasWidth,
        height: snapshot.canvasHeight,
      });
      setSavedHistoryIndex(snapshot.savedHistoryIndex);
      setIsLoadingEditor(false);
      return;
    }

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
            activeLayerIds: initialLayers[0]?.id ? [initialLayers[0].id] : [],
            canvasWidth: thumbnail.canvasWidth || 1280,
            canvasHeight: thumbnail.canvasHeight || 720,
          });
          setCanvasSize({
            width: thumbnail.canvasWidth || 1280,
            height: thumbnail.canvasHeight || 720,
          });
          const loadedHistoryIndex = useEditorStore.getState().historyIndex;
          setSavedHistoryIndex(loadedHistoryIndex);
          useTabsStore.getState().markTabSaved(tabId, loadedHistoryIndex);
          // Check for crash recovery
          const recovery = await loadRecovery(thumbnail.id);
          if (recovery && recovery.savedAt > (thumbnail.updatedAt ?? 0)) {
            setRecoveryPages(recovery.pages);
            setShowRecoveryDialog(true);
          }
        } else {
          const fullImageUrl = await loadFullImageForId(thumbnail.id);
          if (!fullImageUrl) {
            console.error("[ImageEditor] Failed to load full image");
            setIsLoadingEditor(false);
            return;
          }
          const img = new window.Image();
          img.onload = async () => {
            const w = img.naturalWidth;
            const h = img.naturalHeight;
            // Resize canvas and Background layer without pushing a history entry
            useEditorStore.setState((state) => {
              const resized = state.pages.map((p) => ({
                ...p,
                layers: p.layers.map((l) =>
                  l.name === "Background" &&
                  l.type === "shape" &&
                  l.x === 0 &&
                  l.y === 0
                    ? { ...l, width: w, height: h }
                    : l
                ),
              }));
              return {
                canvasWidth: w,
                canvasHeight: h,
                pages: resized,
                layers: resized[state.activePageIndex]?.layers ?? [],
              };
            });
            addImageLayer(fullImageUrl, w, h);
            setCanvasSize({ width: w, height: h });
            const loadedHistoryIndex = useEditorStore.getState().historyIndex;
            setSavedHistoryIndex(loadedHistoryIndex);
            useTabsStore.getState().markTabSaved(tabId, loadedHistoryIndex);
            // Check for crash recovery (new projects may also have a recovery)
            const rec = await loadRecovery(thumbnail.id);
            if (rec && rec.savedAt > (thumbnail.updatedAt ?? 0)) {
              setRecoveryPages(rec.pages);
              setShowRecoveryDialog(true);
            }
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
    tabId,
    snapshot,
    thumbnail.id,
    thumbnail.updatedAt,
    thumbnail.canvasWidth,
    thumbnail.canvasHeight,
    thumbnail.name,
    addImageLayer,
    reset,
    loadFullImageForId,
    loadLayerDataForId,
  ]);

  // Auto-save recovery every 60s when there are unsaved changes
  useEffect(() => {
    if (!projectId) {
      return;
    }
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }
    autoSaveTimerRef.current = setTimeout(async () => {
      const pages = useEditorStore.getState().pages;
      await saveRecovery(projectId, pages);
    }, 60_000);
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [historyIndex, projectId]);

  // Load revisions when switching to revisions tab
  useEffect(() => {
    if (rightTab === "revisions" && projectId) {
      loadRevisions(projectId);
    }
  }, [rightTab, projectId, loadRevisions]);

  // Calculate fit scale
  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width === 0 || height === 0) continue; // editor hidden via display:none
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

  const handleWheel = useCallback(
    (e: WheelEvent) => {
      if (editorViewMode !== "single" && editorViewMode !== "horizontal")
        return;
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        setZoom((prev) => Math.max(0.1, Math.min(5, prev + delta)));
      }
    },
    [editorViewMode]
  );

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
  useLayoutEffect(() => {
    const topCanvas = topRulerRef.current;
    const leftCanvas = leftRulerRef.current;
    if (!(topCanvas && leftCanvas)) return;

    const rulerW = Math.max(1, workspaceSize.width - RULER_SIZE);
    const rulerH = Math.max(1, workspaceSize.height - RULER_SIZE);

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

    const rulerBg = isDark ? "#1a1a1a" : "#e5e5e5";
    const rulerTick = isDark ? "#555" : "#a3a3a3";
    const rulerLabel = isDark ? "#777" : "#737373";

    const topCtx = topCanvas.getContext("2d");
    if (topCtx) {
      topCtx.clearRect(0, 0, rulerW, RULER_SIZE);
      topCtx.fillStyle = rulerBg;
      topCtx.fillRect(0, 0, rulerW, RULER_SIZE);
      topCtx.strokeStyle = rulerTick;
      topCtx.fillStyle = rulerLabel;
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
      leftCtx.fillStyle = rulerBg;
      leftCtx.fillRect(0, 0, RULER_SIZE, rulerH);
      leftCtx.strokeStyle = rulerTick;
      leftCtx.fillStyle = rulerLabel;
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
    isDark,
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

  const handleEditorFileDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      editorDragCounterRef.current = 0;
      setIsDraggingFilesOnEditor(false);
      if (!e.dataTransfer.files.length) return;
      const { loadDroppedImageFiles } = await import("@/lib/image-file-utils");
      const { parseSvgDimensions } = await import("@/lib/svgl");
      const images = await loadDroppedImageFiles(e.dataTransfer.files);
      for (const { dataUrl, fileName, kind, svgString } of images) {
        await addThumbnail(dataUrl, fileName);
        if (kind === "svg" && svgString) {
          const { width: svgWidth, height: svgHeight } =
            parseSvgDimensions(svgString);
          const maxSize = Math.min(canvasSize.width, canvasSize.height) * 0.4;
          const scale = Math.min(1, maxSize / Math.max(svgWidth, svgHeight));
          useEditorStore
            .getState()
            .addSvgLayer(svgString, svgWidth * scale, svgHeight * scale);
          continue;
        }

        const img = new window.Image();
        await new Promise<void>((resolve) => {
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
            resolve();
          };
          img.onerror = () => resolve();
          img.src = dataUrl;
        });
      }
      if (images.length > 0) {
        sileo.success({
          title: `Added ${images.length} image${images.length > 1 ? "s" : ""}`,
        });
      }
    },
    [addImageLayer, addThumbnail, canvasSize]
  );

  const handleUpscaleLayer = useCallback(
    async (scale: 2 | 4, model: string) => {
      const activeLayer = layers.find((l) => l.id === activeLayerId);
      if (!activeLayer || activeLayer.type !== "image") return;
      setIsProcessing(true);
      const toastId = sileo.show({
        title: `Upscaling ${scale}×… this may take a moment`,
        type: "loading",
        duration: null,
      }) as string;
      activeToastIdsRef.current.add(toastId);
      try {
        const { getUpscalerStatus, downloadUpscaler, upscaleImage } =
          await import("@/lib/upscale");
        const status = await getUpscalerStatus();
        if (!status.available) {
          sileo.show({
            title: "Downloading upscaler (first run only)…",
            type: "loading",
            duration: null,
            id: toastId,
          } as any);
          await downloadUpscaler();
        }
        // x4plus models only run at 4×; handle 2× by resizing the output
        const result = await upscaleImage(
          (activeLayer as import("@/stores/use-editor-store").ImageLayer)
            .dataUrl,
          4,
          model
        );
        const img = new window.Image();
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = reject;
          img.src = result;
        });
        let finalDataUrl = result;
        let finalW = img.naturalWidth;
        let finalH = img.naturalHeight;
        if (scale === 2) {
          finalW = Math.round(img.naturalWidth / 2);
          finalH = Math.round(img.naturalHeight / 2);
          const resizeCanvas = document.createElement("canvas");
          resizeCanvas.width = finalW;
          resizeCanvas.height = finalH;
          resizeCanvas.getContext("2d")!.drawImage(img, 0, 0, finalW, finalH);
          finalDataUrl = resizeCanvas.toDataURL("image/png");
        }
        addImageLayer(finalDataUrl, finalW, finalH);
        sileo.success({
          title: `Upscaled ${scale}× — new layer added`,
          id: toastId,
        } as any);
      } catch (error) {
        sileo.error({
          title: error instanceof Error ? error.message : "Upscaling failed",
          id: toastId,
        } as any);
      } finally {
        activeToastIdsRef.current.delete(toastId);
        setIsProcessing(false);
      }
    },
    [activeLayerId, layers, addImageLayer]
  );

  const runBgRemoval = useCallback(
    async (
      dataUrl: string,
      options?: import("@/lib/bg-removal-pipeline").BgRemovalPipelineOptions
    ) => {
      setIsProcessing(true);
      const toastId = sileo.show({
        title: "Removing background...",
        type: "loading",
        duration: null,
      }) as string;
      activeToastIdsRef.current.add(toastId);
      try {
        const { runBgRemovalPipeline } = await import(
          "@/lib/bg-removal-pipeline"
        );
        const result = await runBgRemovalPipeline(
          dataUrl,
          (stage) =>
            sileo.show({
              title: stage,
              type: "loading",
              duration: null,
              id: toastId,
            } as any),
          options
        );
        const img = new window.Image();
        img.onload = () => addImageLayer(result.dataUrl, img.width, img.height);
        img.src = result.dataUrl;
        const message =
          result.kind === "gemini-only"
            ? "Background replaced with color"
            : "Background removed";
        sileo.success({ title: message, id: toastId } as any);
      } catch (error) {
        sileo.error({
          title:
            error instanceof Error
              ? error.message
              : "Failed to remove background",
          id: toastId,
        } as any);
      } finally {
        activeToastIdsRef.current.delete(toastId);
        setIsProcessing(false);
      }
    },
    [addImageLayer]
  );

  const handleRemoveBackground = useCallback(async () => {
    const activeLayer = layers.find((l) => l.id === activeLayerId);
    if (!activeLayer || activeLayer.type !== "image") {
      return;
    }
    // When Gemini pre-processing is enabled, let the user enter a prompt and
    // pick a background color first, then run the full preprocess + removal.
    // Only show the dialog if a Gemini key is set; otherwise fall through to
    // direct local removal so the action still works.
    if (useAppSettingsStore.getState().bgRemovalGeminiEnabled) {
      const apiKey = await getGeminiApiKey();
      if (apiKey) {
        setShowBgRemovalPreprocessDialog(true);
        return;
      }
    }
    await runBgRemoval((activeLayer as ImageLayer).dataUrl);
  }, [activeLayerId, layers, runBgRemoval]);

  const handleRemoveBackgroundWithPreprocess = useCallback(
    (color: string, prompt: string) => {
      const activeLayer = layers.find((l) => l.id === activeLayerId);
      if (!activeLayer || activeLayer.type !== "image") {
        return;
      }
      setShowBgRemovalPreprocessDialog(false);
      void runBgRemoval((activeLayer as ImageLayer).dataUrl, {
        geminiColor: color,
        geminiPrompt: prompt,
        forceRemove: true,
      });
    },
    [activeLayerId, layers, runBgRemoval]
  );

  const handleSmartCrop = useCallback(() => {
    const activeLayer = layers.find((l) => l.id === activeLayerId);
    if (!activeLayer || activeLayer.type !== "image") return;
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(img, 0, 0);
      const { data, width, height } = ctx.getImageData(
        0,
        0,
        img.width,
        img.height
      );
      let minX = width;
      let minY = height;
      let maxX = -1;
      let maxY = -1;
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const alpha = data[(y * width + x) * 4 + 3];
          if (alpha > 0) {
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      }
      if (maxX < 0) {
        sileo.error({ title: "No visible pixels found" });
        return;
      }
      const cropW = maxX - minX + 1;
      const cropH = maxY - minY + 1;
      if (cropW === width && cropH === height) {
        sileo.info({ title: "No invisible border to remove" });
        return;
      }
      const out = document.createElement("canvas");
      out.width = cropW;
      out.height = cropH;
      const outCtx = out.getContext("2d");
      if (!outCtx) return;
      outCtx.drawImage(img, minX, minY, cropW, cropH, 0, 0, cropW, cropH);
      const newDataUrl = out.toDataURL("image/png");
      const store = useEditorStore.getState();
      store.pushHistory("Smart Crop");
      store.updateLayer(activeLayer.id, {
        dataUrl: newDataUrl,
        x: activeLayer.x + minX * activeLayer.scaleX,
        y: activeLayer.y + minY * activeLayer.scaleY,
        width: cropW,
        height: cropH,
      });
      sileo.success({ title: "Invisible borders removed" });
    };
    img.src = (activeLayer as ImageLayer).dataUrl;
  }, [activeLayerId, layers]);

  const handleAddColorBackground = useCallback(
    async (color: string, extraPrompt: string) => {
      const activeLayer = layers.find((l) => l.id === activeLayerId);
      if (!activeLayer || activeLayer.type !== "image") {
        return;
      }
      setShowColorBgDialog(false);
      setIsProcessing(true);
      const toastId = sileo.show({
        title: "Adding color background...",
        type: "loading",
        duration: null,
      }) as string;
      activeToastIdsRef.current.add(toastId);
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
        const result = await generateImageWithGemini(apiKey, model, prompt, [
          (activeLayer as ImageLayer).dataUrl,
        ]);
        const resultDataUrl = base64ToDataUrl(
          result.imageBase64,
          result.mimeType
        );
        const img = new window.Image();
        img.onload = () => addImageLayer(resultDataUrl, img.width, img.height);
        img.src = resultDataUrl;
        sileo.success({ title: "Color background added", id: toastId } as any);
      } catch (error) {
        sileo.error({
          title:
            error instanceof Error ? error.message : "Failed to add background",
          id: toastId,
        } as any);
      } finally {
        activeToastIdsRef.current.delete(toastId);
        setIsProcessing(false);
      }
    },
    [activeLayerId, layers, addImageLayer]
  );

  const handleQuickAiEdit = useCallback(
    async (prompt: string) => {
      const activeLayer = layers.find((l) => l.id === activeLayerId);
      if (!activeLayer || activeLayer.type !== "image") {
        return;
      }
      setShowQuickAiEditDialog(false);
      setIsProcessing(true);
      const toastId = sileo.show({
        title: "Applying AI edit...",
        type: "loading",
        duration: null,
      }) as string;
      activeToastIdsRef.current.add(toastId);
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
        const result = await generateImageWithGemini(apiKey, model, prompt, [
          (activeLayer as ImageLayer).dataUrl,
        ]);
        const resultDataUrl = base64ToDataUrl(
          result.imageBase64,
          result.mimeType
        );
        const img = new window.Image();
        img.onload = () => addImageLayer(resultDataUrl, img.width, img.height);
        img.src = resultDataUrl;
        sileo.success({
          title: "AI edit applied as new layer",
          id: toastId,
        } as any);
      } catch (error) {
        sileo.error({
          title:
            error instanceof Error ? error.message : "Failed to apply AI edit",
          id: toastId,
        } as any);
      } finally {
        activeToastIdsRef.current.delete(toastId);
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
      const pages = useEditorStore.getState().pages;
      const savedId = await saveProject(
        projectId,
        projectName,
        previewDataUrl,
        layers as unknown as GalleryLayer[],
        canvasSize.width,
        canvasSize.height,
        { pages }
      );
      sileo.success({ title: "Project saved" });
      const newHistoryIndex = useEditorStore.getState().historyIndex;
      setSavedHistoryIndex(newHistoryIndex);
      useTabsStore.getState().markTabSaved(tabId, newHistoryIndex);
      await createRevision(savedId, pages);
      if (savedId) await deleteRecovery(savedId);
    } catch (error) {
      console.error("Save failed:", error);
      sileo.error({ title: "Failed to save" });
    } finally {
      setIsSaving(false);
    }
  }, [
    saveProject,
    projectId,
    projectName,
    layers,
    canvasSize,
    isSaving,
    createRevision,
  ]);

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
    sileo.success({ title: "Saved as new project" });
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
            sileo.success({ title: "Layer saved as new thumbnail" });
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
          useEditorStore.getState().copyLayers();
        } else if (e.key === "d" || e.key === "D") {
          e.preventDefault();
          const { activeLayerIds, duplicateLayer } = useEditorStore.getState();
          for (const id of activeLayerIds) duplicateLayer(id);
        } else if (e.key === "e" || e.key === "E") {
          e.preventDefault();
          onExport();
        }
      } else if (e.key === "Backspace" || e.key === "Delete") {
        // Let KonvaCanvas handle Delete when magic select is active
        if (useEditorStore.getState().activeTool === "magic-select") return;
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
          sileo.info({ title: "Select Tool (V)" });
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
          sileo.info({ title: "Added Text (T)" });
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
          sileo.info({ title: "Added Rectangle (R)" });
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
          sileo.info({ title: "Added Ellipse (O)" });
        } else if (e.key.toLowerCase() === "b") {
          e.preventDefault();
          store.setActiveTool("brush");
          sileo.info({ title: "Brush Tool (B)" });
        } else if (e.key.toLowerCase() === "e") {
          e.preventDefault();
          store.setActiveTool("eraser");
          sileo.info({ title: "Eraser Tool (E)" });
        } else if (e.key.toLowerCase() === "c" && !e.ctrlKey && !e.metaKey) {
          e.preventDefault();
          const { activeLayerIds: ids, layers: ls } = useEditorStore.getState();
          const al = ls.find((l) => l.id === ids[0]);
          if (al?.type === "image") {
            store.setActiveTool("crop");
            sileo.info({ title: "Crop Tool (C)" });
          } else {
            sileo.info({ title: "Select an image layer first" });
          }
        } else if (e.key.toLowerCase() === "w") {
          e.preventDefault();
          const { activeLayerIds: ids, layers: ls } = useEditorStore.getState();
          const al = ls.find((l) => l.id === ids[0]);
          if (al?.type === "image") {
            store.setActiveTool("magic-select");
            sileo.info({ title: "Magic Select (W)" });
          } else {
            sileo.info({ title: "Select an image layer first" });
          }
        } else if (e.key.toLowerCase() === "i") {
          e.preventDefault();
          store.setActiveTool("eyedropper");
          sileo.info({ title: "Eyedropper (I)" });
        } else if (e.key.toLowerCase() === "k") {
          e.preventDefault();
          setShowIconPicker(true);
          sileo.info({ title: "Icon Picker (K)" });
        } else if (e.key.toLowerCase() === "l") {
          e.preventDefault();
          setShowLogoPicker(true);
          sileo.info({ title: "Logo Picker (L)" });
        } else if (e.key.toLowerCase() === "g") {
          if (useAppSettingsStore.getState().experimentalFeaturesEnabled) {
            e.preventDefault();
            setShowCarouselGenerator(true);
            sileo.info({ title: "Generate Carousel (G)" });
          }
        } else if (e.key.toLowerCase() === "x") {
          e.preventDefault();
          const { activeLayerIds: ids, layers: ls } = useEditorStore.getState();
          const al = ls.find((l) => l.id === ids[0]);
          if (al?.type === "image") handleRemoveBackground();
          else sileo.info({ title: "Select an image layer first" });
        } else if (e.key.toLowerCase() === "q") {
          e.preventDefault();
          const { activeLayerIds: ids, layers: ls } = useEditorStore.getState();
          const al = ls.find((l) => l.id === ids[0]);
          if (al?.type === "image") handleSmartCrop();
          else sileo.info({ title: "Select an image layer first" });
        } else if (e.key.toLowerCase() === "a") {
          e.preventDefault();
          onAiGenerate();
        } else if (e.key.toLowerCase() === "p") {
          e.preventDefault();
          const { activeLayerIds: ids, layers: ls } = useEditorStore.getState();
          const al = ls.find((l) => l.id === ids[0]);
          if (al?.type === "image") setShowColorBgDialog(true);
          else sileo.info({ title: "Select an image layer first" });
        } else if (e.key.toLowerCase() === "z" && !e.metaKey && !e.ctrlKey) {
          e.preventDefault();
          const { activeLayerIds: ids, layers: ls } = useEditorStore.getState();
          const al = ls.find((l) => l.id === ids[0]);
          if (al?.type === "image") setShowQuickAiEditDialog(true);
          else sileo.info({ title: "Select an image layer first" });
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
    handleSmartCrop,
    onAiGenerate,
    onExport,
    addThumbnail,
  ]);

  const handleNameChange = useCallback(
    (name: string) => {
      setProjectName(name);
      useTabsStore.getState().updateTabName(tabId, name);
      if (projectId) {
        updateThumbnailName(projectId, name);
      }
    },
    [tabId, projectId, updateThumbnailName]
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
      const id = store.activeLayerIds[0];
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
      const id = store.activeLayerIds[0];
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
      const iconResult = resolveIconToDataUrl(
        spec.iconKeyword,
        spec.iconSize || 64,
        spec.iconColor || spec.fill || "#000000"
      );
      if (iconResult) {
        store.addImageLayer(
          iconResult.dataUrl,
          spec.width || 64,
          spec.height || 64
        );
        const id = store.activeLayerIds[0];
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
        store.addImageLayer(emojiData.url, spec.width || 64, spec.height || 64);
        const id = store.activeLayerIds[0];
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
        width: "width" in l ? l.width : undefined,
        height: "height" in l ? l.height : undefined,
      })),
    };
  }, [canvasSize]);

  const handleGenerateCarousel = useCallback(
    async (config: CarouselGeneratorConfig) => {
      const apiKey = await getGeminiApiKey();
      if (!apiKey) {
        sileo.error({ title: "Please set your Gemini API key in Settings" });
        return;
      }

      setIsProcessing(true);
      setShowCarouselGenerator(false);
      const toastId = sileo.show({
        title: "Generating carousel with Gemini AI...",
        type: "loading",
        duration: null,
      }) as string;
      activeToastIdsRef.current.add(toastId);

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
                  fill:
                    update.fill ||
                    (targetLayer as unknown as { fill?: string }).fill,
                });
              }
            }
          }
        }

        // Go back to first page
        useEditorStore.getState().setActivePage(0);

        sileo.success({
          title: `Generated ${slides.length} slides!`,
          id: toastId,
        } as any);
      } catch (error) {
        console.error("Carousel generation failed:", error);
        sileo.error({
          title: "Failed to generate carousel. Check console for details.",
          id: toastId,
        } as any);
      } finally {
        activeToastIdsRef.current.delete(toastId);
        setIsProcessing(false);
      }
    },
    [canvasSize, applyLayerSpec, getCanvasContext]
  );
  const [showCarouselGenerator, setShowCarouselGenerator] = useState(false);

  const handleAddIcon = useCallback((dataUrl: string) => {
    const img = new window.Image();
    img.onload = () => {
      useEditorStore
        .getState()
        .addImageLayer(dataUrl, img.naturalWidth, img.naturalHeight);
      const id = useEditorStore.getState().activeLayerIds[0];
      if (id) {
        useEditorStore.getState().updateLayer(id, { name: "Icon" });
      }
    };
    img.src = dataUrl;
  }, []);

  return (
    <div
      className="relative flex h-full flex-col bg-background"
      onDragEnter={(e) => {
        if (!e.dataTransfer.types.includes("Files")) return;
        editorDragCounterRef.current += 1;
        setIsDraggingFilesOnEditor(true);
      }}
      onDragLeave={() => {
        editorDragCounterRef.current -= 1;
        if (editorDragCounterRef.current <= 0) {
          editorDragCounterRef.current = 0;
          setIsDraggingFilesOnEditor(false);
        }
      }}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes("Files")) e.preventDefault();
      }}
      onDrop={handleEditorFileDrop}
    >
      {isDraggingFilesOnEditor && (
        <div className="pointer-events-none absolute inset-0 z-[200] flex flex-col items-center justify-center gap-3 border-2 border-primary border-dashed bg-background/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-2">
            <p className="font-medium text-primary text-sm">
              Drop images to add to canvas
            </p>
            <p className="text-muted-foreground text-xs">
              Also saves to gallery
            </p>
          </div>
        </div>
      )}
      <EditorHeader
        hasUnsavedChanges={hasUnsavedChanges}
        onClose={onClose}
        onNameChange={handleNameChange}
        onOpenSettings={onOpenSettings}
        onShowConfirmClose={() => setShowConfirmClose(true)}
        projectName={projectName}
      />

      <div className="flex flex-1 overflow-hidden">
        <EditorToolbar
          isProcessing={isProcessing}
          onAddColorBackground={() => setShowColorBgDialog(true)}
          onAddIcon={handleAddIcon}
          onAddImage={() => setShowGalleryPicker(true)}
          onAiGenerate={onAiGenerate}
          onGenerateCarousel={() => setShowCarouselGenerator(true)}
          onQuickAiEdit={() => setShowQuickAiEditDialog(true)}
          onRemoveBackground={handleRemoveBackground}
          onSaveLayerAsImage={() => {
            const activeLayer = layers.find((l) => l.id === activeLayerId);
            if (activeLayer?.type === "image") {
              const imgLayer = activeLayer as ImageLayer;
              addThumbnail(imgLayer.dataUrl, `${imgLayer.name} (Saved)`);
              sileo.success({ title: "Layer saved as new thumbnail" });
            }
          }}
          onShowIconPickerChange={setShowIconPicker}
          onShowLogoPickerChange={setShowLogoPicker}
          onSmartCrop={handleSmartCrop}
          onUpscaleLayer={handleUpscaleLayer}
          showIconPicker={showIconPicker}
          showLogoPicker={showLogoPicker}
        />

        <div className="flex flex-1 flex-col overflow-hidden">
          <div
            className="relative flex flex-1 overflow-hidden"
            onMouseDown={(e) => {
              if (editorViewMode === "single" && e.target === e.currentTarget) {
                useEditorStore.getState().setActiveLayers([]);
              }
            }}
            ref={containerRef}
          >
            {editorViewMode === "single" && (
              <div className="relative flex h-full w-full items-center justify-center bg-neutral-900">
                {showRulers && (
                  <div
                    className="absolute top-0 left-0 z-[11]"
                    style={{
                      width: RULER_SIZE,
                      height: RULER_SIZE,
                      background: isDark ? "#1a1a1a" : "#e5e5e5",
                    }}
                  />
                )}
                {showRulers && (
                  <canvas
                    className="absolute top-0 z-10 cursor-s-resize"
                    height={RULER_SIZE}
                    onMouseDown={handleTopRulerMouseDown}
                    ref={topRulerRef}
                    style={{ left: RULER_SIZE }}
                    width={Math.max(1, workspaceSize.width - RULER_SIZE)}
                  />
                )}
                {showRulers && (
                  <canvas
                    className="absolute left-0 z-10 cursor-e-resize"
                    height={Math.max(1, workspaceSize.height - RULER_SIZE)}
                    onMouseDown={handleLeftRulerMouseDown}
                    ref={leftRulerRef}
                    style={{ top: RULER_SIZE }}
                    width={RULER_SIZE}
                  />
                )}
                <KonvaCanvas
                  height={canvasSize.height}
                  isDark={isDark}
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
            )}

            {editorViewMode === "vertical" && (
              <VerticalScrollView
                activePageIndex={activePageIndex}
                addPage={addPage}
                canvasHeight={canvasSize.height}
                canvasWidth={canvasSize.width}
                duplicatePage={duplicatePage}
                exportRef={exportRef}
                isDark={isDark}
                pages={pages}
                removePage={removePage}
                setActivePage={setActivePage}
                showGrid={showGrid}
                startPendingGuideRef={startPendingGuideRef}
              />
            )}

            {editorViewMode === "horizontal" && (
              <HorizontalSlideView
                activePageIndex={activePageIndex}
                addPage={addPage}
                canvasHeight={canvasSize.height}
                canvasWidth={canvasSize.width}
                duplicatePage={duplicatePage}
                pages={pages}
                removePage={removePage}
                setActivePage={setActivePage}
              >
                <div className="relative flex h-full w-full items-center justify-center bg-neutral-900">
                  <KonvaCanvas
                    height={canvasSize.height}
                    isDark={isDark}
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
                        if (!(isCurrentlyPanning && panStartRef.current))
                          return;
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
                </div>
              </HorizontalSlideView>
            )}

            {editorViewMode === "artboard" && (
              <ArtboardView
                activePageIndex={activePageIndex}
                addPage={addPage}
                canvasHeight={canvasSize.height}
                canvasWidth={canvasSize.width}
                duplicatePage={duplicatePage}
                exportRef={exportRef}
                isDark={isDark}
                pages={pages}
                removePage={removePage}
                setActivePage={setActivePage}
                showGrid={showGrid}
                startPendingGuideRef={startPendingGuideRef}
              />
            )}
          </div>

          <EditorFooter
            canvasSize={canvasSize}
            editorViewMode={editorViewMode}
            hasUnsavedChanges={hasUnsavedChanges}
            isSaving={isSaving}
            onCanvasSizeChange={handleCanvasSizeChange}
            onEditorViewModeChange={setEditorViewMode}
            onExport={onExport}
            onSave={handleSave}
            onSaveAsNew={handleSaveAsNew}
            onZoomFit={handleZoomFit}
            onZoomIn={handleZoomIn}
            onZoomOut={handleZoomOut}
            zoom={zoom}
          />
        </div>

        <ResizablePanel
          defaultWidth={340}
          maxWidth={500}
          minWidth={200}
          side="right"
        >
          <VerticalResizablePanel
            bottomPanel={<PropertiesPanel />}
            defaultTopHeight={45}
            maxTopHeight={70}
            minTopHeight={25}
            topPanel={
              <div className="flex h-full flex-col overflow-hidden">
                <div className="flex shrink-0 items-center border-border border-b">
                  <button
                    className={`flex-1 py-1.5 text-xs transition-colors ${
                      rightTab === "layers"
                        ? "border-border border-b-2 text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                    onClick={() => {
                      sounds.click();
                      setRightTab("layers");
                    }}
                    type="button"
                  >
                    Layers
                  </button>
                  <button
                    className={`flex-1 py-1.5 text-xs transition-colors ${
                      rightTab === "history"
                        ? "border-border border-b-2 text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                    onClick={() => {
                      sounds.click();
                      setRightTab("history");
                    }}
                    type="button"
                  >
                    History
                  </button>
                  <button
                    className={`flex-1 py-1.5 text-xs transition-colors ${
                      rightTab === "revisions"
                        ? "border-border border-b-2 text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                    onClick={() => {
                      sounds.click();
                      setRightTab("revisions");
                    }}
                    type="button"
                  >
                    Saves
                  </button>
                </div>
                {rightTab === "layers" ? (
                  <LayersPanel />
                ) : rightTab === "history" ? (
                  <HistoryPanel />
                ) : projectId ? (
                  <RevisionPanel
                    onRestored={() => setRightTab("layers")}
                    projectId={projectId}
                  />
                ) : null}
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

      <QuickAiEditDialog
        onConfirm={handleQuickAiEdit}
        onOpenChange={setShowQuickAiEditDialog}
        open={showQuickAiEditDialog}
      />

      <BgRemovalPreprocessDialog
        onConfirm={handleRemoveBackgroundWithPreprocess}
        onOpenChange={setShowBgRemovalPreprocessDialog}
        open={showBgRemovalPreprocessDialog}
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
                sounds.click();
                setShowConfirmClose(false);
                onClose();
              }}
            >
              Leave
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        onOpenChange={setShowRecoveryDialog}
        open={showRecoveryDialog}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Recover Unsaved Work?</AlertDialogTitle>
            <AlertDialogDescription>
              Auto-saved work from a previous session was found. Recover it or
              discard to use the last saved version.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                sounds.click();
                if (projectId) deleteRecovery(projectId);
                setShowRecoveryDialog(false);
              }}
            >
              Discard
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                sounds.success();
                if (recoveryPages) {
                  useEditorStore.setState({
                    pages: recoveryPages,
                    layers: recoveryPages[0]?.layers ?? [],
                    activePageIndex: 0,
                  });
                }
                if (projectId) deleteRecovery(projectId);
                setShowRecoveryDialog(false);
              }}
            >
              Recover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
