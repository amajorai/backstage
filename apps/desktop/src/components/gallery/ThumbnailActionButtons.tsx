import {
  Copy,
  Download,
  MoreHorizontal,
  PaintBucket,
  Pencil,
  Sparkles,
  Trash2,
  Wand2,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { ThumbnailItem } from "@/stores/use-gallery-store";
import { useGalleryStore } from "@/stores/use-gallery-store";

interface ThumbnailActionButtonsProps {
  thumbnail: ThumbnailItem;
  onExportClick: (thumbnail: ThumbnailItem) => void;
  onRemoveBackground: (
    e: React.MouseEvent,
    thumbnail: ThumbnailItem
  ) => Promise<void>;
  onRename: (thumbnail: ThumbnailItem) => void;
  onDelete: (thumbnail: ThumbnailItem) => void;
  onAutoRename: (thumbnail: ThumbnailItem) => Promise<void>;
  onAddColorBackground: (thumbnail: ThumbnailItem) => void;
}

export function ThumbnailActionButtons({
  thumbnail,
  onExportClick,
  onRemoveBackground,
  onRename,
  onDelete,
  onAutoRename,
  onAddColorBackground,
}: ThumbnailActionButtonsProps) {
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const duplicateThumbnail = useGalleryStore((s) => s.duplicateThumbnail);

  return (
    <div
      className="z-10 flex shrink-0 gap-1"
      onClick={(e) => e.stopPropagation()}
    >
      <Tooltip>
        <TooltipTrigger
          className={buttonVariants({
            size: "icon-sm",
            variant: "ghost",
          })}
          onClick={async (e) => {
            e.stopPropagation();
            await onAutoRename(thumbnail);
          }}
        >
          <Sparkles className="size-4" />
        </TooltipTrigger>
        <TooltipContent>Auto Rename with AI</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger
          className={buttonVariants({
            size: "icon-sm",
            variant: "ghost",
          })}
          onClick={(e) => onRemoveBackground(e, thumbnail)}
        >
          <Wand2 className="size-4" />
        </TooltipTrigger>
        <TooltipContent>Remove Background</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger
          className={buttonVariants({
            size: "icon-sm",
            variant: "ghost",
          })}
          onClick={(e) => {
            e.stopPropagation();
            onExportClick(thumbnail);
          }}
        >
          <Download className="size-4" />
        </TooltipTrigger>
        <TooltipContent>Export</TooltipContent>
      </Tooltip>
      <div className="relative">
        <Tooltip>
          <TooltipTrigger
            className={buttonVariants({
              size: "icon-sm",
              variant: "ghost",
            })}
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpenId(menuOpenId === thumbnail.id ? null : thumbnail.id);
            }}
          >
            <MoreHorizontal className="size-4" />
          </TooltipTrigger>
          <TooltipContent>More</TooltipContent>
        </Tooltip>
        {menuOpenId === thumbnail.id && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpenId(null);
              }}
              onKeyDown={() => {}}
            />
            <div className="absolute right-0 bottom-full z-50 mb-2 w-48 rounded-lg border border-border bg-card p-1 shadow-lg">
              <div className="px-2 py-1.5">
                <p className="truncate font-medium text-sm">{thumbnail.name}</p>
                {thumbnail.canvasWidth && thumbnail.canvasHeight && (
                  <p className="text-muted-foreground text-xs">
                    {thumbnail.canvasWidth} × {thumbnail.canvasHeight}
                  </p>
                )}
                <p className="text-muted-foreground text-xs">
                  Updated {new Date(thumbnail.updatedAt).toLocaleDateString()}
                </p>
                <p className="text-muted-foreground text-xs">
                  Created {new Date(thumbnail.createdAt).toLocaleDateString()}
                </p>
              </div>
              <div className="my-1 h-px bg-border" />
              <Button
                className="w-full justify-start"
                onClick={async (e) => {
                  e.stopPropagation();
                  await duplicateThumbnail(thumbnail.id);
                  toast.success("Thumbnail duplicated");
                  setMenuOpenId(null);
                }}
                size="sm"
                variant="ghost"
              >
                <Copy className="mr-2 size-4" />
                Duplicate
              </Button>
              <Button
                className="w-full justify-start"
                onClick={(e) => {
                  e.stopPropagation();
                  onRename(thumbnail);
                  setMenuOpenId(null);
                }}
                size="sm"
                variant="ghost"
              >
                <Pencil className="mr-2 size-4" />
                Rename
              </Button>
              <Button
                className="w-full justify-start"
                onClick={(e) => {
                  e.stopPropagation();
                  onAddColorBackground(thumbnail);
                  setMenuOpenId(null);
                }}
                size="sm"
                variant="ghost"
              >
                <PaintBucket className="mr-2 size-4" />
                Add Color Background
              </Button>
              <Button
                className="w-full justify-start text-destructive hover:text-destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(thumbnail);
                  setMenuOpenId(null);
                }}
                size="sm"
                variant="ghost"
              >
                <Trash2 className="mr-2 size-4" />
                Delete
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
