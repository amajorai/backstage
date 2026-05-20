import { Check } from "lucide-react";
import * as sounds from "@/lib/sounds";
import { cn } from "@/lib/utils";

interface GeneratedImage {
  url: string;
  index: number;
}

interface GeneratedImageGridProps {
  images: GeneratedImage[];
  viewingIndex: number;
  selectedIndices: Set<number>;
  onViewingIndexChange: (index: number) => void;
  onToggleSelection: (index: number) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
}

export function GeneratedImageGrid({
  images,
  viewingIndex,
  selectedIndices,
  onViewingIndexChange,
  onToggleSelection,
  onSelectAll,
  onDeselectAll,
}: GeneratedImageGridProps) {
  if (images.length <= 1) {
    return null;
  }

  return (
    <div className="flex shrink-0 flex-col gap-2">
      <div className="flex flex-wrap justify-center gap-2">
        {images.map((img, idx) => {
          const isSelected = selectedIndices.has(idx);
          const isViewing = idx === viewingIndex;
          return (
            <button
              className={cn(
                "group relative size-20 cursor-pointer overflow-hidden rounded-md border-2 transition-all",
                isViewing
                  ? "border-primary ring-2 ring-primary/30"
                  : isSelected
                    ? "border-primary/50"
                    : "border-transparent"
              )}
              key={img.index}
              onClick={() => {
                sounds.select();
                onViewingIndexChange(idx);
              }}
              type="button"
            >
              <img
                alt={`Version ${idx + 1}`}
                className="h-full w-full object-cover"
                src={img.url}
              />
              {/* Selection checkbox overlay */}
              <div
                className={cn(
                  "absolute top-1 left-1 flex size-5 items-center justify-center rounded-full transition-all",
                  isSelected
                    ? "!bg-white text-black shadow-md"
                    : "border-2 border-white/80 bg-black/30 opacity-0 shadow-md group-hover:opacity-100"
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  sounds.select();
                  onToggleSelection(idx);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.stopPropagation();
                    onToggleSelection(idx);
                  }
                }}
              >
                {isSelected && <Check className="size-3" />}
              </div>
              <span className="absolute right-1 bottom-1 rounded bg-black/60 px-1.5 font-medium text-white text-xs">
                v{idx + 1}
              </span>
            </button>
          );
        })}
      </div>
      <div className="flex items-center justify-center gap-2">
        <button
          className="text-muted-foreground text-xs hover:text-foreground"
          onClick={() => {
            sounds.click();
            onSelectAll();
          }}
          type="button"
        >
          Select all
        </button>
        <span className="text-muted-foreground text-xs">•</span>
        <button
          className="text-muted-foreground text-xs hover:text-foreground"
          onClick={() => {
            sounds.click();
            onDeselectAll();
          }}
          type="button"
        >
          Deselect all
        </button>
      </div>
    </div>
  );
}
