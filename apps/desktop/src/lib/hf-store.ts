import { invoke } from "@tauri-apps/api/core";
import { logger } from "@/lib/logger";

const HF_TOKEN_KEY = "huggingface_token";

export async function getHfToken(): Promise<string | null> {
  try {
    return await invoke<string | null>("secure_storage_retrieve", {
      key: HF_TOKEN_KEY,
    });
  } catch (error) {
    logger.error({ err: error }, "Failed to load HuggingFace token");
    return null;
  }
}

export async function setHfToken(token: string): Promise<void> {
  try {
    if (!token) {
      await removeHfToken();
      return;
    }
    await invoke("secure_storage_store", { key: HF_TOKEN_KEY, value: token });
  } catch (error) {
    logger.error({ err: error }, "Failed to save HuggingFace token");
    throw error;
  }
}

export async function removeHfToken(): Promise<void> {
  try {
    await invoke("secure_storage_remove_encrypted", { key: HF_TOKEN_KEY });
  } catch (error) {
    logger.error({ err: error }, "Failed to remove HuggingFace token");
    throw error;
  }
}

export async function hasHfToken(): Promise<boolean> {
  try {
    return await invoke("secure_storage_exists", { key: HF_TOKEN_KEY });
  } catch (error) {
    logger.error({ err: error }, "Failed to check HuggingFace token");
    return false;
  }
}
