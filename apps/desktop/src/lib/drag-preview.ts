// Custom HTML5 drag image used in place of the browser's default (ugly,
// translucent full-element screenshot) preview. The node is rasterized
// synchronously by setDragImage, so it must be in the DOM at call time and
// uses only effects that survive an isolated snapshot: solid background, no
// backdrop-blur, no overflowing box-shadow.

const SVG_NS = "http://www.w3.org/2000/svg";

// Lucide icon path data (https://lucide.dev) for the two drag sources.
const STACK_ICON_PATHS = [
  "m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z",
  "m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65",
  "m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65",
];

const FOLDER_ICON_PATHS = [
  "m6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2",
];

function createIcon(paths: string[]): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("width", "16");
  svg.setAttribute("height", "16");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  for (const d of paths) {
    const path = document.createElementNS(SVG_NS, "path");
    path.setAttribute("d", d);
    svg.appendChild(path);
  }
  return svg;
}

type DragPreviewIcon = "stack" | "folder";

interface DragPreviewOptions {
  label: string;
  icon?: DragPreviewIcon;
  count?: number;
}

/**
 * Replace the native drag preview with a styled pill that follows the cursor.
 * Call inside an onDragStart handler, after setting the drag data.
 */
export function setDragPreview(
  dataTransfer: DataTransfer,
  { label, icon = "stack", count }: DragPreviewOptions
): void {
  const pill = document.createElement("div");
  pill.className =
    "pointer-events-none fixed top-2 left-[-9999px] z-9999 flex items-center gap-2 rounded-lg border border-border bg-popover px-3 py-2 font-medium text-popover-foreground text-sm";

  const iconSpan = document.createElement("span");
  iconSpan.className = "flex shrink-0 text-muted-foreground";
  iconSpan.appendChild(
    createIcon(icon === "folder" ? FOLDER_ICON_PATHS : STACK_ICON_PATHS)
  );
  pill.appendChild(iconSpan);

  const labelSpan = document.createElement("span");
  labelSpan.className = "max-w-[200px] truncate";
  labelSpan.textContent = label;
  pill.appendChild(labelSpan);

  if (count && count > 1) {
    const badge = document.createElement("span");
    badge.className =
      "flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-primary-foreground text-xs";
    badge.textContent = String(count);
    pill.appendChild(badge);
  }

  document.body.appendChild(pill);
  dataTransfer.setDragImage(pill, 16, 16);

  // The snapshot is taken synchronously above; drop the node next tick.
  setTimeout(() => pill.remove(), 0);
}
