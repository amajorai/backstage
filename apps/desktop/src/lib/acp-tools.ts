import { invoke } from "@tauri-apps/api/core";
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

const TOOL_HANDLERS: Record<
  string,
  (args: Record<string, unknown>) => ToolResult
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
    const result = handler(call.arguments);
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
