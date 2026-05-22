const BASE = "https://www.googleapis.com/youtube/v3";

export interface MyChannelVideo {
  id: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  publishedAt: string;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  durationSeconds: number;
}

export interface PagedChannelVideos {
  videos: MyChannelVideo[];
  nextPageToken?: string;
}

interface RawThumbnails {
  maxres?: { url: string };
  high?: { url: string };
  medium?: { url: string };
}

function bestThumbnail(thumbnails: RawThumbnails): string {
  return (
    thumbnails.maxres?.url ??
    thumbnails.high?.url ??
    thumbnails.medium?.url ??
    ""
  );
}

const ISO_DURATION_REGEX = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/;

function parseDuration(iso: string): number {
  const m = iso.match(ISO_DURATION_REGEX);
  if (!m) return 0;
  return Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
}

export async function getMyChannelVideos(
  accessToken: string,
  pageToken?: string,
  maxResults = 50
): Promise<PagedChannelVideos> {
  const authHeader = { Authorization: `Bearer ${accessToken}` };

  // Step 1: Get uploads playlist ID
  const channelsUrl = new URL(`${BASE}/channels`);
  channelsUrl.searchParams.set("part", "contentDetails");
  channelsUrl.searchParams.set("mine", "true");

  const channelsRes = await fetch(channelsUrl.toString(), {
    headers: authHeader,
  });
  if (!channelsRes.ok) {
    const body = await channelsRes.json().catch(() => ({}));
    throw new Error(
      body?.error?.message ?? `YouTube API error ${channelsRes.status}`
    );
  }
  const channelsData = await channelsRes.json();
  const uploadsPlaylistId: string =
    channelsData.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
  if (!uploadsPlaylistId) {
    throw new Error("Could not find uploads playlist for this channel");
  }

  // Step 2: Get playlist items (video IDs)
  const playlistUrl = new URL(`${BASE}/playlistItems`);
  playlistUrl.searchParams.set("part", "snippet");
  playlistUrl.searchParams.set("playlistId", uploadsPlaylistId);
  playlistUrl.searchParams.set("maxResults", String(maxResults));
  if (pageToken) playlistUrl.searchParams.set("pageToken", pageToken);

  const playlistRes = await fetch(playlistUrl.toString(), {
    headers: authHeader,
  });
  if (!playlistRes.ok) {
    const body = await playlistRes.json().catch(() => ({}));
    throw new Error(
      body?.error?.message ?? `YouTube API error ${playlistRes.status}`
    );
  }
  const playlistData = await playlistRes.json();
  const nextPageToken: string | undefined = playlistData.nextPageToken;
  const playlistItems: Array<{
    snippet: {
      resourceId: { videoId: string };
      title: string;
      description: string;
      publishedAt: string;
      thumbnails: RawThumbnails;
    };
  }> = playlistData.items ?? [];

  if (playlistItems.length === 0) {
    return { videos: [], nextPageToken };
  }

  const videoIds = playlistItems.map((item) => item.snippet.resourceId.videoId);

  // Step 3: Get full video data (statistics + contentDetails)
  const videosUrl = new URL(`${BASE}/videos`);
  videosUrl.searchParams.set("part", "snippet,statistics,contentDetails");
  videosUrl.searchParams.set("id", videoIds.join(","));

  const videosRes = await fetch(videosUrl.toString(), {
    headers: authHeader,
  });
  if (!videosRes.ok) {
    const body = await videosRes.json().catch(() => ({}));
    throw new Error(
      body?.error?.message ?? `YouTube API error ${videosRes.status}`
    );
  }
  const videosData = await videosRes.json();

  const detailsMap = new Map<
    string,
    {
      snippet?: {
        title: string;
        description: string;
        publishedAt: string;
        thumbnails: RawThumbnails;
      };
      statistics?: {
        viewCount?: string;
        likeCount?: string;
        commentCount?: string;
      };
      contentDetails?: { duration?: string };
    }
  >(
    (videosData.items ?? []).map(
      (item: {
        id: string;
        snippet: {
          title: string;
          description: string;
          publishedAt: string;
          thumbnails: RawThumbnails;
        };
        statistics: {
          viewCount?: string;
          likeCount?: string;
          commentCount?: string;
        };
        contentDetails: { duration?: string };
      }) => [
        item.id,
        {
          snippet: item.snippet,
          statistics: item.statistics,
          contentDetails: item.contentDetails,
        },
      ]
    )
  );

  const videos: MyChannelVideo[] = videoIds
    .map((videoId) => {
      const detail = detailsMap.get(videoId);
      const playlistItem = playlistItems.find(
        (p) => p.snippet.resourceId.videoId === videoId
      );
      const snippet = detail?.snippet ?? playlistItem?.snippet;
      return {
        id: videoId,
        title: snippet?.title ?? "",
        description: snippet?.description ?? "",
        thumbnailUrl: snippet ? bestThumbnail(snippet.thumbnails) : "",
        publishedAt: snippet?.publishedAt ?? "",
        viewCount: Number(detail?.statistics?.viewCount ?? 0),
        likeCount: Number(detail?.statistics?.likeCount ?? 0),
        commentCount: Number(detail?.statistics?.commentCount ?? 0),
        durationSeconds: parseDuration(detail?.contentDetails?.duration ?? ""),
      };
    })
    .filter((v) => v.title.length > 0);

  return { videos, nextPageToken };
}

export async function uploadThumbnail(
  accessToken: string,
  videoId: string,
  imageBlob: Blob
): Promise<{ url: string }> {
  const arrayBuffer = await imageBlob.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);

  const url = `https://www.googleapis.com/upload/youtube/v3/thumbnails/set?videoId=${videoId}&uploadType=media`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": imageBlob.type || "image/jpeg",
    },
    body: bytes,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error?.message ?? `YouTube API error ${res.status}`);
  }

  const data = await res.json();
  return { url: data.items?.[0]?.url ?? "" };
}
