const BASE = "https://www.googleapis.com/youtube/v3";

export interface YoutubeVideo {
  id: string;
  title: string;
  channelTitle: string;
  thumbnailUrl: string;
  viewCount: number;
  likeCount: number;
  publishedAt: string;
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
  };
}

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

function parseVideo(item: RawVideoItem): YoutubeVideo {
  const id = typeof item.id === "string" ? item.id : item.id.videoId;
  return {
    id,
    title: item.snippet.title,
    channelTitle: item.snippet.channelTitle,
    thumbnailUrl: bestThumbnail(item.snippet.thumbnails),
    viewCount: Number(item.statistics?.viewCount ?? 0),
    likeCount: Number(item.statistics?.likeCount ?? 0),
    publishedAt: item.snippet.publishedAt,
  };
}

export async function fetchTrendingVideos(
  apiKey: string,
  regionCode = "US",
  maxResults = 24
): Promise<YoutubeVideo[]> {
  const url = new URL(`${BASE}/videos`);
  url.searchParams.set("part", "snippet,statistics");
  url.searchParams.set("chart", "mostPopular");
  url.searchParams.set("regionCode", regionCode);
  url.searchParams.set("maxResults", String(maxResults));
  url.searchParams.set("key", apiKey);

  const res = await fetch(url.toString());
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error?.message ?? `YouTube API error ${res.status}`);
  }
  const data = await res.json();
  return (data.items ?? []).map(parseVideo);
}

export async function searchVideos(
  apiKey: string,
  query: string,
  maxResults = 24
): Promise<YoutubeVideo[]> {
  // Step 1: search to get video IDs (100 quota units)
  const searchUrl = new URL(`${BASE}/search`);
  searchUrl.searchParams.set("part", "snippet");
  searchUrl.searchParams.set("q", query);
  searchUrl.searchParams.set("type", "video");
  searchUrl.searchParams.set("maxResults", String(maxResults));
  searchUrl.searchParams.set("key", apiKey);

  const searchRes = await fetch(searchUrl.toString());
  if (!searchRes.ok) {
    const body = await searchRes.json().catch(() => ({}));
    throw new Error(
      body?.error?.message ?? `YouTube API error ${searchRes.status}`
    );
  }
  const searchData = await searchRes.json();
  const items: RawVideoItem[] = searchData.items ?? [];
  if (items.length === 0) return [];

  // Step 2: fetch statistics for those IDs (1 quota unit)
  const ids = items
    .map((i) => (typeof i.id === "string" ? i.id : i.id.videoId))
    .join(",");
  const statsUrl = new URL(`${BASE}/videos`);
  statsUrl.searchParams.set("part", "statistics");
  statsUrl.searchParams.set("id", ids);
  statsUrl.searchParams.set("key", apiKey);

  const statsRes = await fetch(statsUrl.toString());
  const statsData = statsRes.ok ? await statsRes.json() : { items: [] };
  const statsMap = new Map<string, { viewCount?: string; likeCount?: string }>(
    (statsData.items ?? []).map(
      (s: {
        id: string;
        statistics: { viewCount?: string; likeCount?: string };
      }) => [s.id, s.statistics]
    )
  );

  return items.map((item) => {
    const id = typeof item.id === "string" ? item.id : item.id.videoId;
    return parseVideo({ ...item, id, statistics: statsMap.get(id) });
  });
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
