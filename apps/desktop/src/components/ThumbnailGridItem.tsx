import {
  Copy,
  Download,
  FolderOpen,
  FolderPlus,
  Loader2,
  PaintBucket,
  Pencil,
  Trash2,
  Wand2,
} from "lucide-react";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { SelectionCheckbox } from "@/components/gallery/SelectionCheckbox";
import { ThumbnailActionButtons } from "@/components/gallery/ThumbnailActionButtons";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { Folder } from "@/stores/use-folder-store";
import {
  type ThumbnailItem,
  useGalleryStore,
} from "@/stores/use-gallery-store";
import { useSelectionStore } from "@/stores/use-selection-store";

interface ThumbnailGridItemProps {
  thumbnail: ThumbnailItem;
  onThumbnailClick: (thumbnail: ThumbnailItem) => void;
  onExportClick: (thumbnail: ThumbnailItem) => void;
  isProcessing: boolean;
  onRemoveBackground: (
    e: React.MouseEvent,
    thumbnail: ThumbnailItem
  ) => Promise<void>;
  onRename: (thumbnail: ThumbnailItem) => void;
  onDelete: (thumbnail: ThumbnailItem) => void;
  onAutoRename: (thumbnail: ThumbnailItem) => Promise<void>;
  onAddColorBackground: (thumbnail: ThumbnailItem) => void;
  onMoveToFolder: (thumbnail: ThumbnailItem) => void;
  onNewFolderClick: () => void;
  folders: Folder[];
}

export const ThumbnailGridItem = memo(function ThumbnailGridItem({
  thumbnail,
  onThumbnailClick,
  onExportClick,
  isProcessing,
  onRemoveBackground,
  onRename,
  onDelete,
  onAutoRename,
  onAddColorBackground,
  onMoveToFolder,
  onNewFolderClick,
  folders,
}: ThumbnailGridItemProps) {
  const isSelectionMode = useSelectionStore((s) => s.isSelectionMode);
  const selectedIds = useSelectionStore((s) => s.selectedIds);
  const toggleSelection = useSelectionStore((s) => s.toggleSelection);
  const duplicateThumbnail = useGalleryStore((s) => s.duplicateThumbnail);
  const loadPreviewForId = useGalleryStore((s) => s.loadPreviewForId);
  const cachedPreviewUrl = useGalleryStore((s) =>
    s.previewCache.get(thumbnail.id)
  );

  const [previewUrl, setPreviewUrl] = useState<string | null>(
    thumbnail.previewUrl || cachedPreviewUrl || null
  );
  const [isLoadingPreview, setIsLoadingPreview] = useState(!previewUrl);

  const titleRef = useRef<HTMLButtonElement>(null);
  const [isTitleTruncated, setIsTitleTruncated] = useState(false);
  const [isTitleHovered, setIsTitleHovered] = useState(false);
  const [contextMenuSize, setContextMenuSize] = useState<number | null>(null);

  const handleContextMenuOpen = useCallback(() => {
    setContextMenuSize(null);
    import("@/lib/revision-storage").then(({ getProjectStorageSize }) => {
      getProjectStorageSize(thumbnail.id).then(setContextMenuSize);
    });
  }, [thumbnail.id]);

  useEffect(() => {
    const el = titleRef.current;
    if (!el) return;
    const check = () => setIsTitleTruncated(el.scrollWidth > el.clientWidth);
    check();
    const observer = new ResizeObserver(check);
    observer.observe(el);
    return () => observer.disconnect();
  }, [thumbnail.name]);

  useEffect(() => {
    if (cachedPreviewUrl) {
      setPreviewUrl(cachedPreviewUrl);
      setIsLoadingPreview(false);
      return;
    }

    if (thumbnail.previewUrl) {
      setPreviewUrl(thumbnail.previewUrl);
      setIsLoadingPreview(false);
      return;
    }

    let cancelled = false;
    setIsLoadingPreview(true);

    loadPreviewForId(thumbnail.id).then((url) => {
      if (!cancelled) {
        setPreviewUrl(url);
        setIsLoadingPreview(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [thumbnail.id, thumbnail.previewUrl, cachedPreviewUrl, loadPreviewForId]);

  const handleClick = useCallback(() => {
    if (isProcessing) {
      return;
    }
    if (isSelectionMode) {
      toggleSelection(thumbnail.id);
    } else {
      onThumbnailClick(thumbnail);
    }
  }, [
    isProcessing,
    isSelectionMode,
    toggleSelection,
    thumbnail,
    onThumbnailClick,
  ]);

  const isSelected = selectedIds.has(thumbnail.id);

  return (
    <ContextMenu onOpenChange={(open) => open && handleContextMenuOpen()}>
      <ContextMenuTrigger>
        <div
          className={cn(
            "group relative aspect-video cursor-pointer overflow-hidden rounded-lg border border-border bg-card transition-transform hover:scale-[1.02]",
            isSelectionMode && isSelected && "ring-2 ring-primary"
          )}
          data-thumbnail-id={thumbnail.id}
          onClick={handleClick}
          onKeyDown={() => {}}
          onMouseDown={(e) => {
            if (e.button === 1) {
              e.preventDefault();
              import("@/stores/use-tabs-store").then(({ useTabsStore }) => {
                useTabsStore.getState().openTabBackground(thumbnail);
              });
            }
          }}
        >
          {isLoadingPreview ? (
            <div className="flex h-full w-full items-center justify-center bg-muted">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : previewUrl ? (
            <img
              alt={thumbnail.name}
              className="h-full w-full object-cover"
              decoding="async"
              loading="lazy"
              src={previewUrl}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-muted">
              <span className="text-muted-foreground text-sm">No preview</span>
            </div>
          )}

          <SelectionCheckbox
            isSelected={isSelected}
            isSelectionMode={isSelectionMode}
          />

          {/* Gradient overlay with actions */}
          <div className="absolute inset-0 bg-linear-to-t from-black/70 via-black/40 to-transparent opacity-0 transition-opacity group-hover:opacity-100">
            {isProcessing ? (
              <span className="absolute inset-0 flex items-center justify-center text-sm text-white">
                Processing...
              </span>
            ) : (
              <div className="absolute right-0 bottom-0 left-0 flex items-end gap-1 px-2 py-2">
                <div className="min-w-0 flex-1 pl-1">
                  <Tooltip open={isTitleTruncated && isTitleHovered}>
                    <TooltipTrigger
                      className="block w-full truncate text-left text-sm text-white"
                      onMouseEnter={() => setIsTitleHovered(true)}
                      onMouseLeave={() => setIsTitleHovered(false)}
                      ref={titleRef}
                    >
                      {thumbnail.name}
                    </TooltipTrigger>
                    <TooltipContent>{thumbnail.name}</TooltipContent>
                  </Tooltip>
                </div>
                {!isSelectionMode && (
                  <ThumbnailActionButtons
                    onAddColorBackground={onAddColorBackground}
                    onAutoRename={onAutoRename}
                    onDelete={onDelete}
                    onExportClick={onExportClick}
                    onRemoveBackground={onRemoveBackground}
                    onRename={onRename}
                    thumbnail={thumbnail}
                  />
                )}
              </div>
            )}
          </div>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-48">
        <div className="px-2 py-1.5">
          <p className="break-words font-medium text-sm">{thumbnail.name}</p>
          {thumbnail.canvasWidth && thumbnail.canvasHeight && (
            <p className="text-muted-foreground text-xs">
              {thumbnail.canvasWidth} × {thumbnail.canvasHeight}
            </p>
          )}
          <p className="text-muted-foreground text-xs">
            Updated {new Date(thumbnail.updatedAt).toLocaleDateString()}
          </p>
          <p className="text-muted-foreground text-xs">
            Created {new Date(thumbnail.createdAt).toLocaleDateString()}
          </p>
          <p className="text-muted-foreground text-xs">
            {contextMenuSize === null
              ? "Calculating size…"
              : contextMenuSize === 0
                ? "No data stored"
                : `${(contextMenuSize / (1024 * 1024)).toFixed(1)} MB on disk`}
          </p>
        </div>
        <ContextMenuSeparator />
        <ContextMenuItem
          onClick={async () => {
            await duplicateThumbnail(thumbnail.id);
            toast.success("Thumbnail duplicated");
          }}
        >
          <Copy className="mr-2 size-4" />
          Duplicate
        </ContextMenuItem>
        <ContextMenuItem onClick={() => onRename(thumbnail)}>
          <Pencil className="mr-2 size-4" />
          Rename
        </ContextMenuItem>
        {folders.length > 0 && (
          <ContextMenuItem onClick={() => onMoveToFolder(thumbnail)}>
            <FolderOpen className="mr-2 size-4" />
            Move to Folder
          </ContextMenuItem>
        )}
        <ContextMenuItem onClick={onNewFolderClick}>
          <FolderPlus className="mr-2 size-4" />
          New Folder
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={() => onExportClick(thumbnail)}>
          <Download className="mr-2 size-4" />
          Export
        </ContextMenuItem>
        <ContextMenuItem onClick={(e) => onRemoveBackground(e, thumbnail)}>
          <Wand2 className="mr-2 size-4" />
          Remove Background
        </ContextMenuItem>
        <ContextMenuItem onClick={() => onAddColorBackground(thumbnail)}>
          <PaintBucket className="mr-2 size-4" />
          Add Color Background
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem
          className="text-destructive focus:text-destructive"
          onClick={() => onDelete(thumbnail)}
        >
          <Trash2 className="mr-2 size-4" />
          Delete
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
});
