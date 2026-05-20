import { Button } from "@repo/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@repo/ui/tooltip";
import {
  Archive,
  Copy,
  Download,
  FolderOpen,
  Loader2,
  PaintBucket,
  Sparkles,
  Trash2,
  Wand2,
  X,
} from "lucide-react";
import * as sounds from "@/lib/sounds";

interface SelectionToolbarProps {
  selectedCount: number;
  isDuplicating: boolean;
  onClearSelection: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onRemoveBackground: () => void;
  onAddColorBackground: () => void;
  onAutoRename: () => void;
  onExport?: () => void;
  onMoveToFolder?: () => void;
  onArchive?: () => void;
}

export function SelectionToolbar({
  selectedCount,
  isDuplicating,
  onClearSelection,
  onDuplicate,
  onDelete,
  onRemoveBackground,
  onAddColorBackground,
  onAutoRename,
  onExport,
  onMoveToFolder,
  onArchive,
}: SelectionToolbarProps) {
  return (
    <div className="flex flex-1 items-center justify-center gap-4">
      <div className="flex items-center gap-2">
        <Button
          onClick={() => {
            sounds.click();
            onClearSelection();
          }}
          size="icon-sm"
          title="Clear selection"
          variant="ghost"
        >
          <X className="size-4" />
        </Button>
        <span className="font-medium text-sm">{selectedCount} selected</span>
      </div>
      <div className="h-4 w-px bg-border" />
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            disabled={isDuplicating}
            onClick={() => {
              sounds.click();
              onDuplicate();
            }}
            size="sm"
            variant="ghost"
          >
            {isDuplicating ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <Copy className="mr-2 size-4" />
            )}
            {isDuplicating ? "Duplicating..." : "Duplicate"}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <span>Ctrl+D or Ctrl+J</span>
        </TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            onClick={() => {
              sounds.click();
              onAutoRename();
            }}
            size="sm"
            variant="ghost"
          >
            <Sparkles className="mr-2 size-4" />
            Auto Rename
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <span>AI rename selected thumbnails</span>
        </TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            className="text-destructive hover:text-destructive"
            onClick={() => {
              sounds.delete_();
              onDelete();
            }}
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
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            onClick={() => {
              sounds.click();
              onRemoveBackground();
            }}
            size="sm"
            variant="ghost"
          >
            <Wand2 className="mr-2 size-4" />
            Remove BG
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <span>Ctrl+B</span>
        </TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            onClick={() => {
              sounds.click();
              onAddColorBackground();
            }}
            size="sm"
            variant="ghost"
          >
            <PaintBucket className="mr-2 size-4" />
            Add Color BG
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <span>Replace background with a solid color</span>
        </TooltipContent>
      </Tooltip>
      {onMoveToFolder && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              onClick={() => {
                sounds.click();
                onMoveToFolder!();
              }}
              size="sm"
              variant="ghost"
            >
              <FolderOpen className="mr-2 size-4" />
              Move to Folder
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <span>Move selected items to a folder</span>
          </TooltipContent>
        </Tooltip>
      )}
      {onExport && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              onClick={() => {
                sounds.download();
                onExport!();
              }}
              size="sm"
              variant="ghost"
            >
              <Download className="mr-2 size-4" />
              Export
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <span>Export selected thumbnails</span>
          </TooltipContent>
        </Tooltip>
      )}
      {onArchive && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              onClick={() => {
                sounds.click();
                onArchive!();
              }}
              size="sm"
              variant="ghost"
            >
              <Archive className="mr-2 size-4" />
              Archive
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <span>Archive selected items</span>
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}
