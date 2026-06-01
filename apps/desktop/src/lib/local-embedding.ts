import { invoke } from "@tauri-apps/api/core";
import { logger } from "@/lib/logger";

/**
 * Local, fully-offline embeddings via fastembed (ONNX, in-process).
 *
 * Images are embedded with nomic-embed-vision-v1.5 and text queries with
 * nomic-embed-text-v1.5. Both produce 768-dim vectors in an aligned space, so a
 * text query retrieves visually-matching images directly — no cloud, no API key.
 * This must match `CURRENT_MODEL_VERSION` in `src-tauri/src/embeddings.rs`.
 */
export const EMBEDDING_MODEL_VERSION = "nomic-embed-vision-v1.5";

export interface EmbeddingModelStatus {
  installed: boolean;
  loaded: boolean;
}

export async function getEmbeddingModelStatus(): Promise<EmbeddingModelStatus> {
  return await invoke<EmbeddingModelStatus>("embedding_model_status");
}

export async function downloadEmbeddingModels(): Promise<void> {
  await invoke("download_embedding_models");
}

export async function embedImage(dataUrl: string): Promise<number[]> {
  return await invoke<number[]>("embed_image", { dataUrl });
}

export async function embedText(text: string): Promise<number[]> {
  return await invoke<number[]>("embed_text", { text });
}

export async function setEmbeddingIdleTimeout(secs: number): Promise<void> {
  await invoke("set_embedding_idle_timeout", { secs });
}

export async function unloadEmbeddingModels(): Promise<void> {
  try {
    await invoke("unload_embedding_models");
  } catch (err) {
    logger.error({ err }, "[Embedding] Failed to unload models");
  }
}
