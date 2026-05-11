import { type ReactNode, useCallback, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface VerticalResizablePanelProps {
  topPanel: ReactNode;
  bottomPanel: ReactNode;
  defaultTopHeight?: number; // percentage 0-100
  minTopHeight?: number; // percentage
  maxTopHeight?: number; // percentage
  className?: string;
}

export function VerticalResizablePanel({
  topPanel,
  bottomPanel,
  defaultTopHeight = 40,
  minTopHeight = 20,
  maxTopHeight = 80,
  className,
}: VerticalResizablePanelProps) {
  const [topHeight, setTopHeight] = useState(defaultTopHeight);
  const containerRef = useRef<HTMLDivElement>(null);
  const isResizing = useRef(false);
  const startY = useRef(0);
  const startHeight = useRef(0);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      isResizing.current = true;
      startY.current = e.clientY;
      startHeight.current = topHeight;

      const handleMouseMove = (e: MouseEvent) => {
        if (!(isResizing.current && containerRef.current)) {
          return;
        }
        const containerHeight = containerRef.current.clientHeight;
        const deltaY = e.clientY - startY.current;
        const deltaPercent = (deltaY / containerHeight) * 100;
        const newHeight = Math.max(
          minTopHeight,
          Math.min(maxTopHeight, startHeight.current + deltaPercent)
        );
        setTopHeight(newHeight);
      };

      const handleMouseUp = () => {
        isResizing.current = false;
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [topHeight, minTopHeight, maxTopHeight]
  );

  return (
    <div
      className={cn("relative flex h-full w-full flex-col", className)}
      ref={containerRef}
    >
      {/* Top panel */}
      <div
        className="shrink-0 overflow-hidden"
        style={{ height: `${topHeight}%` }}
      >
        {topPanel}
      </div>
      {/* Bottom panel */}
      <div className="min-h-0 flex-1 overflow-hidden">{bottomPanel}</div>
      {/* Resize handle — absolutely positioned at boundary, no layout space */}
      <div
        className="absolute z-10 h-2 w-full cursor-row-resize border-border border-t"
        onMouseDown={handleMouseDown}
        style={{ top: `calc(${topHeight}% - 4px)` }}
      />
    </div>
  );
}
