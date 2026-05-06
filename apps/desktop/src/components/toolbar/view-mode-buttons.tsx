import { Grid2X2, Grid3X3, List } from "lucide-react";
import type { ViewMode } from "@/App";
import { Button } from "@/components/ui/button";

const viewModeIcons: Record<ViewMode, React.ReactNode> = {
  "3": <Grid2X2 className="size-4" />,
  "4": <Grid2X2 className="size-3.5" />,
  "5": <Grid3X3 className="size-4" />,
  row: <List className="size-4" />,
};

const viewModeTitles: Record<ViewMode, string> = {
  "3": "3x3 Grid",
  "4": "4x4 Grid",
  "5": "5x5 Grid",
  row: "List View",
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
      {(["3", "4", "5", "row"] as ViewMode[]).map((mode) => (
        <Button
          key={mode}
          onClick={() => onViewModeChange(mode)}
          size="icon-sm"
          title={viewModeTitles[mode]}
          variant={viewMode === mode ? "secondary" : "ghost"}
        >
          {viewModeIcons[mode]}
        </Button>
      ))}
    </div>
  );
}
