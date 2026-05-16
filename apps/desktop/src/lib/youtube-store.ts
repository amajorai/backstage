import { invoke } from "@tauri-apps/api/core";
import { logger } from "@/lib/logger";

const YOUTUBE_API_KEY_KEY = "youtube_api_key";

export async function getYoutubeApiKey(): Promise<string | null> {
  try {
    return await invoke<string | null>("secure_storage_retrieve", {
      key: YOUTUBE_API_KEY_KEY,
    });
  } catch (error) {
    logger.error({ err: error }, "Failed to load YouTube API key");
    return null;
  }
}

export async function setYoutubeApiKey(apiKey: string): Promise<void> {
  try {
    if (!apiKey) {
      await removeYoutubeApiKey();
      return;
    }
    await invoke("secure_storage_store", {
      key: YOUTUBE_API_KEY_KEY,
      value: apiKey,
    });
  } catch (error) {
    logger.error({ err: error }, "Failed to save YouTube API key");
    throw error;
  }
}

export async function removeYoutubeApiKey(): Promise<void> {
  try {
    await invoke("secure_storage_remove_encrypted", {
      key: YOUTUBE_API_KEY_KEY,
    });
  } catch (error) {
    logger.error({ err: error }, "Failed to remove YouTube API key");
    throw error;
  }
}
