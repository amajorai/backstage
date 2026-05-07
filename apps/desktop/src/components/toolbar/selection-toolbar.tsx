import {
  Copy,
  Download,
  Loader2,
  PaintBucket,
  Sparkles,
  Trash2,
  Wand2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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
}: SelectionToolbarProps) {
  return (
    <div className="flex flex-1 items-center justify-center gap-4">
      <div className="flex items-center gap-2">
        <Button
          onClick={onClearSelection}
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
            onClick={onDuplicate}
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
          <Button onClick={onAutoRename} size="sm" variant="ghost">
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
            onClick={onDelete}
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
          <Button onClick={onRemoveBackground} size="sm" variant="ghost">
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
          <Button onClick={onAddColorBackground} size="sm" variant="ghost">
            <PaintBucket className="mr-2 size-4" />
            Add Color BG
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <span>Replace background with a solid color</span>
        </TooltipContent>
      </Tooltip>
      {onExport && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button onClick={onExport} size="sm" variant="ghost">
              <Download className="mr-2 size-4" />
              Export
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <span>Export selected thumbnails</span>
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}
