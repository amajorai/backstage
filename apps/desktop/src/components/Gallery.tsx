import {
  CheckSquare,
  GalleryThumbnails,
  Grid2X2,
  ImagePlus,
  Loader2,
  MonitorPlay,
  Plus,
  Search,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { VirtuosoGrid } from "react-virtuoso";
import { toast } from "sonner";
import type { ViewMode } from "@/App";
import { AddColorBackgroundDialog } from "@/components/editor/AddColorBackgroundDialog";
import { EmptyState } from "@/components/gallery/EmptyState";
import { gridComponents } from "@/components/gallery/VirtuosoGridComponents";
import { ThumbnailGridItem } from "@/components/ThumbnailGridItem";
import { TitleBar } from "@/components/TitleBar";
import { AddMenu } from "@/components/toolbar/add-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { VideoExtractor } from "@/components/VideoExtractor";
import { useDragSelection } from "@/hooks/use-drag-selection";
import { openAndLoadImages } from "@/lib/image-file-utils";
import { useAutoRenameQueue } from "@/stores/use-auto-rename-queue";
import {
  type ThumbnailItem,
  useGalleryStore,
} from "@/stores/use-gallery-store";
import { useGalleryUIStore } from "@/stores/use-gallery-ui-store";
import { useSelectionStore } from "@/stores/use-selection-store";

interface GalleryProps {
  viewMode: ViewMode;
  onThumbnailClick: (thumbnail: ThumbnailItem) => void;
  onExportClick: (thumbnail: ThumbnailItem) => void;
  onAddVideoClick: () => void;
  onNewProjectClick: () => void;
}

export function Gallery({
  viewMode,
  onThumbnailClick,
  onExportClick,
  onAddVideoClick,
  onNewProjectClick,
}: GalleryProps) {
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [colorBgThumbnail, setColorBgThumbnail] =
    useState<ThumbnailItem | null>(null);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [showVideoExtractor, setShowVideoExtractor] = useState(false);
  const [selectedThumbnail, setSelectedThumbnail] =
    useState<ThumbnailItem | null>(null);
  const [newName, setNewName] = useState("");
  const addToRenameQueue = useAutoRenameQueue((s) => s.addToQueue);
  const addThumbnail = useGalleryStore((s) => s.addThumbnail);
  const deleteThumbnail = useGalleryStore((s) => s.deleteThumbnail);
  const updateThumbnailName = useGalleryStore((s) => s.updateThumbnailName); // used by rename dialog
  const sortField = useGalleryStore((s) => s.sortField);
  const sortOrder = useGalleryStore((s) => s.sortOrder);
  const rawThumbnails = useGalleryStore((s) => s.thumbnails);
  const isLoaded = useGalleryStore((s) => s.isLoaded);

  const [searchQuery, setSearchQuery] = useState("");

  const isSelectionMode = useSelectionStore((s) => s.isSelectionMode);
  const selectAll = useSelectionStore((s) => s.selectAll);
  const toggleSelectionMode = useSelectionStore((s) => s.toggleSelectionMode);
  const exitSelectionMode = useSelectionStore((s) => s.exitSelectionMode);

  const lastClickedIndex = useGalleryUIStore((s) => s.lastClickedIndex);
  const setLastClickedIndex = useGalleryUIStore((s) => s.setLastClickedIndex);

  const filteredThumbnails = useMemo(() => {
    let filtered = rawThumbnails;
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter((t) => t.name.toLowerCase().includes(query));
    }
    return [...filtered].sort((a, b) => {
      let cmp = 0;
      if (sortField === "name") {
        cmp = a.name.localeCompare(b.name);
      } else {
        cmp = (a[sortField] || 0) - (b[sortField] || 0);
      }
      return sortOrder === "desc" ? -cmp : cmp;
    });
  }, [rawThumbnails, sortField, sortOrder, searchQuery]);

  const projects = filteredThumbnails;

  const gridColClass = useMemo(() => {
    const gridClasses: Record<ViewMode, string> = {
      "3": "grid-cols-3",
      "4": "grid-cols-4",
      "5": "grid-cols-5",
      row: "grid-cols-1",
    };
    return gridClasses[viewMode];
  }, [viewMode]);

  // Drag selection hook
  const {
    selectionBox,
    containerRef,
    scrollerRef,
    handleMouseDown,
    justEnteredSelectionMode,
  } = useDragSelection({
    dataAttribute: "data-thumbnail-id",
    isSelectionMode,
    onEnableSelectionMode: toggleSelectionMode,
    onSelectionChange: (ids) => useSelectionStore.getState().selectAll(ids),
    onClearSelection: () => useSelectionStore.getState().clearSelection(),
  });

  const handleAddImage = useCallback(async () => {
    const images = await openAndLoadImages();
    for (const { dataUrl, fileName } of images) {
      addThumbnail(dataUrl, fileName);
    }
  }, [addThumbnail]);

  const loadFullImageForId = useGalleryStore((s) => s.loadFullImageForId);

  const handleRemoveBackground = useCallback(
    async (e: React.MouseEvent, thumbnail: ThumbnailItem) => {
      e.stopPropagation();
      setProcessingId(thumbnail.id);
      try {
        const fullImageUrl = await loadFullImageForId(thumbnail.id);
        if (!fullImageUrl) {
          console.error("Failed to load image for background removal");
          return;
        }
        const { runBgRemovalPipeline } = await import(
          "@/lib/bg-removal-pipeline"
        );
        const result = await runBgRemovalPipeline(fullImageUrl);
        const outputName =
          result.kind === "gemini-only"
            ? `${thumbnail.name} (gemini bg)`
            : `${thumbnail.name} (no bg)`;
        addThumbnail(result.dataUrl, outputName);
      } catch (error) {
        console.error("Background removal failed:", error);
      } finally {
        setProcessingId(null);
      }
    },
    [addThumbnail, loadFullImageForId]
  );

  const handleConfirmColorBg = useCallback(
    async (color: string, extraPrompt: string) => {
      const thumbnail = colorBgThumbnail;
      setColorBgThumbnail(null);
      if (!thumbnail) return;
      setProcessingId(thumbnail.id);
      const toastId = toast.loading("Adding color background...");
      try {
        const fullImageUrl = await loadFullImageForId(thumbnail.id);
        if (!fullImageUrl) throw new Error("Image not found");
        const { getGeminiApiKey } = await import("@/lib/gemini-store");
        const apiKey = await getGeminiApiKey();
        if (!apiKey)
          throw new Error(
            "Gemini API key not set. Add it in Settings → API Keys."
          );
        const { generateImageWithGemini, base64ToDataUrl } = await import(
          "@/lib/gemini-image"
        );
        const { useAppSettingsStore } = await import(
          "@/stores/use-app-settings-store"
        );
        const model = useAppSettingsStore.getState()
          .bgRemovalGeminiModel as import("@/lib/gemini-image").GeminiImageModel;
        const extra = extraPrompt.trim();
        const prompt = `Replace the background of this image with a solid flat ${color} color. Keep the subject exactly as-is. Output the full image with the new solid color background.${extra ? ` Additional instructions: ${extra}` : ""}`;
        const result = await generateImageWithGemini(
          apiKey,
          model,
          prompt,
          fullImageUrl
        );
        const dataUrl = base64ToDataUrl(result.imageBase64, result.mimeType);
        await addThumbnail(dataUrl, `${thumbnail.name} (${color} bg)`);
        toast.success("Color background added", { id: toastId });
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Failed to add background",
          { id: toastId }
        );
      } finally {
        setProcessingId(null);
      }
    },
    [colorBgThumbnail, loadFullImageForId, addThumbnail]
  );

  const handleAutoRename = useCallback(
    async (thumbnail: ThumbnailItem) => {
      addToRenameQueue([{ thumbnailId: thumbnail.id, name: thumbnail.name }]);
    },
    [addToRenameQueue]
  );

  const handleRename = useCallback((thumbnail: ThumbnailItem) => {
    setSelectedThumbnail(thumbnail);
    setNewName(thumbnail.name);
    setRenameDialogOpen(true);
  }, []);

  const handleDelete = useCallback((thumbnail: ThumbnailItem) => {
    setSelectedThumbnail(thumbnail);
    setDeleteDialogOpen(true);
  }, []);

  const itemContent = useCallback(
    (index: number) => {
      const thumbnail = projects[index];
      if (!thumbnail) return null;
      return (
        <ThumbnailGridItem
          isProcessing={processingId === thumbnail.id}
          onAddColorBackground={setColorBgThumbnail}
          onAutoRename={handleAutoRename}
          onDelete={handleDelete}
          onExportClick={onExportClick}
          onRemoveBackground={handleRemoveBackground}
          onRename={handleRename}
          onThumbnailClick={(t) => {
            setLastClickedIndex(index);
            onThumbnailClick(t);
          }}
          thumbnail={thumbnail}
        />
      );
    },
    [
      projects,
      processingId,
      handleAutoRename,
      handleDelete,
      onExportClick,
      handleRemoveBackground,
      handleRename,
      setLastClickedIndex,
      onThumbnailClick,
    ]
  );

  if (!isLoaded) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4">
        <Loader2 className="size-10 animate-spin text-muted-foreground" />
        <p className="text-muted-foreground text-sm">Loading thumbnails...</p>
      </div>
    );
  }

  // Generic empty state logic replaced by tab-specific

  return (
    <div className="relative flex flex-1 select-none flex-col">
      <TitleBar
        center={
          <div className="relative z-[50]">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground/50" />
            <Input
              className="h-8 w-64 border-none bg-muted/30 pr-8 pl-9 transition-all focus-visible:w-96 focus-visible:ring-1 focus-visible:ring-primary/20"
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search projects..."
              type="text"
              value={searchQuery}
            />
            {projects.length > 0 && (
              <Badge
                className="absolute top-1/2 right-2 h-5 -translate-y-1/2 border-none bg-primary/10 px-1.5 font-bold text-[10px] text-primary"
                variant="outline"
              >
                {projects.length}
              </Badge>
            )}
          </div>
        }
      />

      <div className="relative flex-1 select-none overflow-hidden">
        <ContextMenu>
          <ContextMenuTrigger className="h-full">
            <div
              className="h-full w-full overflow-hidden"
              onClick={(e) => {
                if (justEnteredSelectionMode.current) {
                  justEnteredSelectionMode.current = false;
                  return;
                }
                if (
                  isSelectionMode &&
                  !(e.target as HTMLElement).closest("[data-thumbnail-id]")
                ) {
                  exitSelectionMode();
                }
              }}
              onMouseDown={handleMouseDown}
              ref={containerRef}
            >
              {selectionBox && (
                <div
                  className="pointer-events-none absolute z-50 border border-primary/50 bg-primary/20"
                  style={{
                    left: selectionBox.x,
                    top: selectionBox.y,
                    width: selectionBox.width,
                    height: selectionBox.height,
                  }}
                />
              )}

              <div className="mt-0 h-full">
                {projects.length === 0 && searchQuery.trim() ? (
                  <div className="flex h-full flex-col items-center justify-center gap-4">
                    <Search className="size-10 text-muted-foreground opacity-40" />
                    <div className="text-center">
                      <p className="font-medium">No results found</p>
                      <p className="mt-1 text-muted-foreground text-sm">
                        Try a different search term
                      </p>
                    </div>
                    <Button onClick={() => setSearchQuery("")} variant="ghost">
                      Clear Search
                    </Button>
                  </div>
                ) : projects.length === 0 && !searchQuery.trim() ? (
                  <EmptyState
                    action={
                      <AddMenu
                        onAddVideoClick={() => setShowVideoExtractor(true)}
                        onNewProjectClick={onNewProjectClick}
                        triggerClassName="gap-2"
                        triggerContent={
                          <>
                            <Plus className="size-4" />
                            Create
                          </>
                        }
                      />
                    }
                    description="Start by adding images or extracting frames from videos"
                    icon={
                      <GalleryThumbnails className="size-10 fill-muted-foreground" />
                    }
                    title="No projects yet"
                  />
                ) : (
                  <VirtuosoGrid
                    components={gridComponents}
                    initialTopMostItemIndex={lastClickedIndex ?? 0}
                    itemContent={itemContent}
                    listClassName={gridColClass}
                    overscan={600}
                    scrollerRef={(ref) => {
                      scrollerRef.current = ref as HTMLDivElement;
                    }}
                    style={{ height: "100%", width: "100%" }}
                    totalCount={projects.length}
                  />
                )}
              </div>
            </div>
          </ContextMenuTrigger>
          <ContextMenuContent>
            <ContextMenuItem onClick={handleAddImage}>
              <ImagePlus className="mr-2 size-4" />
              Upload Photo
            </ContextMenuItem>
            <ContextMenuItem onClick={() => setShowVideoExtractor(true)}>
              <MonitorPlay className="mr-2 size-4" />
              Upload Video
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem
              onClick={() => {
                toggleSelectionMode();
                selectAll(projects.map((t) => t.id));
              }}
            >
              <CheckSquare className="mr-2 size-4" />
              Select All
            </ContextMenuItem>
            <ContextMenuItem
              onClick={() => {
                if (isSelectionMode) {
                  exitSelectionMode();
                } else {
                  toggleSelectionMode();
                }
              }}
            >
              <Grid2X2 className="mr-2 size-4" />
              {isSelectionMode ? "Exit Selection Mode" : "Enter Selection Mode"}
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
      </div>

      {showVideoExtractor && (
        <VideoExtractor onClose={() => setShowVideoExtractor(false)} />
      )}

      <AddColorBackgroundDialog
        isProcessing={false}
        onConfirm={handleConfirmColorBg}
        onOpenChange={(open) => {
          if (!open) setColorBgThumbnail(null);
        }}
        open={colorBgThumbnail !== null}
      />

      <Dialog onOpenChange={setRenameDialogOpen} open={renameDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Thumbnail</DialogTitle>
          </DialogHeader>
          <Input
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && selectedThumbnail && newName.trim()) {
                updateThumbnailName(selectedThumbnail.id, newName.trim());
                toast.success("Thumbnail renamed");
                setRenameDialogOpen(false);
              }
            }}
            placeholder="Enter new name"
            value={newName}
          />
          <DialogFooter>
            <DialogClose render={<Button variant="ghost" />}>
              Cancel
            </DialogClose>
            <Button
              onClick={() => {
                if (selectedThumbnail && newName.trim()) {
                  updateThumbnailName(selectedThumbnail.id, newName.trim());
                  toast.success("Thumbnail renamed");
                  setRenameDialogOpen(false);
                }
              }}
            >
              Rename
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog onOpenChange={setDeleteDialogOpen} open={deleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Move to Trash?</AlertDialogTitle>
            <AlertDialogDescription>
              "{selectedThumbnail?.name}" will be moved to trash. You can
              restore it within 30 days.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (selectedThumbnail) {
                  await deleteThumbnail(selectedThumbnail.id);
                  toast.info("Moved to trash");
                  setDeleteDialogOpen(false);
                }
              }}
              variant="destructive"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
