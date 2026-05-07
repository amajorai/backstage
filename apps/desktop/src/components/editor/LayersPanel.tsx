import { Eye, EyeOff, Lock, Plus, Unlock } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useEditorStore } from "@/stores/use-editor-store";

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
  } = useEditorStore();

  const [draggingRealIdx, setDraggingRealIdx] = useState<number | null>(null);
  const [dropRealIdx, setDropRealIdx] = useState<number | null>(null);
  const [editingLayerId, setEditingLayerId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [pasteMenuPos, setPasteMenuPos] = useState<{
    x: number;
    y: number;
  } | null>(null);
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

  return (
    <div className="flex h-full w-full shrink-0 flex-col border-border border-l bg-background">
      <div className="flex items-center justify-between border-border border-b px-3 py-2.5">
        <span className="font-semibold text-muted-foreground text-xs uppercase">
          Layers
        </span>
        <Button
          className="size-5"
          onClick={addEmptyLayer}
          size="icon-sm"
          title="Add empty layer"
          variant="ghost"
        >
          <Plus className="size-3" />
        </Button>
      </div>
      <div
        className="flex-1 overflow-y-auto"
        onContextMenu={(e) => {
          const target = e.target as HTMLElement;
          if (!target.closest("[data-layer-item]")) {
            e.preventDefault();
            setPasteMenuPos({ x: e.clientX, y: e.clientY });
          }
        }}
        ref={listRef}
      >
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
                    "flex cursor-grab items-center gap-0.5 border-border border-b px-2 py-1.5 text-xs transition-colors",
                    isSelected
                      ? "bg-primary/20 text-primary"
                      : "hover:bg-muted/50",
                    isDropTarget ? "border-primary border-t-2" : "",
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
                  {/* Visibility */}
                  <Button
                    className="size-6 shrink-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      updateLayer(layer.id, { visible: !layer.visible });
                    }}
                    size="icon-sm"
                    variant="ghost"
                  >
                    {layer.visible ? (
                      <Eye className="size-3" />
                    ) : (
                      <EyeOff className="size-3" />
                    )}
                  </Button>

                  {/* Lock */}
                  <Button
                    className="size-6 shrink-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      updateLayer(layer.id, { locked: !layer.locked });
                    }}
                    size="icon-sm"
                    variant="ghost"
                  >
                    {layer.locked ? (
                      <Lock className="size-3" />
                    ) : (
                      <Unlock className="size-3" />
                    )}
                  </Button>

                  {/* Name: click to select, double-click to edit */}
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
                      className="flex-1 select-none truncate pl-1"
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
