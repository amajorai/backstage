import { invoke } from "@tauri-apps/api/core";
import { renderLayersToCanvas } from "@/lib/canvas-renderer";
import type {
  ImageLayer,
  ShapeLayer,
  TextLayer,
} from "@/stores/use-editor-store";
import { useEditorStore } from "@/stores/use-editor-store";
import { useGalleryStore } from "@/stores/use-gallery-store";
import {
  type NavigablePage,
  useNavigationStore,
} from "@/stores/use-navigation-store";
import { useTabsStore } from "@/stores/use-tabs-store";

export interface AcpToolCall {
  callId: string;
  toolName: string;
  arguments: Record<string, unknown>;
}

type ToolResult = Record<string, unknown>;

function handleGetProjects(): ToolResult {
  const { thumbnails } = useGalleryStore.getState();
  return {
    success: true,
    projects: thumbnails.map((t) => ({
      id: t.id,
      name: t.name,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
      canvasWidth: t.canvasWidth ?? 1280,
      canvasHeight: t.canvasHeight ?? 720,
    })),
  };
}

function handleGetEditorState(): ToolResult {
  const {
    layers,
    canvasWidth,
    canvasHeight,
    pages,
    activePageIndex,
    activeLayerIds,
  } = useEditorStore.getState();

  return {
    success: true,
    canvasWidth,
    canvasHeight,
    pageCount: pages.length,
    activePage: activePageIndex,
    activeLayerIds,
    layers: layers.map((l) => {
      const base = {
        id: l.id,
        name: l.name,
        type: l.type,
        x: l.x,
        y: l.y,
        rotation: l.rotation,
        opacity: l.opacity,
        visible: l.visible,
        locked: l.locked,
      };
      if (l.type === "text") {
        const tl = l as TextLayer;
        return {
          ...base,
          text: tl.text,
          fontSize: tl.fontSize,
          fontFamily: tl.fontFamily,
          fill: tl.fill,
          fontStyle: tl.fontStyle,
          align: tl.align,
        };
      }
      if (l.type === "shape") {
        const sl = l as ShapeLayer;
        return {
          ...base,
          shapeType: sl.shapeType,
          width: sl.width,
          height: sl.height,
          fill: sl.fill,
          stroke: sl.stroke,
        };
      }
      if (l.type === "image") {
        const il = l as ImageLayer;
        return { ...base, width: il.width, height: il.height };
      }
      return base;
    }),
  };
}

function handleAddTextLayer(args: Record<string, unknown>): ToolResult {
  const store = useEditorStore.getState();
  store.addTextLayer(String(args.text ?? ""));

  const newLayer = useEditorStore.getState().layers.at(-1);
  if (!newLayer) {
    return { success: false, error: "Failed to create text layer" };
  }

  const updates: Record<string, unknown> = {};
  if (args.x !== undefined) updates.x = Number(args.x);
  if (args.y !== undefined) updates.y = Number(args.y);
  if (args.fontSize !== undefined) updates.fontSize = Number(args.fontSize);
  if (args.fontFamily !== undefined)
    updates.fontFamily = String(args.fontFamily);
  if (args.fill !== undefined) updates.fill = String(args.fill);
  if (args.fontStyle !== undefined) updates.fontStyle = String(args.fontStyle);
  if (args.align !== undefined) updates.align = String(args.align);

  if (Object.keys(updates).length > 0) {
    useEditorStore
      .getState()
      // biome-ignore lint/suspicious/noExplicitAny: partial layer update from external tool call
      .updateLayer(newLayer.id, updates as any);
  }

  return { success: true, layerId: newLayer.id };
}

function handleAddShapeLayer(args: Record<string, unknown>): ToolResult {
  const shapeType = String(args.shapeType ?? "rect") as
    | "rect"
    | "ellipse"
    | "polygon"
    | "star";
  useEditorStore.getState().addShapeLayer(shapeType);

  const newLayer = useEditorStore.getState().layers.at(-1);
  if (!newLayer) {
    return { success: false, error: "Failed to create shape layer" };
  }

  const updates: Record<string, unknown> = {};
  if (args.x !== undefined) updates.x = Number(args.x);
  if (args.y !== undefined) updates.y = Number(args.y);
  if (args.width !== undefined) updates.width = Number(args.width);
  if (args.height !== undefined) updates.height = Number(args.height);
  if (args.fill !== undefined) updates.fill = String(args.fill);
  if (args.stroke !== undefined) updates.stroke = String(args.stroke);
  if (args.strokeWidth !== undefined)
    updates.strokeWidth = Number(args.strokeWidth);

  if (Object.keys(updates).length > 0) {
    useEditorStore
      .getState()
      // biome-ignore lint/suspicious/noExplicitAny: partial layer update from external tool call
      .updateLayer(newLayer.id, updates as any);
  }

  return { success: true, layerId: newLayer.id };
}

function handleUpdateLayer(args: Record<string, unknown>): ToolResult {
  const layerId = String(args.layerId ?? "");
  const updates = args.updates as Record<string, unknown> | undefined;
  if (!(layerId && updates)) {
    return { success: false, error: "layerId and updates are required" };
  }
  const layer = useEditorStore.getState().layers.find((l) => l.id === layerId);
  if (!layer) {
    return { success: false, error: `Layer not found: ${layerId}` };
  }
  // biome-ignore lint/suspicious/noExplicitAny: partial layer update from external tool call
  useEditorStore.getState().updateLayer(layerId, updates as any);
  return { success: true };
}

function handleRemoveLayer(args: Record<string, unknown>): ToolResult {
  const layerId = String(args.layerId ?? "");
  if (!layerId) return { success: false, error: "layerId is required" };
  const layer = useEditorStore.getState().layers.find((l) => l.id === layerId);
  if (!layer) return { success: false, error: `Layer not found: ${layerId}` };
  useEditorStore.getState().removeLayer(layerId);
  return { success: true };
}

function handleSelectLayers(args: Record<string, unknown>): ToolResult {
  const layerIds = args.layerIds;
  if (!Array.isArray(layerIds)) {
    return { success: false, error: "layerIds must be an array" };
  }
  useEditorStore.getState().setActiveLayers(layerIds as string[]);
  return { success: true };
}

function handleSetCanvasSize(args: Record<string, unknown>): ToolResult {
  const width = Number(args.width);
  const height = Number(args.height);
  if (!(width && height)) {
    return { success: false, error: "width and height are required" };
  }
  useEditorStore.getState().setCanvasSize(width, height);
  return { success: true };
}

function handleOpenProject(args: Record<string, unknown>): ToolResult {
  const projectId = String(args.projectId ?? "");
  if (!projectId) return { success: false, error: "projectId is required" };
  const thumbnail = useGalleryStore
    .getState()
    .thumbnails.find((t) => t.id === projectId);
  if (!thumbnail) {
    return { success: false, error: `Project not found: ${projectId}` };
  }
  useTabsStore.getState().openTab(thumbnail);
  return { success: true };
}

function handleUndo(): ToolResult {
  const store = useEditorStore.getState();
  if (!store.canUndo()) return { success: false, error: "Nothing to undo" };
  store.undo();
  return { success: true };
}

function handleRedo(): ToolResult {
  const store = useEditorStore.getState();
  if (!store.canRedo()) return { success: false, error: "Nothing to redo" };
  store.redo();
  return { success: true };
}

function handleMoveLayer(args: Record<string, unknown>): ToolResult {
  const layerId = String(args.layerId ?? "");
  const direction = String(args.direction ?? "") as "up" | "down";
  if (!(layerId && direction)) {
    return { success: false, error: "layerId and direction are required" };
  }
  const layer = useEditorStore.getState().layers.find((l) => l.id === layerId);
  if (!layer) return { success: false, error: `Layer not found: ${layerId}` };
  useEditorStore.getState().moveLayer(layerId, direction);
  return { success: true };
}

function handleDuplicateLayer(args: Record<string, unknown>): ToolResult {
  const layerId = String(args.layerId ?? "");
  if (!layerId) return { success: false, error: "layerId is required" };
  const layer = useEditorStore.getState().layers.find((l) => l.id === layerId);
  if (!layer) return { success: false, error: `Layer not found: ${layerId}` };
  useEditorStore.getState().duplicateLayer(layerId);
  return { success: true };
}

function handleNavigate(args: Record<string, unknown>): ToolResult {
  const page = String(args.page ?? "") as NavigablePage;
  if (!page) return { success: false, error: "page is required" };
  useNavigationStore.getState().navigateTo(page);
  return { success: true };
}

async function handleSaveProject(): Promise<ToolResult> {
  const { activeTabId, tabs } = useTabsStore.getState();
  if (!activeTabId) {
    return { success: false, error: "No active project" };
  }
  const activeTab = tabs.find((t) => t.id === activeTabId);
  if (!activeTab) {
    return { success: false, error: "Active tab not found" };
  }
  const thumbnail = useGalleryStore
    .getState()
    .thumbnails.find((t) => t.id === activeTab.thumbnailId);
  const { layers, canvasWidth, canvasHeight, pages } =
    useEditorStore.getState();
  try {
    const canvas = document.createElement("canvas");
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    await renderLayersToCanvas(layers, canvasWidth, canvasHeight, canvas);
    const previewDataUrl = canvas.toDataURL("image/jpeg", 0.8);
    const projectName = thumbnail?.name ?? activeTab.name;
    const savedId = await useGalleryStore
      .getState()
      .saveProject(
        activeTab.thumbnailId,
        projectName,
        previewDataUrl,
        [],
        canvasWidth,
        canvasHeight,
        { pages }
      );
    useTabsStore
      .getState()
      .markTabSaved(activeTabId, useEditorStore.getState().historyIndex);
    return { success: true, projectId: savedId };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

async function handleCreateProject(
  args: Record<string, unknown>
): Promise<ToolResult> {
  const name = String(args.name ?? "New Project");
  const width = args.width !== undefined ? Number(args.width) : 1280;
  const height = args.height !== undefined ? Number(args.height) : 720;
  try {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = "#000000";
      ctx.fillRect(0, 0, width, height);
    }
    const previewDataUrl = canvas.toDataURL("image/jpeg", 0.8);
    const projectId = await useGalleryStore
      .getState()
      .saveProject(null, name, previewDataUrl, [], width, height, {
        pages: [],
      });
    const newThumbnail = useGalleryStore
      .getState()
      .thumbnails.find((t) => t.id === projectId);
    if (newThumbnail) {
      useTabsStore.getState().openTab(newThumbnail);
    }
    return { success: true, projectId };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

async function handleExportCanvas(): Promise<ToolResult> {
  const { layers, canvasWidth, canvasHeight } = useEditorStore.getState();
  try {
    const canvas = document.createElement("canvas");
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    await renderLayersToCanvas(layers, canvasWidth, canvasHeight, canvas);
    const dataUrl = canvas.toDataURL("image/png");
    const base64 = dataUrl.replace(/^data:image\/png;base64,/, "");
    return {
      success: true,
      base64,
      mimeType: "image/png",
      width: canvasWidth,
      height: canvasHeight,
    };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

function handleSetBackgroundColor(args: Record<string, unknown>): ToolResult {
  const color = String(args.color ?? "#000000");
  const { layers, canvasWidth, canvasHeight } = useEditorStore.getState();
  const bottomShapeLayer = layers.find((l) => l.type === "shape");
  if (bottomShapeLayer) {
    // biome-ignore lint/suspicious/noExplicitAny: partial layer update from external tool call
    useEditorStore
      .getState()
      .updateLayer(bottomShapeLayer.id, { fill: color } as any);
  } else {
    const layerCountBefore = layers.length;
    useEditorStore.getState().addShapeLayer("rect");
    const newLayer = useEditorStore.getState().layers.at(-1);
    if (newLayer) {
      // biome-ignore lint/suspicious/noExplicitAny: partial layer update from external tool call
      useEditorStore.getState().updateLayer(newLayer.id, {
        x: 0,
        y: 0,
        width: canvasWidth,
        height: canvasHeight,
        fill: color,
        stroke: "transparent",
        strokeWidth: 0,
        cornerRadius: 0,
      } as any);
      for (let i = 0; i < layerCountBefore; i++) {
        useEditorStore.getState().moveLayer(newLayer.id, "down");
      }
    }
  }
  return { success: true };
}

function handleGetActiveProject(): ToolResult {
  const { activeTabId, tabs } = useTabsStore.getState();
  if (!activeTabId) {
    return { success: true, project: null };
  }
  const activeTab = tabs.find((t) => t.id === activeTabId);
  if (!activeTab) {
    return { success: true, project: null };
  }
  const thumbnail = useGalleryStore
    .getState()
    .thumbnails.find((t) => t.id === activeTab.thumbnailId);
  const { canvasWidth, canvasHeight } = useEditorStore.getState();
  return {
    success: true,
    project: {
      id: activeTab.thumbnailId,
      name: thumbnail?.name ?? activeTab.name,
      canvasWidth: thumbnail?.canvasWidth ?? canvasWidth,
      canvasHeight: thumbnail?.canvasHeight ?? canvasHeight,
    },
  };
}

const TOOL_HANDLERS: Record<
  string,
  (args: Record<string, unknown>) => ToolResult | Promise<ToolResult>
> = {
  backstage_get_projects: () => handleGetProjects(),
  backstage_get_editor_state: () => handleGetEditorState(),
  backstage_add_text_layer: handleAddTextLayer,
  backstage_add_shape_layer: handleAddShapeLayer,
  backstage_update_layer: handleUpdateLayer,
  backstage_remove_layer: handleRemoveLayer,
  backstage_select_layers: handleSelectLayers,
  backstage_set_canvas_size: handleSetCanvasSize,
  backstage_open_project: handleOpenProject,
  backstage_undo: () => handleUndo(),
  backstage_redo: () => handleRedo(),
  backstage_move_layer: handleMoveLayer,
  backstage_duplicate_layer: handleDuplicateLayer,
  backstage_navigate: handleNavigate,
  backstage_save_project: () => handleSaveProject(),
  backstage_create_project: handleCreateProject,
  backstage_export_canvas: () => handleExportCanvas(),
  backstage_set_background_color: handleSetBackgroundColor,
  backstage_get_active_project: () => handleGetActiveProject(),
};

export async function dispatchAcpToolCall(call: AcpToolCall): Promise<void> {
  const handler = TOOL_HANDLERS[call.toolName];

  if (!handler) {
    await invoke("acp_tool_result", {
      callId: call.callId,
      result: `Unknown tool: ${call.toolName}`,
      isError: true,
    });
    return;
  }

  try {
    const result = await Promise.resolve(handler(call.arguments));
    await invoke("acp_tool_result", {
      callId: call.callId,
      result: JSON.stringify(result),
      isError: false,
    });
  } catch (err) {
    await invoke("acp_tool_result", {
      callId: call.callId,
      result: String(err),
      isError: true,
    });
  }
}
