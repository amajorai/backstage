import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  ImagePlus,
  Layers,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { GeminiPromptPanel } from "@/components/gemini/GeminiPromptPanel";
import { GeneratedImageGrid } from "@/components/gemini/GeneratedImageGrid";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  CompareSlider,
  CompareSliderAfter,
  CompareSliderBefore,
  CompareSliderHandle,
} from "@/components/ui/compare-slider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  base64ToDataUrl,
  GEMINI_IMAGE_MODELS,
  type GeminiImageModel,
  generateImageWithGemini,
} from "@/lib/gemini-image";
import { getGeminiApiKey } from "@/lib/gemini-store";

interface GeminiImagePageProps {
  inputImageDataUrl: string | null;
  onClose: () => void;
  onSaveAsLayer?: (dataUrl: string) => void;
  onSaveAsImage: (dataUrl: string) => void;
}

interface GeneratedImage {
  url: string;
  index: number;
}

export function GeminiImagePage({
  inputImageDataUrl,
  onClose,
  onSaveAsLayer,
  onSaveAsImage,
}: GeminiImagePageProps) {
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [model, setModel] = useState<GeminiImageModel>(
    GEMINI_IMAGE_MODELS[0].value
  );
  const [prompt, setPrompt] = useState("");
  const [generationCount, setGenerationCount] = useState(1);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(
    new Set()
  );
  const [viewingIndex, setViewingIndex] = useState(0);
  const [currentInputUrl, setCurrentInputUrl] = useState(inputImageDataUrl);
  const [useCanvasAsInput, setUseCanvasAsInput] = useState(
    inputImageDataUrl !== null
  );
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [useSelectedAsInput, setUseSelectedAsInput] = useState(false);

  useEffect(() => {
    getGeminiApiKey().then(setApiKey);
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (generatedImages.length <= 1) {
        return;
      }
      if ((e.target as HTMLElement).tagName === "TEXTAREA") {
        return;
      }

      if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        setViewingIndex((i) => Math.max(0, i - 1));
      } else if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        setViewingIndex((i) => Math.min(generatedImages.length - 1, i + 1));
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [generatedImages.length]);

  const handleGenerate = useCallback(async () => {
    if (!apiKey) {
      setError("Please configure your Gemini API key first");
      return;
    }
    if (!prompt.trim()) {
      setError("Please enter a prompt");
      return;
    }

    let inputImages: (string | undefined)[] = [
      useCanvasAsInput && currentInputUrl ? currentInputUrl : undefined,
    ];
    if (useSelectedAsInput && selectedIndices.size > 0) {
      inputImages = generatedImages
        .filter((_, idx) => selectedIndices.has(idx))
        .map((img) => img.url);
    }

    setIsGenerating(true);
    setError(null);
    setGeneratedImages([]);
    setSelectedIndices(new Set());
    setViewingIndex(0);
    setProgress({ current: 0, total: generationCount });

    const results: GeneratedImage[] = [];
    let errorCount = 0;
    const primaryInput = inputImages[0];

    const promises = Array.from({ length: generationCount }, async (_, i) => {
      try {
        const result = await generateImageWithGemini(
          apiKey,
          model,
          prompt.trim(),
          primaryInput
        );
        const newImageUrl = base64ToDataUrl(
          result.imageBase64,
          result.mimeType
        );
        results.push({ url: newImageUrl, index: i });
        setProgress((p) => ({ ...p, current: p.current + 1 }));
        setGeneratedImages([...results].sort((a, b) => a.index - b.index));
      } catch (err) {
        errorCount++;
        console.error(`Generation ${i + 1} failed:`, err);
      }
    });

    await Promise.all(promises);

    setIsGenerating(false);
    setUseSelectedAsInput(false);

    if (results.length > 0) {
      if (inputImages[0] && inputImages[0] !== currentInputUrl) {
        setCurrentInputUrl(inputImages[0]);
      }
      toast.success(
        `Generated ${results.length} image${results.length > 1 ? "s" : ""}`
      );
    }
    if (errorCount > 0) {
      toast.error(
        `${errorCount} generation${errorCount > 1 ? "s" : ""} failed`
      );
    }
    if (results.length === 0) {
      setError("All generations failed. Please try again.");
    }
  }, [
    apiKey,
    model,
    prompt,
    currentInputUrl,
    generationCount,
    useCanvasAsInput,
    useSelectedAsInput,
    selectedIndices,
    generatedImages,
  ]);

  const toggleSelection = useCallback((idx: number) => {
    setSelectedIndices((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) {
        next.delete(idx);
      } else {
        next.add(idx);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIndices(new Set(generatedImages.map((_, i) => i)));
  }, [generatedImages]);

  const deselectAll = useCallback(() => {
    setSelectedIndices(new Set());
  }, []);

  const handleSaveSelectedAsLayers = useCallback(() => {
    if (!onSaveAsLayer) return;
    const selected = generatedImages.filter((_, idx) =>
      selectedIndices.has(idx)
    );
    for (const img of selected) {
      onSaveAsLayer(img.url);
    }
    toast.success(
      `Saved ${selected.length} image${selected.length > 1 ? "s" : ""} as layers`
    );
    onClose();
  }, [generatedImages, selectedIndices, onSaveAsLayer, onClose]);

  const handleSaveSelectedAsImages = useCallback(() => {
    const selected = generatedImages.filter((_, idx) =>
      selectedIndices.has(idx)
    );
    for (const img of selected) {
      onSaveAsImage(img.url);
    }
    toast.success(
      `Saved ${selected.length} image${selected.length > 1 ? "s" : ""} to gallery`
    );
    onClose();
  }, [generatedImages, selectedIndices, onSaveAsImage, onClose]);

  const handleSaveAllAsLayers = useCallback(() => {
    if (!onSaveAsLayer) return;
    for (const img of generatedImages) {
      onSaveAsLayer(img.url);
    }
    toast.success(`Saved ${generatedImages.length} images as layers`);
    onClose();
  }, [generatedImages, onSaveAsLayer, onClose]);

  const handleSaveAllAsImages = useCallback(() => {
    for (const img of generatedImages) {
      onSaveAsImage(img.url);
    }
    toast.success(`Saved ${generatedImages.length} images to gallery`);
    onClose();
  }, [generatedImages, onSaveAsImage, onClose]);

  const hasApiKey = apiKey !== null && apiKey.length > 0;
  const hasGeneratedImages = generatedImages.length > 0;
  const hasSelection = selectedIndices.size > 0;
  const viewingImage = generatedImages[viewingIndex];

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Header */}
      <div
        className="flex shrink-0 items-center gap-3 px-3 py-2"
        data-tauri-drag-region
      >
        <Tooltip>
          <TooltipTrigger
            className={`${buttonVariants({
              size: "icon-sm",
              variant: "ghost",
            })} relative z-101`}
            onClick={onClose}
          >
            <ArrowLeft className="size-4" />
          </TooltipTrigger>
          <TooltipContent>Back to Editor</TooltipContent>
        </Tooltip>
        <span className="font-medium text-sm">Generate Images</span>
        {isGenerating && progress.total > 1 && (
          <span className="text-muted-foreground text-xs">
            {progress.current}/{progress.total} generated
          </span>
        )}
        {hasGeneratedImages && hasSelection && (
          <span className="text-muted-foreground text-xs">
            {selectedIndices.size} selected
          </span>
        )}
      </div>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        <GeminiPromptPanel
          error={error}
          generationCount={generationCount}
          hasApiKey={hasApiKey}
          hasCanvasInput={inputImageDataUrl !== null}
          hasGeneratedImages={hasGeneratedImages}
          hasSelection={hasSelection}
          isGenerating={isGenerating}
          model={model}
          onGenerate={handleGenerate}
          onGenerationCountChange={setGenerationCount}
          onModelChange={setModel}
          onPromptChange={setPrompt}
          onUseCanvasAsInputChange={setUseCanvasAsInput}
          onUseSelectedAsInputChange={setUseSelectedAsInput}
          progress={progress}
          prompt={prompt}
          selectedCount={selectedIndices.size}
          useCanvasAsInput={useCanvasAsInput}
          useSelectedAsInput={useSelectedAsInput}
        />

        {/* Right panel - Preview */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="relative flex flex-1 items-center justify-center overflow-auto bg-background p-6">
            {hasGeneratedImages ? (
              <div className="flex h-full w-full flex-col gap-4">
                {/* Main preview / compare slider */}
                <div className="relative flex-1">
                  {useCanvasAsInput && currentInputUrl ? (
                    <CompareSlider className="h-full w-full overflow-hidden rounded-lg border border-border">
                      <CompareSliderAfter>
                        <img
                          alt="Generated"
                          className="h-full w-full object-contain"
                          src={viewingImage?.url}
                        />
                      </CompareSliderAfter>
                      <CompareSliderBefore>
                        <img
                          alt="Original"
                          className="h-full w-full object-contain"
                          src={currentInputUrl}
                        />
                      </CompareSliderBefore>
                      <CompareSliderHandle />
                      <span className="pointer-events-none absolute top-3 left-3 z-30 rounded-md border border-border bg-background/80 px-2 py-1 font-medium text-xs backdrop-blur-sm">
                        Original
                      </span>
                      <span className="pointer-events-none absolute top-3 right-3 z-30 rounded-md border border-border bg-background/80 px-2 py-1 font-medium text-xs backdrop-blur-sm">
                        Version{" "}
                        {generatedImages.length > 1 ? viewingIndex + 1 : ""}
                      </span>
                    </CompareSlider>
                  ) : (
                    <div className="relative h-full w-full overflow-hidden rounded-lg border border-border">
                      <img
                        alt="Generated"
                        className="h-full w-full object-contain"
                        src={viewingImage?.url}
                      />
                      <span className="pointer-events-none absolute top-3 right-3 z-30 rounded-md border border-border bg-background/80 px-2 py-1 font-medium text-xs backdrop-blur-sm">
                        Version{" "}
                        {generatedImages.length > 1 ? viewingIndex + 1 : ""}
                      </span>
                    </div>
                  )}

                  {/* Navigation arrows */}
                  {generatedImages.length > 1 && (
                    <>
                      <Button
                        className="absolute top-1/2 left-4 -translate-y-1/2"
                        disabled={viewingIndex === 0}
                        onClick={() => setViewingIndex((i) => i - 1)}
                        size="icon"
                        variant="secondary"
                      >
                        <ChevronLeft className="size-5" />
                      </Button>
                      <Button
                        className="absolute top-1/2 right-4 -translate-y-1/2"
                        disabled={viewingIndex === generatedImages.length - 1}
                        onClick={() => setViewingIndex((i) => i + 1)}
                        size="icon"
                        variant="secondary"
                      >
                        <ChevronRight className="size-5" />
                      </Button>
                    </>
                  )}
                </div>

                <GeneratedImageGrid
                  images={generatedImages}
                  onDeselectAll={deselectAll}
                  onSelectAll={selectAll}
                  onToggleSelection={toggleSelection}
                  onViewingIndexChange={setViewingIndex}
                  selectedIndices={selectedIndices}
                  viewingIndex={viewingIndex}
                />
              </div>
            ) : currentInputUrl ? (
              <div className="max-h-full max-w-full overflow-hidden rounded-lg border border-border">
                <img
                  alt="Input"
                  className="max-h-[70vh] w-auto object-contain"
                  src={currentInputUrl}
                />
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 text-muted-foreground text-sm">
                <span>Enter a prompt to generate an image from scratch</span>
              </div>
            )}
          </div>

          {/* Footer with save actions */}
          {hasGeneratedImages && (
            <div className="flex shrink-0 items-center justify-end gap-2 bg-background px-4 py-3">
              {onSaveAsLayer ? (
                <DropdownMenu>
                  <DropdownMenuTrigger>
                    <Button disabled={!hasSelection} size="sm" variant="ghost">
                      Save Selected ({selectedIndices.size})
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={handleSaveSelectedAsLayers}>
                      <Layers className="mr-2 size-4" />
                      Save as Layers
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleSaveSelectedAsImages}>
                      <ImagePlus className="mr-2 size-4" />
                      Save to Gallery
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Button
                  disabled={!hasSelection}
                  onClick={handleSaveSelectedAsImages}
                  size="sm"
                  variant="ghost"
                >
                  Save Selected ({selectedIndices.size})
                </Button>
              )}

              {onSaveAsLayer ? (
                <DropdownMenu>
                  <DropdownMenuTrigger>
                    <Button size="sm">
                      Save All ({generatedImages.length})
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={handleSaveAllAsLayers}>
                      <Layers className="mr-2 size-4" />
                      Save as Layers
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleSaveAllAsImages}>
                      <ImagePlus className="mr-2 size-4" />
                      Save to Gallery
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Button onClick={handleSaveAllAsImages} size="sm">
                  Save All ({generatedImages.length})
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
