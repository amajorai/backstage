import { Button } from "@repo/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@repo/ui/tooltip";
import { Copy, Plus, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { KonvaCanvas } from "@/components/editor/KonvaCanvas";
import { StaticPageCanvas } from "@/components/editor/StaticPageCanvas";
import * as sounds from "@/lib/sounds";
import type { Page } from "@/stores/use-editor-store";

interface VerticalScrollViewProps {
  pages: Page[];
  activePageIndex: number;
  canvasWidth: number;
  canvasHeight: number;
  setActivePage: (index: number) => void;
  addPage: () => void;
  duplicatePage: (index: number) => void;
  removePage: (index: number) => void;
  exportRef: React.MutableRefObject<(() => string) | null>;
  startPendingGuideRef: React.MutableRefObject<
    ((type: "h" | "v") => void) | null
  >;
  showGrid: boolean;
  isDark: boolean;
}

const PADDING = 48;
const GAP = 40;

export function VerticalScrollView({
  pages,
  activePageIndex,
  canvasWidth,
  canvasHeight,
  setActivePage,
  addPage,
  duplicatePage,
  removePage,
  exportRef,
  startPendingGuideRef,
  showGrid,
  isDark,
}: VerticalScrollViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(800);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const scale = Math.min((containerWidth - PADDING * 2) / canvasWidth, 1);
  const pageDisplayWidth = canvasWidth * scale;
  const pageDisplayHeight = canvasHeight * scale;

  return (
    <div
      className="h-full w-full overflow-y-auto"
      ref={containerRef}
      style={{ background: "#171717" }}
    >
      <div
        className="flex flex-col items-center"
        style={{ paddingTop: PADDING, paddingBottom: PADDING, gap: GAP }}
      >
        <TooltipProvider>
          {pages.map((page, index) => {
            const isActive = index === activePageIndex;
            return (
              <div className="group flex flex-col items-center" key={page.id}>
                <div className="mb-2 text-center font-medium text-neutral-400 text-xs">
                  Page {index + 1}
                </div>
                <div
                  className="relative"
                  onClick={
                    isActive
                      ? undefined
                      : () => {
                          sounds.click();
                          setActivePage(index);
                        }
                  }
                  style={{
                    width: pageDisplayWidth,
                    height: pageDisplayHeight,
                    boxShadow: "0 4px 24px rgba(0,0,0,0.5)",
                    outline: isActive
                      ? "2px solid oklch(0.685 0.169 237.323)"
                      : "none",
                    outlineOffset: 2,
                    overflow: "hidden",
                    cursor: isActive ? "default" : "pointer",
                  }}
                >
                  {isActive ? (
                    <KonvaCanvas
                      height={canvasHeight}
                      isDark={isDark}
                      onExportRef={exportRef}
                      panOffset={{ x: 0, y: 0 }}
                      scale={scale}
                      showGrid={showGrid}
                      startPendingGuideRef={startPendingGuideRef}
                      width={canvasWidth}
                      workspaceHeight={pageDisplayHeight}
                      workspaceWidth={pageDisplayWidth}
                    />
                  ) : (
                    <StaticPageCanvas
                      canvasHeight={canvasHeight}
                      canvasWidth={canvasWidth}
                      layers={page.layers}
                      onClick={() => {
                        sounds.click();
                        setActivePage(index);
                      }}
                      scale={scale}
                    />
                  )}

                  <div className="absolute right-0 bottom-0 left-0 flex justify-center gap-0.5 p-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          className="h-5 w-5"
                          onClick={(e) => {
                            e.stopPropagation();
                            sounds.click();
                            duplicatePage(index);
                          }}
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
                          onClick={(e) => {
                            e.stopPropagation();
                            sounds.delete_();
                            removePage(index);
                          }}
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
              </div>
            );
          })}

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                className="mt-2"
                onClick={() => {
                  sounds.click();
                  addPage();
                }}
                size="sm"
                style={{ width: pageDisplayWidth }}
                variant="outline"
              >
                <Plus className="mr-1.5 size-4" />
                Add page
              </Button>
            </TooltipTrigger>
            <TooltipContent>Add new page</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  );
}
