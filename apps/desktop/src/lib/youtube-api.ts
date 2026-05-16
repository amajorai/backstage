const BASE = "https://www.googleapis.com/youtube/v3";

export interface YoutubeVideo {
  id: string;
  title: string;
  channelTitle: string;
  thumbnailUrl: string;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  publishedAt: string;
  durationSeconds: number;
}

export interface PagedVideos {
  videos: YoutubeVideo[];
  nextPageToken?: string;
}

interface RawVideoItem {
  id: string | { videoId: string };
  snippet: {
    title: string;
    channelTitle: string;
    publishedAt: string;
    thumbnails: {
      maxres?: { url: string };
      high?: { url: string };
      medium?: { url: string };
    };
  };
  statistics?: {
    viewCount?: string;
    likeCount?: string;
    commentCount?: string;
  };
  contentDetails?: {
    duration?: string;
  };
}

// YouTube video category IDs to cycle through for infinite trending content
export const TRENDING_CATEGORIES = [
  undefined, // no category = most popular overall
  "10", // Music
  "20", // Gaming
  "17", // Sports
  "24", // Entertainment
  "28", // Science & Technology
  "25", // News & Politics
  "1", // Film & Animation
  "2", // Autos & Vehicles
  "22", // People & Blogs
];

function bestThumbnail(
  thumbnails: RawVideoItem["snippet"]["thumbnails"]
): string {
  return (
    thumbnails.maxres?.url ??
    thumbnails.high?.url ??
    thumbnails.medium?.url ??
    ""
  );
}

// Parse ISO 8601 duration (e.g. PT4M33S, PT1H2M10S, PT30S) to seconds
function parseDuration(iso: string): number {
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  return Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
}

function parseVideo(item: RawVideoItem): YoutubeVideo {
  const id = typeof item.id === "string" ? item.id : item.id.videoId;
  return {
    id,
    title: item.snippet.title,
    channelTitle: item.snippet.channelTitle,
    thumbnailUrl: bestThumbnail(item.snippet.thumbnails),
    viewCount: Number(item.statistics?.viewCount ?? 0),
    likeCount: Number(item.statistics?.likeCount ?? 0),
    commentCount: Number(item.statistics?.commentCount ?? 0),
    publishedAt: item.snippet.publishedAt,
    durationSeconds: parseDuration(item.contentDetails?.duration ?? ""),
  };
}

function isUsable(v: YoutubeVideo): boolean {
  return v.thumbnailUrl.length > 0 && v.viewCount > 0 && v.durationSeconds > 60;
}

// Check if a video is a YouTube Short via HEAD request.
// YouTube Shorts return 200; regular videos redirect (303) → opaqueredirect response type.
// Uses no-cors + redirect:manual to avoid CORS errors (HEAD is a simple CORS method).
async function isShort(videoId: string): Promise<boolean> {
  try {
    const res = await fetch(`https://www.youtube.com/shorts/${videoId}`, {
      method: "HEAD",
      mode: "no-cors",
      redirect: "manual",
    });
    // opaqueredirect = server sent a redirect = NOT a Short
    // opaque = no redirect = IS a Short
    return res.type !== "opaqueredirect";
  } catch {
    return false; // on error assume not a Short
  }
}

// Run concurrency-limited checks. Only checks videos ≤ 3 min (180s) —
// anything longer is almost certainly not a Short.
async function filterOutShorts(
  videos: YoutubeVideo[]
): Promise<YoutubeVideo[]> {
  const CONCURRENCY = 8;
  const SHORTS_MAX_DURATION = 180;

  const needsCheck = videos.map(
    (v) => v.durationSeconds <= SHORTS_MAX_DURATION
  );

  const results: boolean[] = new Array(videos.length).fill(false);
  const indices = videos.map((_, i) => i).filter((i) => needsCheck[i]);

  for (let i = 0; i < indices.length; i += CONCURRENCY) {
    const batch = indices.slice(i, i + CONCURRENCY);
    const checks = await Promise.all(
      batch.map((idx) => isShort(videos[idx].id))
    );
    for (let j = 0; j < batch.length; j++) {
      results[batch[j]] = checks[j];
    }
  }

  return videos.filter((_, i) => !results[i]);
}

export async function fetchTrendingVideos(
  apiKey: string,
  regionCode = "US",
  maxResults = 50,
  pageToken?: string,
  videoCategoryId?: string
): Promise<PagedVideos> {
  const url = new URL(`${BASE}/videos`);
  url.searchParams.set("part", "snippet,statistics,contentDetails");
  url.searchParams.set("chart", "mostPopular");
  url.searchParams.set("regionCode", regionCode);
  url.searchParams.set("maxResults", String(maxResults));
  url.searchParams.set("key", apiKey);
  if (pageToken) url.searchParams.set("pageToken", pageToken);
  if (videoCategoryId) url.searchParams.set("videoCategoryId", videoCategoryId);

  const res = await fetch(url.toString());
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error?.message ?? `YouTube API error ${res.status}`);
  }
  const data = await res.json();
  const candidates = (data.items ?? []).map(parseVideo).filter(isUsable);
  const videos = await filterOutShorts(candidates);
  return { videos, nextPageToken: data.nextPageToken };
}

export async function searchVideos(
  apiKey: string,
  query: string,
  maxResults = 50,
  pageToken?: string
): Promise<PagedVideos> {
  const searchUrl = new URL(`${BASE}/search`);
  searchUrl.searchParams.set("part", "snippet");
  searchUrl.searchParams.set("q", query);
  searchUrl.searchParams.set("type", "video");
  // medium = 4–20 min; filters out most Shorts at the API level for search
  searchUrl.searchParams.set("videoDuration", "medium");
  searchUrl.searchParams.set("maxResults", String(maxResults));
  searchUrl.searchParams.set("key", apiKey);
  if (pageToken) searchUrl.searchParams.set("pageToken", pageToken);

  const searchRes = await fetch(searchUrl.toString());
  if (!searchRes.ok) {
    const body = await searchRes.json().catch(() => ({}));
    throw new Error(
      body?.error?.message ?? `YouTube API error ${searchRes.status}`
    );
  }
  const searchData = await searchRes.json();
  const items: RawVideoItem[] = searchData.items ?? [];
  if (items.length === 0) return { videos: [], nextPageToken: undefined };

  const ids = items
    .map((i) => (typeof i.id === "string" ? i.id : i.id.videoId))
    .join(",");
  const statsUrl = new URL(`${BASE}/videos`);
  statsUrl.searchParams.set("part", "statistics,contentDetails");
  statsUrl.searchParams.set("id", ids);
  statsUrl.searchParams.set("key", apiKey);

  const statsRes = await fetch(statsUrl.toString());
  const statsData = statsRes.ok ? await statsRes.json() : { items: [] };
  const detailsMap = new Map<
    string,
    {
      statistics?: { viewCount?: string; likeCount?: string };
      contentDetails?: { duration?: string };
    }
  >(
    (statsData.items ?? []).map(
      (s: {
        id: string;
        statistics: { viewCount?: string; likeCount?: string };
        contentDetails: { duration?: string };
      }) => [
        s.id,
        { statistics: s.statistics, contentDetails: s.contentDetails },
      ]
    )
  );

  const videos = items
    .map((item) => {
      const id = typeof item.id === "string" ? item.id : item.id.videoId;
      const details = detailsMap.get(id);
      return parseVideo({
        ...item,
        id,
        statistics: details?.statistics,
        contentDetails: details?.contentDetails,
      });
    })
    .filter(isUsable);

  return { videos, nextPageToken: searchData.nextPageToken };
}

export async function thumbnailUrlToDataUrl(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch thumbnail: ${res.status}`);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export function formatCount(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}
