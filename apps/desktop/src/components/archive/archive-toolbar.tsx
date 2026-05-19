import { Button } from "@repo/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ui/dropdown-menu";
import { Input } from "@repo/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@repo/ui/tooltip";
import {
  ArrowLeft,
  FolderOpen,
  FolderPlus,
  Loader2,
  MoreHorizontal,
  Pencil,
  RotateCcw,
  Search,
  Trash2,
  X,
} from "lucide-react";
import type { ViewMode } from "@/App";
import { ViewModeButtons } from "@/components/toolbar/view-mode-buttons";
import type { ArchiveFolder } from "@/stores/use-archive-store";

interface ArchiveToolbarProps {
  isSelectionMode: boolean;
  selectedCount: number;
  archiveItemCount: number;
  filteredCount: number;
  isProcessing: boolean;
  searchQuery: string;
  viewMode: ViewMode;
  archiveFolders: ArchiveFolder[];
  selectedFolderId: string | null;
  onBack: () => void;
  onSearchChange: (q: string) => void;
  onViewModeChange: (mode: ViewMode) => void;
  onExitSelectionMode: () => void;
  onRestoreSelected: () => void;
  onRestoreAll: () => void;
  onEnterSelectionMode: () => void;
  onSelectFolder: (id: string | null) => void;
  onMoveSelectedToFolder: () => void;
  onCreateFolder: () => void;
  onRenameFolder: (folder: ArchiveFolder) => void;
  onDeleteFolder: (folder: ArchiveFolder) => void;
  onUpdateFolderColor: (id: string, color: string | null) => void;
}

export function ArchiveToolbar({
  isSelectionMode,
  selectedCount,
  archiveItemCount,
  filteredCount,
  isProcessing,
  searchQuery,
  viewMode,
  archiveFolders,
  selectedFolderId,
  onBack,
  onSearchChange,
  onViewModeChange,
  onExitSelectionMode,
  onRestoreSelected,
  onRestoreAll,
  onEnterSelectionMode,
  onSelectFolder,
  onMoveSelectedToFolder,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
}: ArchiveToolbarProps) {
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
                disabled={isProcessing || selectedCount === 0}
                onClick={onMoveSelectedToFolder}
                size="sm"
                variant="ghost"
              >
                <FolderOpen className="mr-2 size-4" />
                Move to Folder
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <span>Move selected to archive folder</span>
            </TooltipContent>
          </Tooltip>
        </div>
      ) : (
        <>
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
            <div className="mx-1 h-4 w-px bg-border" />
            <div className="flex items-center gap-1">
              <Button
                className={
                  selectedFolderId === null
                    ? "bg-secondary text-secondary-foreground"
                    : "text-muted-foreground"
                }
                onClick={() => onSelectFolder(null)}
                size="sm"
                variant="ghost"
              >
                All
              </Button>
              {archiveFolders.map((folder) => (
                <div
                  className="group relative flex items-center"
                  key={folder.id}
                >
                  <Button
                    className={
                      selectedFolderId === folder.id
                        ? "bg-secondary text-secondary-foreground"
                        : "text-muted-foreground"
                    }
                    onClick={() => onSelectFolder(folder.id)}
                    size="sm"
                    style={folder.color ? { color: folder.color } : undefined}
                    variant="ghost"
                  >
                    {folder.name}
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      className="flex h-5 w-5 items-center justify-center rounded opacity-0 hover:bg-accent group-hover:opacity-100"
                      title="Folder options"
                    >
                      <MoreHorizontal className="size-3" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-40">
                      <DropdownMenuItem onClick={() => onRenameFolder(folder)}>
                        <Pencil className="mr-2 size-4" />
                        Rename
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => onDeleteFolder(folder)}
                      >
                        <Trash2 className="mr-2 size-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    aria-label="New archive folder"
                    onClick={onCreateFolder}
                    size="icon-sm"
                    title="New folder"
                    variant="ghost"
                  >
                    <FolderPlus className="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>New archive folder</TooltipContent>
              </Tooltip>
            </div>
          </div>

          <div className="absolute left-1/2 -translate-x-1/2">
            <div className="relative">
              <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground/50" />
              <Input
                className="h-8 w-72 border-none bg-background pr-8 pl-9 transition-all focus-visible:w-96 focus-visible:ring-1 focus-visible:ring-primary/20"
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Search archive"
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

          <div className="ml-auto flex items-center gap-2">
            {archiveItemCount > 0 && (
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
                <div className="h-4 w-px bg-border" />
              </>
            )}
            <Button onClick={onEnterSelectionMode} size="sm" variant="ghost">
              Select
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
