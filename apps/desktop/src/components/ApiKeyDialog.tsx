import { Button } from "@repo/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/dialog";
import { Input } from "@repo/ui/input";
import { Label } from "@repo/ui/label";
import { openUrl } from "@tauri-apps/plugin-opener";
import { ExternalLink, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { sileo } from "sileo";
import {
  getGeminiApiKey,
  removeGeminiApiKey,
  setGeminiApiKey,
} from "@/lib/gemini-store";
import * as sounds from "@/lib/sounds";

interface ApiKeyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ApiKeyDialog({ open, onOpenChange }: ApiKeyDialogProps) {
  const [apiKey, setApiKey] = useState("");
  const [hasKey, setHasKey] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (open) {
      setIsLoading(true);
      getGeminiApiKey()
        .then((key) => {
          setHasKey(!!key);
          setApiKey("");
        })
        .finally(() => setIsLoading(false));
    }
  }, [open]);

  const handleSave = useCallback(async () => {
    if (!apiKey.trim()) {
      sileo.error({ title: "Please enter an API key" });
      return;
    }
    try {
      await setGeminiApiKey(apiKey.trim());
      setHasKey(true);
      setApiKey("");
      sileo.success({ title: "API key saved securely" });
    } catch (error) {
      console.error("Failed to save API key:", error);
      sileo.error({ title: "Failed to save API key" });
    }
  }, [apiKey]);

  const handleRemove = useCallback(async () => {
    try {
      await removeGeminiApiKey();
      setHasKey(false);
      sileo.success({ title: "API key removed" });
    } catch (error) {
      console.error("Failed to remove API key:", error);
      sileo.error({ title: "Failed to remove API key" });
    }
  }, []);

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Gemini API Key</DialogTitle>
          <DialogDescription>
            Enter your Gemini API key to enable AI image generation features.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="py-4 text-center text-muted-foreground text-sm">
            Loading...
          </div>
        ) : (
          <div className="flex flex-col gap-4 py-2">
            {hasKey ? (
              <div className="flex items-center justify-between rounded-md border border-border bg-muted/50 p-3">
                <div className="flex items-center gap-2 text-sm">
                  <div className="size-2 rounded-full bg-green-500" />
                  <span>API key is configured</span>
                </div>
                <Button
                  onClick={() => {
                    sounds.delete_();
                    handleRemove();
                  }}
                  size="icon-sm"
                  title="Remove API key"
                  variant="ghost"
                >
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <Label className="text-xs" htmlFor="api-key">
                  API Key
                </Label>
                <Input
                  id="api-key"
                  onChange={(e) => setApiKey(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleSave();
                    }
                  }}
                  placeholder="Enter your Gemini API key"
                  type="password"
                  value={apiKey}
                />
              </div>
            )}

            <button
              className="inline-flex cursor-pointer items-center gap-1 bg-transparent p-0 text-muted-foreground text-xs hover:text-foreground hover:underline"
              onClick={() => {
                sounds.click();
                openUrl("https://aistudio.google.com/apikey");
              }}
              type="button"
            >
              <ExternalLink className="size-3" />
              Get your API key from Google AI Studio
            </button>
          </div>
        )}

        <DialogFooter>
          <Button
            onClick={() => {
              sounds.click();
              onOpenChange(false);
            }}
            size="sm"
            variant="ghost"
          >
            {hasKey ? "Close" : "Cancel"}
          </Button>
          {!hasKey && (
            <Button
              disabled={!apiKey.trim()}
              onClick={() => {
                sounds.success();
                handleSave();
              }}
              size="sm"
            >
              Save Key
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
