import { Button } from "@repo/ui/button";
import { Checkbox } from "@repo/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/dialog";
import { Input } from "@repo/ui/input";
import { Label } from "@repo/ui/label";
import { Link2, Link2Off } from "lucide-react";
import { useState } from "react";
import { sileo } from "sileo";

interface CanvasSizeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentSize: { width: number; height: number };
  onApply: (size: { width: number; height: number }) => void;
}

export function CanvasSizeDialog({
  open,
  onOpenChange,
  currentSize,
  onApply,
}: CanvasSizeDialogProps) {
  const [tempSize, setTempSize] = useState(currentSize);
  const [keepAspectRatio, setKeepAspectRatio] = useState(false);
  const aspectRatio = currentSize.width / currentSize.height;

  const handleOpen = (isOpen: boolean) => {
    onOpenChange(isOpen);
    if (isOpen) {
      setTempSize(currentSize);
    }
  };

  return (
    <Dialog onOpenChange={handleOpen} open={open}>
      <DialogContent className="sm:max-w-xs">
        <DialogHeader>
          <DialogTitle>Change Canvas Size</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <Label className="mb-1.5 block text-xs" htmlFor="canvas-width">
                Width
              </Label>
              <Input
                id="canvas-width"
                max={7680}
                min={1}
                onChange={(e) => {
                  const newWidth = Number(e.target.value);
                  if (keepAspectRatio) {
                    const newHeight = Math.round(newWidth / aspectRatio);
                    setTempSize({ width: newWidth, height: newHeight });
                  } else {
                    setTempSize((prev) => ({ ...prev, width: newWidth }));
                  }
                }}
                type="number"
                value={tempSize.width}
              />
            </div>
            <div className="flex-1">
              <Label className="mb-1.5 block text-xs" htmlFor="canvas-height">
                Height
              </Label>
              <Input
                id="canvas-height"
                max={7680}
                min={1}
                onChange={(e) => {
                  const newHeight = Number(e.target.value);
                  if (keepAspectRatio) {
                    const newWidth = Math.round(newHeight * aspectRatio);
                    setTempSize({ width: newWidth, height: newHeight });
                  } else {
                    setTempSize((prev) => ({ ...prev, height: newHeight }));
                  }
                }}
                type="number"
                value={tempSize.height}
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              checked={keepAspectRatio}
              id="keep-aspect-ratio"
              onCheckedChange={(checked) =>
                setKeepAspectRatio(checked === true)
              }
            />
            <Label
              className="flex cursor-pointer items-center gap-1.5 text-xs"
              htmlFor="keep-aspect-ratio"
            >
              {keepAspectRatio ? (
                <Link2 className="size-3.5" />
              ) : (
                <Link2Off className="size-3.5 text-muted-foreground" />
              )}
              Keep aspect ratio
            </Label>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)} variant="ghost">
            Cancel
          </Button>
          <Button
            onClick={() => {
              onApply(tempSize);
              onOpenChange(false);
              sileo.success({
                title: `Canvas resized to ${tempSize.width} × ${tempSize.height}`,
              });
            }}
          >
            Apply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
