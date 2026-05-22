import { Button } from "@repo/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/dialog";
import { Textarea } from "@repo/ui/textarea";
import { Zap } from "lucide-react";
import { useState } from "react";
import * as sounds from "@/lib/sounds";

interface QuickAiEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (prompt: string) => void;
}

export function QuickAiEditDialog({
  open,
  onOpenChange,
  onConfirm,
}: QuickAiEditDialogProps) {
  const [prompt, setPrompt] = useState("");

  const handleConfirm = () => {
    const trimmed = prompt.trim();
    if (!trimmed) return;
    setPrompt("");
    onConfirm(trimmed);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleConfirm();
    }
  };

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="size-4" />
            Quick AI Edit
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <p className="text-muted-foreground text-sm">
            Describe the change you want. Gemini will apply it to the current
            image and save the result as a new layer.
          </p>
          <Textarea
            autoFocus
            className="resize-none text-sm"
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder='e.g. "make the background white" or "add a drop shadow below the subject"'
            rows={4}
            value={prompt}
          />
          <p className="text-muted-foreground text-xs">
            Ctrl+Enter to generate
          </p>
        </div>

        <DialogFooter>
          <Button
            onClick={() => {
              sounds.click();
              setPrompt("");
              onOpenChange(false);
            }}
            variant="ghost"
          >
            Cancel
          </Button>
          <Button
            disabled={!prompt.trim()}
            onClick={() => {
              sounds.success();
              handleConfirm();
            }}
          >
            Generate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
