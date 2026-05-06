import { open, save } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";
import { Loader2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Slider } from "@/components/ui/slider";
import { renderLayersToCanvas } from "@/lib/canvas-renderer";
import { exportCanvasFramesToGif } from "@/lib/gif-encoder";
import { cn } from "@/lib/utils";
import { exportCanvasFramesToMp4 } from "@/lib/video-encoder";
import { useEditorStore } from "@/stores/use-editor-store";
import {
  type ThumbnailItem,
  useGalleryStore,
} from "@/stores/use-gallery-store";

interface ExportDialogProps {
  thumbnail?: ThumbnailItem;
  thumbnails?: ThumbnailItem[];
  onClose: () => void;
  useCurrentEditorState?: boolean;
}

type ImageFormat = "png" | "jpeg" | "webp";
type AnimatedFormat = "gif" | "mp4";
type AllFormat = ImageFormat | AnimatedFormat;
type Resolution = string;

function getResolutionPresets(
  width: number,
  height: number
): { value: string; label: string }[] {
  const ratio = width / height;
  const base = [{ value: "original", label: "Original" }];
  const custom = [{ value: "custom", label: "Custom" }];

  if (Math.abs(ratio - 16 / 9) < 0.05) {
    return [
      ...base,
      { value: "3840x2160", label: "3840 × 2160 (4K)" },
      { value: "1920x1080", label: "1920 × 1080 (1080p)" },
      { value: "1280x720", label: "1280 × 720 (720p)" },
      { value: "854x480", label: "854 × 480 (480p)" },
      ...custom,
    ];
  }
  if (Math.abs(ratio - 9 / 16) < 0.05) {
    return [
      ...base,
      { value: "2160x3840", label: "2160 × 3840 (4K)" },
      { value: "1080x1920", label: "1080 × 1920 (1080p)" },
      { value: "720x1280", label: "720 × 1280 (720p)" },
      { value: "480x854", label: "480 × 854 (480p)" },
      ...custom,
    ];
  }
  if (Math.abs(ratio - 1) < 0.05) {
    return [
      ...base,
      { value: "2048x2048", label: "2048 × 2048 (2K)" },
      { value: "1080x1080", label: "1080 × 1080" },
      { value: "720x720", label: "720 × 720" },
      { value: "480x480", label: "480 × 480" },
      ...custom,
    ];
  }
  if (Math.abs(ratio - 4 / 3) < 0.05) {
    return [
      ...base,
      { value: "1440x1080", label: "1440 × 1080" },
      { value: "1280x960", label: "1280 × 960" },
      { value: "960x720", label: "960 × 720" },
      ...custom,
    ];
  }
  if (Math.abs(ratio - 3 / 4) < 0.05) {
    return [
      ...base,
      { value: "1080x1440", label: "1080 × 1440" },
      { value: "960x1280", label: "960 × 1280" },
      { value: "720x960", label: "720 × 960" },
      ...custom,
    ];
  }
  if (Math.abs(ratio - 21 / 9) < 0.05) {
    return [
      ...base,
      { value: "3440x1440", label: "3440 × 1440 (Ultrawide)" },
      { value: "2560x1080", label: "2560 × 1080" },
      ...custom,
    ];
  }
  return [...base, ...custom];
}

const FORMATS: { value: ImageFormat; label: string; mime: string }[] = [
  { value: "png", label: "PNG", mime: "image/png" },
  { value: "jpeg", label: "JPEG", mime: "image/jpeg" },
  { value: "webp", label: "WebP", mime: "image/webp" },
];

const ANIMATED_FORMATS: {
  value: AnimatedFormat;
  label: string;
  mime: string;
}[] = [
  { value: "gif", label: "GIF", mime: "image/gif" },
  { value: "mp4", label: "MP4", mime: "video/mp4" },
];

const parsePageRange = (input: string, totalPages: number): number[] => {
  const indices = new Set<number>();
  const parts = input.split(",");

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    if (trimmed.includes("-")) {
      const [startStr, endStr] = trimmed.split("-");
      const start = Number.parseInt(startStr, 10);
      const end = Number.parseInt(endStr, 10);

      if (!(isNaN(start) || isNaN(end))) {
        const s = Math.max(1, Math.min(start, end));
        const e = Math.min(totalPages, Math.max(start, end));

        for (let i = s; i <= e; i++) {
          indices.add(i - 1);
        }
      }
    } else {
      const page = Number.parseInt(trimmed, 10);
      if (!isNaN(page) && page >= 1 && page <= totalPages) {
        indices.add(page - 1);
      }
    }
  }
  return Array.from(indices).sort((a, b) => a - b);
};

const formatPageSelection = (indices: number[]): string => {
  if (indices.length === 0) return "";
  // Simple comma separated list for now
  return indices.map((i) => i + 1).join(", ");
};

export function ExportDialog({
  thumbnail,
  thumbnails,
  onClose,
  useCurrentEditorState = false,
}: ExportDialogProps) {
  const isBatchMode = !!thumbnails && thumbnails.length > 1;
  const primaryThumbnail = thumbnail ?? thumbnails?.[0];
  const [format, setFormat] = useState<AllFormat>("png");
  const [resolution, setResolution] = useState<Resolution>("original");
  const [customWidth, setCustomWidth] = useState(1920);
  const [customHeight, setCustomHeight] = useState(1080);
  const [quality, setQuality] = useState(90);
  const [fps, setFps] = useState(15); // For animated export
  const [isExporting, setIsExporting] = useState(false);
  const [hasAnimatedLayers, setHasAnimatedLayers] = useState(false);

  // Load full image from file storage
  const loadFullImageForId = useGalleryStore((s) => s.loadFullImageForId);
  const loadLayerDataForId = useGalleryStore((s) => s.loadLayerDataForId);
  const [fullImageUrl, setFullImageUrl] = useState<string | null>(null);
  const [pages, setPages] = useState<any[] | null>(null);

  // Selection state
  const [exportScope, setExportScope] = useState<"current" | "all" | "custom">(
    "all"
  );
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
  const [customRange, setCustomRange] = useState("");

  const [isLoadingImage, setIsLoadingImage] = useState(!isBatchMode);
  const [originalDimensions, setOriginalDimensions] = useState({
    width: primaryThumbnail?.canvasWidth || 1920,
    height: primaryThumbnail?.canvasHeight || 1080,
  });

  const resolutionPresets = useMemo(
    () =>
      getResolutionPresets(originalDimensions.width, originalDimensions.height),
    [originalDimensions.width, originalDimensions.height]
  );

  // Load the full image on mount (single mode only)
  useEffect(() => {
    if (isBatchMode || !primaryThumbnail) return;
    const cancelled = false;
    setIsLoadingImage(true);

    loadFullImageForId(primaryThumbnail.id).then((url) => {
      if (cancelled || !url) {
        setIsLoadingImage(false);
        return;
      }

      // Get dimensions from the loaded image
      const img = new Image();
      img.onload = () => {
        if (!cancelled) {
          setFullImageUrl(url);
          setOriginalDimensions({
            width: img.naturalWidth,
            height: img.naturalHeight,
          });
          setIsLoadingImage(false);
        }
      };
      img.src = url;
    });
  }, [primaryThumbnail?.id, loadFullImageForId, isBatchMode]);

  useEffect(() => {
    if (isBatchMode || !primaryThumbnail) return;
    let cancelled = false;

    const loadData = async () => {
      let items: any[] = [];
      let srcWidth = 0;
      let srcHeight = 0;

      if (useCurrentEditorState) {
        const state = useEditorStore.getState();
        items = state.pages;
        if (items.length > 0) {
          srcWidth = state.canvasWidth;
          srcHeight = state.canvasHeight;
          toast.info("Using live editor state");
        }
      } else {
        const data = await loadLayerDataForId(primaryThumbnail.id);
        if (cancelled) return;

        if (data && data.length > 0) {
          items = data;
          srcWidth = primaryThumbnail.canvasWidth || 0;
          srcHeight = primaryThumbnail.canvasHeight || 0;
        }
      }

      if (items.length > 0) {
        setPages(items);

        if (!(srcWidth && srcHeight) && primaryThumbnail.id) {
          const url = await loadFullImageForId(primaryThumbnail.id);
          if (url && !cancelled) {
            const img = new Image();
            img.src = url;
            await new Promise((r) => {
              img.onload = r;
            });
            srcWidth = img.naturalWidth;
            srcHeight = img.naturalHeight;
          }
        }

        if (srcWidth && srcHeight) {
          setOriginalDimensions({ width: srcWidth, height: srcHeight });

          try {
            const canvas = document.createElement("canvas");
            canvas.width = srcWidth;
            canvas.height = srcHeight;
            renderLayersToCanvas(
              items[0].layers,
              srcWidth,
              srcHeight,
              canvas
            ).then(() => {
              setFullImageUrl(canvas.toDataURL());
              setIsLoadingImage(false);
            });
          } catch (e) {
            console.error("Failed to generate preview", e);
            setIsLoadingImage(false);
          }
        }

        const allIndices = items.map((_, i) => i);
        setSelectedIndices(allIndices);
        setCustomRange(formatPageSelection(allIndices));

        const hasAnimated = items.some((page) =>
          page.layers.some((layer: any) => layer.type === "animated-image")
        );
        setHasAnimatedLayers(hasAnimated);
      }
    };

    loadData();

    return () => {
      cancelled = true;
    };
  }, [
    primaryThumbnail?.id,
    primaryThumbnail?.canvasWidth,
    primaryThumbnail?.canvasHeight,
    loadFullImageForId,
    loadLayerDataForId,
    useCurrentEditorState,
    isBatchMode,
  ]);

  const getFinalDimensions = useCallback(() => {
    if (resolution === "original") {
      return originalDimensions;
    }
    if (resolution === "custom") {
      return { width: customWidth, height: customHeight };
    }
    const [w, h] = resolution.split("x").map(Number);
    return { width: w, height: h };
  }, [resolution, customWidth, customHeight, originalDimensions]);

  const handleExportBatch = useCallback(async () => {
    if (!pages || pages.length === 0) return;

    let indicesToExport: number[] = [];
    if (exportScope === "all") {
      indicesToExport = pages.map((_, i) => i);
    } else if (exportScope === "custom") {
      indicesToExport = selectedIndices;
    } else if (exportScope === "current") {
      indicesToExport = [0];
    }

    if (indicesToExport.length === 0) {
      toast.error("No pages selected");
      return;
    }

    const isSingleFile = indicesToExport.length === 1;

    setIsExporting(true);
    try {
      let exportPath = "";
      let dirPath = "";
      const formatInfo = FORMATS.find((f) => f.value === format)!;
      const dims = getFinalDimensions();

      if (isSingleFile) {
        const pageIndex = indicesToExport[0];
        const defaultName = `${primaryThumbnail?.name ?? "export"}${pages.length > 1 ? `_page_${pageIndex + 1}` : ""}.${format}`;

        const saveResult = await save({
          defaultPath: defaultName,
          filters: [{ name: formatInfo.label, extensions: [format] }],
        });

        if (!saveResult) {
          setIsExporting(false);
          return;
        }
        exportPath = saveResult;
      } else {
        const dirResult = await open({
          directory: true,
          title: "Select Export Directory",
        });

        if (!dirResult || typeof dirResult !== "string") {
          setIsExporting(false);
          return;
        }
        dirPath = dirResult;
      }

      const canvas = document.createElement("canvas");
      canvas.width = dims.width;
      canvas.height = dims.height;

      const toastId = isSingleFile
        ? toast.loading("Exporting...")
        : toast.loading(`Exporting ${indicesToExport.length} slides...`);

      // Prepare canvas context once
      const ctx = canvas.getContext("2d")!;

      // Calculate scale if rendering at different resolution
      const sourceW = originalDimensions.width || dims.width;
      const sourceH = originalDimensions.height || dims.height;
      const scaleX = dims.width / sourceW;
      const scaleY = dims.height / sourceH;
      const needsScaling = scaleX !== 1 || scaleY !== 1;

      for (let i = 0; i < indicesToExport.length; i++) {
        const pageIndex = indicesToExport[i];
        const page = pages[pageIndex];

        if (!isSingleFile) {
          toast.loading(`Exporting slide ${pageIndex + 1}...`, {
            id: toastId,
          });
        }

        if (needsScaling) {
          ctx.save();
          ctx.scale(scaleX, scaleY);
        }

        await renderLayersToCanvas(page.layers, sourceW, sourceH, canvas);

        if (needsScaling) {
          ctx.restore();
        }

        const blob = await new Promise<Blob>((resolve) => {
          canvas.toBlob(
            (b) => resolve(b!),
            formatInfo.mime,
            format === "png" ? undefined : quality / 100
          );
        });

        const arrayBuffer = await blob.arrayBuffer();

        let filePath = exportPath;
        if (!isSingleFile) {
          const fileName = `${primaryThumbnail?.name ?? "export"}_page_${String(pageIndex + 1).padStart(2, "0")}.${format}`;
          filePath = `${dirPath.replace(/[\\/]$/, "")}/${fileName}`;
        }

        await writeFile(filePath, new Uint8Array(arrayBuffer));
      }

      toast.success(
        isSingleFile
          ? "Export successful"
          : `Successfully exported ${indicesToExport.length} slides`,
        {
          id: toastId,
        }
      );
      onClose();
    } catch (error) {
      console.error("Export failed:", error);
      toast.error("Export failed. Check console.");
    } finally {
      setIsExporting(false);
    }
  }, [
    pages,
    format,
    getFinalDimensions,
    quality,
    onClose,
    exportScope,
    selectedIndices,
    primaryThumbnail?.name,
    originalDimensions,
  ]);

  // Animated export handler for GIF/MP4
  const handleExportAnimated = useCallback(async () => {
    if (!pages || pages.length === 0) return;

    // For animated export, we use the first selected page or all pages
    let indicesToExport: number[] = [];
    if (exportScope === "all") {
      indicesToExport = pages.map((_, i) => i);
    } else if (exportScope === "custom") {
      indicesToExport = selectedIndices;
    } else {
      indicesToExport = [0];
    }

    if (indicesToExport.length === 0) {
      toast.error("No pages selected");
      return;
    }

    const dims = getFinalDimensions();
    // Calculate scale
    const sourceW = originalDimensions.width || dims.width;
    const sourceH = originalDimensions.height || dims.height;
    const scaleX = dims.width / sourceW;
    const scaleY = dims.height / sourceH;
    const needsScaling = scaleX !== 1 || scaleY !== 1;

    const isGif = format === "gif";
    const extension = isGif ? "gif" : "mp4";
    const mimeType = isGif ? "image/gif" : "video/mp4";

    // For animated export, we export each page as a separate animated file
    const isSingleFile = indicesToExport.length === 1;

    setIsExporting(true);
    const toastId = toast.loading(
      `Preparing ${extension.toUpperCase()} export...`
    );

    try {
      let dirPath = "";
      let singleFilePath = "";

      if (isSingleFile) {
        const saveResult = await save({
          defaultPath: `${primaryThumbnail?.name ?? "export"}.${extension}`,
          filters: [{ name: extension.toUpperCase(), extensions: [extension] }],
        });
        if (!saveResult) {
          setIsExporting(false);
          toast.dismiss(toastId);
          return;
        }
        singleFilePath = saveResult;
      } else {
        const dirResult = await open({
          directory: true,
          title: "Select Export Directory",
        });
        if (!dirResult || typeof dirResult !== "string") {
          setIsExporting(false);
          toast.dismiss(toastId);
          return;
        }
        dirPath = dirResult;
      }

      // Process each selected page
      for (const pageIndex of indicesToExport) {
        // ... (rest of animated loop)
        const page = pages[pageIndex];

        // --- PREPARE FRAMES ---
        // We need to capture frames for the animation duration
        // Find max duration or default
        const animatedLayer = page.layers.find(
          (l) => l.type === "animated-image"
        ) as any;
        const totalDuration = animatedLayer
          ? animatedLayer.delays.reduce((a: number, b: number) => a + b, 0)
          : 0; // If no animated layer, what to do? Maybe just 1 frame?

        // If totalDuration is 0 (no animation), default to 1 sec?
        // But logic below handles frames.

        const frameCount = animatedLayer?.frames?.length || Math.floor(fps * 2); // default 2 sec if no explicit animation?
        const durationMs = totalDuration || 2000;

        const frameInterval = 1000 / fps;
        const capturedFrames: { canvas: HTMLCanvasElement; delay: number }[] =
          [];

        for (let time = 0; time < durationMs; time += frameInterval) {
          // Update progress
          toast.loading(
            `Capturing frames... ${Math.round((time / durationMs) * 100)}%`,
            { id: toastId }
          );

          const elapsedTime = time;

          // Create a conceptual frame layer list
          const layersForFrame = page.layers.map((layer: any) => {
            if (layer.type === "animated-image") {
              // Calculate which frame to show
              let accumulated = 0;
              let currentFrameIdx = 0;
              for (let i = 0; i < layer.delays.length; i++) {
                accumulated += layer.delays[i];
                if (elapsedTime < accumulated) {
                  currentFrameIdx = i;
                  break;
                }
                if (i === layer.delays.length - 1) {
                  // Loop back
                  currentFrameIdx =
                    Math.floor(elapsedTime / accumulated) % layer.frames.length;
                }
              }
              return {
                ...layer,
                type: "image",
                dataUrl: layer.frames[currentFrameIdx],
              };
            }
            return layer;
          });

          // Render this frame
          const frameCanvas = document.createElement("canvas");
          frameCanvas.width = dims.width;
          frameCanvas.height = dims.height;
          const frameCtx = frameCanvas.getContext("2d")!;

          if (needsScaling) {
            frameCtx.save();
            frameCtx.scale(scaleX, scaleY);
          }

          await renderLayersToCanvas(
            layersForFrame,
            sourceW,
            sourceH,
            frameCanvas
          );

          if (needsScaling) {
            frameCtx.restore();
          }

          capturedFrames.push({
            canvas: frameCanvas,
            delay: frameInterval,
          });
        }

        // Encode based on format (GIF/MP4) follows...
        let blob: Blob;
        if (isGif) {
          blob = await exportCanvasFramesToGif(capturedFrames, {
            width: dims.width,
            height: dims.height,
            fps,
          });
        } else {
          // ... MP4 encoding
          blob = await exportCanvasFramesToMp4(
            capturedFrames,
            { width: dims.width, height: dims.height, fps },
            (p) =>
              toast.loading(`Encoding MP4... ${Math.round(p * 100)}%`, {
                id: toastId,
              })
          );
        }

        // Write file
        const arrayBuffer = await blob.arrayBuffer();
        let filePath = singleFilePath;
        if (!isSingleFile) {
          const fileName = `${primaryThumbnail?.name ?? "export"}_page_${String(pageIndex + 1).padStart(2, "0")}.${extension}`;
          filePath = `${dirPath.replace(/[\\/]$/, "")}/${fileName}`;
        }
        await writeFile(filePath, new Uint8Array(arrayBuffer));
      }

      toast.success(
        isSingleFile
          ? `${extension.toUpperCase()} export successful`
          : `Successfully exported ${indicesToExport.length} ${extension.toUpperCase()} files`,
        { id: toastId }
      );
      onClose();
    } catch (error) {
      console.error("Animated export failed:", error);
      toast.error(`${extension.toUpperCase()} export failed. Check console.`, {
        id: toastId,
      });
    } finally {
      setIsExporting(false);
    }
  }, [
    pages,
    format,
    getFinalDimensions,
    fps,
    onClose,
    exportScope,
    selectedIndices,
    primaryThumbnail?.name,
    originalDimensions,
  ]);

  const handleMultiThumbnailExport = useCallback(async () => {
    if (!thumbnails || thumbnails.length === 0) return;

    const dirResult = await open({
      directory: true,
      title: "Select Export Directory",
    });
    if (!dirResult || typeof dirResult !== "string") return;

    setIsExporting(true);
    const toastId = toast.loading(
      `Exporting ${thumbnails.length} thumbnails...`
    );
    const formatInfo = FORMATS.find((f) => f.value === format)!;

    try {
      for (let i = 0; i < thumbnails.length; i++) {
        const thumb = thumbnails[i];
        toast.loading(
          `Exporting ${i + 1}/${thumbnails.length}: ${thumb.name}...`,
          { id: toastId }
        );

        const srcW = thumb.canvasWidth || originalDimensions.width;
        const srcH = thumb.canvasHeight || originalDimensions.height;

        let exportW: number;
        let exportH: number;
        if (resolution === "original") {
          exportW = srcW;
          exportH = srcH;
        } else {
          const fixed = getFinalDimensions();
          exportW = fixed.width;
          exportH = fixed.height;
        }

        const canvas = document.createElement("canvas");
        canvas.width = exportW;
        canvas.height = exportH;
        const ctx = canvas.getContext("2d")!;

        const scaleX = exportW / srcW;
        const scaleY = exportH / srcH;

        if (scaleX !== 1 || scaleY !== 1) {
          ctx.save();
          ctx.scale(scaleX, scaleY);
        }

        const data = await loadLayerDataForId(thumb.id);
        if (data && data.length > 0) {
          const firstPage =
            "layers" in data[0] ? (data[0] as any).layers : data;
          await renderLayersToCanvas(firstPage, srcW, srcH, canvas);
        } else {
          const url = await loadFullImageForId(thumb.id);
          if (url) {
            const img = new Image();
            img.src = url;
            await new Promise((r) => {
              img.onload = r;
            });
            ctx.drawImage(img, 0, 0, srcW, srcH);
          }
        }

        if (scaleX !== 1 || scaleY !== 1) {
          ctx.restore();
        }

        const blob = await new Promise<Blob>((resolve) => {
          canvas.toBlob(
            (b) => resolve(b!),
            formatInfo.mime,
            format === "png" ? undefined : quality / 100
          );
        });

        const buffer = await blob.arrayBuffer();
        const safeName = thumb.name.replace(/[/\\?%*:|"<>]/g, "_");
        await writeFile(
          `${dirResult.replace(/[\\/]$/, "")}/${safeName}.${format}`,
          new Uint8Array(buffer)
        );
      }

      toast.success(`Exported ${thumbnails.length} thumbnails`, {
        id: toastId,
      });
      onClose();
    } catch (err) {
      console.error("Batch export failed:", err);
      toast.error("Export failed. Check console.", { id: toastId });
    } finally {
      setIsExporting(false);
    }
  }, [
    thumbnails,
    format,
    resolution,
    getFinalDimensions,
    quality,
    loadLayerDataForId,
    loadFullImageForId,
    originalDimensions,
    onClose,
  ]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}
      onKeyDown={(e) => e.key === "Escape" && onClose()}
    >
      <div
        className="w-100 rounded-xl border border-border bg-card"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={() => {}}
      >
        <div className="flex items-center justify-between border-border border-b px-5 py-4">
          <h2 className="font-semibold text-lg">
            {isBatchMode
              ? `Export ${thumbnails!.length} Thumbnails`
              : "Export Image"}
          </h2>
          <Button onClick={onClose} size="icon-sm" variant="ghost">
            <X className="size-4" />
          </Button>
        </div>

        <div className="space-y-4 p-5">
          {/* Batch preview grid */}
          {isBatchMode ? (
            <div className="grid grid-cols-4 gap-2 rounded-lg bg-muted/30 p-3">
              {thumbnails!.slice(0, 8).map((t) => (
                <div
                  className="aspect-video overflow-hidden rounded bg-muted"
                  key={t.id}
                >
                  {t.previewUrl && (
                    <img
                      alt={t.name}
                      className="h-full w-full object-cover"
                      src={t.previewUrl}
                    />
                  )}
                </div>
              ))}
              {thumbnails!.length > 8 && (
                <div className="flex aspect-video items-center justify-center rounded bg-muted text-muted-foreground text-xs">
                  +{thumbnails!.length - 8} more
                </div>
              )}
            </div>
          ) : (
            /* Single thumbnail preview */
            <div className="flex aspect-video items-center justify-center overflow-hidden rounded-lg bg-black">
              {isLoadingImage ? (
                <Loader2 className="size-8 animate-spin text-muted-foreground" />
              ) : fullImageUrl ? (
                <img
                  alt={primaryThumbnail?.name}
                  className="h-full w-full object-contain"
                  src={fullImageUrl}
                />
              ) : (
                <span className="text-muted-foreground text-sm">
                  Failed to load image
                </span>
              )}
            </div>
          )}

          {/* Pages Info & Selection (single mode only) */}
          {!isBatchMode && pages && pages.length > 1 && (
            <div className="space-y-3 rounded-lg bg-muted/40 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-sm">Export Scope</h3>
                  <p className="text-muted-foreground text-xs">
                    {pages.length} slides detected
                  </p>
                </div>
              </div>

              <RadioGroup
                className="grid grid-cols-3 gap-2"
                onValueChange={(v) => {
                  const scope = v as "current" | "all" | "custom";
                  setExportScope(scope);
                  if (scope === "all") {
                    const all = pages.map((_, i) => i);
                    setSelectedIndices(all);
                    setCustomRange(formatPageSelection(all));
                  }
                }}
                value={exportScope}
              >
                <div className="flex items-center space-x-2 rounded-md border border-input bg-background/50 p-2 hover:bg-muted">
                  <RadioGroupItem id="scope-current" value="current" />
                  <Label
                    className="cursor-pointer font-normal text-xs"
                    htmlFor="scope-current"
                  >
                    Current (Cover)
                  </Label>
                </div>
                <div className="flex items-center space-x-2 rounded-md border border-input bg-background/50 p-2 hover:bg-muted">
                  <RadioGroupItem id="scope-all" value="all" />
                  <Label
                    className="cursor-pointer font-normal text-xs"
                    htmlFor="scope-all"
                  >
                    All Slides
                  </Label>
                </div>
                <div className="flex items-center space-x-2 rounded-md border border-input bg-background/50 p-2 hover:bg-muted">
                  <RadioGroupItem id="scope-custom" value="custom" />
                  <Label
                    className="cursor-pointer font-normal text-xs"
                    htmlFor="scope-custom"
                  >
                    Custom Range
                  </Label>
                </div>
              </RadioGroup>

              {exportScope === "custom" && (
                <div className="fade-in slide-in-from-top-2 animate-in space-y-3 pt-2 duration-200">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Page Range</Label>
                    <Input
                      className="h-8 bg-background"
                      onChange={(e) => {
                        setCustomRange(e.target.value);
                        setSelectedIndices(
                          parsePageRange(e.target.value, pages.length)
                        );
                      }}
                      placeholder="e.g. 1-3, 5, 8"
                      value={customRange}
                    />
                    <p className="text-[10px] text-muted-foreground">
                      Enter page numbers separated by commas (e.g. "1, 3, 5") or
                      ranges (e.g. "1-5")
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Select Pages</Label>
                    <div className="flex flex-wrap gap-1.5 rounded-md border border-input bg-background/30 p-2">
                      {pages.map((_, i) => (
                        <div
                          className={cn(
                            "flex size-6 cursor-pointer items-center justify-center rounded text-xs transition-colors",
                            selectedIndices.includes(i)
                              ? "bg-primary font-medium text-primary-foreground shadow-sm"
                              : "bg-muted text-muted-foreground hover:bg-muted/80"
                          )}
                          key={i}
                          onClick={() => {
                            const newSet = new Set(selectedIndices);
                            if (newSet.has(i)) {
                              newSet.delete(i);
                            } else {
                              newSet.add(i);
                            }
                            const newIndices = Array.from(newSet).sort(
                              (a, b) => a - b
                            );
                            setSelectedIndices(newIndices);
                            setCustomRange(formatPageSelection(newIndices));
                          }}
                        >
                          {i + 1}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Format */}
          <div>
            <label className="mb-2 block font-medium text-sm">Format</label>
            <div className="flex flex-wrap gap-2">
              {FORMATS.map((f) => (
                <Button
                  className={cn(
                    format === f.value
                      ? "bg-foreground text-background hover:bg-foreground/90"
                      : "border-0"
                  )}
                  key={f.value}
                  onClick={() => setFormat(f.value)}
                  size="sm"
                  variant={format === f.value ? "secondary" : "outline"}
                >
                  {f.label}
                </Button>
              ))}
              {hasAnimatedLayers && (
                <>
                  <div className="h-6 w-px bg-border" />
                  {ANIMATED_FORMATS.map((f) => (
                    <Button
                      className={cn(
                        format === f.value
                          ? "bg-foreground text-background hover:bg-foreground/90"
                          : "border-0"
                      )}
                      key={f.value}
                      onClick={() => setFormat(f.value)}
                      size="sm"
                      variant={format === f.value ? "secondary" : "outline"}
                    >
                      {f.label}
                    </Button>
                  ))}
                </>
              )}
            </div>
            {hasAnimatedLayers && (format === "gif" || format === "mp4") && (
              <p className="mt-2 text-muted-foreground text-xs">
                Animated export will capture all frames from animated layers
              </p>
            )}
          </div>

          {/* Resolution */}
          <div>
            <label className="mb-2 block font-medium text-sm">Resolution</label>
            <select
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              onChange={(e) => setResolution(e.target.value as Resolution)}
              value={resolution}
            >
              {resolutionPresets.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          {/* Custom Resolution */}
          {resolution === "custom" && (
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="mb-1 block text-muted-foreground text-xs">
                  Width
                </label>
                <input
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  onChange={(e) => setCustomWidth(Number(e.target.value))}
                  type="number"
                  value={customWidth}
                />
              </div>
              <div className="flex-1">
                <label className="mb-1 block text-muted-foreground text-xs">
                  Height
                </label>
                <input
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  onChange={(e) => setCustomHeight(Number(e.target.value))}
                  type="number"
                  value={customHeight}
                />
              </div>
            </div>
          )}

          {/* Quality (for JPEG/WebP) */}
          {(format === "jpeg" || format === "webp") && (
            <div>
              <label className="mb-2 flex justify-between font-medium text-sm">
                <span>Quality</span>
                <span className="text-muted-foreground">{quality}%</span>
              </label>
              <Slider
                max={100}
                min={10}
                onValueChange={(vals) => setQuality(vals[0])}
                step={1}
                value={[quality]}
              />
            </div>
          )}

          {/* FPS (for GIF/MP4) */}
          {(format === "gif" || format === "mp4") && (
            <div>
              <label className="mb-2 flex justify-between font-medium text-sm">
                <span>Frame Rate</span>
                <span className="text-muted-foreground">{fps} fps</span>
              </label>
              <Slider
                max={30}
                min={5}
                onValueChange={(vals) => setFps(vals[0])}
                step={5}
                value={[fps]}
              />
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 border-border border-t px-5 py-4">
          <Button onClick={onClose} variant="ghost">
            Cancel
          </Button>
          <Button
            disabled={
              isExporting ||
              (!isBatchMode &&
                (isLoadingImage ||
                  !fullImageUrl ||
                  (exportScope === "custom" && selectedIndices.length === 0)))
            }
            onClick={() => {
              if (isBatchMode) {
                handleMultiThumbnailExport();
              } else if (
                hasAnimatedLayers &&
                (format === "gif" || format === "mp4")
              ) {
                handleExportAnimated();
              } else {
                handleExportBatch();
              }
            }}
          >
            {isExporting
              ? "Exporting..."
              : isBatchMode
                ? `Export ${thumbnails!.length} Thumbnails`
                : exportScope === "current"
                  ? "Export"
                  : `Export (${exportScope === "all" ? pages?.length || 1 : selectedIndices.length})`}
          </Button>
        </div>
      </div>
    </div>
  );
}
