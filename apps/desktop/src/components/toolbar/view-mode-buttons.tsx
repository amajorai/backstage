import { Grid2X2, Grid3X3, LayoutGrid, List } from "lucide-react";
import type { ViewMode } from "@/App";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Order: 5 (most dense) → 4 → 3 (least dense) → row
const VIEW_MODES: ViewMode[] = ["5", "4", "3", "row"];

const viewModeIcons: Record<ViewMode, React.ReactNode> = {
  "3": <LayoutGrid className="size-4" />,
  "4": <Grid2X2 className="size-3.5" />,
  "5": <Grid3X3 className="size-4" />,
  row: <List className="size-4" />,
};

const viewModeTitles: Record<ViewMode, string> = {
  "3": "3 columns",
  "4": "4 columns",
  "5": "5 columns",
  row: "List view",
};

interface ViewModeButtonsProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
}

export function ViewModeButtons({
  viewMode,
  onViewModeChange,
}: ViewModeButtonsProps) {
  return (
    <div className="flex gap-1">
      {VIEW_MODES.map((mode) => (
        <Button
          className={cn(viewMode === mode && "bg-muted-foreground/15")}
          key={mode}
          onClick={() => onViewModeChange(mode)}
          size="icon-sm"
          title={viewModeTitles[mode]}
          variant="ghost"
        >
          {viewModeIcons[mode]}
        </Button>
      ))}
    </div>
  );
}
