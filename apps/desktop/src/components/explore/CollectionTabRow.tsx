import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@repo/ui/context-menu";
import { Bookmark, Check, Folder, Plus } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import * as sounds from "@/lib/sounds";
import { cn } from "@/lib/utils";
import {
  ALL_SAVED_ID,
  useYtCollectionsStore,
  type YtCollection,
} from "@/stores/use-yt-collections-store";

export const COLLECTION_DRAG_MIME = "application/x-yt-video-id";

const COLOR_SWATCHES: { label: string; value: string | null }[] = [
  { label: "Default", value: null },
  { label: "Red", value: "#ef4444" },
  { label: "Orange", value: "#f97316" },
  { label: "Yellow", value: "#eab308" },
  { label: "Green", value: "#22c55e" },
  { label: "Blue", value: "#3b82f6" },
  { label: "Purple", value: "#a855f7" },
  { label: "Pink", value: "#ec4899" },
];

interface CollectionTabRowProps {
  selectedCollectionId: string;
  onSelect: (id: string) => void;
}

export function CollectionTabRow({
  selectedCollectionId,
  onSelect,
}: CollectionTabRowProps) {
  const collections = useYtCollectionsStore((s) => s.collections);
  const createCollection = useYtCollectionsStore((s) => s.createCollection);
  const renameCollection = useYtCollectionsStore((s) => s.renameCollection);
  const deleteCollection = useYtCollectionsStore((s) => s.deleteCollection);
  const setCollectionColor = useYtCollectionsStore((s) => s.setCollectionColor);
  const reorderCollections = useYtCollectionsStore((s) => s.reorderCollections);
  const addVideoToCollection = useYtCollectionsStore(
    (s) => s.addVideoToCollection
  );

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [reorderFromIndex, setReorderFromIndex] = useState<number | null>(null);
  const [reorderOverIndex, setReorderOverIndex] = useState<number | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (renamingId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [renamingId]);

  const beginRename = useCallback((col: YtCollection) => {
    setRenamingId(col.id);
    setDraftName(col.name);
  }, []);

  const commitRename = useCallback(async () => {
    if (!renamingId) return;
    const name = draftName.trim();
    if (name) await renameCollection(renamingId, name);
    setRenamingId(null);
    setDraftName("");
  }, [renamingId, draftName, renameCollection]);

  const cancelRename = useCallback(() => {
    setRenamingId(null);
    setDraftName("");
  }, []);

  const handleCreate = useCallback(async () => {
    sounds.click();
    const created = await createCollection("New folder");
    if (created) {
      onSelect(created.id);
      setRenamingId(created.id);
      setDraftName(created.name);
    }
  }, [createCollection, onSelect]);

  // Video-drop handlers (drop a video card onto a collection tab)
  const handleVideoDragOver = useCallback(
    (e: React.DragEvent, collectionId: string) => {
      if (!e.dataTransfer.types.includes(COLLECTION_DRAG_MIME)) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
      setDragOverId(collectionId);
    },
    []
  );

  const handleVideoDragLeave = useCallback(() => {
    setDragOverId(null);
  }, []);

  const handleVideoDrop = useCallback(
    async (e: React.DragEvent, collectionId: string) => {
      const videoId = e.dataTransfer.getData(COLLECTION_DRAG_MIME);
      setDragOverId(null);
      if (!videoId || collectionId === ALL_SAVED_ID) return;
      e.preventDefault();
      sounds.click();
      await addVideoToCollection(videoId, collectionId);
    },
    [addVideoToCollection]
  );

  // Reorder handlers (drag a collection tab to a new position)
  const handleReorderStart = useCallback(
    (e: React.DragEvent, index: number) => {
      // Mark this drag as a reorder by setting a marker MIME the drop handler checks.
      e.dataTransfer.setData(
        "application/x-yt-collection-reorder",
        String(index)
      );
      e.dataTransfer.effectAllowed = "move";
      setReorderFromIndex(index);
    },
    []
  );

  const handleReorderOver = useCallback((e: React.DragEvent, index: number) => {
    if (!e.dataTransfer.types.includes("application/x-yt-collection-reorder")) {
      return;
    }
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    const rect = e.currentTarget.getBoundingClientRect();
    setReorderOverIndex(
      e.clientX < rect.left + rect.width / 2 ? index : index + 1
    );
  }, []);

  const handleReorderDrop = useCallback(
    async (e: React.DragEvent) => {
      if (
        !e.dataTransfer.types.includes("application/x-yt-collection-reorder")
      ) {
        return;
      }
      e.preventDefault();
      if (reorderFromIndex !== null && reorderOverIndex !== null) {
        let to = reorderOverIndex;
        if (reorderFromIndex < reorderOverIndex) to--;
        if (to !== reorderFromIndex && to >= 0 && to < collections.length) {
          await reorderCollections(reorderFromIndex, to);
        }
      }
      setReorderFromIndex(null);
      setReorderOverIndex(null);
    },
    [reorderFromIndex, reorderOverIndex, collections.length, reorderCollections]
  );

  const handleReorderEnd = useCallback(() => {
    setReorderFromIndex(null);
    setReorderOverIndex(null);
  }, []);

  return (
    <div className="scrollbar-none flex shrink-0 items-center gap-1 overflow-x-auto border-border/50 border-b px-5 py-2">
      {/* All Saved pseudo-collection */}
      <CollectionTab
        active={selectedCollectionId === ALL_SAVED_ID}
        dropActive={dragOverId === ALL_SAVED_ID}
        icon={<Bookmark className="size-3.5" />}
        label="All Saved"
        onClick={() => {
          sounds.click();
          onSelect(ALL_SAVED_ID);
        }}
        onDragLeave={handleVideoDragLeave}
        onDragOver={(e) => handleVideoDragOver(e, ALL_SAVED_ID)}
        onDrop={(e) => handleVideoDrop(e, ALL_SAVED_ID)}
      />

      {collections.map((col, index) => {
        const showReorderIndicator =
          reorderFromIndex !== null &&
          reorderOverIndex === index &&
          reorderOverIndex !== reorderFromIndex &&
          reorderOverIndex !== reorderFromIndex + 1;

        if (renamingId === col.id) {
          return (
            <div className="shrink-0" key={col.id}>
              <input
                className="h-7 rounded-md border border-primary/40 bg-background px-2 text-sm outline-none focus:ring-1 focus:ring-primary/30"
                onBlur={commitRename}
                onChange={(e) => setDraftName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitRename();
                  else if (e.key === "Escape") cancelRename();
                }}
                ref={inputRef}
                style={{ width: `${Math.max(draftName.length + 1, 8)}ch` }}
                value={draftName}
              />
            </div>
          );
        }

        return (
          <div
            className="relative shrink-0"
            draggable
            key={col.id}
            onDragEnd={handleReorderEnd}
            onDragOver={(e) => handleReorderOver(e, index)}
            onDragStart={(e) => handleReorderStart(e, index)}
            onDrop={handleReorderDrop}
          >
            {showReorderIndicator && (
              <div className="absolute top-1 bottom-1 -left-0.5 w-0.5 rounded-full bg-primary" />
            )}
            <ContextMenu>
              <ContextMenuTrigger asChild>
                <div>
                  <CollectionTab
                    active={selectedCollectionId === col.id}
                    color={col.color}
                    dropActive={dragOverId === col.id}
                    icon={<Folder className="size-3.5" />}
                    label={col.name}
                    onClick={() => {
                      sounds.click();
                      onSelect(col.id);
                    }}
                    onDoubleClick={() => beginRename(col)}
                    onDragLeave={handleVideoDragLeave}
                    onDragOver={(e) => handleVideoDragOver(e, col.id)}
                    onDrop={(e) => handleVideoDrop(e, col.id)}
                  />
                </div>
              </ContextMenuTrigger>
              <ContextMenuContent>
                <ContextMenuItem onClick={() => beginRename(col)}>
                  Rename
                </ContextMenuItem>
                <ContextMenuSub>
                  <ContextMenuSubTrigger>Color</ContextMenuSubTrigger>
                  <ContextMenuSubContent>
                    {COLOR_SWATCHES.map((swatch) => (
                      <ContextMenuItem
                        key={swatch.label}
                        onClick={() => setCollectionColor(col.id, swatch.value)}
                      >
                        <span
                          className="mr-2 inline-block size-3 rounded-full border border-border"
                          style={{
                            backgroundColor: swatch.value ?? "transparent",
                          }}
                        />
                        {swatch.label}
                        {col.color === swatch.value && (
                          <Check className="ml-auto size-3.5" />
                        )}
                      </ContextMenuItem>
                    ))}
                  </ContextMenuSubContent>
                </ContextMenuSub>
                <ContextMenuSeparator />
                <ContextMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={async () => {
                    if (selectedCollectionId === col.id) {
                      onSelect(ALL_SAVED_ID);
                    }
                    await deleteCollection(col.id);
                  }}
                >
                  Delete folder
                </ContextMenuItem>
              </ContextMenuContent>
            </ContextMenu>
          </div>
        );
      })}

      <button
        className="ml-1 flex shrink-0 items-center gap-1 rounded-md border border-border border-dashed px-2 py-1 text-muted-foreground text-xs hover:border-foreground/40 hover:text-foreground"
        onClick={handleCreate}
        type="button"
      >
        <Plus className="size-3.5" />
        New folder
      </button>
    </div>
  );
}

interface CollectionTabProps {
  label: string;
  icon: React.ReactNode;
  active: boolean;
  dropActive: boolean;
  color?: string | null;
  onClick: () => void;
  onDoubleClick?: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
}

function CollectionTab({
  label,
  icon,
  active,
  dropActive,
  color,
  onClick,
  onDoubleClick,
  onDragOver,
  onDragLeave,
  onDrop,
}: CollectionTabProps) {
  return (
    <button
      className={cn(
        "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-sm transition-colors",
        active
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:text-foreground",
        dropActive && "ring-2 ring-primary ring-offset-1 ring-offset-background"
      )}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      onDrop={onDrop}
      style={color ? { color: active ? undefined : color } : undefined}
      type="button"
    >
      <span style={color && !active ? { color } : undefined}>{icon}</span>
      {label}
    </button>
  );
}
