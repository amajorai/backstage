import type { ReactNode } from "react";
import { useCallback, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface ResizablePanelProps {
  children: ReactNode;
  defaultWidth: number;
  minWidth?: number;
  maxWidth?: number;
  side: "left" | "right";
  className?: string;
}

export function ResizablePanel({
  children,
  defaultWidth,
  minWidth = 150,
  maxWidth = 400,
  side,
  className,
}: ResizablePanelProps) {
  const [width, setWidth] = useState(defaultWidth);
  const isResizing = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(0);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      isResizing.current = true;
      startX.current = e.clientX;
      startWidth.current = width;

      const handleMouseMove = (e: MouseEvent) => {
        if (!isResizing.current) {
          return;
        }
        // For right panels: dragging left (negative delta) should increase width
        const delta =
          side === "right"
            ? startX.current - e.clientX
            : e.clientX - startX.current;
        const newWidth = Math.max(
          minWidth,
          Math.min(maxWidth, startWidth.current + delta)
        );
        setWidth(newWidth);
      };

      const handleMouseUp = () => {
        isResizing.current = false;
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [width, minWidth, maxWidth, side]
  );

  const handle = (
    <div
      aria-label="Resize Panel"
      aria-valuemax={maxWidth}
      aria-valuemin={minWidth}
      aria-valuenow={width}
      className="flex w-2 shrink-0 cursor-col-resize items-center justify-center"
      onMouseDown={handleMouseDown}
      role="separator"
      tabIndex={0}
    >
      <div className="h-8 w-0.5 rounded-full bg-border" />
    </div>
  );

  return (
    <div className={cn("flex shrink-0", className)} style={{ width }}>
      {side === "right" && handle}
      <div className="min-w-0 flex-1 overflow-hidden">{children}</div>
      {side === "left" && handle}
    </div>
  );
}
