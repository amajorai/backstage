import { AlertCircle, Loader2 } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { GEMINI_IMAGE_MODELS, type GeminiImageModel } from "@/lib/gemini-image";

const GENERATION_COUNTS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

interface GeminiPromptPanelProps {
  hasApiKey: boolean;
  prompt: string;
  onPromptChange: (prompt: string) => void;
  model: GeminiImageModel;
  onModelChange: (model: GeminiImageModel) => void;
  generationCount: number;
  onGenerationCountChange: (count: number) => void;
  isGenerating: boolean;
  progress: { current: number; total: number };
  error: string | null;
  hasGeneratedImages: boolean;
  hasSelection: boolean;
  selectedCount: number;
  useSelectedAsInput: boolean;
  onUseSelectedAsInputChange: (value: boolean) => void;
  /** Rendered above the prompt textarea — for input image selection UI */
  inputSection?: ReactNode;
  onGenerate: () => void;
}

export function GeminiPromptPanel({
  hasApiKey,
  prompt,
  onPromptChange,
  model,
  onModelChange,
  generationCount,
  onGenerationCountChange,
  isGenerating,
  progress,
  error,
  hasGeneratedImages,
  hasSelection,
  selectedCount,
  useSelectedAsInput,
  onUseSelectedAsInputChange,
  inputSection,
  onGenerate,
}: GeminiPromptPanelProps) {
  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-4">
      {!hasApiKey && (
        <div className="flex items-start gap-2 rounded-md border border-yellow-500/50 bg-yellow-500/10 p-3 text-sm text-yellow-600">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>
            Please configure your Gemini API key in the gallery settings.
          </span>
        </div>
      )}

      {/* Input images section (injected by parent) */}
      {inputSection}

      {/* Prompt Input */}
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

      {/* Error Display */}
      {error && (
        <div className="flex items-start gap-2 overflow-hidden rounded-md border border-destructive/50 bg-destructive/10 p-3 text-destructive text-sm">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span className="overflow-wrap-anywhere min-w-0 break-words">
            {error}
          </span>
        </div>
      )}

      {/* Use selected generated images as input */}
      {hasGeneratedImages && hasSelection && (
        <label className="flex cursor-pointer items-center gap-1.5 text-muted-foreground text-xs hover:text-foreground">
          <Checkbox
            checked={useSelectedAsInput}
            onCheckedChange={(checked) =>
              onUseSelectedAsInputChange(checked === true)
            }
          />
          <span>Use {selectedCount} selected as input</span>
        </label>
      )}

      {/* Generate Button */}
      <Button
        className="w-full"
        disabled={!(hasApiKey && prompt.trim()) || isGenerating}
        onClick={onGenerate}
        size="lg"
      >
        {isGenerating ? (
          <>
            <Loader2 className="mr-2 size-4 animate-spin" />
            {progress.total > 1
              ? `Generating ${progress.current}/${progress.total}...`
              : "Generating..."}
          </>
        ) : (
          <>Generate</>
        )}
      </Button>

      {/* Model and Count selects */}
      <div className="-mt-3 flex flex-col gap-0">
        <Select
          onValueChange={(v) => onModelChange(v as GeminiImageModel)}
          value={model}
        >
          <SelectTrigger
            className="!h-7 !bg-transparent w-full border-0 px-2"
            id="model-select"
          >
            <SelectValue>
              {GEMINI_IMAGE_MODELS.find((m) => m.value === model)?.label}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {GEMINI_IMAGE_MODELS.map((m) => (
              <SelectItem key={m.value} value={m.value}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          disabled={isGenerating}
          onValueChange={(v) => onGenerationCountChange(Number(v))}
          value={String(generationCount)}
        >
          <SelectTrigger
            className="!h-7 !bg-transparent w-20 border-0 px-2"
            id="count-select"
          >
            <SelectValue>{generationCount}×</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {GENERATION_COUNTS.map((count) => (
              <SelectItem key={count} value={String(count)}>
                {count}×
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
