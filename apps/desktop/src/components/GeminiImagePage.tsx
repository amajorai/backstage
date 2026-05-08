import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  ImagePlus,
  Layers,
  Loader2,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { GeminiPromptPanel } from "@/components/gemini/GeminiPromptPanel";
import { GeneratedImageGrid } from "@/components/gemini/GeneratedImageGrid";
import { Button, buttonVariants } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ResizablePanel } from "@/components/ui/resizable-panel";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { renderLayersToCanvas } from "@/lib/canvas-renderer";
import {
  base64ToDataUrl,
  GEMINI_IMAGE_MODELS,
  type GeminiImageModel,
  generateImageWithGemini,
} from "@/lib/gemini-image";
import { getGeminiApiKey } from "@/lib/gemini-store";
import type { Layer } from "@/stores/use-editor-store";
import { useGalleryStore } from "@/stores/use-gallery-store";

type EditorInputMode = "none" | "composite" | "layers";

interface GeminiImagePageProps {
  editorLayers: Layer[] | null;
  canvasWidth: number;
  canvasHeight: number;
  onClose: () => void;
  onSaveAsLayer?: (dataUrl: string) => void;
  onSaveAsImage: (dataUrl: string) => void;
}

interface GeneratedImage {
  url: string;
  index: number;
}

async function renderToDataUrl(
  layers: Layer[],
  width: number,
  height: number
): Promise<string> {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  await renderLayersToCanvas(layers, width, height, canvas);
  return canvas.toDataURL("image/png");
}

export function GeminiImagePage({
  editorLayers,
  canvasWidth,
  canvasHeight,
  onClose,
  onSaveAsLayer,
  onSaveAsImage,
}: GeminiImagePageProps) {
  const isEditorMode = editorLayers !== null;

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
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [useSelectedAsInput, setUseSelectedAsInput] = useState(false);

  // Editor mode state
  const [editorInputMode, setEditorInputMode] = useState<EditorInputMode>(
    isEditorMode ? "composite" : "none"
  );
  const [selectedLayerIds, setSelectedLayerIds] = useState<Set<string>>(
    new Set()
  );
  const [inputPreviewUrl, setInputPreviewUrl] = useState<string | null>(null);

  // Gallery mode state — track which project thumbnails are selected
  const [selectedProjectIds, setSelectedProjectIds] = useState<Set<string>>(
    new Set()
  );
  const [projectImages, setProjectImages] = useState<Map<string, string>>(
    new Map()
  );
  const [loadingProjectIds, setLoadingProjectIds] = useState<Set<string>>(
    new Set()
  );

  const galleryThumbnails = useGalleryStore((s) => s.thumbnails);
  const loadPreviewForId = useGalleryStore((s) => s.loadPreviewForId);
  const loadFullImageForId = useGalleryStore((s) => s.loadFullImageForId);
  const previewCache = useGalleryStore((s) => s.previewCache);

  useEffect(() => {
    getGeminiApiKey().then(setApiKey);
  }, []);

  // Keyboard navigation for generated images
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (generatedImages.length <= 1) return;
      if ((e.target as HTMLElement).tagName === "TEXTAREA") return;
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

  // Render input preview whenever editor input mode or layer selection changes
  useEffect(() => {
    if (!isEditorMode || editorInputMode === "none") {
      setInputPreviewUrl(null);
      return;
    }

    let cancelled = false;

    const render = async () => {
      let layers: Layer[];
      if (editorInputMode === "composite") {
        layers = editorLayers!;
      } else {
        layers = editorLayers!.filter((l) => selectedLayerIds.has(l.id));
        if (layers.length === 0) {
          setInputPreviewUrl(null);
          return;
        }
        // Composite all selected layers into one preview
        // (individual generation happens at generate time)
      }
      const url = await renderToDataUrl(layers, canvasWidth, canvasHeight);
      if (!cancelled) setInputPreviewUrl(url);
    };

    render();
    return () => {
      cancelled = true;
    };
  }, [
    isEditorMode,
    editorInputMode,
    editorLayers,
    selectedLayerIds,
    canvasWidth,
    canvasHeight,
  ]);

  // Load full images for newly selected projects
  useEffect(() => {
    if (isEditorMode) return;

    for (const id of selectedProjectIds) {
      if (!(projectImages.has(id) || loadingProjectIds.has(id))) {
        setLoadingProjectIds((prev) => new Set(prev).add(id));
        loadFullImageForId(id).then((url) => {
          setLoadingProjectIds((prev) => {
            const next = new Set(prev);
            next.delete(id);
            return next;
          });
          if (url) {
            setProjectImages((prev) => new Map(prev).set(id, url));
          }
        });
      }
    }

    // Remove deselected projects from cache
    setProjectImages((prev) => {
      const next = new Map(prev);
      for (const id of next.keys()) {
        if (!selectedProjectIds.has(id)) next.delete(id);
      }
      return next;
    });
  }, [selectedProjectIds, isEditorMode, loadFullImageForId]);

  const handleGenerate = useCallback(async () => {
    if (!apiKey) {
      setError("Please configure your Gemini API key first");
      return;
    }
    if (!prompt.trim()) {
      setError("Please enter a prompt");
      return;
    }

    let inputImages: string[] = [];

    // useSelectedAsInput overrides all other input sources
    if (useSelectedAsInput && selectedIndices.size > 0) {
      inputImages = generatedImages
        .filter((_, idx) => selectedIndices.has(idx))
        .map((img) => img.url);
    } else if (isEditorMode) {
      if (editorInputMode === "composite") {
        const url = await renderToDataUrl(
          editorLayers!,
          canvasWidth,
          canvasHeight
        );
        inputImages = [url];
      } else if (editorInputMode === "layers" && selectedLayerIds.size > 0) {
        const layers = editorLayers!.filter((l) => selectedLayerIds.has(l.id));
        inputImages = await Promise.all(
          layers.map((layer) =>
            renderToDataUrl([layer], canvasWidth, canvasHeight)
          )
        );
      }
    } else {
      // Gallery mode: composite of each selected project
      inputImages = Array.from(selectedProjectIds)
        .map((id) => projectImages.get(id))
        .filter((url): url is string => url !== undefined);
    }

    setIsGenerating(true);
    setError(null);
    setGeneratedImages([]);
    setSelectedIndices(new Set());
    setViewingIndex(0);
    setProgress({ current: 0, total: generationCount });

    const results: GeneratedImage[] = [];
    let errorCount = 0;

    const promises = Array.from({ length: generationCount }, async (_, i) => {
      try {
        const result = await generateImageWithGemini(
          apiKey,
          model,
          prompt.trim(),
          inputImages.length > 0 ? inputImages : undefined
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
    generationCount,
    useSelectedAsInput,
    selectedIndices,
    generatedImages,
    isEditorMode,
    editorInputMode,
    editorLayers,
    selectedLayerIds,
    canvasWidth,
    canvasHeight,
    selectedProjectIds,
    projectImages,
  ]);

  const toggleSelection = useCallback((idx: number) => {
    setSelectedIndices((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
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
    for (const img of selected) onSaveAsLayer(img.url);
    toast.success(
      `Saved ${selected.length} image${selected.length > 1 ? "s" : ""} as layers`
    );
    onClose();
  }, [generatedImages, selectedIndices, onSaveAsLayer, onClose]);

  const handleSaveSelectedAsImages = useCallback(() => {
    const selected = generatedImages.filter((_, idx) =>
      selectedIndices.has(idx)
    );
    for (const img of selected) onSaveAsImage(img.url);
    toast.success(
      `Saved ${selected.length} image${selected.length > 1 ? "s" : ""} to gallery`
    );
    onClose();
  }, [generatedImages, selectedIndices, onSaveAsImage, onClose]);

  const handleSaveAllAsLayers = useCallback(() => {
    if (!onSaveAsLayer) return;
    for (const img of generatedImages) onSaveAsLayer(img.url);
    toast.success(`Saved ${generatedImages.length} images as layers`);
    onClose();
  }, [generatedImages, onSaveAsLayer, onClose]);

  const handleSaveAllAsImages = useCallback(() => {
    for (const img of generatedImages) onSaveAsImage(img.url);
    toast.success(`Saved ${generatedImages.length} images to gallery`);
    onClose();
  }, [generatedImages, onSaveAsImage, onClose]);

  const hasApiKey = apiKey !== null && apiKey.length > 0;
  const hasGeneratedImages = generatedImages.length > 0;
  const hasSelection = selectedIndices.size > 0;
  const viewingImage = generatedImages[viewingIndex];

  // Single input image → show compare slider
  const effectiveInputCount =
    useSelectedAsInput && selectedIndices.size > 0
      ? selectedIndices.size
      : isEditorMode
        ? editorInputMode === "none"
          ? 0
          : editorInputMode === "composite"
            ? 1
            : selectedLayerIds.size
        : selectedProjectIds.size;
  const showCompareSlider =
    hasGeneratedImages && effectiveInputCount === 1 && inputPreviewUrl !== null;

  // --- Input section UI ---

  const editorInputSection = isEditorMode ? (
    <div className="flex flex-col gap-2">
      <Label className="text-xs">Input Images</Label>
      <RadioGroup
        className="flex flex-col gap-1"
        onValueChange={(v) => setEditorInputMode(v as EditorInputMode)}
        value={editorInputMode}
      >
        <label className="flex cursor-pointer items-center gap-2 rounded-md px-1 py-1 text-xs hover:bg-muted/50">
          <RadioGroupItem value="none" />
          <span>None (generate from scratch)</span>
        </label>
        <label className="flex cursor-pointer items-center gap-2 rounded-md px-1 py-1 text-xs hover:bg-muted/50">
          <RadioGroupItem value="composite" />
          <span>Canvas composite</span>
        </label>
        <label className="flex cursor-pointer items-center gap-2 rounded-md px-1 py-1 text-xs hover:bg-muted/50">
          <RadioGroupItem value="layers" />
          <span>Individual layers</span>
        </label>
      </RadioGroup>

      {editorInputMode === "layers" &&
        editorLayers &&
        editorLayers.length > 0 && (
          <div className="mt-1 flex flex-col gap-1 rounded-md border border-border bg-muted/20 p-2">
            <p className="mb-1 text-[10px] text-muted-foreground">
              Each selected layer becomes a separate image input.
            </p>
            {editorLayers.map((layer) => (
              <label
                className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 text-xs hover:bg-muted/50"
                key={layer.id}
              >
                <Checkbox
                  checked={selectedLayerIds.has(layer.id)}
                  onCheckedChange={(checked) => {
                    setSelectedLayerIds((prev) => {
                      const next = new Set(prev);
                      if (checked) next.add(layer.id);
                      else next.delete(layer.id);
                      return next;
                    });
                  }}
                />
                <span className="truncate">{layer.name || "Layer"}</span>
                <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">
                  {layer.type}
                </span>
              </label>
            ))}
          </div>
        )}
    </div>
  ) : null;

  const galleryInputSection = isEditorMode ? null : (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs">Input Projects</Label>
        {selectedProjectIds.size > 0 && (
          <span className="text-[10px] text-muted-foreground">
            {selectedProjectIds.size} selected
          </span>
        )}
      </div>
      {galleryThumbnails.length === 0 ? (
        <p className="text-[10px] text-muted-foreground">
          No projects in gallery.
        </p>
      ) : (
        <div className="max-h-40 overflow-y-auto rounded-md border border-border">
          <div className="grid grid-cols-2 gap-1 p-1">
            {galleryThumbnails.map((thumb) => (
              <ProjectThumbnailCheckbox
                id={thumb.id}
                isLoading={loadingProjectIds.has(thumb.id)}
                isSelected={selectedProjectIds.has(thumb.id)}
                key={thumb.id}
                loadPreview={loadPreviewForId}
                name={thumb.name}
                onToggle={(id, selected) => {
                  setSelectedProjectIds((prev) => {
                    const next = new Set(prev);
                    if (selected) next.add(id);
                    else next.delete(id);
                    return next;
                  });
                }}
                previewUrl={previewCache.get(thumb.id) ?? thumb.previewUrl}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );

  const inputSection = isEditorMode ? editorInputSection : galleryInputSection;

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Header */}
      <div className="flex h-12 shrink-0 items-center px-4">
        <Tooltip>
          <TooltipTrigger
            className={`${buttonVariants({ size: "icon-sm", variant: "ghost" })}`}
            onClick={onClose}
          >
            <ArrowLeft className="size-4" />
          </TooltipTrigger>
          <TooltipContent>Back</TooltipContent>
        </Tooltip>
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
        <ResizablePanel
          defaultWidth={320}
          maxWidth={560}
          minWidth={200}
          side="left"
        >
          <GeminiPromptPanel
            error={error}
            generationCount={generationCount}
            hasApiKey={hasApiKey}
            hasGeneratedImages={hasGeneratedImages}
            hasSelection={hasSelection}
            inputSection={inputSection}
            isGenerating={isGenerating}
            model={model}
            onGenerate={handleGenerate}
            onGenerationCountChange={setGenerationCount}
            onModelChange={setModel}
            onPromptChange={setPrompt}
            onUseSelectedAsInputChange={setUseSelectedAsInput}
            progress={progress}
            prompt={prompt}
            selectedCount={selectedIndices.size}
            useSelectedAsInput={useSelectedAsInput}
          />
        </ResizablePanel>

        {/* Right panel - Preview */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="relative flex flex-1 items-center justify-center overflow-auto bg-background p-6">
            {hasGeneratedImages ? (
              <div className="flex h-full w-full flex-col gap-4">
                {/* Main preview / compare slider */}
                <div className="relative flex-1">
                  {showCompareSlider ? (
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
                          alt="Input"
                          className="h-full w-full object-contain"
                          src={inputPreviewUrl!}
                        />
                      </CompareSliderBefore>
                      <CompareSliderHandle />
                      <span className="pointer-events-none absolute top-3 left-3 z-30 rounded-md border border-border bg-background/80 px-2 py-1 font-medium text-xs backdrop-blur-sm">
                        Input
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
            ) : inputPreviewUrl ? (
              <div className="max-h-full max-w-full overflow-hidden rounded-lg border border-border">
                <img
                  alt="Input"
                  className="max-h-[70vh] w-auto object-contain"
                  src={inputPreviewUrl}
                />
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 text-muted-foreground text-sm">
                <span>Enter a prompt to generate an image</span>
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

// Small helper component for gallery project thumbnail with checkbox
function ProjectThumbnailCheckbox({
  id,
  name,
  previewUrl,
  isSelected,
  isLoading,
  onToggle,
  loadPreview,
}: {
  id: string;
  name: string;
  previewUrl?: string;
  isSelected: boolean;
  isLoading: boolean;
  onToggle: (id: string, selected: boolean) => void;
  loadPreview: (id: string) => Promise<string | null>;
}) {
  const [preview, setPreview] = useState<string | null>(previewUrl ?? null);

  useEffect(() => {
    if (preview) return;
    let cancelled = false;
    loadPreview(id).then((url) => {
      if (!cancelled) setPreview(url);
    });
    return () => {
      cancelled = true;
    };
  }, [id, preview, loadPreview]);

  return (
    <button
      className={`relative aspect-video w-full cursor-pointer overflow-hidden rounded border-2 transition-colors ${
        isSelected ? "border-primary" : "border-transparent hover:border-border"
      }`}
      onClick={() => onToggle(id, !isSelected)}
      title={name}
      type="button"
    >
      {preview ? (
        <img alt={name} className="h-full w-full object-cover" src={preview} />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-muted">
          {isLoading ? (
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          ) : (
            <span className="text-[10px] text-muted-foreground">
              No preview
            </span>
          )}
        </div>
      )}
      {isSelected && (
        <div className="absolute top-1 right-1 flex size-4 items-center justify-center rounded-full bg-primary">
          <svg
            className="size-2.5 text-primary-foreground"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              clipRule="evenodd"
              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
              fillRule="evenodd"
            />
          </svg>
        </div>
      )}
    </button>
  );
}
