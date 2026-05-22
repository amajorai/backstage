import { Button } from "@repo/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/dialog";
import { Loader2, Upload } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { sileo } from "sileo";
import { getDb } from "@/lib/db";
import { logger } from "@/lib/logger";
import { loadFullImage } from "@/lib/thumbnail-storage";
import { uploadThumbnail } from "@/lib/youtube-my-channel-api";
import { getValidAccessToken } from "@/lib/youtube-oauth";
import { useGalleryStore } from "@/stores/use-gallery-store";

interface ThumbnailUploadModalProps {
  videoId: string;
  videoTitle: string;
  open: boolean;
  onClose: () => void;
}

type SelectedSource =
  | { type: "project"; projectId: string }
  | { type: "file"; file: File }
  | null;

export function ThumbnailUploadModal({
  videoId,
  videoTitle,
  open,
  onClose,
}: ThumbnailUploadModalProps) {
  const thumbnails = useGalleryStore((s) => s.thumbnails);
  const loadPreviewForId = useGalleryStore((s) => s.loadPreviewForId);

  const [selectedSource, setSelectedSource] = useState<SelectedSource>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [previews, setPreviews] = useState<Map<string, string>>(new Map());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (!open) {
      setSelectedSource(null);
      setFilePreviewUrl(null);
    }
  }, [open]);

  // Load previews for projects when modal opens
  useEffect(() => {
    if (!open) return;
    const loadAll = async () => {
      const newPreviews = new Map<string, string>();
      await Promise.all(
        thumbnails.slice(0, 20).map(async (t) => {
          const url = await loadPreviewForId(t.id);
          if (url) newPreviews.set(t.id, url);
        })
      );
      setPreviews(newPreviews);
    };
    loadAll();
  }, [open, thumbnails, loadPreviewForId]);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setSelectedSource({ type: "file", file });
      const objectUrl = URL.createObjectURL(file);
      setFilePreviewUrl(objectUrl);
    },
    []
  );

  const handleUpload = useCallback(async () => {
    if (!selectedSource) return;
    setIsUploading(true);

    try {
      const accessToken = await getValidAccessToken();
      if (!accessToken) {
        sileo.error({
          title: "Not authenticated",
          description: "Please reconnect your YouTube channel in Settings.",
        });
        setIsUploading(false);
        return;
      }

      let blob: Blob;
      let projectId: string | null = null;

      if (selectedSource.type === "project") {
        projectId = selectedSource.projectId;
        const dataUrl = await loadFullImage(projectId);
        if (!dataUrl) {
          sileo.error({ title: "Could not load project image" });
          setIsUploading(false);
          return;
        }
        const res = await fetch(dataUrl);
        blob = await res.blob();
      } else {
        blob = selectedSource.file;
      }

      const { url: uploadedUrl } = await uploadThumbnail(
        accessToken,
        videoId,
        blob
      );

      try {
        const db = await getDb();
        await db.execute(
          `INSERT INTO yt_thumbnail_history (id, videoId, thumbnailUrl, projectId, uploadedAt)
           VALUES ($1, $2, $3, $4, $5)`,
          [crypto.randomUUID(), videoId, uploadedUrl, projectId, Date.now()]
        );
      } catch (dbErr) {
        logger.error(
          { err: dbErr },
          "[ThumbnailUploadModal] Failed to save upload history"
        );
      }

      sileo.success({ title: "Thumbnail uploaded successfully!" });
      onClose();
    } catch (err) {
      logger.error({ err }, "[ThumbnailUploadModal] Upload failed");
      sileo.error({
        title: "Upload failed",
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setIsUploading(false);
    }
  }, [selectedSource, videoId, onClose]);

  return (
    <Dialog onOpenChange={(o) => !o && onClose()} open={open}>
      <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Upload Thumbnail to YouTube</DialogTitle>
          <p
            className="line-clamp-1 text-muted-foreground text-sm"
            title={videoTitle}
          >
            {videoTitle}
          </p>
        </DialogHeader>

        <div className="flex flex-col gap-5">
          {/* Section 1: From Your Projects */}
          <div className="flex flex-col gap-2">
            <p className="font-medium text-sm">From Your Projects</p>
            {thumbnails.length === 0 ? (
              <p className="text-muted-foreground text-xs">
                No projects yet. Create a thumbnail in the editor first.
              </p>
            ) : (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {thumbnails.slice(0, 20).map((t) => {
                  const isSelected =
                    selectedSource?.type === "project" &&
                    selectedSource.projectId === t.id;
                  const previewUrl = previews.get(t.id);
                  return (
                    <button
                      className={`flex shrink-0 flex-col gap-1 rounded-md border-2 p-1 transition-colors ${
                        isSelected
                          ? "border-primary"
                          : "border-transparent hover:border-border"
                      }`}
                      key={t.id}
                      onClick={() =>
                        setSelectedSource({ type: "project", projectId: t.id })
                      }
                      type="button"
                    >
                      <div className="h-[67px] w-[120px] overflow-hidden rounded bg-muted">
                        {previewUrl ? (
                          <img
                            alt={t.name}
                            className="h-full w-full object-cover"
                            src={previewUrl}
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center">
                            <Loader2 className="size-4 animate-spin text-muted-foreground" />
                          </div>
                        )}
                      </div>
                      <p className="w-[120px] truncate text-center text-[10px] text-muted-foreground">
                        {t.name}
                      </p>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Section 2: Upload a File */}
          <div className="flex flex-col gap-2">
            <p className="font-medium text-sm">Upload a File</p>
            <div className="flex items-center gap-3">
              <button
                className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm transition-colors hover:bg-muted"
                onClick={() => fileInputRef.current?.click()}
                type="button"
              >
                <Upload className="size-4" />
                Choose file
              </button>
              {selectedSource?.type === "file" && (
                <span className="truncate text-muted-foreground text-xs">
                  {selectedSource.file.name}
                </span>
              )}
            </div>
            {filePreviewUrl && selectedSource?.type === "file" && (
              <div className="mt-1 h-[90px] w-[160px] overflow-hidden rounded-md border border-border bg-muted">
                <img
                  alt="Selected file preview"
                  className="h-full w-full object-cover"
                  src={filePreviewUrl}
                />
              </div>
            )}
            <input
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleFileChange}
              ref={fileInputRef}
              type="file"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            disabled={isUploading}
            onClick={onClose}
            size="sm"
            variant="ghost"
          >
            Cancel
          </Button>
          <Button
            disabled={!selectedSource || isUploading}
            onClick={handleUpload}
            size="sm"
          >
            {isUploading ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Uploading…
              </>
            ) : (
              <>
                <Upload className="size-4" />
                Upload
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
