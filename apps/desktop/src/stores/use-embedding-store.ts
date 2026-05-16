import { create } from "zustand";
import { embedText, generateImageEmbedding } from "@/lib/gemini-embedding";
import { getGeminiApiKey } from "@/lib/gemini-store";
import { logger } from "@/lib/logger";
import {
  deleteEmbedding,
  deleteEmbeddingsBatch,
  getEmbeddedProjectIds,
  getEmbeddingStats,
  markEmbeddingFailed,
  searchSimilarEmbeddings,
  storeEmbedding,
} from "@/lib/semantic-search";
import { loadPreview } from "@/lib/thumbnail-storage";

const CONCURRENCY = 3;
const MAX_RETRIES = 3;

interface EmbeddingProgress {
  current: number;
  total: number;
  failed: number;
}

interface EmbeddingState {
  isEmbedding: boolean;
  progress: EmbeddingProgress;
  embeddedIds: Set<string>;
  stats: { embedded: number; failed: number } | null;

  loadEmbeddedIds: () => Promise<void>;
  loadStats: () => Promise<void>;

  // Schedule single embed (fire-and-forget, used when adding new images)
  scheduleEmbed: (projectId: string) => void;

  // Embed a specific image immediately (returns error string if fails)
  embedSingle: (projectId: string) => Promise<string | null>;

  // Check missing embeddings vs given project IDs, embed all missing
  checkAndEmbedMissing: (
    allProjectIds: string[],
    onProgress?: (progress: EmbeddingProgress) => void
  ) => Promise<void>;

  // Remove embedding for a project
  removeEmbedding: (projectId: string) => Promise<void>;
  removeEmbeddingsBatch: (projectIds: string[]) => Promise<void>;

  // Semantic search: embed query text, then KNN search
  performSemanticSearch: (query: string) => Promise<string[]>;
}

export const useEmbeddingStore = create<EmbeddingState>()((set, get) => ({
  isEmbedding: false,
  progress: { current: 0, total: 0, failed: 0 },
  embeddedIds: new Set(),
  stats: null,

  loadEmbeddedIds: async () => {
    try {
      const ids = await getEmbeddedProjectIds();
      set({ embeddedIds: new Set(ids) });
    } catch (err) {
      logger.error({ err }, "[Embedding] Failed to load embedded IDs");
    }
  },

  loadStats: async () => {
    try {
      const stats = await getEmbeddingStats();
      set({ stats });
    } catch (err) {
      logger.error({ err }, "[Embedding] Failed to load stats");
    }
  },

  scheduleEmbed: (projectId) => {
    setTimeout(() => {
      get()
        .embedSingle(projectId)
        .catch((err) => {
          logger.error(
            { err, projectId },
            "[Embedding] Scheduled embed failed"
          );
        });
    }, 0);
  },

  embedSingle: async (projectId) => {
    const apiKey = await getGeminiApiKey();
    if (!apiKey) return "No Gemini API key configured";

    try {
      const previewDataUrl = await loadPreview(projectId);
      if (!previewDataUrl) return `No image found for ${projectId}`;

      const embedding = await generateImageEmbedding(apiKey, previewDataUrl);
      await storeEmbedding(projectId, embedding);

      set((state) => ({
        embeddedIds: new Set([...state.embeddedIds, projectId]),
      }));

      logger.info({ projectId }, "[Embedding] Embedded successfully");
      return null;
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      logger.error({ err, projectId }, "[Embedding] Failed to embed");
      await markEmbeddingFailed(projectId, reason).catch(() => {});
      return reason;
    }
  },

  checkAndEmbedMissing: async (allProjectIds, onProgress) => {
    if (get().isEmbedding) return;

    const apiKey = await getGeminiApiKey();
    if (!apiKey) {
      logger.warn("[Embedding] No API key, skipping embedding");
      return;
    }

    const embeddedIds = await getEmbeddedProjectIds();
    const embeddedSet = new Set(embeddedIds);
    const missing = allProjectIds.filter((id) => !embeddedSet.has(id));

    if (missing.length === 0) {
      logger.info("[Embedding] All projects already embedded");
      set({ embeddedIds: embeddedSet });
      return;
    }

    logger.info({ count: missing.length }, "[Embedding] Starting batch embed");

    set({
      isEmbedding: true,
      embeddedIds: embeddedSet,
      progress: { current: 0, total: missing.length, failed: 0 },
    });

    let current = 0;
    let failed = 0;

    // Process in batches of CONCURRENCY
    for (let i = 0; i < missing.length; i += CONCURRENCY) {
      const batch = missing.slice(i, i + CONCURRENCY);

      await Promise.all(
        batch.map(async (projectId) => {
          const err = await get().embedSingle(projectId);
          current += 1;
          if (err) failed += 1;

          const progress = {
            current,
            total: missing.length,
            failed,
          };
          set({ progress });
          onProgress?.(progress);
        })
      );
    }

    // Reload stats
    await get().loadStats();

    set({
      isEmbedding: false,
      progress: { current, total: missing.length, failed },
    });

    logger.info(
      { embedded: current - failed, failed },
      "[Embedding] Batch embed complete"
    );
  },

  removeEmbedding: async (projectId) => {
    try {
      await deleteEmbedding(projectId);
      set((state) => {
        const next = new Set(state.embeddedIds);
        next.delete(projectId);
        return { embeddedIds: next };
      });
    } catch (err) {
      logger.error(
        { err, projectId },
        "[Embedding] Failed to remove embedding"
      );
    }
  },

  removeEmbeddingsBatch: async (projectIds) => {
    try {
      await deleteEmbeddingsBatch(projectIds);
      set((state) => {
        const next = new Set(state.embeddedIds);
        for (const id of projectIds) next.delete(id);
        return { embeddedIds: next };
      });
    } catch (err) {
      logger.error({ err }, "[Embedding] Failed to batch remove embeddings");
    }
  },

  performSemanticSearch: async (query) => {
    const apiKey = await getGeminiApiKey();
    if (!apiKey) return [];

    try {
      const embedding = await embedText(apiKey, query);
      const ids = await searchSimilarEmbeddings(embedding, 100);
      return ids;
    } catch (err) {
      logger.error({ err }, "[Embedding] Semantic search failed");
      return [];
    }
  },
}));
