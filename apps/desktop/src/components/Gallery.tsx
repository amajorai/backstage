import {
  CheckSquare,
  FolderOpen,
  FolderPlus,
  GalleryThumbnails,
  ImagePlus,
  LayoutTemplate,
  Loader2,
  MonitorPlay,
  Plus,
  Search,
  SquareDashedMousePointer,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { type GridStateSnapshot, VirtuosoGrid } from "react-virtuoso";
import { toast } from "sonner";
import type { ViewMode } from "@/App";
import { AddColorBackgroundDialog } from "@/components/editor/AddColorBackgroundDialog";
import { EmptyState } from "@/components/gallery/EmptyState";
import {
  gridComponents,
  gridComponentsWithFolderBar,
} from "@/components/gallery/VirtuosoGridComponents";
import { ThumbnailGridItem } from "@/components/ThumbnailGridItem";
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
import { cn } from "@/lib/utils";
import { useAutoRenameQueue } from "@/stores/use-auto-rename-queue";
import { useFolderStore } from "@/stores/use-folder-store";
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
  onNewFolderClick: () => void;
}

export function Gallery({
  viewMode,
  onThumbnailClick,
  onExportClick,
  onAddVideoClick,
  onNewProjectClick,
  onNewFolderClick,
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

  const [moveFolderThumbnail, setMoveFolderThumbnail] =
    useState<ThumbnailItem | null>(null);
  const [deleteFolderTarget, setDeleteFolderTarget] = useState<string | null>(
    null
  );
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);

  const addToRenameQueue = useAutoRenameQueue((s) => s.addToQueue);
  const addThumbnail = useGalleryStore((s) => s.addThumbnail);
  const deleteThumbnail = useGalleryStore((s) => s.deleteThumbnail);
  const updateThumbnailName = useGalleryStore((s) => s.updateThumbnailName);
  const setThumbnailFolder = useGalleryStore((s) => s.setThumbnailFolder);
  const sortField = useGalleryStore((s) => s.sortField);
  const sortOrder = useGalleryStore((s) => s.sortOrder);
  const rawThumbnails = useGalleryStore((s) => s.thumbnails);
  const isLoaded = useGalleryStore((s) => s.isLoaded);

  const folders = useFolderStore((s) => s.folders);
  const deleteFolder = useFolderStore((s) => s.deleteFolder);

  const isSelectionMode = useSelectionStore((s) => s.isSelectionMode);
  const selectAll = useSelectionStore((s) => s.selectAll);
  const toggleSelectionMode = useSelectionStore((s) => s.toggleSelectionMode);
  const exitSelectionMode = useSelectionStore((s) => s.exitSelectionMode);

  const setLastClickedIndex = useGalleryUIStore((s) => s.setLastClickedIndex);
  const gridSnapshot = useGalleryUIStore((s) => s.gridSnapshot);
  const setGridSnapshot = useGalleryUIStore((s) => s.setGridSnapshot);
  const searchQuery = useGalleryUIStore((s) => s.searchQuery);
  const setSearchQuery = useGalleryUIStore((s) => s.setSearchQuery);
  const setFilteredCount = useGalleryUIStore((s) => s.setFilteredCount);
  const selectedFolderId = useGalleryUIStore((s) => s.selectedFolderId);
  const setSelectedFolderId = useGalleryUIStore((s) => s.setSelectedFolderId);
  const bulkMoveFolderOpen = useGalleryUIStore((s) => s.bulkMoveFolderOpen);
  const setBulkMoveFolderOpen = useGalleryUIStore(
    (s) => s.setBulkMoveFolderOpen
  );

  const filteredThumbnails = useMemo(() => {
    let filtered = rawThumbnails;
    if (selectedFolderId !== null) {
      filtered = filtered.filter((t) => t.folderId === selectedFolderId);
    }
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
  }, [rawThumbnails, sortField, sortOrder, searchQuery, selectedFolderId]);

  const projects = filteredThumbnails;

  useEffect(() => {
    setFilteredCount(projects.length);
  }, [projects.length, setFilteredCount]);

  const gridColClass = useMemo(() => {
    const gridClasses: Record<ViewMode, string> = {
      "3": "grid-cols-3",
      "4": "grid-cols-4",
      "5": "grid-cols-5",
      row: "grid-cols-1",
    };
    return gridClasses[viewMode];
  }, [viewMode]);

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

  const handleMoveToFolder = useCallback((thumbnail: ThumbnailItem) => {
    setMoveFolderThumbnail(thumbnail);
  }, []);

  const handleConfirmDeleteFolder = useCallback(async () => {
    if (!deleteFolderTarget) return;
    const folder = folders.find((f) => f.id === deleteFolderTarget);
    await deleteFolder(deleteFolderTarget);
    setDeleteFolderTarget(null);
    if (selectedFolderId === deleteFolderTarget) setSelectedFolderId(null);
    toast.success(`Folder "${folder?.name}" deleted`);
  }, [
    deleteFolderTarget,
    folders,
    deleteFolder,
    selectedFolderId,
    setSelectedFolderId,
  ]);

  const itemContent = useCallback(
    (index: number) => {
      const thumbnail = projects[index];
      if (!thumbnail) return null;
      return (
        <ThumbnailGridItem
          folders={folders}
          isProcessing={processingId === thumbnail.id}
          itemIndex={index}
          onAddColorBackground={setColorBgThumbnail}
          onAutoRename={handleAutoRename}
          onDelete={handleDelete}
          onExportClick={onExportClick}
          onMoveToFolder={handleMoveToFolder}
          onNewFolderClick={onNewFolderClick}
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
      folders,
      processingId,
      handleAutoRename,
      handleDelete,
      onExportClick,
      handleMoveToFolder,
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

  const selectedFolder = folders.find((f) => f.id === selectedFolderId) ?? null;

  return (
    <div className="relative flex flex-1 select-none flex-col overflow-hidden">
      {folders.length > 0 && (
        <div className="scrollbar-none absolute top-0 right-0 left-0 z-20 flex items-center gap-1.5 overflow-x-auto px-5 py-3">
          <button
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1 text-sm transition-colors",
              selectedFolderId === null
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
            onClick={() => setSelectedFolderId(null)}
            type="button"
          >
            All
          </button>
          {folders.map((folder) => (
            <div
              className={cn(
                "group flex shrink-0 items-center gap-1 rounded-md px-2.5 py-1 text-sm transition-all",
                selectedFolderId === folder.id
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
                dragOverFolderId === folder.id &&
                  "scale-110 ring-2 ring-primary"
              )}
              key={folder.id}
              onDragLeave={() => setDragOverFolderId(null)}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                setDragOverFolderId(folder.id);
              }}
              onDrop={async (e) => {
                e.preventDefault();
                setDragOverFolderId(null);
                const raw = e.dataTransfer.getData("application/thumbnail-ids");
                if (!raw) return;
                const ids = JSON.parse(raw) as string[];
                await Promise.all(
                  ids.map((id) => setThumbnailFolder(id, folder.id))
                );
                toast.success(
                  `Moved ${ids.length} item${ids.length > 1 ? "s" : ""} to "${folder.name}"`
                );
              }}
            >
              <button
                className="flex items-center gap-1.5"
                onClick={() =>
                  setSelectedFolderId(
                    selectedFolderId === folder.id ? null : folder.id
                  )
                }
                type="button"
              >
                <FolderOpen className="size-3.5" />
                {folder.name}
              </button>
              <button
                className={cn(
                  "ml-0.5 rounded opacity-0 transition-opacity group-hover:opacity-100",
                  selectedFolderId === folder.id &&
                    "opacity-60 hover:opacity-100"
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  setDeleteFolderTarget(folder.id);
                }}
                title="Delete folder"
                type="button"
              >
                <X className="size-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="relative flex-1 select-none overflow-hidden">
        <div className="pointer-events-none absolute top-0 right-0 left-0 z-10 h-16 bg-gradient-to-b from-background to-transparent" />
        <div className="pointer-events-none absolute right-0 bottom-0 left-0 z-10 h-16 bg-gradient-to-t from-background to-transparent" />
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
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
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
                    description={
                      selectedFolder
                        ? `No projects in "${selectedFolder.name}" yet`
                        : "Start by adding images or extracting frames from videos"
                    }
                    icon={
                      <GalleryThumbnails className="size-10 fill-muted-foreground" />
                    }
                    title={
                      selectedFolder
                        ? `"${selectedFolder.name}" is empty`
                        : "No projects yet"
                    }
                  />
                ) : (
                  <VirtuosoGrid
                    components={
                      folders.length > 0
                        ? gridComponentsWithFolderBar
                        : gridComponents
                    }
                    itemContent={itemContent}
                    listClassName={gridColClass}
                    overscan={600}
                    restoreStateFrom={gridSnapshot}
                    scrollerRef={(ref) => {
                      scrollerRef.current = ref as HTMLDivElement;
                    }}
                    stateChanged={(state: GridStateSnapshot) =>
                      setGridSnapshot(state)
                    }
                    style={{ height: "100%", width: "100%" }}
                    totalCount={projects.length}
                  />
                )}
              </div>
            </div>
          </ContextMenuTrigger>
          <ContextMenuContent>
            <ContextMenuItem onClick={onNewProjectClick}>
              <LayoutTemplate className="mr-2 size-4" />
              New Project
            </ContextMenuItem>
            <ContextMenuItem onClick={onNewFolderClick}>
              <FolderPlus className="mr-2 size-4" />
              New Folder
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem onClick={handleAddImage}>
              <ImagePlus className="mr-2 size-4" />
              Add Image
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
              <SquareDashedMousePointer className="mr-2 size-4" />
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

      <Dialog
        onOpenChange={(open) => {
          if (!open) setMoveFolderThumbnail(null);
        }}
        open={moveFolderThumbnail !== null}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Move to Folder</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-1">
            <button
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-muted",
                moveFolderThumbnail?.folderId === null && "bg-muted"
              )}
              onClick={async () => {
                if (moveFolderThumbnail) {
                  await setThumbnailFolder(moveFolderThumbnail.id, null);
                  toast.success("Moved out of folder");
                  setMoveFolderThumbnail(null);
                }
              }}
              type="button"
            >
              <GalleryThumbnails className="size-4 text-muted-foreground" />
              No folder
            </button>
            {folders.map((folder) => (
              <button
                className={cn(
                  "flex items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-muted",
                  moveFolderThumbnail?.folderId === folder.id && "bg-muted"
                )}
                key={folder.id}
                onClick={async () => {
                  if (moveFolderThumbnail) {
                    await setThumbnailFolder(moveFolderThumbnail.id, folder.id);
                    toast.success(`Moved to "${folder.name}"`);
                    setMoveFolderThumbnail(null);
                  }
                }}
                type="button"
              >
                <FolderOpen className="size-4 text-muted-foreground" />
                {folder.name}
              </button>
            ))}
            {folders.length === 0 && (
              <p className="px-3 py-2 text-muted-foreground text-sm">
                No folders yet. Right-click the gallery to create one.
              </p>
            )}
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="ghost" />}>
              Cancel
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk move to folder dialog */}
      <Dialog onOpenChange={setBulkMoveFolderOpen} open={bulkMoveFolderOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Move to Folder</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-1">
            <button
              className="flex items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-muted"
              onClick={async () => {
                const ids = Array.from(
                  useSelectionStore.getState().selectedIds
                );
                await Promise.all(
                  ids.map((id) => setThumbnailFolder(id, null))
                );
                toast.success(
                  `Moved ${ids.length} item${ids.length > 1 ? "s" : ""} out of folder`
                );
                setBulkMoveFolderOpen(false);
                useSelectionStore.getState().clearSelection();
              }}
              type="button"
            >
              <GalleryThumbnails className="size-4 text-muted-foreground" />
              No folder
            </button>
            {folders.map((folder) => (
              <button
                className="flex items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-muted"
                key={folder.id}
                onClick={async () => {
                  const ids = Array.from(
                    useSelectionStore.getState().selectedIds
                  );
                  await Promise.all(
                    ids.map((id) => setThumbnailFolder(id, folder.id))
                  );
                  toast.success(
                    `Moved ${ids.length} item${ids.length > 1 ? "s" : ""} to "${folder.name}"`
                  );
                  setBulkMoveFolderOpen(false);
                  useSelectionStore.getState().clearSelection();
                }}
                type="button"
              >
                <FolderOpen className="size-4 text-muted-foreground" />
                {folder.name}
              </button>
            ))}
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="ghost" />}>
              Cancel
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

      <AlertDialog
        onOpenChange={(open) => {
          if (!open) setDeleteFolderTarget(null);
        }}
        open={deleteFolderTarget !== null}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Folder?</AlertDialogTitle>
            <AlertDialogDescription>
              Projects inside will be moved out of the folder, not deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDeleteFolder}
              variant="destructive"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
