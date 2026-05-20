import { Button } from "@repo/ui/button";
import { convertFileSrc } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { X } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import * as sounds from "@/lib/sounds";
import { useGalleryStore } from "@/stores/use-gallery-store";

interface VideoExtractorProps {
  onClose: () => void;
}

interface SelectedFrame {
  id: string;
  dataUrl: string;
  timestamp: number;
}

export function VideoExtractor({ onClose }: VideoExtractorProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [selectedFrames, setSelectedFrames] = useState<SelectedFrame[]>([]);
  const [previewFrame, setPreviewFrame] = useState<SelectedFrame | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const addThumbnail = useGalleryStore((s) => s.addThumbnail);

  const handleSelectVideo = useCallback(async () => {
    const selected = await open({
      multiple: false,
      filters: [
        {
          name: "Videos",
          extensions: ["mp4", "webm", "mov", "avi", "mkv"],
        },
      ],
    });

    if (selected) {
      const assetUrl = convertFileSrc(selected as string);
      setVideoSrc(assetUrl);
      setSelectedFrames([]);
      setPreviewFrame(null);
    }
  }, []);

  const handleLoadedMetadata = useCallback(() => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  }, []);

  const handleTimeUpdate = useCallback(() => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  }, []);

  const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const time = Number.parseFloat(e.target.value);
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  }, []);

  const captureCurrentFrame = useCallback((): string | null => {
    if (!(videoRef.current && canvasRef.current)) return null;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (video.videoWidth === 0 || video.videoHeight === 0) return null;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    try {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL("image/png");
    } catch {
      return null;
    }
  }, []);

  const handleAddFrame = useCallback(() => {
    const dataUrl = captureCurrentFrame();
    if (!dataUrl) return;
    const frame: SelectedFrame = {
      id: crypto.randomUUID(),
      dataUrl,
      timestamp: currentTime,
    };
    setSelectedFrames((prev) => [...prev, frame]);
  }, [captureCurrentFrame, currentTime]);

  const handleRemoveFrame = useCallback((id: string) => {
    setSelectedFrames((prev) => prev.filter((f) => f.id !== id));
    setPreviewFrame((prev) => (prev?.id === id ? null : prev));
  }, []);

  const handleImport = useCallback(async () => {
    setIsImporting(true);
    for (const frame of selectedFrames) {
      await addThumbnail(frame.dataUrl, `Frame ${formatTime(frame.timestamp)}`);
    }
    onClose();
  }, [selectedFrames, addThumbnail, onClose]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div
      className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}
      onKeyDown={(e) => e.key === "Escape" && onClose()}
    >
      <div
        className="flex w-[800px] max-w-[90vw] flex-col overflow-hidden rounded-xl border border-border bg-card"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={() => {}}
      >
        <div className="flex items-center justify-between border-border border-b px-5 py-4">
          <h2 className="font-semibold text-lg">Extract Frames</h2>
          <Button
            onClick={() => {
              sounds.click();
              onClose();
            }}
            size="icon-sm"
            variant="ghost"
          >
            <X className="size-4" />
          </Button>
        </div>

        <div className="p-5">
          {videoSrc ? (
            <>
              {previewFrame ? (
                <div className="relative aspect-video overflow-hidden rounded-lg bg-black">
                  <img
                    alt={`Frame at ${formatTime(previewFrame.timestamp)}`}
                    className="h-full w-full object-contain"
                    src={previewFrame.dataUrl}
                  />
                  <button
                    className="absolute top-2 right-2 flex items-center gap-1 rounded bg-black/60 px-2 py-1 text-white text-xs hover:bg-black/80"
                    onClick={() => {
                      sounds.click();
                      setPreviewFrame(null);
                    }}
                    type="button"
                  >
                    <X className="size-3" />
                    Back to video
                  </button>
                </div>
              ) : (
                <div className="aspect-video overflow-hidden rounded-lg bg-black">
                  <video
                    className="h-full w-full object-contain"
                    crossOrigin="anonymous"
                    onLoadedMetadata={handleLoadedMetadata}
                    onTimeUpdate={handleTimeUpdate}
                    ref={videoRef}
                    src={videoSrc}
                  />
                </div>
              )}

              {!previewFrame && (
                <div className="mt-4">
                  <input
                    className="h-2 w-full cursor-pointer appearance-none rounded-full [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:cursor-grab [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary"
                    max={duration || 100}
                    min={0}
                    onChange={handleSeek}
                    step={0.01}
                    style={{
                      background: `linear-gradient(to right, #38bdf8 ${duration ? (currentTime / duration) * 100 : 0}%, var(--muted) ${duration ? (currentTime / duration) * 100 : 0}%)`,
                    }}
                    type="range"
                    value={currentTime}
                  />
                  <div className="mt-2 flex justify-between text-muted-foreground text-sm">
                    <span>{formatTime(currentTime)}</span>
                    <span>{formatTime(duration)}</span>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex aspect-video items-center justify-center rounded-lg bg-muted">
              <Button
                onClick={() => {
                  sounds.click();
                  handleSelectVideo();
                }}
              >
                Select Video
              </Button>
            </div>
          )}

          <canvas className="hidden" ref={canvasRef} />
        </div>

        {selectedFrames.length > 0 && (
          <div className="border-border border-t px-5 py-3">
            <p className="mb-2 text-muted-foreground text-xs">
              {selectedFrames.length} frame
              {selectedFrames.length !== 1 ? "s" : ""} selected
            </p>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {selectedFrames.map((frame) => (
                <div
                  className="group relative shrink-0 cursor-pointer"
                  key={frame.id}
                  onClick={() =>
                    setPreviewFrame(
                      previewFrame?.id === frame.id ? null : frame
                    )
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      setPreviewFrame(
                        previewFrame?.id === frame.id ? null : frame
                      );
                    }
                  }}
                >
                  <img
                    alt={`Frame at ${formatTime(frame.timestamp)}`}
                    className={`h-16 w-24 rounded object-cover ring-2 transition-all ${
                      previewFrame?.id === frame.id
                        ? "ring-accent"
                        : "ring-transparent hover:ring-muted-foreground"
                    }`}
                    src={frame.dataUrl}
                  />
                  <button
                    className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-black/70 text-white opacity-0 transition-opacity group-hover:opacity-100"
                    onClick={(e) => {
                      e.stopPropagation();
                      sounds.delete_();
                      handleRemoveFrame(frame.id);
                    }}
                    type="button"
                  >
                    <X className="size-2.5" />
                  </button>
                  <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1 text-white text-xs">
                    {formatTime(frame.timestamp)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between border-border border-t px-5 py-4">
          <div className="flex gap-2">
            {videoSrc && (
              <Button
                onClick={() => {
                  sounds.click();
                  handleSelectVideo();
                }}
                variant="outline"
              >
                Change Video
              </Button>
            )}
          </div>
          <div className="flex gap-3">
            <Button
              onClick={() => {
                sounds.click();
                onClose();
              }}
              variant="ghost"
            >
              Cancel
            </Button>
            {videoSrc && !previewFrame && (
              <Button
                onClick={() => {
                  sounds.click();
                  handleAddFrame();
                }}
                variant="outline"
              >
                Add Frame
              </Button>
            )}
            <Button
              disabled={selectedFrames.length === 0 || isImporting}
              onClick={() => {
                sounds.success();
                handleImport();
              }}
            >
              {isImporting
                ? "Importing…"
                : `Import${selectedFrames.length > 0 ? ` ${selectedFrames.length} Frame${selectedFrames.length !== 1 ? "s" : ""}` : " Frames"}`}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
