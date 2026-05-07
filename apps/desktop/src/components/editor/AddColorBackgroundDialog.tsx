import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

interface AddColorBackgroundDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (color: string, extraPrompt: string) => void;
  isProcessing: boolean;
}

const PRESET_COLORS = [
  { color: "#ffffff", label: "White" },
  { color: "#000000", label: "Black" },
  { color: "#1a1a2e", label: "Dark Navy" },
  { color: "#374151", label: "Dark Grey" },
  { color: "#6b7280", label: "Grey" },
  { color: "#f3f4f6", label: "Light Grey" },
  { color: "#ef4444", label: "Red" },
  { color: "#f97316", label: "Orange" },
  { color: "#eab308", label: "Yellow" },
  { color: "#22c55e", label: "Green" },
  { color: "#3b82f6", label: "Blue" },
  { color: "#8b5cf6", label: "Purple" },
];

export function AddColorBackgroundDialog({
  open,
  onOpenChange,
  onConfirm,
  isProcessing,
}: AddColorBackgroundDialogProps) {
  const [color, setColor] = useState("#ffffff");
  const [extraPrompt, setExtraPrompt] = useState("");

  const handleConfirm = () => {
    onConfirm(color, extraPrompt);
  };

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Add Color Background</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <p className="text-muted-foreground text-sm">
            Gemini will fill the background behind the subject with your chosen
            color.
          </p>

          <div className="space-y-2">
            <p className="font-medium text-xs">Presets</p>
            <div className="flex flex-wrap gap-2">
              {PRESET_COLORS.map((p) => (
                <button
                  className={`h-7 w-7 rounded-md border-2 transition-transform hover:scale-110 ${
                    color === p.color ? "border-primary" : "border-transparent"
                  }`}
                  key={p.color}
                  onClick={() => setColor(p.color)}
                  style={{ background: p.color }}
                  title={p.label}
                  type="button"
                />
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <p className="font-medium text-xs">Custom color</p>
            <div className="flex items-center gap-3">
              <input
                className="h-9 w-12 cursor-pointer rounded border border-input bg-transparent p-0.5"
                onChange={(e) => setColor(e.target.value)}
                title="Pick background color"
                type="color"
                value={color}
              />
              <span
                className="rounded px-2 py-1 font-mono text-xs"
                style={{
                  background: color,
                  color: isLight(color) ? "#000" : "#fff",
                }}
              >
                {color}
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <p className="font-medium text-xs">Additional instructions</p>
            <p className="text-muted-foreground text-xs">
              Tell Gemini what else to remove or change, e.g. "also remove the
              chair" or "keep only the person"
            </p>
            <Textarea
              className="resize-none text-sm"
              onChange={(e) => setExtraPrompt(e.target.value)}
              placeholder="Optional — leave blank to just replace the background"
              rows={3}
              value={extraPrompt}
            />
          </div>
        </div>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)} variant="ghost">
            Cancel
          </Button>
          <Button onClick={handleConfirm}>Add Background</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function isLight(hex: string): boolean {
  const r = Number.parseInt(hex.slice(1, 3), 16);
  const g = Number.parseInt(hex.slice(3, 5), 16);
  const b = Number.parseInt(hex.slice(5, 7), 16);
  return r * 0.299 + g * 0.587 + b * 0.114 > 128;
}
