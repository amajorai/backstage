import { Button } from "@repo/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/dialog";
import { Textarea } from "@repo/ui/textarea";
import { Wand2 } from "lucide-react";
import { useEffect, useState } from "react";
import {
  ColorPicker,
  ColorPickerAlphaSlider,
  ColorPickerArea,
  ColorPickerContent,
  ColorPickerEyeDropper,
  ColorPickerHueSlider,
  ColorPickerInput,
  ColorPickerTrigger,
} from "@/components/ui/color-picker";
import * as sounds from "@/lib/sounds";
import { useAppSettingsStore } from "@/stores/use-app-settings-store";

interface BgRemovalPreprocessDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (color: string, prompt: string) => void;
}

const PRESET_COLORS = [
  { color: "#00ff00", label: "Green Screen" },
  { color: "#ffffff", label: "White" },
  { color: "#000000", label: "Black" },
  { color: "#374151", label: "Dark Grey" },
  { color: "#6b7280", label: "Grey" },
  { color: "#f3f4f6", label: "Light Grey" },
  { color: "#ef4444", label: "Red" },
  { color: "#3b82f6", label: "Blue" },
  { color: "#8b5cf6", label: "Purple" },
];

export function BgRemovalPreprocessDialog({
  open,
  onOpenChange,
  onConfirm,
}: BgRemovalPreprocessDialogProps) {
  const defaultColor = useAppSettingsStore(
    (state) => state.bgRemovalGeminiColor
  );
  const [color, setColor] = useState(defaultColor);
  const [prompt, setPrompt] = useState("");

  // Reset to the configured default color and an empty prompt each time the
  // dialog opens so a previous run does not leak into the next one.
  useEffect(() => {
    if (open) {
      setColor(defaultColor);
      setPrompt("");
    }
  }, [open, defaultColor]);

  const handleConfirm = () => {
    onConfirm(color, prompt.trim());
  };

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="size-4" />
            Remove Background
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <p className="text-muted-foreground text-sm">
            Pre-processing is on. Gemini first replaces the background with a
            flat color (and applies any instructions you add), then the local
            model cuts out the subject for a clean edge.
          </p>

          <div className="space-y-2">
            <p className="font-medium text-xs">Background color</p>
            <div className="flex flex-wrap gap-2">
              {PRESET_COLORS.map((p) => (
                <button
                  className={`h-7 w-7 rounded-md border-2 transition-transform hover:scale-110 ${
                    color === p.color ? "border-primary" : "border-transparent"
                  }`}
                  key={p.color}
                  onClick={() => {
                    sounds.click();
                    setColor(p.color);
                  }}
                  style={{ background: p.color }}
                  title={p.label}
                  type="button"
                />
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <p className="font-medium text-xs">Custom color</p>
            <ColorPicker onValueChange={setColor} value={color}>
              <ColorPickerTrigger className="w-full justify-start gap-2 px-2 font-normal">
                <div
                  className="size-4 shrink-0 rounded border border-border"
                  style={{ backgroundColor: color }}
                />
                <span className="truncate font-mono text-xs">{color}</span>
              </ColorPickerTrigger>
              <ColorPickerContent>
                <ColorPickerArea className="h-40 w-full rounded-md border" />
                <div className="mt-4 flex flex-col gap-2">
                  <ColorPickerHueSlider />
                  <ColorPickerAlphaSlider />
                </div>
                <div className="mt-4 flex items-center gap-2">
                  <ColorPickerInput />
                  <ColorPickerEyeDropper />
                </div>
              </ColorPickerContent>
            </ColorPicker>
          </div>

          <div className="space-y-2">
            <p className="font-medium text-xs">Instructions (optional)</p>
            <p className="text-muted-foreground text-xs">
              Tell Gemini what else to change before removal, e.g. "also remove
              the chair" or "keep only the person"
            </p>
            <Textarea
              className="resize-none text-sm"
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Optional: leave blank to just replace the background"
              rows={3}
              value={prompt}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            onClick={() => {
              sounds.click();
              onOpenChange(false);
            }}
            variant="ghost"
          >
            Cancel
          </Button>
          <Button
            onClick={() => {
              sounds.success();
              handleConfirm();
            }}
          >
            Remove Background
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
