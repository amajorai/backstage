import { listen } from "@tauri-apps/api/event";
import { openUrl } from "@tauri-apps/plugin-opener";
import { sileo } from "sileo";
import { create } from "zustand";
import { logger } from "@/lib/logger";
import type { OAuthTokens } from "@/lib/youtube-oauth";
import {
  getStoredTokens,
  initiateOAuth,
  removeOAuthCredentials,
  revokeOAuth,
  setOAuthCredentials,
  storeOAuthTokens,
} from "@/lib/youtube-oauth";

interface OAuthCompletePayload {
  success: boolean;
  error?: string;
  access_token?: string;
  refresh_token?: string;
  expires_at?: number; // absolute unix seconds, computed in Rust
  channel_id?: string;
  channel_name?: string;
  channel_thumbnail?: string;
}

interface YtOAuthState {
  isConnected: boolean;
  isConnecting: boolean;
  channelId: string | null;
  channelName: string | null;
  channelThumbnail: string | null;
  load: () => Promise<void>;
  connect: (clientId: string, clientSecret: string) => Promise<void>;
  disconnect: () => Promise<void>;
}

let listenerRegistered = false;

export const useYtOAuthStore = create<YtOAuthState>()((set) => ({
  isConnected: false,
  isConnecting: false,
  channelId: null,
  channelName: null,
  channelThumbnail: null,

  load: async () => {
    try {
      const tokens = await getStoredTokens();
      if (tokens) {
        set({
          isConnected: true,
          channelId: tokens.channelId,
          channelName: tokens.channelName,
          channelThumbnail: tokens.channelThumbnail,
        });
      }
    } catch (error) {
      logger.error(
        { err: error },
        "[YtOAuthStore] Failed to load stored tokens"
      );
    }

    if (listenerRegistered) return;
    listenerRegistered = true;

    try {
      await listen<OAuthCompletePayload>("yt_oauth_complete", async (event) => {
        const payload = event.payload;
        if (!payload.success) {
          set({ isConnecting: false });
          sileo.error({
            title: "OAuth failed",
            description: payload.error ?? "Unknown error",
          });
          return;
        }

        try {
          const tokens: OAuthTokens = {
            accessToken: payload.access_token ?? "",
            refreshToken: payload.refresh_token ?? "",
            expiresAt:
              payload.expires_at ?? Math.floor(Date.now() / 1000) + 3600,
            channelId: payload.channel_id ?? "",
            channelName: payload.channel_name ?? "",
            channelThumbnail: payload.channel_thumbnail ?? "",
          };
          await storeOAuthTokens(tokens);
          set({
            isConnected: true,
            isConnecting: false,
            channelId: tokens.channelId,
            channelName: tokens.channelName,
            channelThumbnail: tokens.channelThumbnail,
          });
        } catch (error) {
          logger.error(
            { err: error },
            "[YtOAuthStore] Failed to store tokens after OAuth complete"
          );
          set({ isConnecting: false });
          sileo.error({
            title: "OAuth failed",
            description: "Failed to save authentication tokens",
          });
        }
      });
    } catch (error) {
      logger.error(
        { err: error },
        "[YtOAuthStore] Failed to register OAuth complete listener"
      );
    }
  },

  connect: async (clientId, clientSecret) => {
    set({ isConnecting: true });
    try {
      await setOAuthCredentials(clientId, clientSecret);
      const authUrl = await initiateOAuth(clientId, clientSecret);
      await openUrl(authUrl);
    } catch (error) {
      logger.error(
        { err: error },
        "[YtOAuthStore] Failed to initiate OAuth connect"
      );
      set({ isConnecting: false });
      sileo.error({
        title: "Connection failed",
        description:
          error instanceof Error ? error.message : "Failed to start OAuth flow",
      });
    }
  },

  disconnect: async () => {
    set({
      isConnected: false,
      isConnecting: false,
      channelId: null,
      channelName: null,
      channelThumbnail: null,
    });
    try {
      await revokeOAuth();
    } catch (error) {
      logger.error(
        { err: error },
        "[YtOAuthStore] Failed to revoke OAuth token"
      );
    }
    try {
      await removeOAuthCredentials();
    } catch (error) {
      logger.error(
        { err: error },
        "[YtOAuthStore] Failed to remove OAuth credentials"
      );
    }
  },
}));

useYtOAuthStore.getState().load();
