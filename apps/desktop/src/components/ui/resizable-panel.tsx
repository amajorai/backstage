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

  const handleLeft = side === "right" ? 0 : undefined;
  const handleRight = side === "left" ? 0 : undefined;

  return (
    <div className={cn("relative shrink-0", className)} style={{ width }}>
      <div className="h-full w-full overflow-hidden">{children}</div>
      {/* Absolutely positioned handle — no layout space */}
      <div
        aria-label="Resize Panel"
        aria-valuemax={maxWidth}
        aria-valuemin={minWidth}
        aria-valuenow={width}
        className="group absolute top-0 z-10 flex h-full w-3 cursor-col-resize items-center justify-center"
        onMouseDown={handleMouseDown}
        role="separator"
        style={{
          left: handleLeft,
          right: handleRight,
        }}
        tabIndex={0}
      >
        <div className="flex h-8 w-1 flex-col items-center justify-center gap-[3px] rounded-full opacity-0 transition-opacity group-hover:opacity-100">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              className="size-[3px] rounded-full bg-muted-foreground/60"
              key={i}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
