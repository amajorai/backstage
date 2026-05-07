import { useCallback, useRef, useState } from "react";

interface SelectionBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface DragSelectionOptions {
  /** Data attribute to identify selectable items (e.g., "data-thumbnail-id") */
  dataAttribute: string;
  /** Called when selection mode should be enabled */
  onEnableSelectionMode?: () => void;
  /** Called when selection changes with array of selected IDs */
  onSelectionChange: (ids: string[]) => void;
  /** Called when selection should be cleared (background click without modifier keys) */
  onClearSelection?: () => void;
  /** Whether selection mode is currently active */
  isSelectionMode: boolean;
}

interface DragSelectionResult {
  /** Current selection box coordinates, null when not dragging */
  selectionBox: SelectionBox | null;
  /** Ref to attach to the container element */
  containerRef: React.RefObject<HTMLDivElement | null>;
  /** Ref callback for VirtuosoGrid's scrollerRef */
  scrollerRef: React.MutableRefObject<HTMLDivElement | null>;
  /** Mouse down handler to attach to the container */
  handleMouseDown: (e: React.MouseEvent) => void;
  /** True if selection mode was just entered on this interaction — check in onClick to skip immediate exit */
  justEnteredSelectionMode: React.MutableRefObject<boolean>;
}

/**
 * Hook for drag-box selection in virtualized grids.
 * Handles mouse events, calculates intersections, and updates selection state.
 */
export function useDragSelection({
  dataAttribute,
  onEnableSelectionMode,
  onSelectionChange,
  onClearSelection,
  isSelectionMode,
}: DragSelectionOptions): DragSelectionResult {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const isDragging = useRef(false);
  const startPoint = useRef<{ x: number; y: number } | null>(null);
  const justEnteredSelectionMode = useRef(false);
  const [selectionBox, setSelectionBox] = useState<SelectionBox | null>(null);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      const container = scrollerRef.current;
      if (!container) {
        return;
      }

      // Don't start drag on interactive elements
      const target = e.target as HTMLElement;
      if (
        target.closest("button") ||
        target.closest(".group") ||
        target.closest(`[${dataAttribute}]`)
      ) {
        return;
      }

      // Only handle left click
      if (e.button !== 0) {
        return;
      }

      isDragging.current = true;
      const rect = container.getBoundingClientRect();
      const x = e.clientX - rect.left + container.scrollLeft;
      const y = e.clientY - rect.top + container.scrollTop;
      startPoint.current = { x, y };

      // Enable selection mode if not already active
      if (!isSelectionMode) {
        justEnteredSelectionMode.current = true;
        onEnableSelectionMode?.();
      }

      // Clear selection on background click/drag unless modifier key held
      if (!(e.shiftKey || e.ctrlKey || e.metaKey)) {
        onClearSelection?.();
      }

      const handleMouseMove = (e: MouseEvent) => {
        if (!(isDragging.current && startPoint.current)) {
          return;
        }

        const rect = container.getBoundingClientRect();
        const currentX = e.clientX - rect.left + container.scrollLeft;
        const currentY = e.clientY - rect.top + container.scrollTop;

        const x = Math.min(currentX, startPoint.current.x);
        const y = Math.min(currentY, startPoint.current.y);
        const width = Math.abs(currentX - startPoint.current.x);
        const height = Math.abs(currentY - startPoint.current.y);

        setSelectionBox({ x, y, width, height });

        // Calculate intersections
        const boxRect = {
          left: x,
          top: y,
          right: x + width,
          bottom: y + height,
        };
        const newSelectedIds: string[] = [];

        // Get all selectable elements
        const elements = container.querySelectorAll(`[${dataAttribute}]`);
        for (const el of elements) {
          const elRect = (el as HTMLElement).getBoundingClientRect();
          // Convert to container-relative coordinates
          const elRelLeft = elRect.left - rect.left + container.scrollLeft;
          const elRelTop = elRect.top - rect.top + container.scrollTop;
          const elRelRight = elRelLeft + elRect.width;
          const elRelBottom = elRelTop + elRect.height;

          const isIntersecting =
            boxRect.left < elRelRight &&
            boxRect.right > elRelLeft &&
            boxRect.top < elRelBottom &&
            boxRect.bottom > elRelTop;

          if (isIntersecting) {
            const id = el.getAttribute(dataAttribute);
            if (id) {
              newSelectedIds.push(id);
            }
          }
        }

        // Update selection
        onSelectionChange(newSelectedIds);
      };

      const handleMouseUp = () => {
        isDragging.current = false;
        startPoint.current = null;
        setSelectionBox(null);
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };

      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    },
    [
      dataAttribute,
      isSelectionMode,
      onEnableSelectionMode,
      onSelectionChange,
      onClearSelection,
    ]
  );

  return {
    selectionBox,
    containerRef,
    scrollerRef,
    handleMouseDown,
    justEnteredSelectionMode,
  };
}
