import { ChevronLeft, ChevronRight, Copy, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useEditorStore } from "@/stores/use-editor-store";

export function PageCarousel() {
  const pages = useEditorStore((s) => s.pages);
  const activePageIndex = useEditorStore((s) => s.activePageIndex);
  const setActivePage = useEditorStore((s) => s.setActivePage);
  const addPage = useEditorStore((s) => s.addPage);
  const removePage = useEditorStore((s) => s.removePage);
  const duplicatePage = useEditorStore((s) => s.duplicatePage);

  const handlePrev = () => {
    if (activePageIndex > 0) setActivePage(activePageIndex - 1);
  };

  const handleNext = () => {
    if (activePageIndex < pages.length - 1) setActivePage(activePageIndex + 1);
  };

  return (
    <div className="flex items-center gap-2 rounded-lg border bg-background/80 p-2 backdrop-blur-sm">
      <TooltipProvider>
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                disabled={activePageIndex === 0}
                onClick={handlePrev}
                size="icon-sm"
                variant="ghost"
              >
                <ChevronLeft className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Previous Page</TooltipContent>
          </Tooltip>

          <span className="min-w-[80px] text-center font-medium text-sm">
            Page {activePageIndex + 1} / {pages.length}
          </span>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                disabled={activePageIndex === pages.length - 1}
                onClick={handleNext}
                size="icon-sm"
                variant="ghost"
              >
                <ChevronRight className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Next Page</TooltipContent>
          </Tooltip>
        </div>

        <div className="mx-2 h-4 w-px bg-border" />

        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button onClick={addPage} size="icon-sm" variant="ghost">
                <Plus className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Add Empty Page</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={() => duplicatePage(activePageIndex)}
                size="icon-sm"
                variant="ghost"
              >
                <Copy className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Duplicate Page</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                disabled={pages.length <= 1}
                onClick={() => removePage(activePageIndex)}
                size="icon-sm"
                variant="ghost"
              >
                <Trash2 className="size-4 text-destructive" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Delete Page</TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>
    </div>
  );
}
