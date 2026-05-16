import { Archive, Loader2, RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";
import { SelectionCheckbox } from "@/components/gallery/SelectionCheckbox";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { type ArchiveItem, useArchiveStore } from "@/stores/use-archive-store";

function getTimeAgo(archivedAt: number): string {
  const days = Math.floor((Date.now() - archivedAt) / (24 * 60 * 60 * 1000));
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  return `${days} days ago`;
}

interface ArchiveItemCardProps {
  item: ArchiveItem;
  isSelected: boolean;
  isSelectionMode: boolean;
  onRestore: (item: ArchiveItem) => void;
  onClick: (item: ArchiveItem) => void;
}

export function ArchiveItemCard({
  item,
  isSelected,
  isSelectionMode,
  onRestore,
  onClick,
}: ArchiveItemCardProps) {
  const loadPreviewForId = useArchiveStore((s) => s.loadPreviewForId);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(true);

  useEffect(() => {
    let mounted = true;
    setIsLoadingPreview(true);
    loadPreviewForId(item.id).then((url) => {
      if (mounted) {
        setPreviewUrl(url);
        setIsLoadingPreview(false);
      }
    });
    return () => {
      mounted = false;
    };
  }, [item.id, loadPreviewForId]);

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-lg border bg-card transition-all",
        isSelected ? "border-primary ring-2 ring-primary" : "border-border"
      )}
      data-archive-id={item.id}
      onClick={() => onClick(item)}
      onKeyDown={() => {}}
    >
      <div className="relative aspect-video w-full bg-muted">
        {isLoadingPreview ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="size-6 animate-spin text-muted-foreground/50" />
          </div>
        ) : previewUrl ? (
          <img
            alt={item.name}
            className="h-full w-full object-cover"
            src={previewUrl}
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <Archive className="size-8 text-muted-foreground/30" />
          </div>
        )}
        <SelectionCheckbox
          isSelected={isSelected}
          isSelectionMode={isSelectionMode}
        />
      </div>
      <div className="p-2">
        <p className="truncate font-medium text-sm">{item.name}</p>
        <p className="mt-0.5 text-muted-foreground text-xs">
          Archived {getTimeAgo(item.archivedAt)}
        </p>
      </div>
      {!isSelectionMode && (
        <div className="absolute inset-x-0 bottom-0 flex justify-center gap-1 bg-gradient-to-t from-background/90 to-transparent p-2 pt-6 opacity-0 transition-opacity group-hover:opacity-100">
          <Button
            onClick={(e) => {
              e.stopPropagation();
              onRestore(item);
            }}
            size="sm"
            variant="secondary"
          >
            <RotateCcw className="mr-1 size-3" />
            Restore
          </Button>
        </div>
      )}
    </div>
  );
}
