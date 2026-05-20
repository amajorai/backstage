import { Button, buttonVariants } from "@repo/ui/button";
import { Checkbox } from "@repo/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ui/dropdown-menu";
import { Input } from "@repo/ui/input";
import { Label } from "@repo/ui/label";
import { RadioGroup, RadioGroupItem } from "@repo/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@repo/ui/tooltip";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  ImagePlus,
  Layers,
  Loader2,
  Search,
  Settings,
  Sparkles,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { sileo } from "sileo";
import { EmptyState } from "@/components/gallery/EmptyState";
import { GeminiPromptPanel } from "@/components/gemini/GeminiPromptPanel";
import { GeneratedImageGrid } from "@/components/gemini/GeneratedImageGrid";
import {
  CompareSlider,
  CompareSliderAfter,
  CompareSliderBefore,
  CompareSliderHandle,
} from "@/components/ui/compare-slider";
import { ResizablePanel } from "@/components/ui/resizable-panel";
import { renderLayersToCanvas } from "@/lib/canvas-renderer";
import {
  base64ToDataUrl,
  estimateGenerationCost,
  GEMINI_IMAGE_MODELS,
  type GeminiImageModel,
  generateImageWithGemini,
} from "@/lib/gemini-image";
import { getGeminiApiKey } from "@/lib/gemini-store";
import * as sounds from "@/lib/sounds";
import { thumbnailUrlToDataUrl } from "@/lib/youtube-api";
import type { Layer } from "@/stores/use-editor-store";
import { useFolderStore } from "@/stores/use-folder-store";
import { useGalleryStore } from "@/stores/use-gallery-store";

const GENERATION_COUNTS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

type EditorInputMode = "none" | "composite" | "layers";

interface GeminiImagePageProps {
  editorLayers: Layer[] | null;
  canvasWidth: number;
  canvasHeight: number;
  onClose: () => void;
  onSettings: () => void;
  onSaveAsLayer?: (dataUrl: string) => void;
  onSaveAsImage: (dataUrl: string) => void;
  remixSourceUrl?: string;
  remixTitle?: string;
  fullPage?: boolean;
  onGenerationComplete?: (args: {
    images: string[];
    prompt: string;
    autoPrompt: string;
    model: string;
  }) => void;
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

function buildAutoPrompt({
  hasRemix,
  hasCharacterSet,
  hasInputImages,
}: {
  hasRemix: boolean;
  hasCharacterSet: boolean;
  hasInputImages: boolean;
}): string {
  const parts: string[] = [];
  if (hasRemix) {
    parts.push(
      "Create a new image inspired by this thumbnail. Reimagine it with a fresh, creative take while preserving the core theme and visual style."
    );
  }
  if (hasInputImages && !hasRemix) {
    parts.push(
      "Use the provided image(s) as a visual reference for style and composition."
    );
  }
  if (hasCharacterSet) {
    parts.push(
      "Maintain the exact character appearance, features, and style from the character reference images provided."
    );
  }
  return parts.join(" ");
}

export function GeminiImagePage({
  editorLayers,
  canvasWidth,
  canvasHeight,
  onClose,
  onSettings,
  onSaveAsLayer,
  onSaveAsImage,
  remixSourceUrl,
  remixTitle,
  fullPage = false,
  onGenerationComplete,
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

  const [editorInputMode, setEditorInputMode] = useState<EditorInputMode>(
    isEditorMode ? "composite" : "none"
  );
  const [selectedLayerIds, setSelectedLayerIds] = useState<Set<string>>(
    new Set()
  );
  const [inputPreviewUrl, setInputPreviewUrl] = useState<string | null>(null);

  const [selectedProjectIds, setSelectedProjectIds] = useState<Set<string>>(
    new Set()
  );
  const [projectImages, setProjectImages] = useState<Map<string, string>>(
    new Map()
  );
  const [loadingProjectIds, setLoadingProjectIds] = useState<Set<string>>(
    new Set()
  );
  const [gallerySearchInput, setGallerySearchInput] = useState("");
  const [gallerySearchQuery, setGallerySearchQuery] = useState("");
  const [galleryFolderId, setGalleryFolderId] = useState<string | null>(null);

  const [remixDataUrl, setRemixDataUrl] = useState<string | null>(null);
  const [isLoadingRemix, setIsLoadingRemix] = useState(false);

  const [characterSetFolderId, setCharacterSetFolderId] = useState<
    string | null
  >(null);
  const [characterSetImageIds, setCharacterSetImageIds] = useState<Set<string>>(
    new Set()
  );
  const [characterSetImages, setCharacterSetImages] = useState<
    Map<string, string>
  >(new Map());
  const [loadingCharacterSetIds, setLoadingCharacterSetIds] = useState<
    Set<string>
  >(new Set());

  const galleryThumbnails = useGalleryStore((s) => s.thumbnails);
  const loadPreviewForId = useGalleryStore((s) => s.loadPreviewForId);
  const loadFullImageForId = useGalleryStore((s) => s.loadFullImageForId);
  const previewCache = useGalleryStore((s) => s.previewCache);
  const folders = useFolderStore((s) => s.folders);
  const characterSetFolders = useMemo(
    () => folders.filter((f) => f.isCharacterSet),
    [folders]
  );

  const characterSetThumbnails = useMemo(() => {
    if (!characterSetFolderId) return [];
    return galleryThumbnails.filter((t) => t.folderId === characterSetFolderId);
  }, [galleryThumbnails, characterSetFolderId]);

  useEffect(() => {
    const timer = setTimeout(
      () => setGallerySearchQuery(gallerySearchInput),
      300
    );
    return () => clearTimeout(timer);
  }, [gallerySearchInput]);

  const filteredGalleryThumbnails = useMemo(() => {
    let filtered = galleryThumbnails;
    if (galleryFolderId !== null) {
      filtered = filtered.filter((t) => t.folderId === galleryFolderId);
    }
    if (!gallerySearchQuery.trim()) return filtered;
    const q = gallerySearchQuery.toLowerCase();
    return filtered.filter((t) => t.name.toLowerCase().includes(q));
  }, [galleryThumbnails, gallerySearchQuery, galleryFolderId]);

  useEffect(() => {
    getGeminiApiKey().then(setApiKey);
  }, []);

  useEffect(() => {
    if (!remixSourceUrl) return;
    let cancelled = false;
    setIsLoadingRemix(true);
    thumbnailUrlToDataUrl(remixSourceUrl)
      .then((url) => {
        if (!cancelled) {
          setRemixDataUrl(url);
          setInputPreviewUrl(url);
        }
      })
      .catch(() => {
        if (!cancelled)
          sileo.error({ title: "Failed to load remix thumbnail" });
      })
      .finally(() => {
        if (!cancelled) setIsLoadingRemix(false);
      });
    return () => {
      cancelled = true;
    };
  }, [remixSourceUrl]);

  useEffect(() => {
    if (!characterSetFolderId) {
      setCharacterSetImageIds(new Set());
      setCharacterSetImages(new Map());
      return;
    }
    const ids = characterSetThumbnails.map((t) => t.id);
    setCharacterSetImageIds(new Set(ids));
  }, [characterSetFolderId, characterSetThumbnails]);

  useEffect(() => {
    for (const id of characterSetImageIds) {
      if (characterSetImages.has(id) || loadingCharacterSetIds.has(id))
        continue;
      setLoadingCharacterSetIds((prev) => new Set(prev).add(id));
      loadFullImageForId(id).then((url) => {
        setLoadingCharacterSetIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        if (url) {
          setCharacterSetImages((prev) => new Map(prev).set(id, url));
        }
      });
    }
    setCharacterSetImages((prev) => {
      const next = new Map(prev);
      for (const id of next.keys()) {
        if (!characterSetImageIds.has(id)) next.delete(id);
      }
      return next;
    });
  }, [characterSetImageIds, loadFullImageForId]);

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

  useEffect(() => {
    if (remixSourceUrl) return;
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
      }
      const url = await renderToDataUrl(layers, canvasWidth, canvasHeight);
      if (!cancelled) setInputPreviewUrl(url);
    };

    render();
    return () => {
      cancelled = true;
    };
  }, [
    remixSourceUrl,
    isEditorMode,
    editorInputMode,
    editorLayers,
    selectedLayerIds,
    canvasWidth,
    canvasHeight,
  ]);

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
    let inputImages: string[] = [];

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
      inputImages = Array.from(selectedProjectIds)
        .map((id) => projectImages.get(id))
        .filter((url): url is string => url !== undefined);
    }

    if (remixDataUrl) {
      inputImages = [remixDataUrl, ...inputImages];
    }

    const charImages = Array.from(characterSetImageIds)
      .map((id) => characterSetImages.get(id))
      .filter((url): url is string => url !== undefined);
    if (charImages.length > 0) {
      inputImages = [...inputImages, ...charImages];
    }

    const autoPrompt = buildAutoPrompt({
      hasRemix: !!remixSourceUrl,
      hasCharacterSet: charImages.length > 0,
      hasInputImages: inputImages.length > 0 && !remixSourceUrl,
    });

    if (!(autoPrompt || prompt.trim())) {
      setError("Please enter a prompt");
      return;
    }

    setIsGenerating(true);
    setError(null);
    setGeneratedImages([]);
    setSelectedIndices(new Set());
    setViewingIndex(0);
    setProgress({ current: 0, total: generationCount });

    const results: GeneratedImage[] = [];
    let errorCount = 0;

    const effectivePrompt = [autoPrompt, prompt.trim()]
      .filter(Boolean)
      .join(" ");

    const promises = Array.from({ length: generationCount }, async (_, i) => {
      try {
        const result = await generateImageWithGemini(
          apiKey,
          model,
          effectivePrompt,
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
      sileo.success({
        title: `Generated ${results.length} image${results.length > 1 ? "s" : ""}`,
      });
      onGenerationComplete?.({
        images: results.sort((a, b) => a.index - b.index).map((r) => r.url),
        prompt,
        autoPrompt,
        model,
      });
    }
    if (errorCount > 0) {
      sileo.error({
        title: `${errorCount} generation${errorCount > 1 ? "s" : ""} failed`,
      });
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
    remixDataUrl,
    characterSetImageIds,
    characterSetImages,
    onGenerationComplete,
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
    sileo.success({
      title: `Saved ${selected.length} image${selected.length > 1 ? "s" : ""} as layers`,
    });
    onClose();
  }, [generatedImages, selectedIndices, onSaveAsLayer, onClose]);

  const handleSaveSelectedAsImages = useCallback(() => {
    const selected = generatedImages.filter((_, idx) =>
      selectedIndices.has(idx)
    );
    for (const img of selected) onSaveAsImage(img.url);
    sileo.success({
      title: `Saved ${selected.length} image${selected.length > 1 ? "s" : ""} to gallery`,
    });
    onClose();
  }, [generatedImages, selectedIndices, onSaveAsImage, onClose]);

  const handleSaveAllAsLayers = useCallback(() => {
    if (!onSaveAsLayer) return;
    for (const img of generatedImages) onSaveAsLayer(img.url);
    sileo.success({
      title: `Saved ${generatedImages.length} images as layers`,
    });
    onClose();
  }, [generatedImages, onSaveAsLayer, onClose]);

  const handleSaveAllAsImages = useCallback(() => {
    for (const img of generatedImages) onSaveAsImage(img.url);
    sileo.success({
      title: `Saved ${generatedImages.length} images to gallery`,
    });
    onClose();
  }, [generatedImages, onSaveAsImage, onClose]);

  const hasApiKey = apiKey !== null && apiKey.length > 0;
  const hasGeneratedImages = generatedImages.length > 0;
  const hasSelection = selectedIndices.size > 0;
  const viewingImage = generatedImages[viewingIndex];

  const effectiveInputCount =
    useSelectedAsInput && selectedIndices.size > 0
      ? selectedIndices.size
      : isEditorMode
        ? editorInputMode === "none"
          ? 0
          : editorInputMode === "composite"
            ? 1
            : selectedLayerIds.size
        : selectedProjectIds.size + (remixDataUrl ? 1 : 0);
  const showCompareSlider =
    hasGeneratedImages && effectiveInputCount === 1 && inputPreviewUrl !== null;

  const hasAutoPrompt = useMemo(() => {
    const hasRemix = !!remixSourceUrl;
    const hasCharacterSet = characterSetImageIds.size > 0;
    const hasInputImages = isEditorMode
      ? editorInputMode !== "none"
      : selectedProjectIds.size > 0;
    return hasRemix || hasCharacterSet || hasInputImages;
  }, [
    remixSourceUrl,
    characterSetImageIds,
    isEditorMode,
    editorInputMode,
    selectedProjectIds,
  ]);

  const estimatedCost = estimateGenerationCost(
    model,
    generationCount,
    Math.ceil(prompt.length / 4) || 25
  );

  const characterSetSection = (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1.5">
        <Users className="size-3 text-muted-foreground" />
        <Label className="text-xs">Character Set</Label>
      </div>
      {characterSetFolders.length === 0 ? (
        <p className="text-[10px] text-muted-foreground">
          No character set folders. Right-click a folder → Mark as Character
          Set.
        </p>
      ) : (
        <Select
          onValueChange={(v) =>
            setCharacterSetFolderId(v === "none" ? null : v)
          }
          value={characterSetFolderId ?? "none"}
        >
          <SelectTrigger className="h-7 text-xs">
            <SelectValue>
              {characterSetFolderId == null
                ? "None"
                : (characterSetFolders.find(
                    (f) => f.id === characterSetFolderId
                  )?.name ?? "None")}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">None</SelectItem>
            {characterSetFolders.map((f) => (
              <SelectItem key={f.id} value={f.id}>
                {f.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      {characterSetFolderId && characterSetThumbnails.length > 0 && (
        <div className="flex flex-col gap-1 rounded-md border border-border bg-muted/20 p-2">
          <div className="mb-1 flex items-center justify-between">
            <p className="text-[10px] text-muted-foreground">
              Select images to include
            </p>
            <span className="text-[10px] text-muted-foreground">
              {characterSetImageIds.size}/{characterSetThumbnails.length}
            </span>
          </div>
          <div className="max-h-32 overflow-y-auto">
            {characterSetThumbnails.map((thumb) => (
              <CharacterSetThumb
                id={thumb.id}
                isSelected={characterSetImageIds.has(thumb.id)}
                key={thumb.id}
                loadPreview={loadPreviewForId}
                name={thumb.name}
                onToggle={(id, selected) => {
                  setCharacterSetImageIds((prev) => {
                    const next = new Set(prev);
                    if (selected) next.add(id);
                    else next.delete(id);
                    return next;
                  });
                }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );

  const remixSourceSection = remixSourceUrl ? (
    <div className="flex flex-col gap-2">
      <Label className="text-xs">Remix Source</Label>
      <div className="relative overflow-hidden rounded-md border border-border bg-muted">
        {isLoadingRemix ? (
          <div className="flex h-20 items-center justify-center">
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          </div>
        ) : remixDataUrl ? (
          <img
            alt="Remix source"
            className="aspect-video w-full object-cover"
            draggable={false}
            src={remixDataUrl}
          />
        ) : null}
        {remixTitle && (
          <p className="truncate p-1.5 text-[10px] text-muted-foreground">
            {remixTitle}
          </p>
        )}
      </div>
    </div>
  ) : null;

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
        <div className="flex flex-col gap-1 rounded-md border border-border">
          <div className="border-border border-b px-2 py-1.5">
            <div className="relative">
              <Search className="absolute top-1/2 left-2 size-3 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="h-6 pl-6 text-xs"
                onChange={(e) => setGallerySearchInput(e.target.value)}
                placeholder="Search projects..."
                value={gallerySearchInput}
              />
            </div>
          </div>
          <div className="max-h-40 overflow-y-auto p-1">
            {filteredGalleryThumbnails.length === 0 ? (
              <div className="flex h-16 items-center justify-center text-[10px] text-muted-foreground">
                No projects match your search
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-1">
                {filteredGalleryThumbnails.map((thumb) => (
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
            )}
          </div>
        </div>
      )}
    </div>
  );

  const inputSection = (
    <>
      {remixSourceSection}
      {isEditorMode ? editorInputSection : galleryInputSection}
      {characterSetSection}
    </>
  );

  if (fullPage && !hasApiKey) {
    return (
      <>
        <div className="mx-1 flex flex-1 flex-col overflow-hidden rounded-xl border-2 border-border bg-background">
          <EmptyState
            action={{
              icon: <Settings className="size-4" />,
              label: "Open Settings",
              onClick: onSettings,
            }}
            description="Add your Gemini API key in Settings to generate images with AI."
            icon={<Sparkles className="size-10" />}
            title="Gemini API key required"
          />
        </div>
        <div className="mx-1 mb-1">
          <div className="flex h-12 items-center gap-2 bg-muted px-4">
            <button
              className={buttonVariants({ size: "icon-sm", variant: "ghost" })}
              onClick={() => {
                sounds.click();
                onClose();
              }}
              type="button"
            >
              <ArrowLeft className="size-4" />
            </button>
          </div>
        </div>
      </>
    );
  }

  const toolbarItems = (
    <>
      <Select
        onValueChange={(v) => setModel(v as GeminiImageModel)}
        value={model}
      >
        <SelectTrigger className="!h-8 !bg-transparent min-w-0 max-w-48 flex-1 border-0 px-2">
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
        onValueChange={(v) => setGenerationCount(Number(v))}
        value={String(generationCount)}
      >
        <SelectTrigger className="!h-8 !bg-transparent w-16 shrink-0 border-0 px-2">
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
      <span className="shrink-0 text-[10px] text-muted-foreground">
        ~${estimatedCost.toFixed(3)}
      </span>
      <div className="flex-1" />
      {hasGeneratedImages && hasSelection && (
        <label className="flex cursor-pointer items-center gap-1.5 text-muted-foreground text-xs hover:text-foreground">
          <Checkbox
            checked={useSelectedAsInput}
            onCheckedChange={(checked) =>
              setUseSelectedAsInput(checked === true)
            }
          />
          <span>Use {selectedIndices.size} selected as input</span>
        </label>
      )}
      <Button
        disabled={
          !(hasApiKey && (hasAutoPrompt || prompt.trim())) || isGenerating
        }
        onClick={() => {
          sounds.click();
          handleGenerate();
        }}
        size="default"
      >
        {isGenerating ? (
          <>
            <Loader2 className="mr-2 size-4 animate-spin" />
            {progress.total > 1
              ? `${progress.current}/${progress.total}`
              : "Generating..."}
          </>
        ) : (
          <>Generate</>
        )}
      </Button>
    </>
  );

  return (
    <>
      <div
        className={
          fullPage
            ? "mx-1 flex flex-1 flex-col overflow-hidden rounded-xl border-2 border-border bg-background"
            : "flex h-full flex-col bg-background"
        }
      >
        {/* Header — panel mode only (fullPage uses bottom toolbar for back) */}
        {!fullPage && (
          <div className="flex h-12 shrink-0 items-center px-4">
            <Tooltip>
              <TooltipTrigger
                className={`${buttonVariants({ size: "icon-sm", variant: "ghost" })}`}
                onClick={() => {
                  sounds.click();
                  onClose();
                }}
              >
                <ArrowLeft className="size-4" />
              </TooltipTrigger>
              <TooltipContent>Back</TooltipContent>
            </Tooltip>
            {remixTitle && (
              <span className="ml-2 truncate text-muted-foreground text-xs">
                Remixing: {remixTitle}
              </span>
            )}
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
        )}

        {/* Main content */}
        <div className="flex flex-1 overflow-hidden">
          <ResizablePanel
            defaultWidth={320}
            maxWidth={560}
            minWidth={200}
            side="left"
          >
            <div className="flex h-full flex-col">
              {/* Scrollable prompt + input area */}
              <div className="min-h-0 flex-1">
                <GeminiPromptPanel
                  error={error}
                  hasApiKey={hasApiKey}
                  inputSection={inputSection}
                  isGenerating={isGenerating}
                  onPromptChange={setPrompt}
                  onSettings={onSettings}
                  prompt={prompt}
                />
              </div>
            </div>
          </ResizablePanel>

          {/* Right panel - Preview */}
          <div className="flex flex-1 flex-col overflow-hidden">
            <div className="relative flex flex-1 items-center justify-center overflow-auto bg-background p-6">
              {hasGeneratedImages ? (
                <div className="flex h-full w-full flex-col gap-4">
                  <div className="relative flex-1">
                    {showCompareSlider ? (
                      <CompareSlider className="h-full w-full overflow-hidden rounded-lg border border-border">
                        <CompareSliderAfter>
                          <img
                            alt="Generated"
                            className="h-full w-full object-contain"
                            draggable={false}
                            src={viewingImage?.url}
                          />
                        </CompareSliderAfter>
                        <CompareSliderBefore>
                          <img
                            alt="Input"
                            className="h-full w-full object-contain"
                            draggable={false}
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
                          draggable={false}
                          src={viewingImage?.url}
                        />
                        <span className="pointer-events-none absolute top-3 right-3 z-30 rounded-md border border-border bg-background/80 px-2 py-1 font-medium text-xs backdrop-blur-sm">
                          Version{" "}
                          {generatedImages.length > 1 ? viewingIndex + 1 : ""}
                        </span>
                      </div>
                    )}

                    {generatedImages.length > 1 && (
                      <>
                        <Button
                          className="absolute top-1/2 left-4 -translate-y-1/2"
                          disabled={viewingIndex === 0}
                          onClick={() => {
                            sounds.click();
                            setViewingIndex((i) => i - 1);
                          }}
                          size="icon"
                          variant="secondary"
                        >
                          <ChevronLeft className="size-5" />
                        </Button>
                        <Button
                          className="absolute top-1/2 right-4 -translate-y-1/2"
                          disabled={viewingIndex === generatedImages.length - 1}
                          onClick={() => {
                            sounds.click();
                            setViewingIndex((i) => i + 1);
                          }}
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
                    draggable={false}
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
                      <Button
                        disabled={!hasSelection}
                        size="sm"
                        variant="ghost"
                      >
                        Save Selected ({selectedIndices.size})
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => {
                          sounds.success();
                          handleSaveSelectedAsLayers();
                        }}
                      >
                        <Layers className="mr-2 size-4" />
                        Save as Layers
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => {
                          sounds.success();
                          handleSaveSelectedAsImages();
                        }}
                      >
                        <ImagePlus className="mr-2 size-4" />
                        Save to Gallery
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : (
                  <Button
                    disabled={!hasSelection}
                    onClick={() => {
                      sounds.success();
                      handleSaveSelectedAsImages();
                    }}
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
                      <DropdownMenuItem
                        onClick={() => {
                          sounds.success();
                          handleSaveAllAsLayers();
                        }}
                      >
                        <Layers className="mr-2 size-4" />
                        Save as Layers
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => {
                          sounds.success();
                          handleSaveAllAsImages();
                        }}
                      >
                        <ImagePlus className="mr-2 size-4" />
                        Save to Gallery
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : (
                  <Button
                    onClick={() => {
                      sounds.success();
                      handleSaveAllAsImages();
                    }}
                    size="sm"
                  >
                    Save All ({generatedImages.length})
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Bottom toolbar — panel mode (inside card) */}
        {!fullPage && (
          <div className="flex shrink-0 items-center gap-2 border-border border-t bg-background px-4 py-2">
            {toolbarItems}
          </div>
        )}
      </div>
      {/* Bottom toolbar — full page mode (outside card, in muted area) */}
      {fullPage && (
        <div className="mx-1 mb-1">
          <div className="flex h-12 items-center gap-2 bg-muted px-4">
            <button
              className={buttonVariants({ size: "icon-sm", variant: "ghost" })}
              onClick={() => {
                sounds.click();
                onClose();
              }}
              type="button"
            >
              <ArrowLeft className="size-4" />
            </button>
            <div className="mx-1 h-4 w-px bg-border" />
            {toolbarItems}
          </div>
        </div>
      )}
    </>
  );
}

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
      onClick={() => {
        sounds.select();
        onToggle(id, !isSelected);
      }}
      title={name}
      type="button"
    >
      {preview ? (
        <img
          alt={name}
          className="h-full w-full object-cover"
          draggable={false}
          src={preview}
        />
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

function CharacterSetThumb({
  id,
  name,
  isSelected,
  onToggle,
  loadPreview,
}: {
  id: string;
  name: string;
  isSelected: boolean;
  onToggle: (id: string, selected: boolean) => void;
  loadPreview: (id: string) => Promise<string | null>;
}) {
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadPreview(id).then((url) => {
      if (!cancelled) setPreview(url);
    });
    return () => {
      cancelled = true;
    };
  }, [id, loadPreview]);

  return (
    <label className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 text-xs hover:bg-muted/50">
      <Checkbox
        checked={isSelected}
        onCheckedChange={(checked) => onToggle(id, checked === true)}
      />
      {preview && (
        <img
          alt={name}
          className="size-5 rounded object-cover"
          draggable={false}
          src={preview}
        />
      )}
      <span className="truncate">{name}</span>
    </label>
  );
}
