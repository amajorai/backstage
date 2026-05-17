import {
  Archive,
  Loader2,
  Search,
  Settings,
  Tag,
  Trash2,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { sileo } from "sileo";
import type { ViewMode } from "@/App";
import { AddColorBackgroundDialog } from "@/components/editor/AddColorBackgroundDialog";
import { SearchHistoryDropdown } from "@/components/SearchHistoryDropdown";
import { AddMenu } from "@/components/toolbar/add-menu";
import { SelectionToolbar } from "@/components/toolbar/selection-toolbar";
import { SortMenu } from "@/components/toolbar/sort-menu";
import { ViewModeButtons } from "@/components/toolbar/view-mode-buttons";
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
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAppSettingsStore } from "@/stores/use-app-settings-store";
import { useAutoRenameQueue } from "@/stores/use-auto-rename-queue";
import { useBackgroundRemovalQueue } from "@/stores/use-background-removal-queue";
import { useEmbeddingStore } from "@/stores/use-embedding-store";
import { useGalleryStore } from "@/stores/use-gallery-store";
import { useGalleryUIStore } from "@/stores/use-gallery-ui-store";
import { useSearchHistoryStore } from "@/stores/use-search-history-store";
import { useSelectionStore } from "@/stores/use-selection-store";
import { useTrashStore } from "@/stores/use-trash-store";

interface BottomToolbarProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  onAddVideoClick: () => void;
  onSettingsClick: () => void;
  onTrashClick: () => void;
  onNewProjectClick: () => void;
  onNewFolderClick: () => void;
  onExportSelected?: () => void;
  onArchiveClick?: () => void;
}

export function BottomToolbar({
  viewMode,
  onViewModeChange,
  onAddVideoClick,
  onSettingsClick,
  onTrashClick,
  onNewProjectClick,
  onNewFolderClick,
  onExportSelected,
  onArchiveClick,
}: BottomToolbarProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState(false);
  const [colorBgDialogOpen, setColorBgDialogOpen] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const blurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const thumbnails = useGalleryStore((s) => s.thumbnails);
  const duplicateThumbnailsBatch = useGalleryStore(
    (s) => s.duplicateThumbnailsBatch
  );
  const deleteThumbnailsBatch = useGalleryStore((s) => s.deleteThumbnailsBatch);

  const isSelectionMode = useSelectionStore((s) => s.isSelectionMode);
  const selectedIds = useSelectionStore((s) => s.selectedIds);
  const toggleSelectionMode = useSelectionStore((s) => s.toggleSelectionMode);
  const clearSelection = useSelectionStore((s) => s.clearSelection);
  const selectAll = useSelectionStore((s) => s.selectAll);
  const exitSelectionMode = useSelectionStore((s) => s.exitSelectionMode);

  const addToBgQueue = useBackgroundRemovalQueue((s) => s.addToQueue);
  const addColorBgToQueue = useBackgroundRemovalQueue(
    (s) => s.addColorBgToQueue
  );
  const addToRenameQueue = useAutoRenameQueue((s) => s.addToQueue);

  const archiveThumbnailsBatch = useGalleryStore(
    (s) => s.archiveThumbnailsBatch
  );

  const trashItems = useTrashStore((s) => s.trashItems);
  const trashCount = trashItems.length;

  const handleBulkDuplicate = useCallback(async () => {
    if (isDuplicating) return;
    setIsDuplicating(true);
    try {
      const ids = Array.from(selectedIds);
      await duplicateThumbnailsBatch(ids);
      sileo.success({ title: `Duplicated ${ids.length} items` });
      clearSelection();
    } finally {
      setIsDuplicating(false);
    }
  }, [selectedIds, duplicateThumbnailsBatch, clearSelection, isDuplicating]);

  const handleBulkDelete = async () => {
    setIsDeleting(true);
    try {
      const ids = Array.from(selectedIds);
      await deleteThumbnailsBatch(ids);
      sileo.success({ title: `Moved ${ids.length} items to trash` });
      setDeleteDialogOpen(false);
      clearSelection();
    } finally {
      setIsDeleting(false);
    }
  };

  const handleBulkRemoveBackground = useCallback(() => {
    const itemsToProcess = thumbnails
      .filter((t) => selectedIds.has(t.id))
      .map((t) => ({ thumbnailId: t.id, name: t.name }));
    addToBgQueue(itemsToProcess);
    sileo.success({
      title: `Added ${itemsToProcess.length} items to processing queue`,
    });
    clearSelection();
  }, [thumbnails, selectedIds, addToBgQueue, clearSelection]);

  const handleBulkAddColorBackground = useCallback(
    (color: string) => {
      const itemsToProcess = thumbnails
        .filter((t) => selectedIds.has(t.id))
        .map((t) => ({ thumbnailId: t.id, name: t.name, color }));
      addColorBgToQueue(itemsToProcess);
      sileo.success({
        title: `Added ${itemsToProcess.length} items to color background queue`,
      });
      clearSelection();
    },
    [thumbnails, selectedIds, addColorBgToQueue, clearSelection]
  );

  const handleBulkArchive = useCallback(async () => {
    const ids = Array.from(selectedIds);
    await archiveThumbnailsBatch(ids);
    sileo.success({ title: `Archived ${ids.length} items` });
    clearSelection();
  }, [selectedIds, archiveThumbnailsBatch, clearSelection]);

  const handleBulkAutoRename = useCallback(() => {
    const itemsToRename = thumbnails
      .filter((t) => selectedIds.has(t.id))
      .map((t) => ({ thumbnailId: t.id, name: t.name }));
    addToRenameQueue(itemsToRename);
    sileo.success({
      title: `Added ${itemsToRename.length} items to rename queue`,
    });
    clearSelection();
  }, [thumbnails, selectedIds, addToRenameQueue, clearSelection]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        setDeleteDialogOpen(true);
      }

      if ((e.ctrlKey || e.metaKey) && (e.key === "d" || e.key === "j")) {
        e.preventDefault();
        handleBulkDuplicate();
      }

      if ((e.ctrlKey || e.metaKey) && e.key === "b") {
        e.preventDefault();
        handleBulkRemoveBackground();
      }

      if ((e.ctrlKey || e.metaKey) && e.key === "a") {
        e.preventDefault();
        if (!isSelectionMode) {
          useSelectionStore.getState().toggleSelectionMode();
        }
        selectAll(thumbnails.map((t) => t.id));
      }

      if (e.key === "Escape") {
        if (selectedIds.size > 0) {
          e.preventDefault();
          clearSelection();
        } else if (isSelectionMode) {
          e.preventDefault();
          exitSelectionMode();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    selectedIds,
    isSelectionMode,
    thumbnails,
    handleBulkDuplicate,
    handleBulkRemoveBackground,
    selectAll,
    clearSelection,
    exitSelectionMode,
  ]);

  const searchQuery = useGalleryUIStore((s) => s.searchQuery);
  const setSearchQuery = useGalleryUIStore((s) => s.setSearchQuery);
  const filteredCount = useGalleryUIStore((s) => s.filteredCount);
  const searchMode = useGalleryUIStore((s) => s.searchMode);
  const setSearchMode = useGalleryUIStore((s) => s.setSearchMode);
  const setSemanticResultIds = useGalleryUIStore((s) => s.setSemanticResultIds);
  const setIsSemanticSearching = useGalleryUIStore(
    (s) => s.setIsSemanticSearching
  );
  const isSemanticSearching = useGalleryUIStore((s) => s.isSemanticSearching);

  const showFolderBadges = useAppSettingsStore((s) => s.showFolderBadges);
  const setShowFolderBadges = useAppSettingsStore((s) => s.setShowFolderBadges);

  const semanticSearchEnabled = useAppSettingsStore(
    (s) => s.semanticSearchEnabled
  );
  const saveSearchHistory = useAppSettingsStore((s) => s.saveSearchHistory);
  const performSemanticSearch = useEmbeddingStore(
    (s) => s.performSemanticSearch
  );

  const galleryHistory = useSearchHistoryStore((s) => s.histories.gallery);
  const addSearch = useSearchHistoryStore((s) => s.addSearch);
  const removeSearch = useSearchHistoryStore((s) => s.removeSearch);
  const clearHistory = useSearchHistoryStore((s) => s.clearHistory);

  // Autocomplete: first history item starting with current query
  const suggestion = useMemo(() => {
    if (!(searchQuery && saveSearchHistory)) return "";
    const lower = searchQuery.toLowerCase();
    return galleryHistory.find((h) => h.toLowerCase().startsWith(lower)) ?? "";
  }, [searchQuery, galleryHistory, saveSearchHistory]);

  const ghostText = suggestion ? suggestion.slice(searchQuery.length) : "";

  // Filtered history: substring match
  const filteredHistory = useMemo(() => {
    if (!saveSearchHistory) return [];
    if (!searchQuery) return galleryHistory;
    const lower = searchQuery.toLowerCase();
    return galleryHistory.filter((h) => h.toLowerCase().includes(lower));
  }, [searchQuery, galleryHistory, saveSearchHistory]);

  const handleInputBlur = useCallback(() => {
    blurTimerRef.current = setTimeout(() => setSearchFocused(false), 150);
    if (saveSearchHistory && searchQuery.trim()) {
      addSearch("gallery", searchQuery.trim());
    }
  }, [saveSearchHistory, searchQuery, addSearch]);

  const handleHistorySelect = useCallback(
    (q: string) => {
      if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
      setSearchQuery(q);
      setSearchFocused(false);
    },
    [setSearchQuery]
  );

  // Debounced semantic search trigger
  const semanticDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  useEffect(() => {
    if (!semanticSearchEnabled || searchMode !== "semantic") return;

    if (semanticDebounceRef.current) clearTimeout(semanticDebounceRef.current);

    if (!searchQuery.trim()) {
      setSemanticResultIds(null);
      setIsSemanticSearching(false);
      return;
    }

    setIsSemanticSearching(true);
    semanticDebounceRef.current = setTimeout(async () => {
      const ids = await performSemanticSearch(searchQuery);
      setSemanticResultIds(ids);
      setIsSemanticSearching(false);
    }, 500);

    return () => {
      if (semanticDebounceRef.current)
        clearTimeout(semanticDebounceRef.current);
    };
  }, [
    searchQuery,
    searchMode,
    semanticSearchEnabled,
    performSemanticSearch,
    setSemanticResultIds,
    setIsSemanticSearching,
  ]);

  // Reset semantic results when mode switches or feature disabled
  useEffect(() => {
    if (searchMode !== "semantic" || !semanticSearchEnabled) {
      setSemanticResultIds(null);
      setIsSemanticSearching(false);
    }
  }, [
    searchMode,
    semanticSearchEnabled,
    setSemanticResultIds,
    setIsSemanticSearching,
  ]);

  const showDefaultToolbar = !isSelectionMode || selectedIds.size === 0;
  const showHistory = searchFocused && filteredHistory.length > 0;

  return (
    <header className="flex h-12 items-center justify-between bg-muted px-4">
      {isSelectionMode && selectedIds.size > 0 ? (
        <SelectionToolbar
          isDuplicating={isDuplicating}
          onAddColorBackground={() => setColorBgDialogOpen(true)}
          onArchive={handleBulkArchive}
          onAutoRename={handleBulkAutoRename}
          onClearSelection={clearSelection}
          onDelete={() => setDeleteDialogOpen(true)}
          onDuplicate={handleBulkDuplicate}
          onExport={onExportSelected}
          onMoveToFolder={() =>
            useGalleryUIStore.getState().setBulkMoveFolderOpen(true)
          }
          onRemoveBackground={handleBulkRemoveBackground}
          selectedCount={selectedIds.size}
        />
      ) : (
        <div className="flex items-center gap-2">
          <ViewModeButtons
            onViewModeChange={onViewModeChange}
            viewMode={viewMode}
          />
          <SortMenu />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                className={showFolderBadges ? "bg-muted-foreground/15" : ""}
                onClick={() => setShowFolderBadges(!showFolderBadges)}
                size="icon-sm"
                type="button"
                variant="ghost"
              >
                <Tag className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {showFolderBadges ? "Hide folder badges" : "Show folder badges"}
            </TooltipContent>
          </Tooltip>
        </div>
      )}

      {/* Search — center */}
      {showDefaultToolbar && (
        <div className="absolute left-1/2 flex -translate-x-1/2 items-center gap-1.5">
          {/* Search container — bg here so input can be transparent */}
          <div className="relative h-8 w-72 rounded-md bg-background transition-all focus-within:w-96 focus-within:ring-1 focus-within:ring-primary/20">
            {showHistory && (
              <SearchHistoryDropdown
                items={filteredHistory}
                onClearAll={() => clearHistory("gallery")}
                onRemove={(q) => removeSearch("gallery", q)}
                onSelect={handleHistorySelect}
              />
            )}

            {/* Ghost text overlay */}
            {ghostText && (
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 flex items-center overflow-hidden pr-8 pl-9"
              >
                <span className="invisible shrink-0 whitespace-pre text-sm">
                  {searchQuery}
                </span>
                <span className="shrink-0 whitespace-pre text-muted-foreground/40 text-sm">
                  {ghostText}
                </span>
              </div>
            )}

            {isSemanticSearching ? (
              <Loader2 className="absolute top-1/2 left-3 size-4 -translate-y-1/2 animate-spin text-primary/60" />
            ) : (
              <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground/50" />
            )}

            <input
              className="absolute inset-0 h-full w-full rounded-md border-none bg-transparent pr-8 pl-9 text-foreground text-sm outline-none placeholder:text-muted-foreground/60"
              onBlur={handleInputBlur}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => {
                if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
                setSearchFocused(true);
              }}
              onKeyDown={(e) => {
                if (e.key === "Tab" && ghostText) {
                  e.preventDefault();
                  setSearchQuery(suggestion);
                }
              }}
              placeholder={
                semanticSearchEnabled && searchMode === "semantic"
                  ? "Describe what you're looking for"
                  : "Search projects"
              }
              ref={inputRef}
              type="text"
              value={searchQuery}
            />

            {filteredCount > 0 && searchMode === "text" && !searchQuery && (
              <Badge
                className="absolute top-1/2 right-2 h-5 -translate-y-1/2 border-none bg-primary/10 px-1.5 font-bold text-[10px] text-primary"
                variant="outline"
              >
                {filteredCount}
              </Badge>
            )}
          </div>

          {semanticSearchEnabled && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  className={
                    searchMode === "semantic"
                      ? "text-primary"
                      : "text-muted-foreground"
                  }
                  onClick={() =>
                    setSearchMode(
                      searchMode === "semantic" ? "text" : "semantic"
                    )
                  }
                  size="icon-sm"
                  type="button"
                  variant="ghost"
                >
                  <Zap className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {searchMode === "semantic"
                  ? "Switch to text search"
                  : "Switch to semantic search"}
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      )}

      {/* Right side buttons */}
      <div className="flex items-center gap-2">
        <Button
          onClick={toggleSelectionMode}
          size="sm"
          variant={isSelectionMode ? "secondary" : "ghost"}
        >
          {isSelectionMode ? "Cancel" : "Select"}
        </Button>

        {showDefaultToolbar && onArchiveClick && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                aria-label="Archive"
                onClick={onArchiveClick}
                size="icon-sm"
                variant="ghost"
              >
                <Archive className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Archive</TooltipContent>
          </Tooltip>
        )}

        {showDefaultToolbar && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                aria-label="Trash"
                className="relative"
                onClick={onTrashClick}
                size="icon-sm"
                variant="ghost"
              >
                <Trash2 className="size-4" />
                {trashCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 font-medium text-[10px] text-primary-foreground">
                    {trashCount > 99 ? "99+" : trashCount}
                  </span>
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>Trash</TooltipContent>
          </Tooltip>
        )}

        {showDefaultToolbar && (
          <>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  aria-label="Settings"
                  onClick={onSettingsClick}
                  size="icon-sm"
                  variant="ghost"
                >
                  <Settings className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Settings</TooltipContent>
            </Tooltip>
            <AddMenu
              onAddVideoClick={onAddVideoClick}
              onNewFolderClick={onNewFolderClick}
              onNewProjectClick={onNewProjectClick}
            />
          </>
        )}
      </div>

      <AddColorBackgroundDialog
        isProcessing={false}
        onConfirm={(color) => {
          setColorBgDialogOpen(false);
          handleBulkAddColorBackground(color);
        }}
        onOpenChange={setColorBgDialogOpen}
        open={colorBgDialogOpen}
      />

      <AlertDialog onOpenChange={setDeleteDialogOpen} open={deleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Move {selectedIds.size} items to trash
            </AlertDialogTitle>
            <AlertDialogDescription>
              These items will be moved to trash. You can restore them within 30
              days.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isDeleting}
              onClick={handleBulkDelete}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Moving...
                </>
              ) : (
                "Move to Trash"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </header>
  );
}
