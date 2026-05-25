import { Button } from "@repo/ui/button";
import { openUrl } from "@tauri-apps/plugin-opener";
import {
  ArrowLeft,
  Bot,
  ExternalLink,
  Eye,
  Heart,
  Loader2,
  RotateCcw,
  Search,
  Settings,
  ThumbsUp,
  Wand2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { sileo } from "sileo";
import type { ViewMode } from "@/App";
import { VideoAnalyticsPanel } from "@/components/explore/VideoAnalyticsPanel";
import { YoutubeAnalystPanel } from "@/components/explore/YoutubeAnalystPanel";
import { EmptyState } from "@/components/gallery/EmptyState";
import { SearchHistoryDropdown } from "@/components/SearchHistoryDropdown";
import { ScrollFadeEffect } from "@/components/scroll-fade-effect";
import { ViewModeButtons } from "@/components/toolbar/view-mode-buttons";
import { usePersistedViewMode } from "@/hooks/use-persisted-view-mode";
import * as sounds from "@/lib/sounds";
import { cn } from "@/lib/utils";
import {
  fetchTrendingVideos,
  formatCount,
  searchVideos,
  TRENDING_CATEGORIES,
  type YoutubeVideo,
} from "@/lib/youtube-api";
import { getYoutubeApiKey } from "@/lib/youtube-store";
import { useAppSettingsStore } from "@/stores/use-app-settings-store";
import { useSearchHistoryStore } from "@/stores/use-search-history-store";
import {
  ALL_SAVED_ID,
  useYtCollectionsStore,
} from "@/stores/use-yt-collections-store";
import { useYtFavouritesStore } from "@/stores/use-yt-favourites-store";

const SAVED_CATEGORY_ID = "saved" as const;

const CATEGORIES = [
  { id: undefined, label: "Trending" },
  { id: SAVED_CATEGORY_ID, label: "Saved" },
  { id: "10", label: "Music" },
  { id: "20", label: "Gaming" },
  { id: "17", label: "Sports" },
  { id: "24", label: "Entertainment" },
  { id: "28", label: "Science & Tech" },
  { id: "1", label: "Film" },
  { id: "25", label: "News" },
  { id: "22", label: "Vlogs" },
  { id: "2", label: "Autos" },
] as const;

type CategoryId = (typeof CATEGORIES)[number]["id"];

interface ExplorePageProps {
  onRemix: (thumbnailUrl: string, title: string) => void;
  onClose: () => void;
  onSettings: () => void;
}

export function ExplorePage({
  onRemix,
  onClose,
  onSettings,
}: ExplorePageProps) {
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [videos, setVideos] = useState<YoutubeVideo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [selectedCategory, setSelectedCategory] =
    useState<CategoryId>(undefined);
  const [viewMode, setViewMode] = usePersistedViewMode(
    "view-mode:explore",
    "3"
  );
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null);
  const [analystOpen, setAnalystOpen] = useState(false);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const apiKeyRef = useRef<string | null>(null);
  const activeQueryRef = useRef("");
  const selectedCategoryRef = useRef<CategoryId>(undefined);
  const nextPageTokenRef = useRef<string | undefined>(undefined);
  const categoryIndexRef = useRef(0);
  const seenIdsRef = useRef(new Set<string>());
  const isLoadingMoreRef = useRef(false);
  const isLoadingRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const blurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const saveSearchHistory = useAppSettingsStore((s) => s.saveSearchHistory);
  const exploreHistory = useSearchHistoryStore((s) => s.histories.explore);
  const addSearch = useSearchHistoryStore((s) => s.addSearch);
  const removeSearch = useSearchHistoryStore((s) => s.removeSearch);
  const clearHistory = useSearchHistoryStore((s) => s.clearHistory);

  const toggleFavourite = useYtFavouritesStore((s) => s.toggleFavourite);
  const favouriteIds = useYtFavouritesStore((s) => s.favouriteIds);
  const favourites = useYtFavouritesStore((s) => s.favourites);

  const [selectedCollectionId, setSelectedCollectionId] =
    useState<string>(ALL_SAVED_ID);
  const collectionsMembership = useYtCollectionsStore((s) => s.membership);

  const visibleFavourites = useMemo(() => {
    if (selectedCollectionId === ALL_SAVED_ID) return favourites;
    return favourites.filter((f) =>
      collectionsMembership.get(f.id)?.has(selectedCollectionId)
    );
  }, [favourites, collectionsMembership, selectedCollectionId]);

  // Autocomplete: first history item that starts with current input
  const suggestion = useMemo(() => {
    if (!(searchInput && saveSearchHistory)) return "";
    const lower = searchInput.toLowerCase();
    return exploreHistory.find((h) => h.toLowerCase().startsWith(lower)) ?? "";
  }, [searchInput, exploreHistory, saveSearchHistory]);

  const ghostText = suggestion ? suggestion.slice(searchInput.length) : "";

  // Filtered history for dropdown (substring match)
  const filteredHistory = useMemo(() => {
    if (!saveSearchHistory) return [];
    if (!searchInput) return exploreHistory;
    const lower = searchInput.toLowerCase();
    return exploreHistory.filter((h) => h.toLowerCase().includes(lower));
  }, [searchInput, exploreHistory, saveSearchHistory]);

  const showHistory = searchFocused && filteredHistory.length > 0;

  useEffect(() => {
    getYoutubeApiKey().then((key) => {
      apiKeyRef.current = key;
      setApiKey(key);
    });
  }, []);

  const fetchNextChunk = useCallback(async (append: boolean) => {
    if (selectedCategoryRef.current === SAVED_CATEGORY_ID) return;
    const key = apiKeyRef.current;
    if (!key) return;
    if (isLoadingRef.current || isLoadingMoreRef.current) return;

    if (append) {
      setIsLoadingMore(true);
      isLoadingMoreRef.current = true;
    } else {
      setIsLoading(true);
      isLoadingRef.current = true;
      setError(null);
    }

    try {
      const query = activeQueryRef.current;
      let result: Awaited<ReturnType<typeof fetchTrendingVideos>>;

      if (query) {
        result = await searchVideos(key, query, 50, nextPageTokenRef.current);
      } else {
        const catId = selectedCategoryRef.current;
        if (catId !== undefined) {
          result = await fetchTrendingVideos(
            key,
            "US",
            50,
            nextPageTokenRef.current,
            catId
          );
          if (!result.nextPageToken) {
            nextPageTokenRef.current = undefined;
            seenIdsRef.current = new Set();
          }
        } else {
          result = await fetchTrendingVideos(
            key,
            "US",
            50,
            nextPageTokenRef.current,
            TRENDING_CATEGORIES[categoryIndexRef.current]
          );
          if (!result.nextPageToken) {
            const nextIdx = categoryIndexRef.current + 1;
            categoryIndexRef.current =
              nextIdx < TRENDING_CATEGORIES.length ? nextIdx : 0;
          }
        }
      }

      nextPageTokenRef.current = result.nextPageToken;

      const fresh = result.videos.filter((v) => !seenIdsRef.current.has(v.id));
      for (const v of fresh) seenIdsRef.current.add(v.id);

      if (append) {
        setVideos((prev) => [...prev, ...fresh]);
      } else {
        setVideos(fresh);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load videos";
      if (append) {
        sileo.error({ title: msg });
      } else {
        setError(msg);
        setVideos([]);
      }
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
      isLoadingRef.current = false;
      isLoadingMoreRef.current = false;
    }
  }, []);

  const resetAndFetch = useCallback(() => {
    nextPageTokenRef.current = undefined;
    categoryIndexRef.current = 0;
    seenIdsRef.current = new Set();
    fetchNextChunk(false);
  }, [fetchNextChunk]);

  useEffect(() => {
    if (!apiKey) return;
    activeQueryRef.current = "";
    selectedCategoryRef.current = undefined;
    resetAndFetch();
  }, [apiKey, resetAndFetch]);

  useEffect(() => {
    if (isLoading || isLoadingMore) return;
    const el = scrollContainerRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 400;
    if (nearBottom) fetchNextChunk(true);
  }, [isLoading, isLoadingMore, fetchNextChunk]);

  const handleScroll = useCallback(() => {
    if (isLoadingMoreRef.current || isLoadingRef.current) return;
    const el = scrollContainerRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 400;
    if (nearBottom) fetchNextChunk(true);
  }, [fetchNextChunk]);

  const handleSelectCategory = useCallback(
    (id: CategoryId) => {
      setSelectedCategory(id);
      selectedCategoryRef.current = id;
      setSearchInput("");
      activeQueryRef.current = "";
      if (id !== SAVED_CATEGORY_ID) resetAndFetch();
    },
    [resetAndFetch]
  );

  const handleSearch = useCallback(
    (query?: string) => {
      const q = (query ?? searchInput).trim();
      if (!q) return;
      activeQueryRef.current = q;
      if (saveSearchHistory) addSearch("explore", q);
      setSearchInput(q);
      setSearchFocused(false);
      resetAndFetch();
    },
    [searchInput, resetAndFetch, saveSearchHistory, addSearch]
  );

  const handleClearSearch = useCallback(() => {
    // Cancel pending blur so dropdown appears right away
    if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
    setSearchInput("");
    activeQueryRef.current = "";
    setSearchFocused(true);
    inputRef.current?.focus();
    resetAndFetch();
  }, [resetAndFetch]);

  const handleInputBlur = useCallback(() => {
    blurTimerRef.current = setTimeout(() => setSearchFocused(false), 150);
  }, []);

  const handleRemix = useCallback(
    (video: YoutubeVideo) => {
      onRemix(video.thumbnailUrl, video.title);
    },
    [onRemix]
  );

  const gridColClass = useMemo(() => {
    const map: Record<ViewMode, string> = {
      "3": "grid-cols-3",
      "4": "grid-cols-4",
      "5": "grid-cols-5",
      row: "grid-cols-1",
    };
    return map[viewMode];
  }, [viewMode]);

  const bottomToolbar = (
    <div className="mx-1 mb-1">
      <div className="relative flex h-12 items-center justify-between rounded-xl bg-muted px-4">
        <div className="flex items-center gap-1">
          <Button
            aria-label="Back to Gallery"
            onClick={() => {
              sounds.click();
              onClose();
            }}
            size="icon-sm"
            variant="ghost"
          >
            <ArrowLeft className="size-4" />
          </Button>
          <div className="mx-1 h-4 w-px bg-border" />
          <ViewModeButtons onViewModeChange={setViewMode} viewMode={viewMode} />
        </div>

        <div className="absolute left-1/2 -translate-x-1/2">
          {/* Search container — bg lives here so input can be transparent */}
          <div className="relative h-8 w-72 rounded-md bg-background transition-all focus-within:w-96 focus-within:ring-1 focus-within:ring-primary/20">
            {showHistory && (
              <SearchHistoryDropdown
                items={filteredHistory}
                onClearAll={() => clearHistory("explore")}
                onRemove={(q) => removeSearch("explore", q)}
                onSelect={(q) => handleSearch(q)}
              />
            )}

            {/* Ghost text overlay */}
            {ghostText && (
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 flex items-center overflow-hidden pr-8 pl-9"
              >
                <span className="invisible shrink-0 whitespace-pre text-sm">
                  {searchInput}
                </span>
                <span className="shrink-0 whitespace-pre text-muted-foreground/40 text-sm">
                  {ghostText}
                </span>
              </div>
            )}

            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground/50" />

            <input
              className="absolute inset-0 h-full w-full rounded-md border-none bg-transparent pr-8 pl-9 text-foreground text-sm outline-none placeholder:text-muted-foreground/60"
              onBlur={handleInputBlur}
              onChange={(e) => setSearchInput(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onKeyDown={(e) => {
                if (e.key === "Tab" && ghostText) {
                  e.preventDefault();
                  setSearchInput(suggestion);
                } else if (e.key === "Enter") {
                  handleSearch();
                }
              }}
              placeholder="Search YouTube"
              ref={inputRef}
              value={searchInput}
            />

            {videos.length > 0 && !searchInput && (
              <span className="absolute top-1/2 right-2 -translate-y-1/2 rounded bg-primary/10 px-1.5 py-0.5 font-bold text-[10px] text-primary">
                {videos.length}
              </span>
            )}
            {searchInput && (
              <button
                className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
                onClick={() => {
                  sounds.click();
                  handleClearSearch();
                }}
                type="button"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
        </div>

        <Button
          aria-label="AI Analyst"
          onClick={() => {
            sounds.click();
            setAnalystOpen(true);
          }}
          size="icon-sm"
          title="AI Analyst"
          variant="ghost"
        >
          <Bot className="size-4" />
        </Button>
      </div>
    </div>
  );

  if (!apiKey) {
    return (
      <>
        <div className="mx-1 flex flex-1 flex-col overflow-hidden rounded-xl border-2 border-border bg-background">
          <EmptyState
            action={{
              icon: <Settings className="size-4" />,
              label: "Open Settings",
              onClick: onSettings,
            }}
            description="Add your YouTube Data API v3 key in Settings to explore trending thumbnails."
            icon={<Search className="size-10" />}
            title="YouTube API key required"
          />
        </div>
        {bottomToolbar}
      </>
    );
  }

  return (
    <>
      <div className="mx-1 flex flex-1 flex-col overflow-hidden rounded-xl border-2 border-border bg-background">
        <div className="relative flex-1 overflow-hidden">
          {/* Category tabs */}
          <div className="scrollbar-none absolute top-0 right-0 left-0 z-20 flex items-center gap-1.5 overflow-x-auto px-5 py-3">
            {CATEGORIES.map((cat) => (
              <button
                className={cn(
                  "shrink-0 rounded-md px-2.5 py-1 text-sm transition-colors",
                  selectedCategory === cat.id && !activeQueryRef.current
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
                key={String(cat.id)}
                onClick={() => {
                  sounds.click();
                  handleSelectCategory(cat.id);
                }}
                type="button"
              >
                {cat.label}
              </button>
            ))}
          </div>
          <ScrollFadeEffect
            className="h-full p-4 pt-12"
            onScroll={handleScroll}
            ref={scrollContainerRef}
          >
            {isLoading && selectedCategory !== SAVED_CATEGORY_ID ? (
              <div className="flex h-48 items-center justify-center">
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
              </div>
            ) : error && selectedCategory !== SAVED_CATEGORY_ID ? (
              <div className="flex h-48 flex-col items-center justify-center gap-4">
                <div className="text-muted-foreground opacity-40">
                  <X className="size-10" />
                </div>
                <div className="text-center">
                  <p className="font-medium">Failed to load</p>
                  <p className="mt-1 max-w-sm text-muted-foreground text-sm">
                    {error}
                  </p>
                </div>
                <Button
                  onClick={() => {
                    sounds.click();
                    fetchNextChunk(false);
                  }}
                  variant="ghost"
                >
                  <RotateCcw className="size-4" />
                  Retry
                </Button>
              </div>
            ) : selectedCategory === SAVED_CATEGORY_ID ? (
              visibleFavourites.length === 0 ? (
                <div className="flex h-48 flex-col items-center justify-center gap-4">
                  <div className="text-muted-foreground opacity-40">
                    <Heart className="size-10" />
                  </div>
                  <div className="text-center">
                    <p className="font-medium">No saved videos yet</p>
                    <p className="mt-1 text-muted-foreground text-sm">
                      Save videos to access them here
                    </p>
                  </div>
                </div>
              ) : (
                <div className={`grid gap-4 ${gridColClass}`}>
                  {visibleFavourites.map((video) => (
                    <VideoCard
                      isFavourite={true}
                      key={video.id}
                      onRemix={handleRemix}
                      onToggleFavourite={toggleFavourite}
                      video={video}
                    />
                  ))}
                </div>
              )
            ) : videos.length === 0 ? (
              <div className="flex h-48 flex-col items-center justify-center gap-4">
                <div className="text-muted-foreground opacity-40">
                  <Search className="size-10" />
                </div>
                <div className="text-center">
                  <p className="font-medium">No results</p>
                  <p className="mt-1 text-muted-foreground text-sm">
                    Try a different search term
                  </p>
                </div>
              </div>
            ) : (
              <>
                <div className={`grid gap-4 ${gridColClass}`}>
                  {videos.map((video) => (
                    <VideoCard
                      isFavourite={favouriteIds.has(video.id)}
                      key={video.id}
                      onRemix={handleRemix}
                      onToggleFavourite={toggleFavourite}
                      video={video}
                    />
                  ))}
                </div>
                {isLoadingMore && (
                  <div className="flex justify-center py-6">
                    <Loader2 className="size-5 animate-spin text-muted-foreground" />
                  </div>
                )}
              </>
            )}
          </ScrollFadeEffect>
        </div>
      </div>

      {bottomToolbar}

      <VideoAnalyticsPanel
        onClose={() => setSelectedVideoId(null)}
        videoId={selectedVideoId}
      />
      <YoutubeAnalystPanel
        onClose={() => setAnalystOpen(false)}
        open={analystOpen}
      />
    </>
  );
}

function VideoCard({
  video,
  isFavourite,
  onRemix,
  onToggleFavourite,
}: {
  video: YoutubeVideo;
  isFavourite: boolean;
  onRemix: (video: YoutubeVideo) => void;
  onToggleFavourite: (video: YoutubeVideo) => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className="flex cursor-default flex-col gap-2 transition-transform hover:scale-[1.02]"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="relative aspect-video overflow-hidden rounded-lg border border-border bg-muted">
        <img
          alt={video.title}
          className="h-full w-full object-cover"
          loading="lazy"
          src={video.thumbnailUrl}
        />
        {(hovered || isFavourite) && (
          <div className="absolute inset-0 flex items-end justify-between p-2">
            <div className="flex items-center gap-1">
              <button
                className={cn(
                  "rounded-full p-1.5 shadow-lg backdrop-blur-sm transition-colors",
                  isFavourite
                    ? "bg-red-500/90 text-white hover:bg-red-600/90"
                    : "bg-black/40 text-white hover:bg-black/60"
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  sounds.click();
                  onToggleFavourite(video);
                }}
                title={isFavourite ? "Remove from saved" : "Save"}
                type="button"
              >
                <Heart
                  className={cn("size-3.5", isFavourite && "fill-current")}
                />
              </button>
              {hovered && (
                <button
                  className="rounded-full bg-black/40 p-1.5 text-white shadow-lg backdrop-blur-sm transition-colors hover:bg-black/60"
                  onClick={(e) => {
                    e.stopPropagation();
                    sounds.click();
                    openUrl(`https://www.youtube.com/watch?v=${video.id}`);
                  }}
                  title="Open in browser"
                  type="button"
                >
                  <ExternalLink className="size-3.5" />
                </button>
              )}
            </div>
            {hovered && (
              <Button
                className="gap-1.5 shadow-lg"
                onClick={() => {
                  sounds.click();
                  onRemix(video);
                }}
                size="sm"
              >
                <Wand2 className="size-3.5" />
                Remix
              </Button>
            )}
          </div>
        )}
      </div>

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
