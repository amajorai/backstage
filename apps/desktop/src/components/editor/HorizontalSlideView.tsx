import { Button } from "@repo/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@repo/ui/tooltip";
import { Copy, Plus, Trash2 } from "lucide-react";
import { useRef } from "react";
import { StaticPageCanvas } from "@/components/editor/StaticPageCanvas";
import type { Page } from "@/stores/use-editor-store";

const STRIP_HEIGHT = 128;

interface HorizontalSlideViewProps {
  pages: Page[];
  activePageIndex: number;
  canvasWidth: number;
  canvasHeight: number;
  setActivePage: (index: number) => void;
  addPage: () => void;
  duplicatePage: (index: number) => void;
  removePage: (index: number) => void;
  children: React.ReactNode;
}

export function HorizontalSlideView({
  pages,
  activePageIndex,
  canvasWidth,
  canvasHeight,
  setActivePage,
  addPage,
  duplicatePage,
  removePage,
  children,
}: HorizontalSlideViewProps) {
  const stripRef = useRef<HTMLDivElement>(null);

  const thumbScale = Math.min((STRIP_HEIGHT - 36) / canvasHeight, 0.15);
  const thumbW = Math.round(canvasWidth * thumbScale);
  const thumbH = Math.round(canvasHeight * thumbScale);

  return (
    <div className="flex h-full w-full flex-col">
      <div className="relative flex flex-1 items-center justify-center overflow-hidden">
        {children}
      </div>

      <div
        style={{
          height: STRIP_HEIGHT,
          background: "#0d0d0d",
          borderTop: "1px solid rgba(255,255,255,0.07)",
          flexShrink: 0,
        }}
      >
        <div
          className="flex h-full items-center gap-3 overflow-x-auto px-4"
          ref={stripRef}
          style={{ scrollbarWidth: "thin" }}
        >
          <TooltipProvider>
            {pages.map((page, index) => {
              const isActive = index === activePageIndex;
              return (
                <div className="group relative flex-shrink-0" key={page.id}>
                  <div
                    className="mb-1.5 text-center text-neutral-500"
                    style={{ fontSize: 10 }}
                  >
                    {index + 1}
                  </div>
                  <div
                    onClick={() => setActivePage(index)}
                    style={{
                      width: thumbW,
                      height: thumbH,
                      outline: isActive
                        ? "2px solid oklch(0.685 0.169 237.323)"
                        : "1px solid rgba(255,255,255,0.12)",
                      outlineOffset: isActive ? 1 : 0,
                      cursor: "pointer",
                      overflow: "hidden",
                      boxShadow: "0 2px 8px rgba(0,0,0,0.5)",
                    }}
                  >
                    <StaticPageCanvas
                      canvasHeight={canvasHeight}
                      canvasWidth={canvasWidth}
                      layers={page.layers}
                      scale={thumbScale}
                    />
                  </div>

                  <div className="absolute right-0 bottom-0 left-0 flex justify-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          className="h-5 w-5"
                          onClick={() => duplicatePage(index)}
                          size="icon-sm"
                          variant="secondary"
                        >
                          <Copy className="size-3" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Duplicate page</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          className="h-5 w-5"
                          disabled={pages.length <= 1}
                          onClick={() => removePage(index)}
                          size="icon-sm"
                          variant="secondary"
                        >
                          <Trash2 className="size-3 text-destructive" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Delete page</TooltipContent>
                    </Tooltip>
                  </div>
                </div>
              );
            })}

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  className="flex-shrink-0"
                  onClick={addPage}
                  size="icon"
                  style={{ width: Math.max(28, thumbW * 0.5), height: thumbH }}
                  variant="outline"
                >
                  <Plus className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Add page</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
    </div>
  );
}
