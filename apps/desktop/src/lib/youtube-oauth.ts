import { invoke } from "@tauri-apps/api/core";
import { logger } from "@/lib/logger";

const KEY_ACCESS_TOKEN = "yt_oauth_access_token";
const KEY_REFRESH_TOKEN = "yt_oauth_refresh_token";
const KEY_EXPIRES_AT = "yt_oauth_expires_at";
const KEY_CHANNEL_ID = "yt_oauth_channel_id";
const KEY_CHANNEL_NAME = "yt_oauth_channel_name";
const KEY_CHANNEL_THUMBNAIL = "yt_oauth_channel_thumbnail";
const KEY_CLIENT_ID = "yt_oauth_client_id";
const KEY_CLIENT_SECRET = "yt_oauth_client_secret";

export interface OAuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // unix seconds
  channelId: string;
  channelName: string;
  channelThumbnail: string;
}

export interface OAuthCredentials {
  clientId: string;
  clientSecret: string;
}

export async function getOAuthCredentials(): Promise<OAuthCredentials | null> {
  try {
    const clientId = await invoke<string | null>("secure_storage_retrieve", {
      key: KEY_CLIENT_ID,
    });
    const clientSecret = await invoke<string | null>(
      "secure_storage_retrieve",
      {
        key: KEY_CLIENT_SECRET,
      }
    );
    if (!(clientId && clientSecret)) return null;
    return { clientId, clientSecret };
  } catch (error) {
    logger.error(
      { err: error },
      "[YouTubeOAuth] Failed to get OAuth credentials"
    );
    return null;
  }
}

export async function setOAuthCredentials(
  clientId: string,
  clientSecret: string
): Promise<void> {
  try {
    await invoke("secure_storage_store", {
      key: KEY_CLIENT_ID,
      value: clientId,
    });
    await invoke("secure_storage_store", {
      key: KEY_CLIENT_SECRET,
      value: clientSecret,
    });
  } catch (error) {
    logger.error(
      { err: error },
      "[YouTubeOAuth] Failed to set OAuth credentials"
    );
    throw error;
  }
}

export async function removeOAuthCredentials(): Promise<void> {
  try {
    await invoke("secure_storage_remove_encrypted", { key: KEY_CLIENT_ID });
    await invoke("secure_storage_remove_encrypted", { key: KEY_CLIENT_SECRET });
  } catch (error) {
    logger.error(
      { err: error },
      "[YouTubeOAuth] Failed to remove OAuth credentials"
    );
    throw error;
  }
}

export async function getStoredTokens(): Promise<OAuthTokens | null> {
  try {
    const accessToken = await invoke<string | null>("secure_storage_retrieve", {
      key: KEY_ACCESS_TOKEN,
    });
    const refreshToken = await invoke<string | null>(
      "secure_storage_retrieve",
      {
        key: KEY_REFRESH_TOKEN,
      }
    );
    const expiresAtStr = await invoke<string | null>(
      "secure_storage_retrieve",
      {
        key: KEY_EXPIRES_AT,
      }
    );
    const channelId = await invoke<string | null>("secure_storage_retrieve", {
      key: KEY_CHANNEL_ID,
    });
    const channelName = await invoke<string | null>("secure_storage_retrieve", {
      key: KEY_CHANNEL_NAME,
    });
    const channelThumbnail = await invoke<string | null>(
      "secure_storage_retrieve",
      {
        key: KEY_CHANNEL_THUMBNAIL,
      }
    );

    if (!(accessToken && channelId)) return null;

    return {
      accessToken,
      refreshToken: refreshToken ?? "",
      expiresAt: expiresAtStr ? Number(expiresAtStr) : 0,
      channelId,
      channelName: channelName ?? "",
      channelThumbnail: channelThumbnail ?? "",
    };
  } catch (error) {
    logger.error({ err: error }, "[YouTubeOAuth] Failed to get stored tokens");
    return null;
  }
}

export async function storeOAuthTokens(tokens: OAuthTokens): Promise<void> {
  try {
    await invoke("secure_storage_store", {
      key: KEY_ACCESS_TOKEN,
      value: tokens.accessToken,
    });
    await invoke("secure_storage_store", {
      key: KEY_REFRESH_TOKEN,
      value: tokens.refreshToken,
    });
    await invoke("secure_storage_store", {
      key: KEY_EXPIRES_AT,
      value: String(tokens.expiresAt),
    });
    await invoke("secure_storage_store", {
      key: KEY_CHANNEL_ID,
      value: tokens.channelId,
    });
    await invoke("secure_storage_store", {
      key: KEY_CHANNEL_NAME,
      value: tokens.channelName,
    });
    await invoke("secure_storage_store", {
      key: KEY_CHANNEL_THUMBNAIL,
      value: tokens.channelThumbnail,
    });
  } catch (error) {
    logger.error({ err: error }, "[YouTubeOAuth] Failed to store OAuth tokens");
    throw error;
  }
}

export async function clearOAuthTokens(): Promise<void> {
  const keys = [
    KEY_ACCESS_TOKEN,
    KEY_REFRESH_TOKEN,
    KEY_EXPIRES_AT,
    KEY_CHANNEL_ID,
    KEY_CHANNEL_NAME,
    KEY_CHANNEL_THUMBNAIL,
  ];
  try {
    for (const key of keys) {
      await invoke("secure_storage_remove_encrypted", { key });
    }
  } catch (error) {
    logger.error({ err: error }, "[YouTubeOAuth] Failed to clear OAuth tokens");
    throw error;
  }
}

export async function getValidAccessToken(): Promise<string | null> {
  try {
    const tokens = await getStoredTokens();
    if (!tokens) return null;

    const secondsUntilExpiry = tokens.expiresAt - Date.now() / 1000;
    if (secondsUntilExpiry < 120) {
      await refreshAccessToken();
      const refreshed = await getStoredTokens();
      return refreshed?.accessToken ?? null;
    }

    return tokens.accessToken;
  } catch (error) {
    logger.error(
      { err: error },
      "[YouTubeOAuth] Failed to get valid access token"
    );
    return null;
  }
}

export async function initiateOAuth(
  clientId: string,
  clientSecret: string
): Promise<string> {
  try {
    const authUrl = await invoke<string>("youtube_oauth_initiate", {
      clientId,
      clientSecret,
    });
    return authUrl;
  } catch (error) {
    logger.error({ err: error }, "[YouTubeOAuth] Failed to initiate OAuth");
    throw error;
  }
}

export async function refreshAccessToken(): Promise<void> {
  try {
    const refreshToken = await invoke<string | null>(
      "secure_storage_retrieve",
      {
        key: KEY_REFRESH_TOKEN,
      }
    );
    const clientId = await invoke<string | null>("secure_storage_retrieve", {
      key: KEY_CLIENT_ID,
    });
    const clientSecret = await invoke<string | null>(
      "secure_storage_retrieve",
      {
        key: KEY_CLIENT_SECRET,
      }
    );

    if (!(refreshToken && clientId && clientSecret)) {
      throw new Error("Missing credentials for token refresh");
    }

    const result = await invoke<{ access_token: string; expires_in: number }>(
      "youtube_token_refresh",
      { refreshToken, clientId, clientSecret }
    );

    const newExpiresAt = Math.floor(Date.now() / 1000) + result.expires_in;

    await invoke("secure_storage_store", {
      key: KEY_ACCESS_TOKEN,
      value: result.access_token,
    });
    await invoke("secure_storage_store", {
      key: KEY_EXPIRES_AT,
      value: String(newExpiresAt),
    });
  } catch (error) {
    logger.error(
      { err: error },
      "[YouTubeOAuth] Failed to refresh access token"
    );
    throw error;
  }
}

export async function revokeOAuth(): Promise<void> {
  try {
    const accessToken = await invoke<string | null>("secure_storage_retrieve", {
      key: KEY_ACCESS_TOKEN,
    });

    if (accessToken) {
      await invoke("youtube_oauth_revoke", { accessToken });
    }
  } catch (error) {
    logger.error({ err: error }, "[YouTubeOAuth] Failed to revoke OAuth token");
  } finally {
    await clearOAuthTokens();
  }
}
