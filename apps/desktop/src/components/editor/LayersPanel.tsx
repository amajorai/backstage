import {
  Copy,
  Eye,
  EyeOff,
  Lock,
  Plus,
  Sparkles,
  Trash2,
  Unlock,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ScrollFadeEffect } from "@/components/scroll-fade-effect";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { generateThumbnailName } from "@/lib/gemini-rename";
import { getGeminiApiKey } from "@/lib/gemini-store";
import { cn } from "@/lib/utils";
import type { Layer } from "@/stores/use-editor-store";
import { useEditorStore } from "@/stores/use-editor-store";

function LayerThumbnail({ layer }: { layer: Layer }) {
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
  } = useEditorStore();

  const [draggingRealIdx, setDraggingRealIdx] = useState<number | null>(null);
  const [dropRealIdx, setDropRealIdx] = useState<number | null>(null);
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
  } | null>(null);

  const getRealIdxAtY = useCallback((clientY: number): number | null => {
    const container = listRef.current;
    if (!container) return null;
    const rows = container.querySelectorAll<HTMLElement>("[data-real-idx]");
    for (const row of rows) {
      const rect = row.getBoundingClientRect();
      if (clientY >= rect.top && clientY < rect.bottom) {
        return Number(row.getAttribute("data-real-idx"));
      }
    }
    if (rows.length > 0) {
      const firstRect = rows[0].getBoundingClientRect();
      if (clientY < firstRect.top)
        return Number(rows[0].getAttribute("data-real-idx"));
      const lastRect = rows[rows.length - 1].getBoundingClientRect();
      if (clientY >= lastRect.bottom)
        return Number(rows[rows.length - 1].getAttribute("data-real-idx"));
    }
    return null;
  }, []);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>, realIdx: number) => {
      if (editingLayerId) return;
      if (e.button !== 0) return;
      dragState.current = {
        active: false,
        fromRealIdx: realIdx,
        startY: e.clientY,
        currentDropRealIdx: realIdx,
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
      }
      if (dragState.current.active) {
        const idx = getRealIdxAtY(e.clientY);
        if (idx !== null && idx !== dragState.current.currentDropRealIdx) {
          dragState.current.currentDropRealIdx = idx;
          setDropRealIdx(idx);
        }
      }
    };

    const onUp = () => {
      if (dragState.current?.active) {
        const { fromRealIdx, currentDropRealIdx } = dragState.current;
        if (fromRealIdx !== currentDropRealIdx) {
          reorderLayers(fromRealIdx, currentDropRealIdx);
        }
      }
      dragState.current = null;
      setDraggingRealIdx(null);
      setDropRealIdx(null);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [getRealIdxAtY, reorderLayers]);

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
      toast.success("Layer renamed");
      return;
    }
    if (activeLayer.type === "shape") {
      const name = `${activeLayer.fill} ${activeLayer.shapeType}`;
      updateLayer(activeLayer.id, { name });
      toast.success("Layer renamed");
      return;
    }
    if (
      activeLayer.type !== "image" &&
      activeLayer.type !== "draw" &&
      activeLayer.type !== "animated-image"
    ) {
      toast.info("Auto-rename not supported for this layer type");
      return;
    }

    const apiKey = await getGeminiApiKey();
    if (!apiKey) {
      toast.error("Gemini API key not set. Add it in Settings → API Keys.");
      return;
    }

    setIsRenaming(true);
    const toastId = toast.loading("Renaming…");
    try {
      const dataUrl =
        activeLayer.type === "animated-image"
          ? activeLayer.frames[0]
          : activeLayer.dataUrl;
      const name = await generateThumbnailName(apiKey, dataUrl);
      updateLayer(activeLayer.id, { name });
      toast.success(`Renamed to "${name}"`, { id: toastId });
    } catch {
      toast.error("Failed to rename", { id: toastId });
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
      toast.success("All layers renamed");
      return;
    }

    const apiKey = await getGeminiApiKey();
    if (!apiKey) {
      toast.error("Gemini API key not set. Add it in Settings → API Keys.");
      return;
    }

    setIsRenaming(true);
    const toastId = toast.loading(
      `Renaming ${imageLayers.length} image layer(s)…`
    );
    try {
      await Promise.all(
        imageLayers.map(async (layer) => {
          const dataUrl =
            layer.type === "animated-image" ? layer.frames[0] : layer.dataUrl;
          const name = await generateThumbnailName(apiKey, dataUrl);
          updateLayer(layer.id, { name });
        })
      );
      toast.success("All layers renamed", { id: toastId });
    } catch {
      toast.error("Failed to rename some layers", { id: toastId });
    } finally {
      setIsRenaming(false);
    }
  }, [layers, updateLayer]);

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
          {[...layers].reverse().map((layer, displayIdx) => {
            const realIdx = layers.length - 1 - displayIdx;
            const isEditing = editingLayerId === layer.id;
            const isSelected = activeLayerIds.includes(layer.id);
            const isDragging = draggingRealIdx === realIdx;
            const isDropTarget =
              draggingRealIdx !== null &&
              dropRealIdx === realIdx &&
              draggingRealIdx !== realIdx;

            return (
              <ContextMenu key={layer.id}>
                <ContextMenuTrigger data-layer-item="true">
                  <div
                    className={cn(
                      "flex cursor-grab items-center gap-1.5 rounded-md px-1.5 py-1 text-xs transition-colors",
                      isSelected
                        ? "bg-primary/20 text-primary"
                        : "hover:bg-muted/50",
                      isDropTarget ? "ring-1 ring-primary" : "",
                      isDragging ? "opacity-50" : ""
                    )}
                    data-real-idx={realIdx}
                    onClick={(e) => {
                      if (draggingRealIdx !== null) return;
                      if (e.metaKey || e.ctrlKey || e.shiftKey) {
                        toggleLayerSelection(layer.id);
                      } else {
                        setActiveLayers([layer.id]);
                      }
                    }}
                    onKeyDown={(e) =>
                      e.key === "Enter" && setActiveLayers([layer.id])
                    }
                    onPointerDown={(e) => handlePointerDown(e, realIdx)}
                    role="button"
                    tabIndex={0}
                  >
                    {/* Visibility + Lock */}
                    <div className="flex shrink-0">
                      <button
                        className="flex size-5 items-center justify-center rounded text-muted-foreground hover:text-foreground"
                        onClick={(e) => {
                          e.stopPropagation();
                          pushHistory(
                            layer.visible ? "Hide Layer" : "Show Layer"
                          );
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
                          pushHistory(
                            layer.locked ? "Unlock Layer" : "Lock Layer"
                          );
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
                </ContextMenuTrigger>

                <ContextMenuContent className="w-44">
                  <ContextMenuItem
                    onClick={() => {
                      setActiveLayers([layer.id]);
                      duplicateLayer(layer.id);
                    }}
                  >
                    Duplicate
                  </ContextMenuItem>
                  <ContextMenuItem
                    onClick={() => {
                      setActiveLayers([layer.id]);
                      copyLayers();
                    }}
                  >
                    Copy
                  </ContextMenuItem>
                  <ContextMenuItem onClick={() => pasteLayers()}>
                    Paste
                  </ContextMenuItem>
                  <ContextMenuSeparator />
                  <ContextMenuItem
                    disabled={layers.length <= 1}
                    onClick={() => removeLayer(layer.id)}
                    variant="destructive"
                  >
                    Delete
                  </ContextMenuItem>
                </ContextMenuContent>
              </ContextMenu>
            );
          })}
        </div>
      </ScrollFadeEffect>

      <div className="flex shrink-0 items-center border-border border-t px-1 py-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              className="flex size-6 items-center justify-center rounded text-muted-foreground transition-colors hover:text-foreground"
              onClick={addEmptyLayer}
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
                for (const id of activeLayerIds) removeLayer(id);
              }}
              type="button"
            >
              <Trash2 className="size-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent>Delete layer</TooltipContent>
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
              onClick={handleAutoRenameActive}
            >
              Active layer
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleAutoRenameAll}>
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
                pasteLayers();
                setPasteMenuPos(null);
              }}
              type="button"
            >
              Paste
              <span className="ml-auto text-muted-foreground text-xs">⌘V</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
