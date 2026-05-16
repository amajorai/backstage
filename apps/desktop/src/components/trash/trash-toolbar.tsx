import { ArrowLeft, Loader2, RotateCcw, Search, Trash2, X } from "lucide-react";
import { useState } from "react";
import type { ViewMode } from "@/App";
import { SearchHistoryDropdown } from "@/components/SearchHistoryDropdown";
import { ViewModeButtons } from "@/components/toolbar/view-mode-buttons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAppSettingsStore } from "@/stores/use-app-settings-store";
import { useSearchHistoryStore } from "@/stores/use-search-history-store";

interface TrashToolbarProps {
  isSelectionMode: boolean;
  selectedCount: number;
  trashItemCount: number;
  filteredCount: number;
  isProcessing: boolean;
  searchQuery: string;
  viewMode: ViewMode;
  onBack: () => void;
  onSearchChange: (q: string) => void;
  onViewModeChange: (mode: ViewMode) => void;
  onExitSelectionMode: () => void;
  onRestoreSelected: () => void;
  onDeleteSelected: () => void;
  onRestoreAll: () => void;
  onEmptyTrash: () => void;
  onEnterSelectionMode: () => void;
}

export function TrashToolbar({
  isSelectionMode,
  selectedCount,
  trashItemCount,
  filteredCount,
  isProcessing,
  searchQuery,
  viewMode,
  onBack,
  onSearchChange,
  onViewModeChange,
  onExitSelectionMode,
  onRestoreSelected,
  onDeleteSelected,
  onRestoreAll,
  onEmptyTrash,
  onEnterSelectionMode,
}: TrashToolbarProps) {
  const [searchFocused, setSearchFocused] = useState(false);

  const saveSearchHistory = useAppSettingsStore((s) => s.saveSearchHistory);
  const trashHistory = useSearchHistoryStore((s) => s.histories.trash);
  const addSearch = useSearchHistoryStore((s) => s.addSearch);
  const removeSearch = useSearchHistoryStore((s) => s.removeSearch);
  const clearHistory = useSearchHistoryStore((s) => s.clearHistory);

  const handleBlur = () => {
    setTimeout(() => setSearchFocused(false), 150);
    if (saveSearchHistory && searchQuery.trim()) {
      addSearch("trash", searchQuery.trim());
    }
  };

  const handleHistorySelect = (q: string) => {
    onSearchChange(q);
    setSearchFocused(false);
  };

  const showHistory =
    searchFocused &&
    !searchQuery &&
    saveSearchHistory &&
    trashHistory.length > 0;

  return (
    <div className="relative flex h-12 items-center justify-between bg-muted px-4">
      {isSelectionMode ? (
        <div className="flex flex-1 items-center justify-center gap-4">
          <div className="flex items-center gap-2">
            <Button
              aria-label="Clear Selection"
              onClick={onExitSelectionMode}
              size="icon-sm"
              title="Clear selection"
              variant="ghost"
            >
              <X className="size-4" />
            </Button>
            <span className="font-medium text-sm">
              {selectedCount} selected
            </span>
          </div>
          <div className="h-4 w-px bg-border" />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                disabled={isProcessing || selectedCount === 0}
                onClick={onRestoreSelected}
                size="sm"
                variant="ghost"
              >
                {isProcessing ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : (
                  <RotateCcw className="mr-2 size-4" />
                )}
                Restore
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <span>Ctrl+E</span>
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                className="text-destructive hover:text-destructive"
                disabled={isProcessing || selectedCount === 0}
                onClick={onDeleteSelected}
                size="sm"
                variant="ghost"
              >
                <Trash2 className="mr-2 size-4" />
                Delete
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <span>Delete or Backspace</span>
            </TooltipContent>
          </Tooltip>
        </div>
      ) : (
        <>
          {/* Left: back + view mode */}
          <div className="flex items-center gap-1">
            <Button
              aria-label="Back to Gallery"
              onClick={onBack}
              size="icon-sm"
              variant="ghost"
            >
              <ArrowLeft className="size-4" />
            </Button>
            <div className="mx-1 h-4 w-px bg-border" />
            <ViewModeButtons
              onViewModeChange={onViewModeChange}
              viewMode={viewMode}
            />
          </div>

          {/* Centered search */}
          <div className="absolute left-1/2 -translate-x-1/2">
            <div className="relative">
              {showHistory && (
                <SearchHistoryDropdown
                  items={trashHistory}
                  onClearAll={() => clearHistory("trash")}
                  onRemove={(q) => removeSearch("trash", q)}
                  onSelect={handleHistorySelect}
                />
              )}
              <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground/50" />
              <Input
                className="h-8 w-72 border-none bg-background pr-8 pl-9 transition-all focus-visible:w-96 focus-visible:ring-1 focus-visible:ring-primary/20"
                onBlur={handleBlur}
                onChange={(e) => onSearchChange(e.target.value)}
                onFocus={() => setSearchFocused(true)}
                placeholder="Search trash"
                value={searchQuery}
              />
              {searchQuery ? (
                <button
                  className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
                  onClick={() => onSearchChange("")}
                  type="button"
                >
                  <X className="size-3.5" />
                </button>
              ) : (
                filteredCount > 0 && (
                  <span className="absolute top-1/2 right-2 -translate-y-1/2 rounded bg-primary/10 px-1.5 py-0.5 font-bold text-[10px] text-primary">
                    {filteredCount}
                  </span>
                )
              )}
            </div>
          </div>

          {/* Right actions */}
          <div className="ml-auto flex items-center gap-2">
            {trashItemCount > 0 && (
              <>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button onClick={onRestoreAll} size="sm" variant="ghost">
                      <RotateCcw className="mr-2 size-4" />
                      Restore All
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <span>Ctrl+Shift+E</span>
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      className="text-destructive hover:text-destructive"
                      onClick={onEmptyTrash}
                      size="sm"
                      variant="ghost"
                    >
                      <Trash2 className="mr-2 size-4" />
                      Empty Trash
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <span>Ctrl+Shift+D</span>
                  </TooltipContent>
                </Tooltip>
                <div className="h-4 w-px bg-border" />
              </>
            )}
            <Button
              aria-label="Enter Selection Mode"
              onClick={onEnterSelectionMode}
              size="sm"
              variant="ghost"
            >
              Select
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
