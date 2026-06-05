import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@repo/ui/alert-dialog";
import { Button } from "@repo/ui/button";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@repo/ui/context-menu";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/dialog";
import { Input } from "@repo/ui/input";
import {
  CheckSquare,
  CircleUser,
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
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type GridStateSnapshot, VirtuosoGrid } from "react-virtuoso";
import { sileo } from "sileo";
import type { ViewMode } from "@/App";
import { AddColorBackgroundDialog } from "@/components/editor/AddColorBackgroundDialog";
import { FolderColorPicker } from "@/components/FolderColorPicker";
import { EmptyState } from "@/components/gallery/EmptyState";
import {
  gridComponents,
  gridComponentsWithFolderBar,
} from "@/components/gallery/VirtuosoGridComponents";
import { ThumbnailGridItem } from "@/components/ThumbnailGridItem";
import { AddMenu } from "@/components/toolbar/add-menu";
import { VideoExtractor } from "@/components/VideoExtractor";
import { useDragSelection } from "@/hooks/use-drag-selection";
import { setDragPreview } from "@/lib/drag-preview";
import {
  loadDroppedImageFiles,
  openAndLoadImages,
} from "@/lib/image-file-utils";
import * as sounds from "@/lib/sounds";
import { cn } from "@/lib/utils";
import { useAutoRenameQueue } from "@/stores/use-auto-rename-queue";
import { useFolderStore } from "@/stores/use-folder-store";
import {
  type ThumbnailItem,
  useGalleryStore,
} from "@/stores/use-gallery-store";
import { useGalleryUIStore } from "@/stores/use-gallery-ui-store";
import { useSelectionStore } from "@/stores/use-selection-store";

// Sentinel folder id for the "No folder" pseudo-folder (thumbnails with no folderId)
const NO_FOLDER_ID = "__none__";

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
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);
  const dragCounterRef = useRef(0);

  const [moveFolderThumbnail, setMoveFolderThumbnail] =
    useState<ThumbnailItem | null>(null);
  const [deleteFolderTarget, setDeleteFolderTarget] = useState<string | null>(
    null
  );
  const [colorFolderTarget, setColorFolderTarget] = useState<string | null>(
    null
  );
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);
  const [dragOverFolderPosition, setDragOverFolderPosition] = useState<
    "before" | "after" | null
  >(null);
  const [draggingFolderId, setDraggingFolderId] = useState<string | null>(null);

  const addToRenameQueue = useAutoRenameQueue((s) => s.addToQueue);
  const addThumbnail = useGalleryStore((s) => s.addThumbnail);
  const deleteThumbnail = useGalleryStore((s) => s.deleteThumbnail);
  const archiveThumbnail = useGalleryStore((s) => s.archiveThumbnail);
  const archiveThumbnailsBatch = useGalleryStore(
    (s) => s.archiveThumbnailsBatch
  );
  const updateThumbnailName = useGalleryStore((s) => s.updateThumbnailName);
  const setThumbnailFolder = useGalleryStore((s) => s.setThumbnailFolder);
  const sortField = useGalleryStore((s) => s.sortField);
  const sortOrder = useGalleryStore((s) => s.sortOrder);
  const rawThumbnails = useGalleryStore((s) => s.thumbnails);
  const isLoaded = useGalleryStore((s) => s.isLoaded);

  const folders = useFolderStore((s) => s.folders);
  const deleteFolder = useFolderStore((s) => s.deleteFolder);
  const reorderFolders = useFolderStore((s) => s.reorderFolders);
  const renameFolder = useFolderStore((s) => s.renameFolder);
  const updateFolderColor = useFolderStore((s) => s.updateFolderColor);

  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null);
  const [renameFolderName, setRenameFolderName] = useState("");

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
  const setFilteredIds = useGalleryUIStore((s) => s.setFilteredIds);
  const selectedFolderId = useGalleryUIStore((s) => s.selectedFolderId);
  const setSelectedFolderId = useGalleryUIStore((s) => s.setSelectedFolderId);
  const bulkMoveFolderOpen = useGalleryUIStore((s) => s.bulkMoveFolderOpen);
  const setBulkMoveFolderOpen = useGalleryUIStore(
    (s) => s.setBulkMoveFolderOpen
  );
  const searchMode = useGalleryUIStore((s) => s.searchMode);
  const semanticResultIds = useGalleryUIStore((s) => s.semanticResultIds);

  const folderCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const t of rawThumbnails) {
      if (t.folderId) {
        counts[t.folderId] = (counts[t.folderId] ?? 0) + 1;
      } else {
        counts[NO_FOLDER_ID] = (counts[NO_FOLDER_ID] ?? 0) + 1;
      }
    }
    return counts;
  }, [rawThumbnails]);

  const filteredThumbnails = useMemo(() => {
    // Semantic mode: use KNN results (ordered by similarity), optionally folder-filtered
    if (searchMode === "semantic" && semanticResultIds !== null) {
      const thumbMap = new Map(rawThumbnails.map((t) => [t.id, t]));
      return semanticResultIds
        .map((id) => thumbMap.get(id))
        .filter((t): t is ThumbnailItem => {
          if (!t) return false;
          if (selectedFolderId === NO_FOLDER_ID) return !t.folderId;
          if (selectedFolderId !== null) return t.folderId === selectedFolderId;
          return true;
        });
    }

    let filtered = rawThumbnails;
    if (selectedFolderId === NO_FOLDER_ID) {
      filtered = filtered.filter((t) => !t.folderId);
    } else if (selectedFolderId !== null) {
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
  }, [
    rawThumbnails,
    sortField,
    sortOrder,
    searchQuery,
    selectedFolderId,
    searchMode,
    semanticResultIds,
  ]);

  const projects = filteredThumbnails;

  const projectIds = useMemo(() => projects.map((t) => t.id), [projects]);

  useEffect(() => {
    setFilteredCount(projectIds.length);
    setFilteredIds(projectIds);
  }, [projectIds, setFilteredCount, setFilteredIds]);

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

  const handleFileDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      dragCounterRef.current = 0;
      setIsDraggingFiles(false);
      if (!e.dataTransfer.files.length) return;
      const images = await loadDroppedImageFiles(e.dataTransfer.files);
      for (const { dataUrl, fileName } of images) {
        await addThumbnail(dataUrl, fileName);
      }
      if (images.length > 0) {
        sileo.success({
          title: `Added ${images.length} image${images.length > 1 ? "s" : ""} to gallery`,
        });
      }
    },
    [addThumbnail]
  );

  const loadFullImageForId = useGalleryStore((s) => s.loadFullImageForId);

  const handleRemoveBackground = useCallback(
    async (e: React.MouseEvent, thumbnail: ThumbnailItem) => {
      e.stopPropagation();
      setProcessingId(thumbnail.id);
      const toastId = sileo.show({
        title: "Removing background...",
        type: "loading",
        duration: null,
      }) as string;
      try {
        const fullImageUrl = await loadFullImageForId(thumbnail.id);
        if (!fullImageUrl) {
          sileo.dismiss(toastId);
          return;
        }
        const { runBgRemovalPipeline } = await import(
          "@/lib/bg-removal-pipeline"
        );
        const result = await runBgRemovalPipeline(fullImageUrl, (stage) =>
          sileo.show({
            title: stage,
            type: "loading",
            duration: null,
            id: toastId,
          } as any)
        );
        const outputName =
          result.kind === "gemini-only"
            ? `${thumbnail.name} (gemini bg)`
            : `${thumbnail.name} (no bg)`;
        const message =
          result.kind === "gemini-only"
            ? "Background replaced with color"
            : "Background removed";
        addThumbnail(result.dataUrl, outputName);
        sileo.success({ title: message, id: toastId } as any);
      } catch (error) {
        sileo.error({
          title:
            error instanceof Error
              ? error.message
              : "Failed to remove background",
          id: toastId,
        } as any);
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
      const toastId = sileo.show({
        title: "Adding color background...",
        type: "loading",
        duration: null,
      }) as string;
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
        sileo.success({ title: "Color background added", id: toastId } as any);
      } catch (error) {
        sileo.error({
          title:
            error instanceof Error ? error.message : "Failed to add background",
          id: toastId,
        } as any);
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

  const handleArchive = useCallback(
    async (thumbnail: ThumbnailItem) => {
      await archiveThumbnail(thumbnail.id);
      sileo.success({ title: `Archived "${thumbnail.name}"` });
    },
    [archiveThumbnail]
  );

  const handleArchiveFolder = useCallback(
    async (folderId: string) => {
      const folder = folders.find((f) => f.id === folderId);
      if (!folder) return;
      const itemsInFolder = rawThumbnails.filter(
        (t) => t.folderId === folderId
      );
      if (itemsInFolder.length === 0) {
        sileo.info({ title: `Folder "${folder.name}" is empty` });
        return;
      }
      const { useArchiveStore } = await import("@/stores/use-archive-store");
      const archiveFolder = await useArchiveStore
        .getState()
        .createArchiveFolder(folder.name);
      await archiveThumbnailsBatch(itemsInFolder.map((t) => t.id));
      // Assign all archived items to the new archive folder
      await useArchiveStore.getState().moveItemsBatchToArchiveFolder(
        itemsInFolder.map((t) => t.id),
        archiveFolder.id
      );
      if (selectedFolderId === folderId) setSelectedFolderId(null);
      sileo.success({
        title: `Archived folder "${folder.name}" (${itemsInFolder.length} items)`,
      });
    },
    [
      folders,
      rawThumbnails,
      archiveThumbnailsBatch,
      selectedFolderId,
      setSelectedFolderId,
    ]
  );

  const handleConfirmDeleteFolder = useCallback(async () => {
    if (!deleteFolderTarget) return;
    const folder = folders.find((f) => f.id === deleteFolderTarget);
    await deleteFolder(deleteFolderTarget);
    setDeleteFolderTarget(null);
    if (selectedFolderId === deleteFolderTarget) setSelectedFolderId(null);
    sileo.success({ title: `Folder "${folder?.name}" deleted` });
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
          onArchive={handleArchive}
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
      handleArchive,
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
    <div
      className="relative flex flex-1 select-none flex-col overflow-hidden"
      onDragEnter={(e) => {
        if (!e.dataTransfer.types.includes("Files")) return;
        dragCounterRef.current += 1;
        setIsDraggingFiles(true);
      }}
      onDragLeave={() => {
        dragCounterRef.current -= 1;
        if (dragCounterRef.current <= 0) {
          dragCounterRef.current = 0;
          setIsDraggingFiles(false);
        }
      }}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes("Files")) e.preventDefault();
      }}
      onDrop={handleFileDrop}
    >
      {isDraggingFiles && (
        <div className="pointer-events-none absolute inset-0 z-50 flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-primary border-dashed bg-background/80 backdrop-blur-sm">
          <ImagePlus className="size-10 text-primary" />
          <p className="font-medium text-primary text-sm">
            Drop images to add to gallery
          </p>
        </div>
      )}
      {folders.length > 0 && (
        <div className="scrollbar-none absolute top-0 right-0 left-0 z-20 flex items-center gap-1.5 overflow-x-auto px-5 py-3">
          <button
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1 text-sm transition-colors",
              selectedFolderId === null
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
            onClick={() => {
              sounds.click();
              setSelectedFolderId(null);
            }}
            type="button"
          >
            All
            <span
              className={cn(
                "rounded px-1 py-0.5 text-xs tabular-nums",
                selectedFolderId === null
                  ? "bg-primary-foreground/20 text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              )}
            >
              {rawThumbnails.length}
            </span>
          </button>
          <button
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1 text-sm transition-colors",
              selectedFolderId === NO_FOLDER_ID
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
            onClick={() => {
              sounds.click();
              setSelectedFolderId(
                selectedFolderId === NO_FOLDER_ID ? null : NO_FOLDER_ID
              );
            }}
            type="button"
          >
            No folder
            <span
              className={cn(
                "rounded px-1 py-0.5 text-xs tabular-nums",
                selectedFolderId === NO_FOLDER_ID
                  ? "bg-primary-foreground/20 text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              )}
            >
              {folderCounts[NO_FOLDER_ID] ?? 0}
            </span>
          </button>
          {folders.map((folder) => (
            <ContextMenu key={folder.id}>
              <ContextMenuTrigger asChild>
                <div
                  className={cn(
                    "group relative flex shrink-0 cursor-grab items-center gap-1 rounded-md px-2.5 py-1 text-sm transition-all active:cursor-grabbing",
                    selectedFolderId === folder.id
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground",
                    draggingFolderId === folder.id && "opacity-40",
                    dragOverFolderId === folder.id &&
                      draggingFolderId === null &&
                      "scale-110 ring-2 ring-primary"
                  )}
                  draggable
                  onDragEnd={() => {
                    setDraggingFolderId(null);
                    setDragOverFolderId(null);
                    setDragOverFolderPosition(null);
                  }}
                  onDragEnter={(e) => {
                    e.preventDefault();
                    setDragOverFolderId(folder.id);
                  }}
                  onDragLeave={(e) => {
                    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                      setDragOverFolderId(null);
                      setDragOverFolderPosition(null);
                    }
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                    setDragOverFolderId(folder.id);
                    const rect = e.currentTarget.getBoundingClientRect();
                    const midX = rect.left + rect.width / 2;
                    setDragOverFolderPosition(
                      e.clientX < midX ? "before" : "after"
                    );
                  }}
                  onDragStart={(e) => {
                    e.stopPropagation();
                    setDraggingFolderId(folder.id);
                    e.dataTransfer.setData("text/plain", `f:${folder.id}`);
                    e.dataTransfer.effectAllowed = "move";
                    setDragPreview(e.dataTransfer, {
                      label: folder.name,
                      icon: "folder",
                    });
                  }}
                  onDrop={async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const position = dragOverFolderPosition;
                    setDragOverFolderId(null);
                    setDragOverFolderPosition(null);
                    setDraggingFolderId(null);
                    const raw = e.dataTransfer.getData("text/plain");
                    if (!raw) return;
                    if (raw.startsWith("t:")) {
                      const ids = JSON.parse(raw.slice(2)) as string[];
                      await Promise.all(
                        ids.map((id) => setThumbnailFolder(id, folder.id))
                      );
                      sileo.success({
                        title: `Moved ${ids.length} item${ids.length > 1 ? "s" : ""} to "${folder.name}"`,
                      });
                    } else if (raw.startsWith("f:")) {
                      const draggedId = raw.slice(2);
                      if (draggedId === folder.id) return;
                      const current = useFolderStore.getState().folders;
                      const without = current.filter((f) => f.id !== draggedId);
                      let targetIdx = without.findIndex(
                        (f) => f.id === folder.id
                      );
                      if (position === "after") targetIdx += 1;
                      const dragged = current.find((f) => f.id === draggedId);
                      if (!dragged) return;
                      without.splice(targetIdx, 0, dragged);
                      await reorderFolders(without.map((f) => f.id));
                    }
                  }}
                >
                  {dragOverFolderId === folder.id &&
                    draggingFolderId !== null &&
                    draggingFolderId !== folder.id &&
                    dragOverFolderPosition === "before" && (
                      <div className="absolute top-1 bottom-1 -left-1 z-10 w-0.5 rounded-full bg-primary" />
                    )}
                  {dragOverFolderId === folder.id &&
                    draggingFolderId !== null &&
                    draggingFolderId !== folder.id &&
                    dragOverFolderPosition === "after" && (
                      <div className="absolute top-1 -right-1 bottom-1 z-10 w-0.5 rounded-full bg-primary" />
                    )}
                  <button
                    className="flex items-center gap-1.5"
                    onClick={() => {
                      sounds.click();
                      setSelectedFolderId(
                        selectedFolderId === folder.id ? null : folder.id
                      );
                    }}
                    type="button"
                  >
                    {folder.isCharacterSet ? (
                      <CircleUser
                        className="size-3.5 shrink-0"
                        style={
                          folder.color ? { color: folder.color } : undefined
                        }
                      />
                    ) : (
                      <FolderOpen
                        className="size-3.5 shrink-0"
                        style={
                          folder.color ? { color: folder.color } : undefined
                        }
                      />
                    )}
                    {renamingFolderId === folder.id ? (
                      <input
                        autoFocus
                        className="w-20 min-w-0 bg-transparent outline-none"
                        onBlur={async () => {
                          const trimmed = renameFolderName.trim();
                          if (trimmed && trimmed !== folder.name) {
                            await renameFolder(folder.id, trimmed);
                          }
                          setRenamingFolderId(null);
                        }}
                        onChange={(e) => setRenameFolderName(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={async (e) => {
                          if (e.key === "Enter") {
                            const trimmed = renameFolderName.trim();
                            if (trimmed && trimmed !== folder.name) {
                              await renameFolder(folder.id, trimmed);
                            }
                            setRenamingFolderId(null);
                          } else if (e.key === "Escape") {
                            setRenamingFolderId(null);
                          }
                        }}
                        value={renameFolderName}
                      />
                    ) : (
                      folder.name
                    )}
                    <span
                      className="rounded px-1 py-0.5 text-xs tabular-nums backdrop-blur-sm"
                      style={{
                        backgroundColor:
                          selectedFolderId === folder.id
                            ? "rgba(255,255,255,0.2)"
                            : "rgba(128,128,128,0.15)",
                        color:
                          selectedFolderId === folder.id
                            ? "inherit"
                            : undefined,
                      }}
                    >
                      {folderCounts[folder.id] ?? 0}
                    </span>
                  </button>
                  <div
                    className={cn(
                      "max-w-0 overflow-hidden transition-[max-width,opacity] duration-200 ease-out group-hover:max-w-[20px]",
                      selectedFolderId === folder.id
                        ? "max-w-[20px] opacity-60 group-hover:opacity-100"
                        : "opacity-0 group-hover:opacity-100"
                    )}
                  >
                    <button
                      className="ml-0.5 rounded"
                      onClick={(e) => {
                        e.stopPropagation();
                        sounds.delete_();
                        setDeleteFolderTarget(folder.id);
                      }}
                      title="Delete folder"
                      type="button"
                    >
                      <X className="size-3" />
                    </button>
                  </div>
                </div>
              </ContextMenuTrigger>
              <ContextMenuContent className="w-44">
                <ContextMenuItem
                  onClick={() => {
                    sounds.click();
                    setRenameFolderName(folder.name);
                    setRenamingFolderId(folder.id);
                  }}
                >
                  Rename
                </ContextMenuItem>
                <ContextMenuItem
                  onClick={() => {
                    sounds.click();
                    setColorFolderTarget(folder.id);
                  }}
                >
                  Change Color
                </ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuItem
                  onClick={() => {
                    sounds.click();
                    useFolderStore
                      .getState()
                      .toggleCharacterSet(folder.id, !folder.isCharacterSet);
                  }}
                >
                  {folder.isCharacterSet
                    ? "Unmark as Character Set"
                    : "Mark as Character Set"}
                </ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuItem
                  onClick={() => {
                    sounds.click();
                    handleArchiveFolder(folder.id);
                  }}
                >
                  Archive Folder
                </ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuItem
                  onClick={() => {
                    sounds.delete_();
                    setDeleteFolderTarget(folder.id);
                  }}
                  variant="destructive"
                >
                  Delete
                </ContextMenuItem>
              </ContextMenuContent>
            </ContextMenu>
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
                    <Button
                      onClick={() => {
                        sounds.click();
                        setSearchQuery("");
                      }}
                      variant="ghost"
                    >
                      <X className="size-4" />
                      Clear Search
                    </Button>
                  </div>
                ) : projects.length === 0 && !searchQuery.trim() ? (
                  <EmptyState
                    action={
                      <AddMenu
                        onAddVideoClick={() => setShowVideoExtractor(true)}
                        onNewFolderClick={onNewFolderClick}
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
            <ContextMenuItem
              onClick={() => {
                sounds.click();
                onNewProjectClick();
              }}
            >
              <LayoutTemplate className="mr-2 size-4" />
              New Project
            </ContextMenuItem>
            <ContextMenuItem
              onClick={() => {
                sounds.click();
                onNewFolderClick();
              }}
            >
              <FolderPlus className="mr-2 size-4" />
              New Folder
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem
              onClick={() => {
                sounds.click();
                handleAddImage();
              }}
            >
              <ImagePlus className="mr-2 size-4" />
              Add Image
            </ContextMenuItem>
            <ContextMenuItem
              onClick={() => {
                sounds.click();
                setShowVideoExtractor(true);
              }}
            >
              <MonitorPlay className="mr-2 size-4" />
              Upload Video
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem
              onClick={() => {
                sounds.select();
                toggleSelectionMode();
                selectAll(projects.map((t) => t.id));
              }}
            >
              <CheckSquare className="mr-2 size-4" />
              Select All
            </ContextMenuItem>
            <ContextMenuItem
              onClick={() => {
                sounds.click();
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
                  sounds.click();
                  await setThumbnailFolder(moveFolderThumbnail.id, null);
                  sileo.success({ title: "Moved out of folder" });
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
                    sounds.click();
                    await setThumbnailFolder(moveFolderThumbnail.id, folder.id);
                    sileo.success({ title: `Moved to "${folder.name}"` });
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
                sounds.click();
                const ids = Array.from(
                  useSelectionStore.getState().selectedIds
                );
                await Promise.all(
                  ids.map((id) => setThumbnailFolder(id, null))
                );
                sileo.success({
                  title: `Moved ${ids.length} item${ids.length > 1 ? "s" : ""} out of folder`,
                });
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
                  sounds.click();
                  const ids = Array.from(
                    useSelectionStore.getState().selectedIds
                  );
                  await Promise.all(
                    ids.map((id) => setThumbnailFolder(id, folder.id))
                  );
                  sileo.success({
                    title: `Moved ${ids.length} item${ids.length > 1 ? "s" : ""} to "${folder.name}"`,
                  });
                  setBulkMoveFolderOpen(false);
                  useSelectionStore.getState().clearSelection();
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
                sileo.success({ title: "Thumbnail renamed" });
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
                  sounds.success();
                  updateThumbnailName(selectedThumbnail.id, newName.trim());
                  sileo.success({ title: "Thumbnail renamed" });
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
            <AlertDialogCancel onClick={() => sounds.click()}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                sounds.delete_();
                handleConfirmDeleteFolder();
              }}
              variant="destructive"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        onOpenChange={(open) => {
          if (!open) setColorFolderTarget(null);
        }}
        open={colorFolderTarget !== null}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Folder Color</DialogTitle>
          </DialogHeader>
          <FolderColorPicker
            onChange={(color) => {
              if (colorFolderTarget)
                updateFolderColor(colorFolderTarget, color);
              setColorFolderTarget(null);
            }}
            value={
              folders.find((f) => f.id === colorFolderTarget)?.color ?? null
            }
          />
          <DialogFooter>
            <DialogClose render={<Button variant="ghost" />}>
              Cancel
            </DialogClose>
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
            <AlertDialogCancel onClick={() => sounds.click()}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (selectedThumbnail) {
                  sounds.delete_();
                  await deleteThumbnail(selectedThumbnail.id);
                  sileo.info({ title: "Moved to trash" });
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
