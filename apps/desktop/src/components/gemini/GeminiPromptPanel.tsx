import { Button } from "@repo/ui/button";
import { Label } from "@repo/ui/label";
import { Textarea } from "@repo/ui/textarea";
import { AlertCircle } from "lucide-react";
import type { ReactNode } from "react";

interface GeminiPromptPanelProps {
  hasApiKey: boolean;
  prompt: string;
  onPromptChange: (prompt: string) => void;
  isGenerating: boolean;
  error: string | null;
  /** Rendered above the prompt textarea — for input image selection UI */
  inputSection?: ReactNode;
  onSettings: () => void;
}

export function GeminiPromptPanel({
  hasApiKey,
  prompt,
  onPromptChange,
  isGenerating,
  error,
  inputSection,
  onSettings,
}: GeminiPromptPanelProps) {
  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-4">
      {!hasApiKey && (
        <div className="flex flex-col gap-2 rounded-md border border-yellow-500/50 bg-yellow-500/10 p-3 text-sm text-yellow-600">
          <div className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <span>Gemini API key required to generate images.</span>
          </div>
          <Button
            className="self-start"
            onClick={onSettings}
            size="sm"
            variant="outline"
          >
            Open Settings
          </Button>
        </div>
      )}

      {inputSection}

      <div className="flex flex-1 flex-col gap-2">
        <Label className="text-xs" htmlFor="prompt">
          Prompt
        </Label>
        <Textarea
          className="flex-1 resize-none"
          disabled={!hasApiKey || isGenerating}
          id="prompt"
          onChange={(e) => onPromptChange(e.target.value)}
          placeholder="Describe the image you want to generate..."
          value={prompt}
        />
      </div>

      {error && (
        <div className="flex items-start gap-2 overflow-hidden rounded-md border border-destructive/50 bg-destructive/10 p-3 text-destructive text-sm">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span className="overflow-wrap-anywhere min-w-0 break-words">
            {error}
          </span>
        </div>
      )}
    </div>
  );
}
