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
      {/* Resize handle */}
      <div
        className="z-10 flex h-2 shrink-0 cursor-row-resize items-center justify-center"
        onMouseDown={handleMouseDown}
      >
        <div className="h-0.5 w-8 rounded-full bg-border" />
      </div>
      {/* Bottom panel */}
      <div className="min-h-0 flex-1 overflow-hidden">{bottomPanel}</div>
    </div>
  );
}
