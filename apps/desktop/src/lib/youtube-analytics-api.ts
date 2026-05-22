const ANALYTICS_BASE = "https://youtubeanalytics.googleapis.com/v2";

export interface VideoAnalytics {
  videoId: string;
  views: number;
  estimatedMinutesWatched: number;
  averageViewDuration: number;
  impressions: number;
  impressionsCtr: number; // 0–1 decimal
}

export interface DailyMetrics {
  day: string; // YYYY-MM-DD
  views: number;
  impressions: number;
  impressionsCtr: number;
}

export async function getVideoAnalytics(
  accessToken: string,
  channelId: string,
  videoId: string,
  startDate: string,
  endDate: string
): Promise<VideoAnalytics> {
  const url = new URL(`${ANALYTICS_BASE}/reports`);
  url.searchParams.set("ids", `channel==${channelId}`);
  url.searchParams.set("startDate", startDate);
  url.searchParams.set("endDate", endDate);
  url.searchParams.set(
    "metrics",
    "views,estimatedMinutesWatched,averageViewDuration,impressions,impressionsCtr"
  );
  url.searchParams.set("filters", `video==${videoId}`);
  url.searchParams.set("dimensions", "video");

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(
      body?.error?.message ?? `YouTube Analytics API error ${res.status}`
    );
  }

  const data = await res.json();
  const row: [string, number, number, number, number, number] = data
    .rows?.[0] ?? [videoId, 0, 0, 0, 0, 0];

  return {
    videoId: row[0],
    views: row[1],
    estimatedMinutesWatched: row[2],
    averageViewDuration: row[3],
    impressions: row[4],
    impressionsCtr: row[5],
  };
}

export async function getChannelDailyMetrics(
  accessToken: string,
  channelId: string,
  startDate: string,
  endDate: string
): Promise<DailyMetrics[]> {
  const url = new URL(`${ANALYTICS_BASE}/reports`);
  url.searchParams.set("ids", `channel==${channelId}`);
  url.searchParams.set("startDate", startDate);
  url.searchParams.set("endDate", endDate);
  url.searchParams.set("metrics", "views,impressions,impressionsCtr");
  url.searchParams.set("dimensions", "day");
  url.searchParams.set("sort", "day");

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(
      body?.error?.message ?? `YouTube Analytics API error ${res.status}`
    );
  }

  const data = await res.json();
  const rows: [string, number, number, number][] = data.rows ?? [];

  return rows.map((row) => ({
    day: row[0],
    views: row[1],
    impressions: row[2],
    impressionsCtr: row[3],
  }));
}
