import { Button } from "@repo/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@repo/ui/tooltip";
import { ArrowLeft, Loader2, RotateCcw, Search, Trash2, X } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import type { ViewMode } from "@/App";
import { SearchHistoryDropdown } from "@/components/SearchHistoryDropdown";
import { ViewModeButtons } from "@/components/toolbar/view-mode-buttons";
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
  const inputRef = useRef<HTMLInputElement>(null);
  const blurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const saveSearchHistory = useAppSettingsStore((s) => s.saveSearchHistory);
  const trashHistory = useSearchHistoryStore((s) => s.histories.trash);
  const addSearch = useSearchHistoryStore((s) => s.addSearch);
  const removeSearch = useSearchHistoryStore((s) => s.removeSearch);
  const clearHistory = useSearchHistoryStore((s) => s.clearHistory);

  // Autocomplete: first history item starting with current query
  const suggestion = useMemo(() => {
    if (!(searchQuery && saveSearchHistory)) return "";
    const lower = searchQuery.toLowerCase();
    return trashHistory.find((h) => h.toLowerCase().startsWith(lower)) ?? "";
  }, [searchQuery, trashHistory, saveSearchHistory]);

  const ghostText = suggestion ? suggestion.slice(searchQuery.length) : "";

  // Filtered history: substring match
  const filteredHistory = useMemo(() => {
    if (!saveSearchHistory) return [];
    if (!searchQuery) return trashHistory;
    const lower = searchQuery.toLowerCase();
    return trashHistory.filter((h) => h.toLowerCase().includes(lower));
  }, [searchQuery, trashHistory, saveSearchHistory]);

  const showHistory = searchFocused && filteredHistory.length > 0;

  const handleInputBlur = () => {
    blurTimerRef.current = setTimeout(() => setSearchFocused(false), 150);
    if (saveSearchHistory && searchQuery.trim()) {
      addSearch("trash", searchQuery.trim());
    }
  };

  const handleHistorySelect = (q: string) => {
    if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
    onSearchChange(q);
    setSearchFocused(false);
  };

  const handleClear = () => {
    if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
    onSearchChange("");
    setSearchFocused(true);
    inputRef.current?.focus();
  };

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
            {/* Search container — bg here so input can be transparent */}
            <div className="relative h-8 w-72 rounded-md bg-background transition-all focus-within:w-96 focus-within:ring-1 focus-within:ring-primary/20">
              {showHistory && (
                <SearchHistoryDropdown
                  items={filteredHistory}
                  onClearAll={() => clearHistory("trash")}
                  onRemove={(q) => removeSearch("trash", q)}
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

              <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground/50" />

              <input
                className="absolute inset-0 h-full w-full rounded-md border-none bg-transparent pr-8 pl-9 text-foreground text-sm outline-none placeholder:text-muted-foreground/60"
                onBlur={handleInputBlur}
                onChange={(e) => onSearchChange(e.target.value)}
                onFocus={() => {
                  if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
                  setSearchFocused(true);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Tab" && ghostText) {
                    e.preventDefault();
                    onSearchChange(suggestion);
                  }
                }}
                placeholder="Search trash"
                ref={inputRef}
                value={searchQuery}
              />

              {searchQuery ? (
                <button
                  className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
                  onClick={handleClear}
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
