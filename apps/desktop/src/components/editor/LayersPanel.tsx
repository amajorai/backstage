import {
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  GripVertical,
  Lock,
  Plus,
  Trash2,
  Unlock,
} from "lucide-react";
import { useCallback, useRef, useState } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
    moveLayer,
    reorderLayers,
    addEmptyLayer,
  } = useEditorStore();

  const [dragLayerIdx, setDragLayerIdx] = useState<number | null>(null);
  const [dropTargetIdx, setDropTargetIdx] = useState<number | null>(null);
  const [editingLayerId, setEditingLayerId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleLayerDragStart = (idx: number) => {
    setDragLayerIdx(idx);
    setDropTargetIdx(idx);
  };

  const handleLayerDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (dragLayerIdx !== null) {
      setDropTargetIdx(idx);
    }
  };

  const handleLayerDragEnd = () => {
    if (
      dragLayerIdx !== null &&
      dropTargetIdx !== null &&
      dragLayerIdx !== dropTargetIdx
    ) {
      reorderLayers(dragLayerIdx, dropTargetIdx);
    }
    setDragLayerIdx(null);
    setDropTargetIdx(null);
  };

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
      <div className="flex-1 overflow-y-auto">
        {[...layers].reverse().map((layer, displayIdx) => {
          const realIdx = layers.length - 1 - displayIdx;
          const isEditing = editingLayerId === layer.id;
          const isSelected = activeLayerIds.includes(layer.id);

          return (
            <div
              className={cn(
                "flex cursor-pointer items-center gap-1 border-border border-b px-2 py-1.5 text-xs transition-colors",
                isSelected ? "bg-accent/20" : "hover:bg-muted/50",
                dragLayerIdx !== null &&
                  dropTargetIdx === realIdx &&
                  dragLayerIdx !== realIdx
                  ? "border-primary border-t-2"
                  : "",
                dragLayerIdx === realIdx ? "opacity-50" : ""
              )}
              draggable={!isEditing}
              key={layer.id}
              onClick={(e) => {
                if (e.metaKey || e.ctrlKey || e.shiftKey) {
                  toggleLayerSelection(layer.id);
                } else {
                  setActiveLayers([layer.id]);
                }
              }}
              onDragEnd={handleLayerDragEnd}
              onDragOver={(e) => handleLayerDragOver(e, realIdx)}
              onDragStart={() => handleLayerDragStart(realIdx)}
              onKeyDown={(e) =>
                e.key === "Enter" && setActiveLayers([layer.id])
              }
              role="button"
              tabIndex={0}
            >
              <GripVertical className="size-3 shrink-0 cursor-grab text-muted-foreground" />

              {/* Visibility */}
              <Button
                className="size-6"
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
                className="size-6"
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

              {/* Name - Editable */}
              {isEditing ? (
                <Input
                  autoFocus
                  className="h-5 flex-1 px-1 text-xs"
                  onBlur={finishEditing}
                  onChange={(e) => setEditingName(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                    if (e.key === "Enter") {
                      finishEditing();
                    }
                    if (e.key === "Escape") {
                      cancelEditing();
                    }
                  }}
                  ref={inputRef}
                  value={editingName}
                />
              ) : (
                <span
                  className="flex-1 cursor-text truncate hover:underline"
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    startEditing(layer.id, layer.name);
                  }}
                >
                  {layer.name}
                </span>
              )}

              {/* Move buttons */}
              <div className="flex shrink-0">
                <Tooltip>
                  <TooltipTrigger
                    className={buttonVariants({
                      size: "icon-sm",
                      variant: "ghost",
                      className: "size-6",
                    })}
                    disabled={realIdx === layers.length - 1}
                    onClick={(e) => {
                      e.stopPropagation();
                      moveLayer(layer.id, "up");
                    }}
                  >
                    <ChevronUp className="size-3" />
                  </TooltipTrigger>
                  <TooltipContent>Move up</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger
                    className={buttonVariants({
                      size: "icon-sm",
                      variant: "ghost",
                      className: "size-6",
                    })}
                    disabled={realIdx === 0}
                    onClick={(e) => {
                      e.stopPropagation();
                      moveLayer(layer.id, "down");
                    }}
                  >
                    <ChevronDown className="size-3" />
                  </TooltipTrigger>
                  <TooltipContent>Move down</TooltipContent>
                </Tooltip>
              </div>

              {/* Delete */}
              {layers.length > 1 && (
                <Button
                  className="size-6 hover:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeLayer(layer.id);
                  }}
                  size="icon-sm"
                  variant="ghost"
                >
                  <Trash2 className="size-3" />
                </Button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
