import { Eye, Loader2, Search, ThumbsUp, Wand2, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { sileo } from "sileo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  fetchTrendingVideos,
  formatCount,
  searchVideos,
  type YoutubeVideo,
} from "@/lib/youtube-api";
import { getYoutubeApiKey } from "@/lib/youtube-store";

interface ExplorePageProps {
  onRemix: (thumbnailUrl: string, title: string) => void;
  onClose: () => void;
}

export function ExplorePage({ onRemix, onClose }: ExplorePageProps) {
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [videos, setVideos] = useState<YoutubeVideo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getYoutubeApiKey().then((key) => {
      setApiKey(key);
    });
  }, []);

  const load = useCallback(
    async (query: string) => {
      if (!apiKey) return;
      setIsLoading(true);
      setError(null);
      try {
        const results = query.trim()
          ? await searchVideos(apiKey, query.trim())
          : await fetchTrendingVideos(apiKey);
        setVideos(results);
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "Failed to load videos";
        setError(msg);
        setVideos([]);
      } finally {
        setIsLoading(false);
      }
    },
    [apiKey]
  );

  // Load trending on mount when key is available
  useEffect(() => {
    if (apiKey) load("");
  }, [apiKey, load]);

  const handleSearch = useCallback(() => {
    const q = searchInput.trim();
    setActiveQuery(q);
    load(q);
  }, [searchInput, load]);

  const handleClearSearch = useCallback(() => {
    setSearchInput("");
    setActiveQuery("");
    load("");
  }, [load]);

  const handleRemix = useCallback(
    (video: YoutubeVideo) => {
      if (!video.thumbnailUrl) {
        sileo.error({ title: "No thumbnail available for this video" });
        return;
      }
      onRemix(video.thumbnailUrl, video.title);
    },
    [onRemix]
  );

  if (!apiKey) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
        <Search className="size-10 text-muted-foreground/40" />
        <p className="font-medium text-sm">YouTube API key required</p>
        <p className="max-w-xs text-muted-foreground text-xs">
          Add your YouTube Data API v3 key in Settings → API Keys to explore
          trending thumbnails.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Page header with back button */}
      <div className="flex h-10 shrink-0 items-center gap-2 border-border border-b px-3">
        <button
          className="flex items-center gap-1.5 rounded px-1.5 py-1 text-muted-foreground text-xs hover:bg-muted hover:text-foreground"
          onClick={onClose}
          type="button"
        >
          <ArrowLeft className="size-3.5" />
          Back
        </button>
        <span className="font-medium text-sm">Explore</span>
      </div>
      {/* Search header */}
      <div className="flex items-center gap-3 border-border border-b px-4 py-3">
        <div className="relative flex-1">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground/60" />
          <Input
            className="pr-8 pl-9"
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSearch();
            }}
            placeholder="Search YouTube thumbnails..."
            ref={searchInputRef}
            value={searchInput}
          />
          {searchInput && (
            <button
              className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
              onClick={handleClearSearch}
              type="button"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
        <Button onClick={handleSearch} size="sm" variant="secondary">
          Search
        </Button>
      </div>

      {/* Status bar */}
      <div className="flex items-center gap-2 border-border border-b px-4 py-2">
        {activeQuery ? (
          <span className="text-muted-foreground text-xs">
            Results for{" "}
            <span className="font-medium text-foreground">
              &ldquo;{activeQuery}&rdquo;
            </span>
          </span>
        ) : (
          <span className="text-muted-foreground text-xs">Trending videos</span>
        )}
        {!isLoading && videos.length > 0 && (
          <span className="text-muted-foreground text-xs">
            · {videos.length} results
          </span>
        )}
        <span className="ml-auto text-[10px] text-muted-foreground/50">
          Uses YouTube Data API quota
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <div className="flex h-48 items-center justify-center">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="flex h-48 flex-col items-center justify-center gap-2">
            <p className="font-medium text-destructive text-sm">Error</p>
            <p className="max-w-sm text-center text-muted-foreground text-xs">
              {error}
            </p>
            <Button
              className="mt-2"
              onClick={() => load(activeQuery)}
              size="sm"
              variant="secondary"
            >
              Retry
            </Button>
          </div>
        ) : videos.length === 0 ? (
          <div className="flex h-48 items-center justify-center text-muted-foreground text-sm">
            No results
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-4 xl:grid-cols-4">
            {videos.map((video) => (
              <VideoCard key={video.id} onRemix={handleRemix} video={video} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function VideoCard({
  video,
  onRemix,
}: {
  video: YoutubeVideo;
  onRemix: (video: YoutubeVideo) => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className="group flex cursor-default flex-col gap-2"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Thumbnail */}
      <div className="relative aspect-video overflow-hidden rounded-lg border border-border bg-muted">
        {video.thumbnailUrl ? (
          <img
            alt={video.title}
            className="h-full w-full object-cover"
            loading="lazy"
            src={video.thumbnailUrl}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <span className="text-[10px] text-muted-foreground">
              No thumbnail
            </span>
          </div>
        )}

        {/* Hover overlay */}
        {hovered && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-[2px]">
            <Button
              className="gap-1.5 shadow-lg"
              onClick={() => onRemix(video)}
              size="sm"
            >
              <Wand2 className="size-3.5" />
              Remix
            </Button>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex flex-col gap-1">
        <p
          className="line-clamp-2 font-medium text-xs leading-snug"
          title={video.title}
        >
          {video.title}
        </p>
        <p className="truncate text-[10px] text-muted-foreground">
          {video.channelTitle}
        </p>
        <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
          {video.viewCount > 0 && (
            <span className="flex items-center gap-1">
              <Eye className="size-3" />
              {formatCount(video.viewCount)}
            </span>
          )}
          {video.likeCount > 0 && (
            <span className="flex items-center gap-1">
              <ThumbsUp className="size-3" />
              {formatCount(video.likeCount)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
