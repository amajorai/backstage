import {
  BarChart2,
  Eye,
  Loader2,
  ThumbsUp,
  Tv2,
  Upload,
  Wand2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { sileo } from "sileo";
import { ScrollFadeEffect } from "@/components/scroll-fade-effect";
import { formatCount } from "@/lib/youtube-api";
import { useYtMyChannelStore } from "@/stores/use-yt-my-channel-store";
import { useYtOAuthStore } from "@/stores/use-yt-oauth-store";
import { ThumbnailUploadModal } from "./ThumbnailUploadModal";

interface MyChannelTabProps {
  onRemix: (thumbnailUrl: string, title: string) => void;
  onSelectVideo: (videoId: string) => void;
}

export function MyChannelTab({ onRemix, onSelectVideo }: MyChannelTabProps) {
  const isConnected = useYtOAuthStore((s) => s.isConnected);
  const isConnecting = useYtOAuthStore((s) => s.isConnecting);
  const channelName = useYtOAuthStore((s) => s.channelName);

  const videos = useYtMyChannelStore((s) => s.videos);
  const isLoading = useYtMyChannelStore((s) => s.isLoading);
  const isLoadingMore = useYtMyChannelStore((s) => s.isLoadingMore);
  const loadVideos = useYtMyChannelStore((s) => s.loadVideos);
  const loadMore = useYtMyChannelStore((s) => s.loadMore);
  const nextPageToken = useYtMyChannelStore((s) => s.nextPageToken);
  const error = useYtMyChannelStore((s) => s.error);

  const [uploadTargetVideoId, setUploadTargetVideoId] = useState<string | null>(
    null
  );
  const [uploadTargetTitle, setUploadTargetTitle] = useState<string>("");

  const sentinelRef = useRef<HTMLDivElement>(null);
  const isConnectedRef = useRef(isConnected);

  useEffect(() => {
    isConnectedRef.current = isConnected;
  }, [isConnected]);

  useEffect(() => {
    if (isConnected) {
      loadVideos();
    }
  }, [isConnected, loadVideos]);

  useEffect(() => {
    if (!sentinelRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry?.isIntersecting && nextPageToken) {
          loadMore();
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [loadMore, nextPageToken]);

  const handleUploadClick = useCallback(
    (videoId: string, videoTitle: string) => {
      setUploadTargetVideoId(videoId);
      setUploadTargetTitle(videoTitle);
    },
    []
  );

  const handleCloseUpload = useCallback(() => {
    setUploadTargetVideoId(null);
    setUploadTargetTitle("");
  }, []);

  if (!(isConnected || isConnecting)) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8">
        <div className="flex max-w-sm flex-col items-center gap-4 rounded-xl border border-border bg-muted/30 p-8 text-center">
          <div className="text-muted-foreground opacity-40">
            <Tv2 className="size-12" />
          </div>
          <div className="flex flex-col gap-1.5">
            <p className="font-medium text-base">
              Connect Your YouTube Channel
            </p>
            <p className="text-muted-foreground text-sm">
              Link your account to view your videos, upload thumbnails, and
              analyze performance.
            </p>
          </div>
          <button
            className="rounded-md bg-primary px-4 py-2 text-primary-foreground text-sm transition-colors hover:bg-primary/90"
            onClick={() => {
              sileo.info({
                title: "Open Settings → Discovery tab to connect your channel",
              });
            }}
            type="button"
          >
            Go to Settings
          </button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <div className="text-muted-foreground opacity-40">
          <X className="size-10" />
        </div>
        <div className="text-center">
          <p className="font-medium">Failed to load videos</p>
          <p className="mt-1 max-w-sm text-muted-foreground text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (videos.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
        <p className="font-medium text-muted-foreground">
          No videos found on your channel.
        </p>
        {channelName && (
          <p className="text-muted-foreground text-sm">{channelName}</p>
        )}
      </div>
    );
  }

  return (
    <>
      <ScrollFadeEffect className="h-full p-4 pt-2">
        {channelName && (
          <p className="mb-3 text-muted-foreground text-sm">
            {channelName} · {videos.length} video{videos.length !== 1 && "s"}
          </p>
        )}
        <div className="grid grid-cols-3 gap-4">
          {videos.map((video) => (
            <MyChannelVideoCard
              key={video.id}
              onAnalytics={() => onSelectVideo(video.id)}
              onRemix={() => onRemix(video.thumbnailUrl, video.title)}
              onUpload={() => handleUploadClick(video.id, video.title)}
              video={video}
            />
          ))}
        </div>

        {isLoadingMore && (
          <div className="flex justify-center py-6">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {nextPageToken && !isLoadingMore && (
          <div className="h-4" ref={sentinelRef} />
        )}
      </ScrollFadeEffect>

      {uploadTargetVideoId && (
        <ThumbnailUploadModal
          onClose={handleCloseUpload}
          open={!!uploadTargetVideoId}
          videoId={uploadTargetVideoId}
          videoTitle={uploadTargetTitle}
        />
      )}
    </>
  );
}

interface MyChannelVideoCardProps {
  video: {
    id: string;
    title: string;
    thumbnailUrl: string;
    viewCount: number;
    likeCount: number;
  };
  onUpload: () => void;
  onRemix: () => void;
  onAnalytics: () => void;
}

function MyChannelVideoCard({
  video,
  onUpload,
  onRemix,
  onAnalytics,
}: MyChannelVideoCardProps) {
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
        {hovered && (
          <div className="absolute inset-0 flex items-end justify-between gap-1 p-2">
            <div className="flex items-center gap-1">
              <button
                className="rounded-full bg-black/40 p-1.5 text-white shadow-lg backdrop-blur-sm transition-colors hover:bg-black/60"
                onClick={(e) => {
                  e.stopPropagation();
                  onUpload();
                }}
                title="Upload Thumbnail"
                type="button"
              >
                <Upload className="size-3.5" />
              </button>
              <button
                className="rounded-full bg-black/40 p-1.5 text-white shadow-lg backdrop-blur-sm transition-colors hover:bg-black/60"
                onClick={(e) => {
                  e.stopPropagation();
                  onAnalytics();
                }}
                title="Analytics"
                type="button"
              >
                <BarChart2 className="size-3.5" />
              </button>
            </div>
            <button
              className="flex items-center gap-1.5 rounded-full bg-primary px-2.5 py-1.5 text-primary-foreground text-xs shadow-lg transition-colors hover:bg-primary/90"
              onClick={(e) => {
                e.stopPropagation();
                onRemix();
              }}
              title="Remix"
              type="button"
            >
              <Wand2 className="size-3.5" />
              Remix
            </button>
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
