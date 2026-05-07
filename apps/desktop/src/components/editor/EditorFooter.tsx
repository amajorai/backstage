import {
  ChevronDown,
  Copy,
  LayoutTemplate,
  Loader2,
  Minus,
  Plus,
  Save,
} from "lucide-react";
import { useState } from "react";
import { CanvasSizeDialog } from "@/components/editor/CanvasSizeDialog";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface EditorFooterProps {
  canvasSize: { width: number; height: number };
  onCanvasSizeChange: (size: { width: number; height: number }) => void;
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomFit: () => void;
  onExport: () => void;
  onSave: () => void;
  onSaveAsNew: () => void;
  onSaveAsTemplate: () => void;
  isSaving: boolean;
  hasUnsavedChanges: boolean;
}

export function EditorFooter({
  canvasSize,
  onCanvasSizeChange,
  zoom,
  onZoomIn,
  onZoomOut,
  onZoomFit,
  onExport,
  onSave,
  onSaveAsNew,
  onSaveAsTemplate,
  isSaving,
  hasUnsavedChanges,
}: EditorFooterProps) {
  const [showCanvasSizeDialog, setShowCanvasSizeDialog] = useState(false);
  const [showSaveMenu, setShowSaveMenu] = useState(false);

  return (
    <div className="flex shrink-0 items-center justify-between border-border border-t bg-background px-3 py-2">
      <Tooltip>
        <TooltipTrigger
          className="cursor-pointer text-muted-foreground text-xs hover:text-foreground"
          onClick={() => setShowCanvasSizeDialog(true)}
          type="button"
        >
          {`${canvasSize.width} × ${canvasSize.height}`}
        </TooltipTrigger>
        <TooltipContent>Change Canvas Size</TooltipContent>
      </Tooltip>

      <CanvasSizeDialog
        currentSize={canvasSize}
        onApply={onCanvasSizeChange}
        onOpenChange={setShowCanvasSizeDialog}
        open={showCanvasSizeDialog}
      />

      {/* Zoom controls */}
      <div className="flex items-center gap-0.5 rounded-md px-0.5">
        <Button
          aria-label="Zoom Out"
          onClick={onZoomOut}
          size="icon-sm"
          variant="ghost"
        >
          <Minus className="size-3" />
        </Button>
        <Button
          className="min-w-12 text-xs"
          onClick={onZoomFit}
          size="sm"
          variant="ghost"
        >
          {Math.round(zoom * 100)}%
        </Button>
        <Button
          aria-label="Zoom In"
          onClick={onZoomIn}
          size="icon-sm"
          variant="ghost"
        >
          <Plus className="size-3" />
        </Button>
      </div>

      {/* Save/Export */}
      <div className="flex gap-2">
        <Button onClick={onExport} size="sm" variant="ghost">
          Export
        </Button>
        <div className="relative">
          <Button
            className="gap-2"
            disabled={isSaving}
            onClick={() => setShowSaveMenu(!showSaveMenu)}
            size="sm"
          >
            {isSaving ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                Save
                <ChevronDown className="size-3" />
              </>
            )}
          </Button>
          {hasUnsavedChanges && !isSaving && (
            <span className="pointer-events-none absolute -top-1 -left-1 flex size-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-orange-400 opacity-75" />
              <span className="relative inline-flex size-3 rounded-full bg-orange-500" />
            </span>
          )}
          {showSaveMenu && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowSaveMenu(false)}
                onKeyDown={() => {}}
              />
              <div className="absolute right-0 bottom-full z-50 mb-2 w-40 rounded-lg border border-border bg-card p-1 shadow-lg">
                <Button
                  className="w-full justify-start"
                  onClick={() => {
                    setShowSaveMenu(false);
                    onSave();
                  }}
                  size="sm"
                  variant="ghost"
                >
                  <Save className="mr-2 size-4" />
                  Save
                </Button>
                <Button
                  className="w-full justify-start"
                  onClick={() => {
                    setShowSaveMenu(false);
                    onSaveAsNew();
                  }}
                  size="sm"
                  variant="ghost"
                >
                  <Copy className="mr-2 size-4" />
                  Save as New
                </Button>
                <Button
                  className="w-full justify-start"
                  onClick={() => {
                    setShowSaveMenu(false);
                    onSaveAsTemplate();
                  }}
                  size="sm"
                  variant="ghost"
                >
                  <LayoutTemplate className="mr-2 size-4" />
                  Save as Template
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
