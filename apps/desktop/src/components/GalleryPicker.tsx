import { FolderOpen, Image, Loader2, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useFolderStore } from "@/stores/use-folder-store";
import { useGalleryStore } from "@/stores/use-gallery-store";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

interface GalleryPickerProps {
  onSelect: (dataUrl: string, name: string) => void;
  onClose: () => void;
}

// Individual thumbnail item that loads its own preview
function PickerThumbnail({
  id,
  name,
  previewUrl: initialPreviewUrl,
  onSelect,
}: {
  id: string;
  name: string;
  previewUrl?: string;
  onSelect: (dataUrl: string, name: string) => void;
}) {
  const loadPreviewForId = useGalleryStore((s) => s.loadPreviewForId);
  const loadFullImageForId = useGalleryStore((s) => s.loadFullImageForId);
  const cachedPreviewUrl = useGalleryStore((s) => s.previewCache.get(id));

  const [previewUrl, setPreviewUrl] = useState<string | null>(
    initialPreviewUrl || cachedPreviewUrl || null
  );
  const [isLoading, setIsLoading] = useState(!previewUrl);
  const [isSelecting, setIsSelecting] = useState(false);

  useEffect(() => {
    if (previewUrl) {
      setIsLoading(false);
      return;
    }

    if (cachedPreviewUrl) {
      setPreviewUrl(cachedPreviewUrl);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    loadPreviewForId(id).then((url) => {
      if (!cancelled) {
        setPreviewUrl(url);
        setIsLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [id, previewUrl, cachedPreviewUrl, loadPreviewForId]);

  const handleClick = useCallback(async () => {
    setIsSelecting(true);
    try {
      const fullUrl = await loadFullImageForId(id);
      if (fullUrl) {
        onSelect(fullUrl, name);
      }
    } finally {
      setIsSelecting(false);
    }
  }, [id, name, loadFullImageForId, onSelect]);

  return (
    <Button
      className="relative aspect-video h-auto overflow-hidden rounded-lg p-0"
      disabled={isSelecting}
      onClick={handleClick}
      variant="ghost"
    >
      {isLoading || isSelecting ? (
        <div className="flex h-full w-full items-center justify-center bg-muted">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : previewUrl ? (
        <img
          alt={name}
          className="h-full w-full object-cover"
          src={previewUrl}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-muted">
          <Image className="size-6 text-muted-foreground" />
        </div>
      )}
    </Button>
  );
}

export function GalleryPicker({ onSelect, onClose }: GalleryPickerProps) {
  const thumbnails = useGalleryStore((s) => s.thumbnails);
  const folders = useFolderStore((s) => s.folders);
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);

  // Debounce search input by 300ms
  useEffect(() => {
    const timer = setTimeout(() => setSearchQuery(searchInput), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const folderCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const t of thumbnails) {
      if (t.folderId) counts[t.folderId] = (counts[t.folderId] ?? 0) + 1;
    }
    return counts;
  }, [thumbnails]);

  const filteredThumbnails = useMemo(() => {
    let filtered = thumbnails;
    if (selectedFolderId !== null) {
      filtered = filtered.filter((t) => t.folderId === selectedFolderId);
    }
    if (!searchQuery.trim()) return filtered;
    const q = searchQuery.toLowerCase();
    return filtered.filter((t) => t.name.toLowerCase().includes(q));
  }, [thumbnails, searchQuery, selectedFolderId]);

  const hasFolders = folders.length > 0;

  if (thumbnails.length === 0) {
    return (
      <div
        className="fixed inset-0 z-60 flex items-center justify-center bg-black/60"
        onClick={onClose}
        onKeyDown={(e) => e.key === "Escape" && onClose()}
      >
        <div
          className="w-100 rounded-xl border border-border bg-card p-6 text-center"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={() => {}}
        >
          <Image className="mx-auto size-12 text-muted-foreground opacity-50" />
          <p className="mt-4 text-muted-foreground">No images in gallery</p>
          <Button className="mt-4" onClick={onClose} variant="ghost">
            Close
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-60 flex items-center justify-center bg-black/60"
      onClick={onClose}
      onKeyDown={(e) => e.key === "Escape" && onClose()}
    >
      <div
        className="flex max-h-[80vh] w-170 flex-col overflow-hidden rounded-xl border border-border bg-card"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={() => {}}
      >
        <div className="border-border border-b px-5 py-4">
          <h3 className="font-semibold">Add Image from Gallery</h3>
        </div>

        {/* Search bar */}
        <div className="border-border border-b px-4 py-2">
          <div className="relative">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search images..."
              value={searchInput}
            />
          </div>
        </div>

        {/* Body: optional folder sidebar + grid */}
        <div className="flex flex-1 overflow-hidden">
          {hasFolders && (
            <div className="flex w-36 shrink-0 flex-col gap-0.5 overflow-y-auto border-border border-r p-2">
              <button
                className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
                  selectedFolderId === null
                    ? "bg-accent font-medium text-accent-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
                onClick={() => setSelectedFolderId(null)}
                type="button"
              >
                <span className="truncate">All</span>
                <span className="ml-auto text-xs opacity-60">
                  {thumbnails.length}
                </span>
              </button>
              {folders.map((folder) => (
                <button
                  className={`flex items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
                    selectedFolderId === folder.id
                      ? "bg-accent font-medium text-accent-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                  key={folder.id}
                  onClick={() =>
                    setSelectedFolderId(
                      selectedFolderId === folder.id ? null : folder.id
                    )
                  }
                  type="button"
                >
                  <FolderOpen className="size-3.5 shrink-0" />
                  <span className="truncate">{folder.name}</span>
                  <span className="ml-auto text-xs opacity-60">
                    {folderCounts[folder.id] ?? 0}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Scrollable grid */}
          <div className="flex-1 overflow-y-auto p-4">
            {filteredThumbnails.length === 0 ? (
              <div className="flex h-32 items-center justify-center text-muted-foreground text-sm">
                {searchQuery.trim()
                  ? "No images match your search"
                  : "No images in this folder"}
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {filteredThumbnails.map((thumb) => (
                  <PickerThumbnail
                    id={thumb.id}
                    key={thumb.id}
                    name={thumb.name}
                    onSelect={onSelect}
                    previewUrl={thumb.previewUrl}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end border-border border-t px-5 py-4">
          <Button onClick={onClose} variant="ghost">
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
