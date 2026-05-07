import { create } from "zustand";

// Base layer properties
interface BaseLayer {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  x: number;
  y: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
  opacity: number;
}
// Image layer
export interface ImageLayer extends BaseLayer {
  type: "image";
  dataUrl: string;
  width: number;
  height: number;
  cornerRadius: number | [number, number, number, number];
}
// Text layer with rich styling
export interface TextLayer extends BaseLayer {
  type: "text";
  text: string;
  fontSize: number;
  fontFamily: string;
  fontStyle: "normal" | "bold" | "italic" | "bold italic";
  fill: string;
  stroke: string;
  strokeWidth: number;
  shadowColor: string;
  shadowBlur: number;
  shadowOffsetX: number;
  shadowOffsetY: number;
}
// Shape layer
export interface ShapeLayer extends BaseLayer {
  type: "shape";
  shapeType: "rect" | "ellipse";
  width: number;
  height: number;
  fill: string;
  stroke: string;
  strokeWidth: number;
  cornerRadius: number | [number, number, number, number];
}
// Animated Image layer (for APNGs like Fluent Emojis)
export interface AnimatedImageLayer extends BaseLayer {
  type: "animated-image";
  frames: string[]; // Array of data URLs for each frame
  delays: number[]; // Delay for each frame in ms
  currentFrame: number;
  width: number;
  height: number;
  cornerRadius: number | [number, number, number, number];
}
// Draw layer — raster paint/draw strokes, always full-canvas or per-layer
export interface DrawLayer extends BaseLayer {
  type: "draw";
  dataUrl: string;
  width: number;
  height: number;
}
export type Layer =
  | ImageLayer
  | TextLayer
  | ShapeLayer
  | AnimatedImageLayer
  | DrawLayer;

export interface Page {
  id: string;
  layers: Layer[];
}

interface EditorState {
  // Multi-page support
  pages: Page[];
  activePageIndex: number;
  // Legacy support & convenience (always reflects active page layers)
  layers: Layer[];

  activeLayerIds: string[];
  activeTool: "select" | "text" | "rect" | "ellipse" | "brush" | "eraser";
  canvasWidth: number;
  canvasHeight: number;
  // Brush settings
  brushSize: number;
  brushColor: string;
  brushOpacity: number;
  history: Page[][]; // History now tracks pages snapshot
  historyIndex: number;
  clipboard: Layer[];
  // View toggles
  showRulers: boolean;
  showGrid: boolean;
  toggleRulers: () => void;
  toggleGrid: () => void;
  // Layer CRUD
  addImageLayer: (dataUrl: string, width: number, height: number) => void;
  addAnimatedImageLayer: (
    frames: string[],
    delays: number[],
    width: number,
    height: number
  ) => void;
  addTextLayer: (text: string) => void;
  addShapeLayer: (shapeType: "rect" | "ellipse") => void;
  addEmptyLayer: () => void;
  addDrawLayer: (dataUrl: string, width: number, height: number) => void;
  removeLayer: (id: string) => void;
  removeLayers: (ids: string[]) => void;
  copyLayers: () => void;
  pasteLayers: () => void;
  duplicateLayer: (id: string) => void;
  setLayerAsBackground: (id: string) => void;
  updateLayer: (id: string, updates: Partial<Layer>) => void;
  // Page CRUD
  addPage: () => void;
  removePage: (index: number) => void;
  setActivePage: (index: number) => void;
  duplicatePage: (index: number) => void;
  reorderPages: (fromIndex: number, toIndex: number) => void;

  // Selection
  setActiveLayers: (ids: string[]) => void;
  toggleLayerSelection: (id: string) => void;
  setActiveTool: (
    tool: "select" | "text" | "rect" | "ellipse" | "brush" | "eraser"
  ) => void;
  // Brush settings
  setBrushSize: (size: number) => void;
  setBrushColor: (color: string) => void;
  setBrushOpacity: (opacity: number) => void;
  // Ordering
  moveLayer: (id: string, direction: "up" | "down") => void;
  reorderLayers: (fromIndex: number, toIndex: number) => void;
  // Canvas
  setCanvasSize: (width: number, height: number) => void;
  reset: () => void;
  // History
  pushHistory: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  // Internal helper to sync state
  _syncLayers: (pages: Page[], activeIndex: number) => void;
}

export const useEditorStore = create<EditorState>((set, get) => ({
  pages: [{ id: crypto.randomUUID(), layers: [] }],
  activePageIndex: 0,
  layers: [],
  activeLayerIds: [],
  activeTool: "select",
  canvasWidth: 1280,
  canvasHeight: 720,
  brushSize: 20,
  brushColor: "#000000",
  brushOpacity: 1,
  history: [],
  historyIndex: -1,
  clipboard: (() => {
    try {
      const stored = localStorage.getItem("youtube.pub:clipboard:v1");
      return stored ? (JSON.parse(stored) as Layer[]) : [];
    } catch {
      return [];
    }
  })(),
  showRulers: true,
  showGrid: true,

  toggleRulers: () => set((s) => ({ showRulers: !s.showRulers })),
  toggleGrid: () => set((s) => ({ showGrid: !s.showGrid })),

  _syncLayers: (pages, activeIndex) => {
    set({
      pages,
      activePageIndex: activeIndex,
      layers: pages[activeIndex]?.layers || [],
    });
  },

  addImageLayer: (dataUrl, width, height) => {
    get().pushHistory();
    const newLayer: ImageLayer = {
      id: crypto.randomUUID(),
      type: "image",
      name: "Image",
      visible: true,
      locked: false,
      x: 0,
      y: 0,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      opacity: 1,
      dataUrl,
      width,
      height,
      cornerRadius: 0,
    };

    const { pages, activePageIndex } = get();
    const newPages = [...pages];
    newPages[activePageIndex] = {
      ...newPages[activePageIndex],
      layers: [...newPages[activePageIndex].layers, newLayer],
    };

    set(() => ({
      pages: newPages,
      layers: newPages[activePageIndex].layers,
      activeLayerIds: [newLayer.id],
    }));
  },

  addAnimatedImageLayer: (frames, delays, width, height) => {
    get().pushHistory();
    const newLayer: AnimatedImageLayer = {
      id: crypto.randomUUID(),
      type: "animated-image",
      name: "Animated Image",
      visible: true,
      locked: false,
      x: 0,
      y: 0,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      opacity: 1,
      frames,
      delays,
      currentFrame: 0,
      width,
      height,
      cornerRadius: 0,
    };

    const { pages, activePageIndex } = get();
    const newPages = [...pages];
    newPages[activePageIndex] = {
      ...newPages[activePageIndex],
      layers: [...newPages[activePageIndex].layers, newLayer],
    };

    set(() => ({
      pages: newPages,
      layers: newPages[activePageIndex].layers,
      activeLayerIds: [newLayer.id],
    }));
  },

  addTextLayer: (text) => {
    get().pushHistory();
    const newLayer: TextLayer = {
      id: crypto.randomUUID(),
      type: "text",
      name: text.slice(0, 20) || "Text",
      visible: true,
      locked: false,
      x: 100,
      y: 100,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      opacity: 1,
      text,
      fontSize: 48,
      fontFamily: "Inter",
      fontStyle: "normal",
      fill: "#ffffff",
      stroke: "",
      strokeWidth: 0,
      shadowColor: "rgba(0,0,0,0.5)",
      shadowBlur: 0,
      shadowOffsetX: 0,
      shadowOffsetY: 0,
    };

    const { pages, activePageIndex } = get();
    const newPages = [...pages];
    newPages[activePageIndex] = {
      ...newPages[activePageIndex],
      layers: [...newPages[activePageIndex].layers, newLayer],
    };

    set(() => ({
      pages: newPages,
      layers: newPages[activePageIndex].layers,
      activeLayerIds: [newLayer.id],
    }));
  },

  addDrawLayer: (dataUrl, width, height) => {
    get().pushHistory();
    const newLayer: DrawLayer = {
      id: crypto.randomUUID(),
      type: "draw",
      name: "Paint",
      visible: true,
      locked: false,
      x: 0,
      y: 0,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      opacity: 1,
      dataUrl,
      width,
      height,
    };

    const { pages, activePageIndex } = get();
    const newPages = [...pages];
    newPages[activePageIndex] = {
      ...newPages[activePageIndex],
      layers: [...newPages[activePageIndex].layers, newLayer],
    };

    set(() => ({
      pages: newPages,
      layers: newPages[activePageIndex].layers,
      activeLayerIds: [newLayer.id],
    }));
  },

  addShapeLayer: (shapeType) => {
    get().pushHistory();
    const newLayer: ShapeLayer = {
      id: crypto.randomUUID(),
      type: "shape",
      name: shapeType === "rect" ? "Rectangle" : "Ellipse",
      visible: true,
      locked: false,
      x: 100,
      y: 100,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      opacity: 1,
      shapeType,
      width: 200,
      height: 150,
      fill: "#3b82f6",
      stroke: "#1d4ed8",
      strokeWidth: 2,
      cornerRadius: shapeType === "rect" ? 8 : 0,
    };

    const { pages, activePageIndex } = get();
    const newPages = [...pages];
    newPages[activePageIndex] = {
      ...newPages[activePageIndex],
      layers: [...newPages[activePageIndex].layers, newLayer],
    };

    set(() => ({
      pages: newPages,
      layers: newPages[activePageIndex].layers,
      activeLayerIds: [newLayer.id],
    }));
  },

  addEmptyLayer: () => {
    get().pushHistory();
    const { pages, activePageIndex, canvasWidth, canvasHeight } = get();
    const newLayer: ShapeLayer = {
      id: crypto.randomUUID(),
      type: "shape",
      name: "Layer",
      visible: true,
      locked: false,
      x: 0,
      y: 0,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      opacity: 1,
      shapeType: "rect",
      width: canvasWidth,
      height: canvasHeight,
      fill: "rgba(0,0,0,0)",
      stroke: "rgba(0,0,0,0)",
      strokeWidth: 0,
      cornerRadius: 0,
    };

    const newPages = [...pages];
    newPages[activePageIndex] = {
      ...newPages[activePageIndex],
      layers: [...newPages[activePageIndex].layers, newLayer],
    };

    set(() => ({
      pages: newPages,
      layers: newPages[activePageIndex].layers,
      activeLayerIds: [newLayer.id],
    }));
  },

  removeLayer: (id) => {
    get().pushHistory();
    const { pages, activePageIndex, activeLayerIds } = get();
    const newPages = [...pages];
    const currentCallback = newPages[activePageIndex];

    newPages[activePageIndex] = {
      ...currentCallback,
      layers: currentCallback.layers.filter((l) => l.id !== id),
    };

    set(() => ({
      pages: newPages,
      layers: newPages[activePageIndex].layers,
      activeLayerIds: activeLayerIds.filter((currentId) => currentId !== id),
    }));
  },

  removeLayers: (ids) => {
    const { pages, activePageIndex, activeLayerIds } = get();
    const newPages = [...pages];
    const currentCallback = newPages[activePageIndex];
    const idsToRemove = new Set(ids);

    // Don't remove locked layers
    const layersToRemove = currentCallback.layers.filter(
      (l) => idsToRemove.has(l.id) && !l.locked
    );
    const safeIdsToRemove = new Set(layersToRemove.map((l) => l.id));

    if (safeIdsToRemove.size === 0) {
      return;
    }

    newPages[activePageIndex] = {
      ...currentCallback,
      layers: currentCallback.layers.filter((l) => !safeIdsToRemove.has(l.id)),
    };

    set(() => ({
      pages: newPages,
      layers: newPages[activePageIndex].layers,
      activeLayerIds: activeLayerIds.filter((id) => !safeIdsToRemove.has(id)),
    }));
  },

  copyLayers: () => {
    const { layers, activeLayerIds } = get();
    const activeIdSet = new Set(activeLayerIds);
    const layersToCopy = layers.filter(
      (l) => activeIdSet.has(l.id) && !l.locked
    );

    if (layersToCopy.length > 0) {
      const clipped: Layer[] = JSON.parse(JSON.stringify(layersToCopy));
      set({ clipboard: clipped });
      try {
        localStorage.setItem(
          "youtube.pub:clipboard:v1",
          JSON.stringify(clipped)
        );
      } catch {}
    }
  },

  pasteLayers: () => {
    let { clipboard } = get();

    if (!clipboard || clipboard.length === 0) {
      try {
        const stored = localStorage.getItem("youtube.pub:clipboard:v1");
        if (stored) clipboard = JSON.parse(stored) as Layer[];
      } catch {}
    }

    if (!clipboard || clipboard.length === 0) return;

    get().pushHistory();
    const { pages, activePageIndex } = get();
    const newPages = [...pages];
    const currentCallback = newPages[activePageIndex];

    // Create new layers with offset
    const newLayers = clipboard.map((layer) => ({
      ...layer,
      id: crypto.randomUUID(),
      x: layer.x + 20,
      y: layer.y + 20,
    }));

    newPages[activePageIndex] = {
      ...currentCallback,
      layers: [...currentCallback.layers, ...newLayers],
    };

    set(() => ({
      pages: newPages,
      layers: newPages[activePageIndex].layers,
      activeLayerIds: newLayers.map((l) => l.id), // Select pasted layers
    }));
  },

  duplicateLayer: (id) => {
    get().pushHistory();
    const { layers, pages, activePageIndex } = get();
    const layer = layers.find((l) => l.id === id);
    if (!layer) return;
    const newLayer = {
      ...JSON.parse(JSON.stringify(layer)),
      id: crypto.randomUUID(),
      x: layer.x + 20,
      y: layer.y + 20,
    };
    const newPages = [...pages];
    newPages[activePageIndex] = {
      ...newPages[activePageIndex],
      layers: [...newPages[activePageIndex].layers, newLayer],
    };
    set({
      pages: newPages,
      layers: newPages[activePageIndex].layers,
      activeLayerIds: [newLayer.id],
    });
  },

  setLayerAsBackground: (id) => {
    get().pushHistory();
    const { layers, pages, activePageIndex, canvasWidth, canvasHeight } = get();
    const layerIndex = layers.findIndex((l) => l.id === id);
    if (layerIndex === -1) return;
    const layer = layers[layerIndex];
    const newLayers = layers.filter((_, i) => i !== layerIndex);
    const updatedLayer = {
      ...layer,
      x: 0,
      y: 0,
      scaleX: 1,
      scaleY: 1,
      rotation: 0,
      ...(layer.type === "image" ||
      layer.type === "animated-image" ||
      layer.type === "shape"
        ? { width: canvasWidth, height: canvasHeight }
        : {}),
    } as Layer;
    newLayers.unshift(updatedLayer);
    const newPages = [...pages];
    newPages[activePageIndex] = {
      ...newPages[activePageIndex],
      layers: newLayers,
    };
    set({ pages: newPages, layers: newLayers });
  },

  updateLayer: (id, updates) => {
    const { pages, activePageIndex } = get();
    const newPages = [...pages];
    const currentCallback = newPages[activePageIndex];

    newPages[activePageIndex] = {
      ...currentCallback,
      layers: currentCallback.layers.map((l) =>
        l.id === id ? ({ ...l, ...updates } as Layer) : l
      ),
    };

    set(() => ({
      pages: newPages,
      layers: newPages[activePageIndex].layers,
    }));
  },

  setActiveLayers: (ids) => set({ activeLayerIds: ids }),
  toggleLayerSelection: (id) =>
    set((state) => {
      const currentIds = state.activeLayerIds;
      if (currentIds.includes(id)) {
        return { activeLayerIds: currentIds.filter((i) => i !== id) };
      }
      return { activeLayerIds: [...currentIds, id] };
    }),
  setActiveTool: (tool) => set({ activeTool: tool }),
  setBrushSize: (size) => set({ brushSize: size }),
  setBrushColor: (color) => set({ brushColor: color }),
  setBrushOpacity: (opacity) => set({ brushOpacity: opacity }),

  moveLayer: (id, direction) => {
    get().pushHistory();
    const { pages, activePageIndex } = get();
    const newPages = [...pages];
    const currentCallback = newPages[activePageIndex];
    const layers = [...currentCallback.layers];

    const index = layers.findIndex((l) => l.id === id);
    if (index === -1) {
      return;
    }

    const newIndex = direction === "up" ? index + 1 : index - 1;
    if (newIndex < 0 || newIndex >= layers.length) {
      return;
    }

    [layers[index], layers[newIndex]] = [layers[newIndex], layers[index]];

    newPages[activePageIndex] = {
      ...currentCallback,
      layers,
    };

    set({ pages: newPages, layers });
  },

  reorderLayers: (fromIndex, toIndex) => {
    get().pushHistory();
    const { pages, activePageIndex } = get();
    const newPages = [...pages];
    const currentCallback = newPages[activePageIndex];
    const layers = [...currentCallback.layers];

    const [removed] = layers.splice(fromIndex, 1);
    layers.splice(toIndex, 0, removed);

    newPages[activePageIndex] = {
      ...currentCallback,
      layers,
    };

    set({ pages: newPages, layers });
  },

  // Page Actions
  addPage: () => {
    get().pushHistory();
    const { pages, canvasWidth, canvasHeight } = get();

    const bgLayer: ShapeLayer = {
      id: crypto.randomUUID(),
      type: "shape",
      shapeType: "rect",
      name: "Background",
      visible: true,
      locked: true,
      x: 0,
      y: 0,
      width: canvasWidth,
      height: canvasHeight,
      fill: "#ffffff",
      stroke: "",
      strokeWidth: 0,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      opacity: 1,
      cornerRadius: 0,
    };

    const newPage: Page = {
      id: crypto.randomUUID(),
      layers: [bgLayer],
    };

    // Check if previous page has a full-size rect background, duplicate it?
    // For now, clean slate.
    const newPages = [...pages, newPage];
    const newIndex = newPages.length - 1;

    set({
      pages: newPages,
      activePageIndex: newIndex,
      layers: newPage.layers,
      activeLayerIds: [],
    });
  },

  removePage: (index) => {
    get().pushHistory();
    const { pages, activePageIndex } = get();
    if (pages.length <= 1) {
      return; // Cannot remove last page
    }

    const newPages = pages.filter((_, i) => i !== index);
    let newActiveIndex = activePageIndex;
    if (index === activePageIndex) {
      newActiveIndex = Math.max(0, index - 1);
    } else if (activePageIndex > index) {
      newActiveIndex = activePageIndex - 1;
    }

    set({
      pages: newPages,
      activePageIndex: newActiveIndex,
      layers: newPages[newActiveIndex].layers,
      activeLayerIds: [],
    });
  },

  setActivePage: (index) => {
    const { pages } = get();
    if (pages[index]) {
      set({
        activePageIndex: index,
        layers: pages[index].layers,
        activeLayerIds: [],
      });
    }
  },

  duplicatePage: (index) => {
    get().pushHistory();
    const { pages } = get();
    const pageToDup = pages[index];
    if (!pageToDup) {
      return;
    }

    // Deep clone layers
    const newLayers = JSON.parse(JSON.stringify(pageToDup.layers)).map(
      (l: Layer) => ({
        ...l,
        id: crypto.randomUUID(), // Ensure new IDs for layers
      })
    );

    const newPage: Page = {
      id: crypto.randomUUID(),
      layers: newLayers,
    };

    const newPages = [...pages];
    newPages.splice(index + 1, 0, newPage);

    set({
      pages: newPages,
      activePageIndex: index + 1,
      layers: newPage.layers,
      activeLayerIds: [],
    });
  },

  reorderPages: (fromIndex, toIndex) => {
    get().pushHistory();
    const { pages, activePageIndex } = get();
    const newPages = [...pages];
    const [removed] = newPages.splice(fromIndex, 1);
    newPages.splice(toIndex, 0, removed);

    // Adjust active index if needed
    // If active page moved, track it.
    // However, usually reorder happens in UI without changing selection conceptually,
    // or we can just keep the active page ID?

    // Simple for now: just update active index if we moved the active page
    let newActiveIndex = activePageIndex;
    if (activePageIndex === fromIndex) {
      newActiveIndex = toIndex;
    } else if (activePageIndex > fromIndex && activePageIndex <= toIndex) {
      newActiveIndex = activePageIndex - 1;
    } else if (activePageIndex < fromIndex && activePageIndex >= toIndex) {
      newActiveIndex = activePageIndex + 1;
    }

    set({
      pages: newPages,
      activePageIndex: newActiveIndex,
      layers: newPages[newActiveIndex].layers,
    });
  },

  setCanvasSize: (width, height) => {
    const { pages, activePageIndex } = get();
    const newPages = pages.map((page) => ({
      ...page,
      layers: page.layers.map((layer) =>
        layer.name === "Background" &&
        layer.type === "shape" &&
        layer.x === 0 &&
        layer.y === 0
          ? { ...layer, width, height }
          : layer
      ),
    }));
    const newLayers = newPages[activePageIndex].layers;
    set({
      canvasWidth: width,
      canvasHeight: height,
      pages: newPages,
      layers: newLayers,
    });
  },

  reset: () => {
    const { canvasWidth, canvasHeight } = get();
    const bgLayer: ShapeLayer = {
      id: crypto.randomUUID(),
      type: "shape",
      shapeType: "rect",
      name: "Background",
      visible: true,
      locked: true,
      x: 0,
      y: 0,
      width: canvasWidth,
      height: canvasHeight,
      fill: "#ffffff",
      stroke: "",
      strokeWidth: 0,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      opacity: 1,
      cornerRadius: 0,
    };

    set({
      pages: [{ id: crypto.randomUUID(), layers: [bgLayer] }],
      activePageIndex: 0,
      layers: [bgLayer],
      activeLayerIds: [],
      activeTool: "select",
      brushSize: 20,
      brushColor: "#000000",
      brushOpacity: 1,
      history: [],
      historyIndex: -1,
    });
  },

  pushHistory: () => {
    const { pages, history, historyIndex } = get();
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(JSON.parse(JSON.stringify(pages)));
    if (newHistory.length > 50) {
      newHistory.shift();
    }
    set({ history: newHistory, historyIndex: newHistory.length - 1 });
  },

  undo: () => {
    const { history, historyIndex, pages } = get();
    if (historyIndex < 0) {
      return;
    }

    if (historyIndex === history.length - 1) {
      const newHistory = [...history];
      newHistory.push(JSON.parse(JSON.stringify(pages)));
      set({ history: newHistory });
    }

    const newIndex = Math.max(0, historyIndex - 1);
    const previousPages = history[newIndex];
    if (previousPages) {
      // Restore pages
      // We also need to ensure activePageIndex is valid, usually keep it unless out of bounds
      const currentIndex = get().activePageIndex;
      const validIndex = Math.min(currentIndex, previousPages.length - 1);

      set({
        pages: JSON.parse(JSON.stringify(previousPages)),
        historyIndex: newIndex,
        activePageIndex: validIndex,
        layers: previousPages[validIndex].layers,
      });
    }
  },

  redo: () => {
    const { history, historyIndex } = get();
    if (historyIndex >= history.length - 1) {
      return;
    }

    const newIndex = historyIndex + 1;
    const nextPages = history[newIndex];
    if (nextPages) {
      const currentIndex = get().activePageIndex;
      const validIndex = Math.min(currentIndex, nextPages.length - 1);

      set({
        pages: JSON.parse(JSON.stringify(nextPages)),
        historyIndex: newIndex,
        activePageIndex: validIndex,
        layers: nextPages[validIndex].layers,
      });
    }
  },

  canUndo: () => get().historyIndex >= 0,
  canRedo: () => get().historyIndex < get().history.length - 1,
}));
