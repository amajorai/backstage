import { ArrowLeft, Loader2, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { VirtuosoGrid } from "react-virtuoso";
import { sileo } from "sileo";
import { EmptyState } from "@/components/gallery/EmptyState";
import { gridComponents } from "@/components/gallery/VirtuosoGridComponents";
import {
  DeleteItemDialog,
  DeleteSelectedDialog,
  EmptyTrashDialog,
  RestoreAllDialog,
} from "@/components/trash/TrashDialogs";
import { TrashItemCard } from "@/components/trash/TrashItemCard";
import { TrashToolbar } from "@/components/trash/trash-toolbar";
import { Button } from "@/components/ui/button";
import { useDragSelection } from "@/hooks/use-drag-selection";
import { useGalleryStore } from "@/stores/use-gallery-store";
import { type TrashItem, useTrashStore } from "@/stores/use-trash-store";

interface TrashPageProps {
  onClose: () => void;
}

export function TrashPage({ onClose }: TrashPageProps) {
  const trashItems = useTrashStore((s) => s.trashItems);
  const isLoaded = useTrashStore((s) => s.isLoaded);
  const restoreFromTrash = useTrashStore((s) => s.restoreFromTrash);
  const restoreFromTrashBatch = useTrashStore((s) => s.restoreFromTrashBatch);
  const deletePermanently = useTrashStore((s) => s.deletePermanently);
  const deletePermanentlyBatch = useTrashStore((s) => s.deletePermanentlyBatch);
  const emptyTrash = useTrashStore((s) => s.emptyTrash);
  const restoreThumbnail = useGalleryStore((s) => s.restoreThumbnail);

  const [emptyTrashDialogOpen, setEmptyTrashDialogOpen] = useState(false);
  const [restoreAllDialogOpen, setRestoreAllDialogOpen] = useState(false);
  const [deleteItemDialogOpen, setDeleteItemDialogOpen] = useState(false);
  const [deleteSelectedDialogOpen, setDeleteSelectedDialogOpen] =
    useState(false);
  const [selectedItem, setSelectedItem] = useState<TrashItem | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Selection state (local to trash page)
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Selection helpers
  const toggleSelection = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const exitSelectionMode = useCallback(() => {
    setIsSelectionMode(false);
    setSelectedIds(new Set());
  }, []);

  // Drag selection hook
  const { selectionBox, containerRef, scrollerRef, handleMouseDown } =
    useDragSelection({
      dataAttribute: "data-trash-id",
      isSelectionMode,
      onEnableSelectionMode: () => setIsSelectionMode(true),
      onSelectionChange: (ids) => setSelectedIds(new Set(ids)),
      onClearSelection: clearSelection,
    });

  // Handle item click
  const handleItemClick = useCallback(
    (item: TrashItem) => {
      if (isSelectionMode) {
        toggleSelection(item.id);
      }
    },
    [isSelectionMode, toggleSelection]
  );

  const handleRestore = useCallback(
    async (item: TrashItem) => {
      const restoredItem = await restoreFromTrash(item.id);
      if (restoredItem) {
        await restoreThumbnail({
          id: restoredItem.id,
          name: restoredItem.name,
          originalCreatedAt: restoredItem.originalCreatedAt,
          originalUpdatedAt: restoredItem.originalUpdatedAt,
          canvasWidth: restoredItem.canvasWidth,
          canvasHeight: restoredItem.canvasHeight,
        });
        sileo.success({ title: `Restored "${item.name}"` });
      }
    },
    [restoreFromTrash, restoreThumbnail]
  );

  const handleRestoreSelected = useCallback(async () => {
    setIsProcessing(true);
    try {
      const ids = [...selectedIds];
      const restoredItems = await restoreFromTrashBatch(ids);
      for (const item of restoredItems) {
        await restoreThumbnail({
          id: item.id,
          name: item.name,
          originalCreatedAt: item.originalCreatedAt,
          originalUpdatedAt: item.originalUpdatedAt,
          canvasWidth: item.canvasWidth,
          canvasHeight: item.canvasHeight,
        });
      }
      sileo.success({ title: `Restored ${restoredItems.length} items` });
      exitSelectionMode();
    } finally {
      setIsProcessing(false);
    }
  }, [selectedIds, restoreFromTrashBatch, restoreThumbnail, exitSelectionMode]);

  const handleDeleteSelected = useCallback(async () => {
    setIsProcessing(true);
    try {
      const ids = [...selectedIds];
      await deletePermanentlyBatch(ids);
      sileo.info({ title: `Permanently deleted ${ids.length} items` });
      setDeleteSelectedDialogOpen(false);
      exitSelectionMode();
    } finally {
      setIsProcessing(false);
    }
  }, [selectedIds, deletePermanentlyBatch, exitSelectionMode]);

  const handleRestoreAll = useCallback(async () => {
    setIsProcessing(true);
    try {
      const ids = trashItems.map((item) => item.id);
      const restoredItems = await restoreFromTrashBatch(ids);
      for (const item of restoredItems) {
        await restoreThumbnail({
          id: item.id,
          name: item.name,
          originalCreatedAt: item.originalCreatedAt,
          originalUpdatedAt: item.originalUpdatedAt,
          canvasWidth: item.canvasWidth,
          canvasHeight: item.canvasHeight,
        });
      }
      sileo.success({ title: `Restored ${restoredItems.length} items` });
      setRestoreAllDialogOpen(false);
    } finally {
      setIsProcessing(false);
    }
  }, [trashItems, restoreFromTrashBatch, restoreThumbnail]);

  const handleDeleteClick = useCallback((item: TrashItem) => {
    setSelectedItem(item);
    setDeleteItemDialogOpen(true);
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    if (selectedItem) {
      await deletePermanently(selectedItem.id);
      sileo.info({ title: `Permanently deleted "${selectedItem.name}"` });
      setDeleteItemDialogOpen(false);
      setSelectedItem(null);
    }
  }, [selectedItem, deletePermanently]);

  const handleEmptyTrash = useCallback(async () => {
    setIsProcessing(true);
    try {
      await emptyTrash();
      sileo.info({ title: "Trash emptied" });
      setEmptyTrashDialogOpen(false);
    } finally {
      setIsProcessing(false);
    }
  }, [emptyTrash]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Shortcuts that work in selection mode only
      if (isSelectionMode) {
        // Delete selected items
        if (
          (e.key === "Delete" || e.key === "Backspace") &&
          selectedIds.size > 0
        ) {
          e.preventDefault();
          setDeleteSelectedDialogOpen(true);
        }
        // Escape - exit selection mode
        if (e.key === "Escape") {
          e.preventDefault();
          exitSelectionMode();
        }
        // Ctrl+A - select all
        if ((e.ctrlKey || e.metaKey) && e.key === "a") {
          e.preventDefault();
          setSelectedIds(new Set(trashItems.map((item) => item.id)));
        }
        // Ctrl+E - restore selected
        if (
          (e.ctrlKey || e.metaKey) &&
          e.key === "e" &&
          !e.shiftKey &&
          selectedIds.size > 0
        ) {
          e.preventDefault();
          handleRestoreSelected();
        }
      }

      // Shortcuts that work without selection mode (for the whole trash)
      if (trashItems.length > 0) {
        // Ctrl+Shift+E - restore all
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "E") {
          e.preventDefault();
          setRestoreAllDialogOpen(true);
        }
        // Ctrl+Shift+D - empty trash
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "D") {
          e.preventDefault();
          setEmptyTrashDialogOpen(true);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    isSelectionMode,
    selectedIds,
    exitSelectionMode,
    trashItems,
    handleRestoreSelected,
  ]);

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Header */}
      <div className="flex h-12 shrink-0 items-center px-4">
        <Button onClick={onClose} size="icon-sm" type="button" variant="ghost">
          <ArrowLeft className="size-4" />
        </Button>
      </div>

      {/* Content */}
      <div className="relative flex-1 select-none">
        {isLoaded ? (
          trashItems.length === 0 ? (
            <EmptyState
              action={{
                label: "Back to Gallery",
                icon: <ArrowLeft className="mr-2 size-4" />,
                onClick: onClose,
              }}
              description="Deleted items will appear here for 30 days"
              icon={<Trash2 className="size-10" />}
              title="Trash is empty"
            />
          ) : (
            <div
              className="absolute inset-0 overflow-hidden"
              onMouseDown={handleMouseDown}
              ref={containerRef}
            >
              {/* Selection box */}
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
                  const item = trashItems[index];
                  return (
                    <TrashItemCard
                      isSelected={selectedIds.has(item.id)}
                      isSelectionMode={isSelectionMode}
                      item={item}
                      key={item.id}
                      onClick={handleItemClick}
                      onDelete={handleDeleteClick}
                      onRestore={handleRestore}
                    />
                  );
                }}
                listClassName="grid-cols-4"
                overscan={600}
                scrollerRef={(ref) => {
                  scrollerRef.current = ref as HTMLDivElement;
                }}
                style={{ height: "100%", width: "100%" }}
                totalCount={trashItems.length}
              />
            </div>
          )
        ) : (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="size-8 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>

      {/* Bottom Toolbar */}
      <TrashToolbar
        isProcessing={isProcessing}
        isSelectionMode={isSelectionMode}
        onDeleteSelected={() => setDeleteSelectedDialogOpen(true)}
        onEmptyTrash={() => setEmptyTrashDialogOpen(true)}
        onEnterSelectionMode={() => setIsSelectionMode(true)}
        onExitSelectionMode={exitSelectionMode}
        onRestoreAll={() => setRestoreAllDialogOpen(true)}
        onRestoreSelected={handleRestoreSelected}
        selectedCount={selectedIds.size}
        trashItemCount={trashItems.length}
      />

      {/* Dialogs */}
      <RestoreAllDialog
        isProcessing={isProcessing}
        itemCount={trashItems.length}
        onConfirm={handleRestoreAll}
        onOpenChange={setRestoreAllDialogOpen}
        open={restoreAllDialogOpen}
      />
      <EmptyTrashDialog
        isProcessing={isProcessing}
        itemCount={trashItems.length}
        onConfirm={handleEmptyTrash}
        onOpenChange={setEmptyTrashDialogOpen}
        open={emptyTrashDialogOpen}
      />
      <DeleteItemDialog
        item={selectedItem}
        onConfirm={handleDeleteConfirm}
        onOpenChange={setDeleteItemDialogOpen}
        open={deleteItemDialogOpen}
      />
      <DeleteSelectedDialog
        isProcessing={isProcessing}
        onConfirm={handleDeleteSelected}
        onOpenChange={setDeleteSelectedDialogOpen}
        open={deleteSelectedDialogOpen}
        selectedCount={selectedIds.size}
      />
    </div>
  );
}
