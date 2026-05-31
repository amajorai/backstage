import { Button } from "@repo/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@repo/ui/tooltip";
import { Copy, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { KonvaCanvas } from "@/components/editor/KonvaCanvas";
import { StaticPageCanvas } from "@/components/editor/StaticPageCanvas";
import * as sounds from "@/lib/sounds";
import type { Page } from "@/stores/use-editor-store";

const ARTBOARD_GAP = 80;
const ARTBOARD_LABEL_HEIGHT = 28;
const ARTBOARD_PADDING = 120;
const MIN_ZOOM = 0.05;
const MAX_ZOOM = 3;

interface ArtboardViewProps {
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

export function ArtboardView({
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
}: ArtboardViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({
    width: 800,
    height: 600,
  });
  const [zoom, setZoom] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const isPanningRef = useRef(false);
  const panStartRef = useRef<{
    mouseX: number;
    mouseY: number;
    offsetX: number;
    offsetY: number;
  } | null>(null);
  const [isSpaceDown, setIsSpaceDown] = useState(false);
  const initializedRef = useRef(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setContainerSize({ width, height });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (initializedRef.current || !containerSize.width || !containerSize.height)
      return;
    initializedRef.current = true;

    const totalContentW =
      pages.length * canvasWidth +
      (pages.length - 1) * ARTBOARD_GAP +
      ARTBOARD_PADDING * 2;
    const totalContentH =
      canvasHeight + ARTBOARD_PADDING * 2 + ARTBOARD_LABEL_HEIGHT;

    const fitZoom = Math.min(
      (containerSize.width - 40) / totalContentW,
      (containerSize.height - 40) / totalContentH,
      1
    );
    const clampedZoom = Math.max(MIN_ZOOM, fitZoom);
    setZoom(clampedZoom);
    setPanOffset({
      x: (containerSize.width - totalContentW * clampedZoom) / 2,
      y: (containerSize.height - totalContentH * clampedZoom) / 2,
    });
  }, [containerSize, pages.length, canvasWidth, canvasHeight]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== "Space") return;
      const tag = (document.activeElement as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      e.preventDefault();
      setIsSpaceDown(true);
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code !== "Space") return;
      setIsSpaceDown(false);
      isPanningRef.current = false;
      panStartRef.current = null;
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  const handleWheel = useCallback((e: WheelEvent) => {
    if (!(e.ctrlKey || e.metaKey)) return;
    e.preventDefault();
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const delta = e.deltaY > 0 ? -0.08 : 0.08;
    setZoom((prev) => {
      const next = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, prev + delta));
      setPanOffset((p) => ({
        x: mouseX - (mouseX - p.x) * (next / prev),
        y: mouseY - (mouseY - p.y) * (next / prev),
      }));
      return next;
    });
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [handleWheel]);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button === 1 || (e.button === 0 && isSpaceDown)) {
        isPanningRef.current = true;
        panStartRef.current = {
          mouseX: e.clientX,
          mouseY: e.clientY,
          offsetX: panOffset.x,
          offsetY: panOffset.y,
        };
        e.preventDefault();
      }
    },
    [isSpaceDown, panOffset]
  );

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!(isPanningRef.current && panStartRef.current)) return;
    const dx = e.clientX - panStartRef.current.mouseX;
    const dy = e.clientY - panStartRef.current.mouseY;
    setPanOffset({
      x: panStartRef.current.offsetX + dx,
      y: panStartRef.current.offsetY + dy,
    });
  }, []);

  const handleMouseUp = useCallback(() => {
    isPanningRef.current = false;
    panStartRef.current = null;
  }, []);

  const cursor = isSpaceDown
    ? isPanningRef.current
      ? "grabbing"
      : "grab"
    : "default";

  const totalContentW =
    pages.length * canvasWidth +
    (pages.length - 1) * ARTBOARD_GAP +
    ARTBOARD_PADDING * 2;
  const totalContentH =
    canvasHeight + ARTBOARD_PADDING * 2 + ARTBOARD_LABEL_HEIGHT;

  return (
    <TooltipProvider>
      <div
        className="relative h-full w-full select-none overflow-hidden"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        ref={containerRef}
        style={{
          background: isDark ? "#111111" : "#d4d4d4",
          cursor,
        }}
      >
        <div
          style={{
            position: "absolute",
            top: panOffset.y,
            left: panOffset.x,
            transform: `scale(${zoom})`,
            transformOrigin: "0 0",
            width: totalContentW,
            height: totalContentH,
          }}
        >
          {pages.map((page, index) => {
            const isActive = index === activePageIndex;
            const artboardX =
              ARTBOARD_PADDING + index * (canvasWidth + ARTBOARD_GAP);

            return (
              <div
                key={page.id}
                style={{
                  position: "absolute",
                  left: artboardX,
                  top: ARTBOARD_PADDING + ARTBOARD_LABEL_HEIGHT,
                }}
              >
                {/* Artboard label + controls */}
                <div
                  style={{
                    position: "absolute",
                    top: -ARTBOARD_LABEL_HEIGHT,
                    left: 0,
                    width: canvasWidth,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    userSelect: "none",
                  }}
                >
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: isActive ? 600 : 400,
                      color: isActive
                        ? "oklch(0.685 0.169 237.323)"
                        : isDark
                          ? "#737373"
                          : "#525252",
                      whiteSpace: "nowrap",
                    }}
                  >
                    Page {index + 1}
                  </span>
                  <div
                    className="flex gap-0.5"
                    style={{ pointerEvents: "auto" }}
                  >
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

                {/* Artboard content */}
                <div
                  onClick={
                    isActive
                      ? undefined
                      : () => {
                          sounds.click();
                          setActivePage(index);
                        }
                  }
                  style={{
                    width: canvasWidth,
                    height: canvasHeight,
                    overflow: "hidden",
                    cursor: isActive ? "default" : "pointer",
                    boxShadow: isActive
                      ? "0 0 0 2px oklch(0.685 0.169 237.323), 0 8px 32px rgba(0,0,0,0.6)"
                      : "0 4px 20px rgba(0,0,0,0.5)",
                  }}
                >
                  {isActive ? (
                    <KonvaCanvas
                      cssZoom={zoom}
                      height={canvasHeight}
                      isDark={isDark}
                      onExportRef={exportRef}
                      panOffset={{ x: 0, y: 0 }}
                      scale={1}
                      showGrid={showGrid}
                      startPendingGuideRef={startPendingGuideRef}
                      width={canvasWidth}
                      workspaceHeight={canvasHeight}
                      workspaceWidth={canvasWidth}
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
                      scale={1}
                    />
                  )}
                </div>
              </div>
            );
          })}

          {/* Add page artboard */}
          <div
            style={{
              position: "absolute",
              left:
                ARTBOARD_PADDING + pages.length * (canvasWidth + ARTBOARD_GAP),
              top: ARTBOARD_PADDING + ARTBOARD_LABEL_HEIGHT,
            }}
          >
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => {
                    sounds.click();
                    addPage();
                  }}
                  style={{
                    width: Math.max(120, canvasWidth * 0.3),
                    height: canvasHeight,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    background: isDark
                      ? "rgba(255,255,255,0.04)"
                      : "rgba(0,0,0,0.06)",
                    border: `2px dashed ${isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.2)"}`,
                    borderRadius: 4,
                    cursor: "pointer",
                    color: isDark ? "#737373" : "#737373",
                  }}
                  type="button"
                >
                  <Plus
                    style={{
                      width: 24,
                      height: 24,
                      color: isDark ? "#525252" : "#737373",
                    }}
                  />
                  <span
                    style={{
                      fontSize: 12,
                      color: isDark ? "#525252" : "#737373",
                    }}
                  >
                    Add page
                  </span>
                </button>
              </TooltipTrigger>
              <TooltipContent>Add new page</TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Zoom level indicator */}
        <div className="pointer-events-none absolute right-3 bottom-3 rounded bg-black/50 px-2 py-0.5 font-mono text-neutral-300 text-xs">
          {Math.round(zoom * 100)}%
        </div>
      </div>
    </TooltipProvider>
  );
}
