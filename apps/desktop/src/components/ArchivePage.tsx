import { Archive, Loader2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { VirtuosoGrid } from "react-virtuoso";
import { sileo } from "sileo";
import type { ViewMode } from "@/App";
import {
  RestoreAllArchiveDialog,
  RestoreSelectedArchiveDialog,
} from "@/components/archive/ArchiveDialogs";
import { ArchiveItemCard } from "@/components/archive/ArchiveItemCard";
import { ArchiveToolbar } from "@/components/archive/archive-toolbar";
import { FolderColorPicker } from "@/components/FolderColorPicker";
import { EmptyState } from "@/components/gallery/EmptyState";
import { gridComponents } from "@/components/gallery/VirtuosoGridComponents";
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
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useDragSelection } from "@/hooks/use-drag-selection";
import { usePersistedViewMode } from "@/hooks/use-persisted-view-mode";
import {
  type ArchiveFolder,
  type ArchiveItem,
  useArchiveStore,
} from "@/stores/use-archive-store";
import { useGalleryStore } from "@/stores/use-gallery-store";

interface ArchivePageProps {
  onClose: () => void;
}

export function ArchivePage({ onClose }: ArchivePageProps) {
  const archiveItems = useArchiveStore((s) => s.archiveItems);
  const archiveFolders = useArchiveStore((s) => s.archiveFolders);
  const isLoaded = useArchiveStore((s) => s.isLoaded);
  const unarchiveItem = useArchiveStore((s) => s.unarchiveItem);
  const unarchiveItemsBatch = useArchiveStore((s) => s.unarchiveItemsBatch);
  const unarchiveAll = useArchiveStore((s) => s.unarchiveAll);
  const moveItemsBatchToArchiveFolder = useArchiveStore(
    (s) => s.moveItemsBatchToArchiveFolder
  );
  const createArchiveFolder = useArchiveStore((s) => s.createArchiveFolder);
  const renameArchiveFolder = useArchiveStore((s) => s.renameArchiveFolder);
  const deleteArchiveFolder = useArchiveStore((s) => s.deleteArchiveFolder);
  const updateArchiveFolderColor = useArchiveStore(
    (s) => s.updateArchiveFolderColor
  );
  const restoreToGallery = useGalleryStore((s) => s.restoreFromArchive);

  const [restoreAllDialogOpen, setRestoreAllDialogOpen] = useState(false);
  const [restoreSelectedDialogOpen, setRestoreSelectedDialogOpen] =
    useState(false);
  const [moveFolderDialogOpen, setMoveFolderDialogOpen] = useState(false);
  const [newFolderDialogOpen, setNewFolderDialogOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [newFolderColor, setNewFolderColor] = useState<string | null>(null);
  const [renameFolderDialogOpen, setRenameFolderDialogOpen] = useState(false);
  const [renameFolderTarget, setRenameFolderTarget] =
    useState<ArchiveFolder | null>(null);
  const [renameFolderName, setRenameFolderName] = useState("");
  const [deleteFolderDialogOpen, setDeleteFolderDialogOpen] = useState(false);
  const [deleteFolderTarget, setDeleteFolderTarget] =
    useState<ArchiveFolder | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [viewMode, setViewMode] = usePersistedViewMode(
    "view-mode:archive",
    "4"
  );

  const filteredItems = useMemo(() => {
    let items = archiveItems;
    if (selectedFolderId !== null) {
      items = items.filter((a) => a.archiveFolderId === selectedFolderId);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      items = items.filter((a) => a.name.toLowerCase().includes(q));
    }
    return items;
  }, [archiveItems, searchQuery, selectedFolderId]);

  const gridColClass = useMemo(() => {
    const map: Record<ViewMode, string> = {
      "3": "grid-cols-3",
      "4": "grid-cols-4",
      "5": "grid-cols-5",
      row: "grid-cols-1",
    };
    return map[viewMode];
  }, [viewMode]);

  const toggleSelection = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  const exitSelectionMode = useCallback(() => {
    setIsSelectionMode(false);
    setSelectedIds(new Set());
  }, []);

  const { selectionBox, containerRef, scrollerRef, handleMouseDown } =
    useDragSelection({
      dataAttribute: "data-archive-id",
      isSelectionMode,
      onEnableSelectionMode: () => setIsSelectionMode(true),
      onSelectionChange: (ids) => setSelectedIds(new Set(ids)),
      onClearSelection: clearSelection,
    });

  const handleItemClick = useCallback(
    (item: ArchiveItem) => {
      if (isSelectionMode) toggleSelection(item.id);
    },
    [isSelectionMode, toggleSelection]
  );

  const handleRestore = useCallback(
    async (item: ArchiveItem) => {
      const restored = await unarchiveItem(item.id);
      if (restored) {
        await restoreToGallery(restored);
        sileo.success({ title: `Restored "${item.name}"` });
      }
    },
    [unarchiveItem, restoreToGallery]
  );

  const handleRestoreSelected = useCallback(async () => {
    setIsProcessing(true);
    try {
      const ids = [...selectedIds];
      const restoredItems = await unarchiveItemsBatch(ids);
      for (const item of restoredItems) {
        await restoreToGallery(item);
      }
      sileo.success({ title: `Restored ${restoredItems.length} items` });
      setRestoreSelectedDialogOpen(false);
      exitSelectionMode();
    } finally {
      setIsProcessing(false);
    }
  }, [selectedIds, unarchiveItemsBatch, restoreToGallery, exitSelectionMode]);

  const handleRestoreAll = useCallback(async () => {
    setIsProcessing(true);
    try {
      const restoredItems = await unarchiveAll();
      for (const item of restoredItems) {
        await restoreToGallery(item);
      }
      sileo.success({ title: `Restored ${restoredItems.length} items` });
      setRestoreAllDialogOpen(false);
    } finally {
      setIsProcessing(false);
    }
  }, [unarchiveAll, restoreToGallery]);

  const handleMoveSelectedToFolder = useCallback(
    async (folderId: string | null) => {
      const ids = [...selectedIds];
      await moveItemsBatchToArchiveFolder(ids, folderId);
      sileo.success({ title: `Moved ${ids.length} items` });
      setMoveFolderDialogOpen(false);
      exitSelectionMode();
    },
    [selectedIds, moveItemsBatchToArchiveFolder, exitSelectionMode]
  );

  const handleCreateFolder = useCallback(async () => {
    if (!newFolderName.trim()) return;
    await createArchiveFolder(newFolderName.trim(), newFolderColor);
    sileo.success({ title: `Folder "${newFolderName.trim()}" created` });
    setNewFolderName("");
    setNewFolderColor(null);
    setNewFolderDialogOpen(false);
  }, [newFolderName, newFolderColor, createArchiveFolder]);

  const handleRenameFolder = useCallback(async () => {
    if (!(renameFolderTarget && renameFolderName.trim())) return;
    await renameArchiveFolder(renameFolderTarget.id, renameFolderName.trim());
    sileo.success({ title: "Folder renamed" });
    setRenameFolderDialogOpen(false);
    setRenameFolderTarget(null);
  }, [renameFolderTarget, renameFolderName, renameArchiveFolder]);

  const handleDeleteFolder = useCallback(async () => {
    if (!deleteFolderTarget) return;
    await deleteArchiveFolder(deleteFolderTarget.id);
    if (selectedFolderId === deleteFolderTarget.id) setSelectedFolderId(null);
    sileo.success({ title: `Folder "${deleteFolderTarget.name}" deleted` });
    setDeleteFolderDialogOpen(false);
    setDeleteFolderTarget(null);
  }, [deleteFolderTarget, deleteArchiveFolder, selectedFolderId]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isSelectionMode) {
        if (e.key === "Escape") {
          e.preventDefault();
          exitSelectionMode();
        }
        if ((e.ctrlKey || e.metaKey) && e.key === "a") {
          e.preventDefault();
          setSelectedIds(new Set(archiveItems.map((a) => a.id)));
        }
        if (
          (e.ctrlKey || e.metaKey) &&
          e.key === "e" &&
          !e.shiftKey &&
          selectedIds.size > 0
        ) {
          e.preventDefault();
          setRestoreSelectedDialogOpen(true);
        }
      }
      if (
        archiveItems.length > 0 &&
        (e.ctrlKey || e.metaKey) &&
        e.shiftKey &&
        e.key === "E"
      ) {
        e.preventDefault();
        setRestoreAllDialogOpen(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isSelectionMode, selectedIds, exitSelectionMode, archiveItems]);

  return (
    <>
      <div className="mx-1 flex flex-1 flex-col overflow-hidden rounded-xl border-2 border-border bg-background">
        <div className="relative flex-1 select-none">
          {isLoaded ? (
            archiveItems.length === 0 ? (
              <EmptyState
                description="Archived projects will appear here. They stay hidden from your gallery until restored."
                icon={<Archive className="size-10" />}
                title="Archive is empty"
              />
            ) : filteredItems.length === 0 ? (
              <EmptyState
                action={{
                  icon: <X className="size-4" />,
                  label: "Clear Search",
                  onClick: () => setSearchQuery(""),
                }}
                description="No items match your search"
                icon={<Archive className="size-10" />}
                title="No results"
              />
            ) : (
              <div
                className="absolute inset-0 overflow-hidden"
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
                <VirtuosoGrid
                  components={gridComponents}
                  itemContent={(index) => {
                    const item = filteredItems[index];
                    return (
                      <ArchiveItemCard
                        isSelected={selectedIds.has(item.id)}
                        isSelectionMode={isSelectionMode}
                        item={item}
                        key={item.id}
                        onClick={handleItemClick}
                        onRestore={handleRestore}
                      />
                    );
                  }}
                  listClassName={gridColClass}
                  overscan={600}
                  scrollerRef={(ref) => {
                    scrollerRef.current = ref as HTMLDivElement;
                  }}
                  style={{ height: "100%", width: "100%" }}
                  totalCount={filteredItems.length}
                />
              </div>
            )
          ) : (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="size-8 animate-spin text-muted-foreground" />
            </div>
          )}
        </div>
      </div>

      <div className="mx-1 mb-1">
        <ArchiveToolbar
          archiveFolders={archiveFolders}
          archiveItemCount={archiveItems.length}
          filteredCount={filteredItems.length}
          isProcessing={isProcessing}
          isSelectionMode={isSelectionMode}
          onBack={onClose}
          onCreateFolder={() => setNewFolderDialogOpen(true)}
          onDeleteFolder={(folder) => {
            setDeleteFolderTarget(folder);
            setDeleteFolderDialogOpen(true);
          }}
          onEnterSelectionMode={() => setIsSelectionMode(true)}
          onExitSelectionMode={exitSelectionMode}
          onMoveSelectedToFolder={() => setMoveFolderDialogOpen(true)}
          onRenameFolder={(folder) => {
            setRenameFolderTarget(folder);
            setRenameFolderName(folder.name);
            setRenameFolderDialogOpen(true);
          }}
          onRestoreAll={() => setRestoreAllDialogOpen(true)}
          onRestoreSelected={() => setRestoreSelectedDialogOpen(true)}
          onSearchChange={setSearchQuery}
          onSelectFolder={setSelectedFolderId}
          onUpdateFolderColor={updateArchiveFolderColor}
          onViewModeChange={setViewMode}
          searchQuery={searchQuery}
          selectedCount={selectedIds.size}
          selectedFolderId={selectedFolderId}
          viewMode={viewMode}
        />
      </div>

      <RestoreAllArchiveDialog
        isProcessing={isProcessing}
        itemCount={archiveItems.length}
        onConfirm={handleRestoreAll}
        onOpenChange={setRestoreAllDialogOpen}
        open={restoreAllDialogOpen}
      />
      <RestoreSelectedArchiveDialog
        isProcessing={isProcessing}
        onConfirm={handleRestoreSelected}
        onOpenChange={setRestoreSelectedDialogOpen}
        open={restoreSelectedDialogOpen}
        selectedCount={selectedIds.size}
      />

      {/* Move to archive folder dialog */}
      <Dialog
        onOpenChange={setMoveFolderDialogOpen}
        open={moveFolderDialogOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Move to Archive Folder</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-1 py-2">
            <Button
              className="justify-start"
              onClick={() => handleMoveSelectedToFolder(null)}
              variant="ghost"
            >
              No folder (unfiled)
            </Button>
            {archiveFolders.map((folder) => (
              <Button
                className="justify-start"
                key={folder.id}
                onClick={() => handleMoveSelectedToFolder(folder.id)}
                style={folder.color ? { color: folder.color } : undefined}
                variant="ghost"
              >
                {folder.name}
              </Button>
            ))}
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="ghost" />}>
              Cancel
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New archive folder dialog */}
      <Dialog
        onOpenChange={(open) => {
          setNewFolderDialogOpen(open);
          if (!open) {
            setNewFolderName("");
            setNewFolderColor(null);
          }
        }}
        open={newFolderDialogOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Archive Folder</DialogTitle>
          </DialogHeader>
          <Input
            autoFocus
            onChange={(e) => setNewFolderName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreateFolder();
            }}
            placeholder="Folder name"
            value={newFolderName}
          />
          <FolderColorPicker
            onChange={setNewFolderColor}
            value={newFolderColor}
          />
          <DialogFooter>
            <DialogClose render={<Button variant="ghost" />}>
              Cancel
            </DialogClose>
            <Button
              disabled={!newFolderName.trim()}
              onClick={handleCreateFolder}
            >
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename archive folder dialog */}
      <Dialog
        onOpenChange={(open) => {
          setRenameFolderDialogOpen(open);
          if (!open) setRenameFolderTarget(null);
        }}
        open={renameFolderDialogOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Folder</DialogTitle>
          </DialogHeader>
          <Input
            autoFocus
            onChange={(e) => setRenameFolderName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleRenameFolder();
            }}
            value={renameFolderName}
          />
          <DialogFooter>
            <DialogClose render={<Button variant="ghost" />}>
              Cancel
            </DialogClose>
            <Button
              disabled={!renameFolderName.trim()}
              onClick={handleRenameFolder}
            >
              Rename
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete archive folder confirmation */}
      <AlertDialog
        onOpenChange={setDeleteFolderDialogOpen}
        open={deleteFolderDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Archive Folder</AlertDialogTitle>
            <AlertDialogDescription>
              Delete folder "{deleteFolderTarget?.name}"? Items inside will
              become unfiled but remain in archive.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDeleteFolder}
            >
              Delete Folder
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
