import { invoke } from "@tauri-apps/api/core";
import {
  generateImageEmbedding as geminiEmbedImage,
  embedText as geminiEmbedText,
} from "@/lib/gemini-embedding";
import { getGeminiApiKey } from "@/lib/gemini-store";
import {
  downloadEmbeddingModels,
  getEmbeddingModelStatus,
  EMBEDDING_MODEL_VERSION as LOCAL_MODEL_VERSION,
  embedImage as localEmbedImage,
  embedText as localEmbedText,
} from "@/lib/local-embedding";
import { logger } from "@/lib/logger";

/**
 * Embedding provider abstraction. Builds that include the local fastembed/ONNX
 * engine use it; builds without it (e.g. macOS Intel, where ort ships no
 * prebuilt ONNX Runtime) fall back to Gemini. The choice is compile-time per
 * build, so within a session every vector comes from a single provider — the
 * two 768-dim spaces are never KNN-compared.
 */

/** model_version label for Gemini fallback vectors. Distinct from the local
 * nomic label so `clearEmbeddingsOtherModel` purges one when the other is in use. */
export const GEMINI_MODEL_VERSION = "text-embedding-004";

export type EmbeddingProvider = "local" | "gemini";

let localAvailable: boolean | null = null;

/** Whether this build ships the local engine. Cached (compile-time constant). */
export async function isLocalEmbeddingAvailable(): Promise<boolean> {
  if (localAvailable === null) {
    try {
      localAvailable = await invoke<boolean>("local_embeddings_available");
    } catch (err) {
      logger.error({ err }, "[Embedding] Capability check failed");
      localAvailable = false;
    }
  }
  return localAvailable;
}

/** The model_version label stored alongside vectors produced by this build. */
export async function getActiveEmbeddingModelVersion(): Promise<string> {
  return (await isLocalEmbeddingAvailable())
    ? LOCAL_MODEL_VERSION
    : GEMINI_MODEL_VERSION;
}

export interface EmbeddingProviderStatus {
  provider: EmbeddingProvider;
  /** Whether embedding can run now (local model installed / Gemini key present). */
  ready: boolean;
  modelVersion: string;
  /** Human-readable reason when not ready. */
  reason?: string;
}

export async function getEmbeddingProviderStatus(): Promise<EmbeddingProviderStatus> {
  if (await isLocalEmbeddingAvailable()) {
    try {
      const status = await getEmbeddingModelStatus();
      return {
        provider: "local",
        ready: status.installed,
        modelVersion: LOCAL_MODEL_VERSION,
        reason: status.installed ? undefined : "Local model not installed yet",
      };
    } catch (err) {
      logger.error({ err }, "[Embedding] Local status check failed");
      return {
        provider: "local",
        ready: false,
        modelVersion: LOCAL_MODEL_VERSION,
        reason: "Local embedding engine unavailable",
      };
    }
  }

  const apiKey = await getGeminiApiKey();
  return {
    provider: "gemini",
    ready: Boolean(apiKey),
    modelVersion: GEMINI_MODEL_VERSION,
    reason: apiKey
      ? undefined
      : "Add a Gemini API key to enable semantic search on this build",
  };
}

async function requireGeminiKey(): Promise<string> {
  const apiKey = await getGeminiApiKey();
  if (!apiKey) {
    throw new Error(
      "Gemini API key required for embeddings on this build (no local engine)"
    );
  }
  return apiKey;
}

/** Embed a thumbnail image, returning the vector and the model_version to store. */
export async function embedImageForIndex(
  dataUrl: string
): Promise<{ embedding: number[]; modelVersion: string }> {
  if (await isLocalEmbeddingAvailable()) {
    return {
      embedding: await localEmbedImage(dataUrl),
      modelVersion: LOCAL_MODEL_VERSION,
    };
  }
  const apiKey = await requireGeminiKey();
  return {
    embedding: await geminiEmbedImage(apiKey, dataUrl),
    modelVersion: GEMINI_MODEL_VERSION,
  };
}

/** Embed a text query for KNN search. */
export async function embedQueryText(text: string): Promise<number[]> {
  if (await isLocalEmbeddingAvailable()) {
    return await localEmbedText(text);
  }
  const apiKey = await requireGeminiKey();
  return await geminiEmbedText(apiKey, text);
}

/**
 * Ensure the active provider is ready to embed. Downloads the local models when
 * the local engine is present; a no-op for the Gemini fallback (nothing to
 * install — readiness is just an API key, surfaced via getEmbeddingProviderStatus).
 */
export async function ensureEmbeddingModelsReady(): Promise<void> {
  if (await isLocalEmbeddingAvailable()) {
    await downloadEmbeddingModels();
  }
}
