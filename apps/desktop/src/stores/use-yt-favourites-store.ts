import { create } from "zustand";
import { getDb } from "@/lib/db";
import type { YoutubeVideo } from "@/lib/youtube-api";

export interface YtFavourite extends YoutubeVideo {
  savedAt: number;
}

interface YtFavouritesState {
  favourites: YtFavourite[];
  favouriteIds: Set<string>;
  isLoaded: boolean;
  addFavourite: (video: YoutubeVideo) => Promise<void>;
  removeFavourite: (videoId: string) => Promise<void>;
  toggleFavourite: (video: YoutubeVideo) => Promise<void>;
  isFavourite: (videoId: string) => boolean;
  loadFromDb: () => Promise<void>;
}

export const useYtFavouritesStore = create<YtFavouritesState>()((set, get) => ({
  favourites: [],
  favouriteIds: new Set(),
  isLoaded: false,

  addFavourite: async (video) => {
    const savedAt = Date.now();
    const fav: YtFavourite = { ...video, savedAt };

    set((state) => ({
      favourites: [fav, ...state.favourites],
      favouriteIds: new Set([...state.favouriteIds, video.id]),
    }));

    try {
      const db = await getDb();
      await db.execute(
        `INSERT OR REPLACE INTO yt_favourites
            (videoId, title, channelTitle, thumbnailUrl, viewCount, likeCount, commentCount, publishedAt, durationSeconds, savedAt)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          video.id,
          video.title,
          video.channelTitle,
          video.thumbnailUrl,
          video.viewCount,
          video.likeCount,
          video.commentCount,
          video.publishedAt,
          video.durationSeconds,
          savedAt,
        ]
      );
    } catch {
      // rollback state
      set((state) => {
        const newIds = new Set(state.favouriteIds);
        newIds.delete(video.id);
        return {
          favourites: state.favourites.filter((f) => f.id !== video.id),
          favouriteIds: newIds,
        };
      });
    }
  },

  removeFavourite: async (videoId) => {
    const existing = get().favourites.find((f) => f.id === videoId);

    set((state) => {
      const newIds = new Set(state.favouriteIds);
      newIds.delete(videoId);
      return {
        favourites: state.favourites.filter((f) => f.id !== videoId),
        favouriteIds: newIds,
      };
    });

    try {
      const db = await getDb();
      await db.execute("DELETE FROM yt_favourites WHERE videoId = $1", [
        videoId,
      ]);
    } catch {
      // rollback
      if (existing) {
        set((state) => ({
          favourites: [existing, ...state.favourites],
          favouriteIds: new Set([...state.favouriteIds, videoId]),
        }));
      }
    }
  },

  toggleFavourite: async (video) => {
    if (get().isFavourite(video.id)) {
      await get().removeFavourite(video.id);
    } else {
      await get().addFavourite(video);
    }
  },

  isFavourite: (videoId) => get().favouriteIds.has(videoId),

  loadFromDb: async () => {
    try {
      const db = await getDb();
      const rows = await db.select<
        {
          videoId: string;
          title: string;
          channelTitle: string;
          thumbnailUrl: string;
          viewCount: number;
          likeCount: number;
          commentCount: number;
          publishedAt: string;
          durationSeconds: number;
          savedAt: number;
        }[]
      >("SELECT * FROM yt_favourites ORDER BY savedAt DESC");

      const favourites: YtFavourite[] = rows.map((r) => ({
        id: r.videoId,
        title: r.title,
        channelTitle: r.channelTitle,
        thumbnailUrl: r.thumbnailUrl,
        viewCount: r.viewCount,
        likeCount: r.likeCount,
        commentCount: r.commentCount,
        publishedAt: r.publishedAt,
        durationSeconds: r.durationSeconds,
        savedAt: r.savedAt,
      }));

      set({
        favourites,
        favouriteIds: new Set(favourites.map((f) => f.id)),
        isLoaded: true,
      });
    } catch {
      set({ isLoaded: true });
    }
  },
}));

useYtFavouritesStore.getState().loadFromDb();
