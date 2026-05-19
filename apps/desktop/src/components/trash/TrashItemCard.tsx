import { Button } from "@repo/ui/button";
import { Loader2, RotateCcw, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { SelectionCheckbox } from "@/components/gallery/SelectionCheckbox";
import { cn } from "@/lib/utils";
import { type TrashItem, useTrashStore } from "@/stores/use-trash-store";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

function getDaysRemaining(deletedAt: number): number {
  const expiresAt = deletedAt + THIRTY_DAYS_MS;
  const remaining = expiresAt - Date.now();
  return Math.max(0, Math.ceil(remaining / (24 * 60 * 60 * 1000)));
}

function getDaysAgo(deletedAt: number): number {
  return Math.floor((Date.now() - deletedAt) / (24 * 60 * 60 * 1000));
}

interface TrashItemCardProps {
  item: TrashItem;
  isSelected: boolean;
  isSelectionMode: boolean;
  onRestore: (item: TrashItem) => void;
  onDelete: (item: TrashItem) => void;
  onClick: (item: TrashItem) => void;
}

export function TrashItemCard({
  item,
  isSelected,
  isSelectionMode,
  onRestore,
  onDelete,
  onClick,
}: TrashItemCardProps) {
  const loadPreviewForId = useTrashStore((s) => s.loadPreviewForId);
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

  const daysAgo = getDaysAgo(item.deletedAt);
  const daysRemaining = getDaysRemaining(item.deletedAt);

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-lg border bg-card transition-all",
        isSelected ? "border-primary ring-2 ring-primary" : "border-border"
      )}
      data-trash-id={item.id}
      onClick={() => onClick(item)}
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
            <Trash2 className="size-8 text-muted-foreground/30" />
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
          Deleted {daysAgo} {daysAgo === 1 ? "day" : "days"} ago •{" "}
          <span className={daysRemaining <= 3 ? "text-destructive" : ""}>
            {daysRemaining} {daysRemaining === 1 ? "day" : "days"} left
          </span>
        </p>
      </div>
      {/* Action buttons - only show when not in selection mode */}
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
          <Button
            className="text-destructive"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(item);
            }}
            size="sm"
            variant="ghost"
          >
            <Trash2 className="mr-1 size-3" />
            Delete
          </Button>
        </div>
      )}
    </div>
  );
}
