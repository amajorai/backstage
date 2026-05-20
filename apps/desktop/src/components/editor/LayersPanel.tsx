import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@repo/ui/context-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ui/dropdown-menu";
import { Input } from "@repo/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@repo/ui/tooltip";
import {
  ChevronDown,
  ChevronRight,
  Copy,
  Eye,
  EyeOff,
  Folder,
  FolderOpen,
  FolderPlus,
  Lock,
  Plus,
  Sparkles,
  Trash2,
  Unlock,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { sileo } from "sileo";
import { ScrollFadeEffect } from "@/components/scroll-fade-effect";
import { generateThumbnailName } from "@/lib/gemini-rename";
import { getGeminiApiKey } from "@/lib/gemini-store";
import * as sounds from "@/lib/sounds";
import { cn } from "@/lib/utils";
import type { GroupLayer, Layer } from "@/stores/use-editor-store";
import { useEditorStore } from "@/stores/use-editor-store";

function LayerThumbnail({ layer }: { layer: Layer }) {
  if (layer.type === "group") {
    return layer.collapsed ? (
      <Folder className="size-4 shrink-0 text-muted-foreground" />
    ) : (
      <FolderOpen className="size-4 shrink-0 text-muted-foreground" />
    );
  }
  if (layer.type === "image" || layer.type === "draw") {
    return (
      <img
        alt=""
        className="size-7 shrink-0 rounded-sm object-cover"
        src={layer.dataUrl}
        style={{
          background:
            "repeating-conic-gradient(#808080 0% 25%, transparent 0% 50%) 0 0 / 6px 6px",
        }}
      />
    );
  }
  if (layer.type === "animated-image") {
    return (
      <img
        alt=""
        className="size-7 shrink-0 rounded-sm object-cover"
        src={layer.frames[0]}
      />
    );
  }
  if (layer.type === "text") {
    return (
      <div
        className="flex size-7 shrink-0 items-center justify-center rounded-sm font-bold text-[11px]"
        style={{ color: layer.fill, background: `${layer.fill}22` }}
      >
        T
      </div>
    );
  }
  if (layer.type === "shape") {
    return (
      <div
        className="size-7 shrink-0 rounded-sm border border-white/10"
        style={{ background: layer.fill || "#888" }}
      />
    );
  }
  if (layer.type === "svg") {
    const encoded = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(layer.svgString)}`;
    return (
      <img
        alt=""
        className="size-7 shrink-0 rounded-sm object-cover"
        src={encoded}
      />
    );
  }
  return <div className="size-7 shrink-0 rounded-sm bg-muted" />;
}

interface DisplayItem {
  layer: Layer;
  realIdx: number;
  isGroupHeader: boolean;
  children: Array<{ layer: Layer; realIdx: number }>;
}

function buildDisplayItems(layers: Layer[]): DisplayItem[] {
  const childIdSet = new Set(layers.filter((l) => l.groupId).map((l) => l.id));
  const items: DisplayItem[] = [];

  for (let i = layers.length - 1; i >= 0; i--) {
    const layer = layers[i];
    if (childIdSet.has(layer.id)) continue;

    if (layer.type === "group") {
      const group = layer as GroupLayer;
      const children: Array<{ layer: Layer; realIdx: number }> = [];
      let j = i + 1;
      while (j < layers.length && layers[j].groupId === group.id) {
        children.unshift({ layer: layers[j], realIdx: j });
        j++;
      }
      items.push({ layer, realIdx: i, isGroupHeader: true, children });
    } else {
      items.push({ layer, realIdx: i, isGroupHeader: false, children: [] });
    }
  }

  return items;
}

export function LayersPanel() {
  const {
    layers,
    activeLayerIds,
    updateLayer,
    removeLayer,
    setActiveLayers,
    toggleLayerSelection,
    reorderLayers,
    addEmptyLayer,
    duplicateLayer,
    copyLayers,
    pasteLayers,
    pushHistory,
    createGroup,
    ungroup,
    toggleGroupCollapse,
    moveLayerToGroup,
  } = useEditorStore();

  const [draggingRealIdx, setDraggingRealIdx] = useState<number | null>(null);
  const [dropRealIdx, setDropRealIdx] = useState<number | null>(null);
  const [dropPosition, setDropPosition] = useState<"before" | "after" | null>(
    null
  );
  const [dropIntoGroupId, setDropIntoGroupId] = useState<string | null>(null);
  const [editingLayerId, setEditingLayerId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [pasteMenuPos, setPasteMenuPos] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [isRenaming, setIsRenaming] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const dragState = useRef<{
    active: boolean;
    fromRealIdx: number;
    startY: number;
    currentDropRealIdx: number;
    currentDropPosition: "before" | "after";
    currentDropIntoGroupId: string | null;
  } | null>(null);

  const displayItems = useMemo(() => buildDisplayItems(layers), [layers]);

  const getRealIdxAtY = useCallback(
    (
      clientY: number
    ): {
      realIdx: number;
      isGroup: boolean;
      groupId: string | null;
      position: "before" | "after";
      intoGroup: boolean;
    } | null => {
      const container = listRef.current;
      if (!container) return null;
      const rows = container.querySelectorAll<HTMLElement>("[data-real-idx]");
      for (const row of rows) {
        const rect = row.getBoundingClientRect();
        if (clientY >= rect.top && clientY < rect.bottom) {
          const idx = Number(row.getAttribute("data-real-idx"));
          const isGroup = row.getAttribute("data-is-group") === "true";
          const gid = row.getAttribute("data-group-id");
          if (isGroup && gid) {
            const oneThird = rect.top + rect.height / 3;
            const twoThirds = rect.top + (rect.height * 2) / 3;
            if (clientY < oneThird) {
              return {
                realIdx: idx,
                isGroup,
                groupId: gid,
                position: "before",
                intoGroup: false,
              };
            }
            if (clientY > twoThirds) {
              return {
                realIdx: idx,
                isGroup,
                groupId: gid,
                position: "after",
                intoGroup: false,
              };
            }
            return {
              realIdx: idx,
              isGroup,
              groupId: gid,
              position: "before",
              intoGroup: true,
            };
          }
          const midY = rect.top + rect.height / 2;
          const position = clientY < midY ? "before" : "after";
          return {
            realIdx: idx,
            isGroup,
            groupId: gid,
            position,
            intoGroup: false,
          };
        }
      }
      if (rows.length > 0) {
        const firstRect = rows[0].getBoundingClientRect();
        if (clientY < firstRect.top) {
          const idx = Number(rows[0].getAttribute("data-real-idx"));
          return {
            realIdx: idx,
            isGroup: false,
            groupId: null,
            position: "before",
            intoGroup: false,
          };
        }
        const lastRect = rows[rows.length - 1].getBoundingClientRect();
        if (clientY >= lastRect.bottom) {
          const idx = Number(
            rows[rows.length - 1].getAttribute("data-real-idx")
          );
          return {
            realIdx: idx,
            isGroup: false,
            groupId: null,
            position: "after",
            intoGroup: false,
          };
        }
      }
      return null;
    },
    []
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>, realIdx: number) => {
      if (editingLayerId) return;
      if (e.button !== 0) return;
      dragState.current = {
        active: false,
        fromRealIdx: realIdx,
        startY: e.clientY,
        currentDropRealIdx: realIdx,
        currentDropPosition: "before",
        currentDropIntoGroupId: null,
      };
    },
    [editingLayerId]
  );

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (!dragState.current) return;
      const dy = Math.abs(e.clientY - dragState.current.startY);
      if (!dragState.current.active && dy > 5) {
        dragState.current.active = true;
        setDraggingRealIdx(dragState.current.fromRealIdx);
        setDropRealIdx(dragState.current.fromRealIdx);
        setDropPosition("before");
        setDropIntoGroupId(null);
      }
      if (dragState.current.active) {
        const hit = getRealIdxAtY(e.clientY);
        if (!hit) return;
        const { realIdx: idx, isGroup, groupId, position, intoGroup } = hit;
        const draggingLayer = layers[dragState.current.fromRealIdx];
        const targetIsGroupOfDragging =
          draggingLayer && draggingLayer.groupId === groupId;

        const newGroupId =
          intoGroup && isGroup && groupId && !targetIsGroupOfDragging
            ? groupId
            : null;

        if (
          idx !== dragState.current.currentDropRealIdx ||
          newGroupId !== dragState.current.currentDropIntoGroupId ||
          position !== dragState.current.currentDropPosition
        ) {
          dragState.current.currentDropRealIdx = idx;
          dragState.current.currentDropPosition = position;
          dragState.current.currentDropIntoGroupId = newGroupId;
          setDropRealIdx(idx);
          setDropPosition(position);
          setDropIntoGroupId(newGroupId);
        }
      }
    };

    const onUp = () => {
      if (dragState.current?.active) {
        const {
          fromRealIdx,
          currentDropRealIdx,
          currentDropPosition,
          currentDropIntoGroupId,
        } = dragState.current;
        const draggingLayer = layers[fromRealIdx];
        if (
          currentDropIntoGroupId &&
          draggingLayer &&
          draggingLayer.id !== currentDropIntoGroupId
        ) {
          moveLayerToGroup(draggingLayer.id, currentDropIntoGroupId);
        } else if (
          !currentDropIntoGroupId &&
          draggingLayer?.groupId &&
          fromRealIdx !== currentDropRealIdx
        ) {
          moveLayerToGroup(draggingLayer.id, null);
        } else if (fromRealIdx !== currentDropRealIdx) {
          const adjustedTarget =
            currentDropPosition === "after"
              ? currentDropRealIdx - 1
              : currentDropRealIdx;
          reorderLayers(fromRealIdx, adjustedTarget);
        }
      }
      dragState.current = null;
      setDraggingRealIdx(null);
      setDropRealIdx(null);
      setDropPosition(null);
      setDropIntoGroupId(null);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [getRealIdxAtY, reorderLayers, moveLayerToGroup, layers]);

  const startEditing = useCallback((layerId: string, currentName: string) => {
    setEditingLayerId(layerId);
    setEditingName(currentName);
    setTimeout(() => inputRef.current?.select(), 0);
  }, []);

  const finishEditing = useCallback(() => {
    if (editingLayerId && editingName.trim()) {
      updateLayer(editingLayerId, { name: editingName.trim() });
    }
    setEditingLayerId(null);
    setEditingName("");
  }, [editingLayerId, editingName, updateLayer]);

  const cancelEditing = useCallback(() => {
    setEditingLayerId(null);
    setEditingName("");
  }, []);

  const handleAutoRenameActive = useCallback(async () => {
    const activeLayer = layers.find((l) => activeLayerIds.includes(l.id));
    if (!activeLayer) return;

    if (activeLayer.type === "text") {
      const name = activeLayer.text.slice(0, 40).trim() || "Text Layer";
      updateLayer(activeLayer.id, { name });
      sileo.success({ title: "Layer renamed" });
      return;
    }
    if (activeLayer.type === "shape") {
      const name = `${activeLayer.fill} ${activeLayer.shapeType}`;
      updateLayer(activeLayer.id, { name });
      sileo.success({ title: "Layer renamed" });
      return;
    }
    if (
      activeLayer.type !== "image" &&
      activeLayer.type !== "draw" &&
      activeLayer.type !== "animated-image"
    ) {
      sileo.info({ title: "Auto-rename not supported for this layer type" });
      return;
    }

    const apiKey = await getGeminiApiKey();
    if (!apiKey) {
      sileo.error({
        title: "Gemini API key not set. Add it in Settings → API Keys.",
      });
      return;
    }

    setIsRenaming(true);
    const toastId = sileo.show({
      title: "Renaming…",
      type: "loading",
      duration: null,
    }) as string;
    try {
      const dataUrl =
        activeLayer.type === "animated-image"
          ? activeLayer.frames[0]
          : activeLayer.dataUrl;
      const name = await generateThumbnailName(apiKey, dataUrl);
      updateLayer(activeLayer.id, { name });
      sileo.success({ title: `Renamed to "${name}"`, id: toastId } as any);
    } catch {
      sileo.error({ title: "Failed to rename", id: toastId } as any);
    } finally {
      setIsRenaming(false);
    }
  }, [layers, activeLayerIds, updateLayer]);

  const handleAutoRenameAll = useCallback(async () => {
    const imageLayers = layers.filter(
      (l) =>
        l.type === "image" || l.type === "draw" || l.type === "animated-image"
    );

    for (const layer of layers) {
      if (layer.type === "text") {
        updateLayer(layer.id, {
          name: layer.text.slice(0, 40).trim() || "Text Layer",
        });
      } else if (layer.type === "shape") {
        updateLayer(layer.id, { name: `${layer.fill} ${layer.shapeType}` });
      }
    }

    if (imageLayers.length === 0) {
      sileo.success({ title: "All layers renamed" });
      return;
    }

    const apiKey = await getGeminiApiKey();
    if (!apiKey) {
      sileo.error({
        title: "Gemini API key not set. Add it in Settings → API Keys.",
      });
      return;
    }

    setIsRenaming(true);
    const toastId = sileo.show({
      title: `Renaming ${imageLayers.length} image layer(s)…`,
      type: "loading",
      duration: null,
    }) as string;
    try {
      await Promise.all(
        imageLayers.map(async (layer) => {
          const dataUrl =
            layer.type === "animated-image" ? layer.frames[0] : layer.dataUrl;
          const name = await generateThumbnailName(apiKey, dataUrl);
          updateLayer(layer.id, { name });
        })
      );
      sileo.success({ title: "All layers renamed", id: toastId } as any);
    } catch {
      sileo.error({
        title: "Failed to rename some layers",
        id: toastId,
      } as any);
    } finally {
      setIsRenaming(false);
    }
  }, [layers, updateLayer]);

  const handleCreateGroup = useCallback(() => {
    if (activeLayerIds.length >= 1) {
      createGroup(activeLayerIds, "Group");
    }
  }, [activeLayerIds, createGroup]);

  function renderLayerRow(
    layer: Layer,
    realIdx: number,
    depth: number,
    isChildRow = false
  ) {
    const isEditing = editingLayerId === layer.id;
    const isSelected = activeLayerIds.includes(layer.id);
    const isDragging = draggingRealIdx === realIdx;
    const isReorderTarget =
      draggingRealIdx !== null &&
      dropRealIdx === realIdx &&
      dropIntoGroupId === null &&
      draggingRealIdx !== realIdx;
    const isGroupDropTarget =
      layer.type === "group" && dropIntoGroupId === layer.id;
    const showLineBefore = isReorderTarget && dropPosition === "before";
    const showLineAfter = isReorderTarget && dropPosition === "after";

    const isGroup = layer.type === "group";
    const group = isGroup ? (layer as GroupLayer) : null;

    const rowContent = (
      <div className={cn("relative", depth > 0 ? "ml-4" : "")}>
        {showLineBefore && (
          <div className="absolute -top-0.5 right-0 left-0 z-10 h-0.5 rounded-full bg-primary" />
        )}
        {showLineAfter && (
          <div className="absolute right-0 -bottom-0.5 left-0 z-10 h-0.5 rounded-full bg-primary" />
        )}
        <div
          className={cn(
            "flex cursor-grab items-center gap-1.5 rounded-md px-1.5 py-1 text-xs transition-colors",
            isSelected ? "bg-primary/20 text-primary" : "hover:bg-muted/50",
            isGroupDropTarget ? "bg-accent/10 ring-2 ring-accent" : "",
            isDragging ? "opacity-50" : ""
          )}
          data-group-id={isGroup ? layer.id : null}
          data-is-group={isGroup ? "true" : "false"}
          data-layer-item="true"
          data-real-idx={realIdx}
          onClick={(e) => {
            if (draggingRealIdx !== null) return;
            if (isGroup) {
              if (e.metaKey || e.ctrlKey || e.shiftKey) {
                toggleLayerSelection(layer.id);
              } else {
                setActiveLayers([layer.id]);
              }
              return;
            }
            if (e.metaKey || e.ctrlKey || e.shiftKey) {
              toggleLayerSelection(layer.id);
            } else {
              setActiveLayers([layer.id]);
            }
          }}
          onKeyDown={(e) => e.key === "Enter" && setActiveLayers([layer.id])}
          onPointerDown={(e) => handlePointerDown(e, realIdx)}
          role="button"
          tabIndex={0}
        >
          {/* Collapse toggle for groups */}
          {isGroup ? (
            <button
              className="flex size-4 shrink-0 items-center justify-center rounded text-muted-foreground hover:text-foreground"
              onClick={(e) => {
                e.stopPropagation();
                sounds.click();
                toggleGroupCollapse(layer.id);
              }}
              type="button"
            >
              {group?.collapsed ? (
                <ChevronRight className="size-3" />
              ) : (
                <ChevronDown className="size-3" />
              )}
            </button>
          ) : (
            <div className="w-4 shrink-0" />
          )}

          {/* Visibility + Lock */}
          <div className="flex shrink-0">
            <button
              className="flex size-5 items-center justify-center rounded text-muted-foreground hover:text-foreground"
              onClick={(e) => {
                e.stopPropagation();
                sounds.click();
                pushHistory(layer.visible ? "Hide Layer" : "Show Layer");
                updateLayer(layer.id, { visible: !layer.visible });
              }}
              type="button"
            >
              {layer.visible ? (
                <Eye className="size-3" />
              ) : (
                <EyeOff className="size-3" />
              )}
            </button>
            <button
              className={cn(
                "flex size-5 items-center justify-center rounded",
                layer.locked
                  ? "text-destructive"
                  : "text-muted-foreground hover:text-foreground"
              )}
              onClick={(e) => {
                e.stopPropagation();
                sounds.click();
                pushHistory(layer.locked ? "Unlock Layer" : "Lock Layer");
                updateLayer(layer.id, { locked: !layer.locked });
              }}
              type="button"
            >
              {layer.locked ? (
                <Lock className="size-3" />
              ) : (
                <Unlock className="size-3" />
              )}
            </button>
          </div>

          {/* Thumbnail */}
          <LayerThumbnail layer={layer} />

          {/* Name */}
          {isEditing ? (
            <Input
              autoFocus
              className="h-5 flex-1 border-0 bg-transparent px-1 text-xs shadow-none ring-0 focus-visible:ring-0 md:text-xs dark:bg-transparent"
              onBlur={finishEditing}
              onChange={(e) => setEditingName(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === "Enter") finishEditing();
                if (e.key === "Escape") cancelEditing();
              }}
              ref={inputRef}
              value={editingName}
            />
          ) : (
            <span
              className="flex-1 select-none truncate"
              onDoubleClick={(e) => {
                e.stopPropagation();
                startEditing(layer.id, layer.name);
              }}
            >
              {layer.name}
            </span>
          )}
        </div>
      </div>
    );

    const contextMenuContent = (
      <ContextMenuContent className="w-48">
        {isGroup ? (
          <>
            <ContextMenuItem
              onClick={() => {
                sounds.click();
                setActiveLayers([layer.id]);
                duplicateLayer(layer.id);
              }}
            >
              Duplicate Group
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem
              onClick={() => {
                sounds.click();
                ungroup(layer.id);
              }}
            >
              Ungroup
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem
              onClick={() => {
                sounds.delete_();
                removeLayer(layer.id);
              }}
              variant="destructive"
            >
              Delete Group &amp; Contents
            </ContextMenuItem>
          </>
        ) : (
          <>
            <ContextMenuItem
              onClick={() => {
                sounds.click();
                setActiveLayers([layer.id]);
                duplicateLayer(layer.id);
              }}
            >
              Duplicate
            </ContextMenuItem>
            <ContextMenuItem
              onClick={() => {
                sounds.click();
                setActiveLayers([layer.id]);
                copyLayers();
              }}
            >
              Copy
            </ContextMenuItem>
            <ContextMenuItem
              onClick={() => {
                sounds.click();
                pasteLayers();
              }}
            >
              Paste
            </ContextMenuItem>
            <ContextMenuSeparator />
            {activeLayerIds.length >= 2 && (
              <ContextMenuItem
                onClick={() => {
                  sounds.click();
                  createGroup(activeLayerIds, "Group");
                }}
              >
                Group Selection ({activeLayerIds.length} layers)
              </ContextMenuItem>
            )}
            <ContextMenuItem
              onClick={() => {
                sounds.click();
                createGroup([layer.id], "Group");
              }}
            >
              New Group from Layer
            </ContextMenuItem>
            {isChildRow && layer.groupId && (
              <ContextMenuItem
                onClick={() => {
                  sounds.click();
                  moveLayerToGroup(layer.id, null);
                }}
              >
                Remove from Group
              </ContextMenuItem>
            )}
            <ContextMenuSeparator />
            <ContextMenuItem
              disabled={layers.length <= 1}
              onClick={() => {
                sounds.delete_();
                removeLayer(layer.id);
              }}
              variant="destructive"
            >
              Delete
            </ContextMenuItem>
          </>
        )}
      </ContextMenuContent>
    );

    return (
      <ContextMenu key={layer.id}>
        <ContextMenuTrigger>{rowContent}</ContextMenuTrigger>
        {contextMenuContent}
      </ContextMenu>
    );
  }

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col border-border border-l bg-background">
      <ScrollFadeEffect
        className="flex-1 p-1.5"
        onClick={(e) => {
          const target = e.target as HTMLElement;
          if (!target.closest("[data-layer-item]")) {
            setActiveLayers([]);
          }
        }}
        onContextMenu={(e) => {
          const target = e.target as HTMLElement;
          if (!target.closest("[data-layer-item]")) {
            e.preventDefault();
            setPasteMenuPos({ x: e.clientX, y: e.clientY });
          }
        }}
        ref={listRef}
      >
        <div className="flex flex-col gap-1">
          {displayItems.map((item) => {
            const { layer, realIdx, isGroupHeader, children } = item;
            const group = isGroupHeader ? (layer as GroupLayer) : null;

            return (
              <div key={layer.id}>
                {renderLayerRow(layer, realIdx, 0, false)}
                {/* Render children if group is expanded */}
                {group && !group.collapsed && children.length > 0 && (
                  <div className="mt-0.5 flex flex-col gap-1">
                    {children.map((child) =>
                      renderLayerRow(child.layer, child.realIdx, 1, true)
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </ScrollFadeEffect>

      <div className="flex shrink-0 items-center border-border border-t px-1 py-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              className="flex size-6 items-center justify-center rounded text-muted-foreground transition-colors hover:text-foreground"
              onClick={() => {
                sounds.click();
                addEmptyLayer();
              }}
              type="button"
            >
              <Plus className="size-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent>Add layer</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              className="flex size-6 items-center justify-center rounded text-muted-foreground transition-colors hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
              disabled={activeLayerIds.length === 0}
              onClick={() => {
                sounds.click();
                for (const id of activeLayerIds) duplicateLayer(id);
              }}
              type="button"
            >
              <Copy className="size-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent>Duplicate layer</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              className="flex size-6 items-center justify-center rounded text-muted-foreground transition-colors hover:text-destructive disabled:pointer-events-none disabled:opacity-30"
              disabled={activeLayerIds.length === 0 || layers.length <= 1}
              onClick={() => {
                sounds.delete_();
                for (const id of activeLayerIds) removeLayer(id);
              }}
              type="button"
            >
              <Trash2 className="size-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent>Delete layer</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              className="flex size-6 items-center justify-center rounded text-muted-foreground transition-colors hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
              disabled={activeLayerIds.length === 0}
              onClick={() => {
                sounds.click();
                handleCreateGroup();
              }}
              type="button"
            >
              <FolderPlus className="size-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent>
            {activeLayerIds.length >= 2
              ? `Group ${activeLayerIds.length} selected layers`
              : activeLayerIds.length === 1
                ? "Group selected layer"
                : "New group"}
          </TooltipContent>
        </Tooltip>
        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger
                className="flex size-6 items-center justify-center rounded text-muted-foreground transition-colors hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
                disabled={isRenaming}
              >
                <Sparkles
                  className={cn("size-3.5", isRenaming && "animate-pulse")}
                />
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent>Auto-rename with AI</TooltipContent>
          </Tooltip>
          <DropdownMenuContent align="start" side="top">
            <DropdownMenuItem
              disabled={activeLayerIds.length === 0}
              onClick={() => {
                sounds.click();
                handleAutoRenameActive();
              }}
            >
              Active layer
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                sounds.click();
                handleAutoRenameAll();
              }}
            >
              All layers
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Panel-level paste menu for right-clicking empty space */}
      {pasteMenuPos && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setPasteMenuPos(null)}
            onContextMenu={(e) => {
              e.preventDefault();
              setPasteMenuPos(null);
            }}
            onKeyDown={() => {}}
          />
          <div
            className="fixed z-50 min-w-36 rounded-lg border border-border bg-popover p-1 shadow-md ring-1 ring-foreground/10"
            style={{ left: pasteMenuPos.x, top: pasteMenuPos.y }}
          >
            <button
              className="flex w-full items-center rounded-md px-1.5 py-1 text-sm hover:bg-accent hover:text-accent-foreground"
              onClick={() => {
                sounds.click();
                pasteLayers();
                setPasteMenuPos(null);
              }}
              type="button"
            >
              Paste
              <span className="ml-auto text-muted-foreground text-xs">⌘V</span>
            </button>
            <button
              className="flex w-full items-center rounded-md px-1.5 py-1 text-sm hover:bg-accent hover:text-accent-foreground"
              onClick={() => {
                sounds.click();
                createGroup(
                  activeLayerIds.length >= 2 ? activeLayerIds : [],
                  "Group"
                );
                setPasteMenuPos(null);
              }}
              type="button"
            >
              New Group
            </button>
          </div>
        </>
      )}
    </div>
  );
}
