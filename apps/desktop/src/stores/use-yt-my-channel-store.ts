import { create } from "zustand";
import { logger } from "@/lib/logger";
import type { MyChannelVideo } from "@/lib/youtube-my-channel-api";
import { getMyChannelVideos } from "@/lib/youtube-my-channel-api";
import { getValidAccessToken } from "@/lib/youtube-oauth";

interface YtMyChannelState {
  videos: MyChannelVideo[];
  isLoading: boolean;
  isLoadingMore: boolean;
  nextPageToken: string | undefined;
  error: string | null;
  loadVideos: () => Promise<void>;
  loadMore: () => Promise<void>;
  reset: () => void;
}

export const useYtMyChannelStore = create<YtMyChannelState>()((set, get) => ({
  videos: [],
  isLoading: false,
  isLoadingMore: false,
  nextPageToken: undefined,
  error: null,

  loadVideos: async () => {
    set({ isLoading: true, error: null });
    try {
      const token = await getValidAccessToken();
      if (!token) {
        set({ isLoading: false });
        return;
      }
      const { videos, nextPageToken } = await getMyChannelVideos(token);
      set({ videos, nextPageToken, isLoading: false });
    } catch (error) {
      logger.error(
        { err: error },
        "[YtMyChannelStore] Failed to load channel videos"
      );
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : "Failed to load videos",
      });
    }
  },

  loadMore: async () => {
    const { nextPageToken, isLoadingMore } = get();
    if (!nextPageToken || isLoadingMore) return;

    set({ isLoadingMore: true });
    try {
      const token = await getValidAccessToken();
      if (!token) {
        set({ isLoadingMore: false });
        return;
      }
      const { videos: newVideos, nextPageToken: newPageToken } =
        await getMyChannelVideos(token, nextPageToken);
      set((state) => ({
        videos: [...state.videos, ...newVideos],
        nextPageToken: newPageToken,
        isLoadingMore: false,
      }));
    } catch (error) {
      logger.error(
        { err: error },
        "[YtMyChannelStore] Failed to load more channel videos"
      );
      set({ isLoadingMore: false });
    }
  },

  reset: () => {
    set({
      videos: [],
      isLoading: false,
      isLoadingMore: false,
      nextPageToken: undefined,
      error: null,
    });
  },
}));
