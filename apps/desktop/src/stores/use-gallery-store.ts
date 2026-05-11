import { create } from "zustand";
import { getDb } from "@/lib/db";
import { logger } from "@/lib/logger";
import {
  loadFullImage,
  loadLayerData,
  loadPreview,
  regeneratePreviewFromFull,
  saveLayerData,
  saveThumbnail,
} from "@/lib/thumbnail-storage";
import { useTrashStore } from "@/stores/use-trash-store";

// ThumbnailItem no longer stores dataUrl - images are loaded on demand
export interface ThumbnailItem {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  canvasWidth?: number;
  canvasHeight?: number;
  folderId?: string | null;
  // Lazy loaded fields (not in DB)
  previewUrl?: string;
}

// Layer type for projects
export interface Layer {
  id: string;
  name: string;
  dataUrl: string;
  visible: boolean;
  opacity: number;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  locked: boolean;
  flipX: boolean;
  flipY: boolean;
  filters?: {
    brightness: number;
    contrast: number;
    saturation: number;
  };
}

export type SortField = "updatedAt" | "createdAt" | "name";
export type SortOrder = "desc" | "asc";

interface GalleryState {
  thumbnails: ThumbnailItem[];
  isLoaded: boolean;
  dbError: string | null;
  sortField: SortField;
  sortOrder: SortOrder;
  previewCache: Map<string, string>; // id -> previewUrl

  // Actions
  setSortField: (field: SortField) => void;
  setSortOrder: (order: SortOrder) => void;
  addThumbnail: (dataUrl: string, name?: string) => Promise<string>;
  duplicateThumbnail: (id: string) => Promise<void>;
  duplicateThumbnailsBatch: (ids: string[]) => Promise<void>;
  deleteThumbnailsBatch: (ids: string[]) => Promise<void>;
  saveProject: (
    id: string | null,
    name: string,
    previewDataUrl: string,
    layers: Layer[],
    canvasWidth: number,
    canvasHeight: number,
    options?: { pages?: any[] }
  ) => Promise<string>;
  updateThumbnailName: (id: string, name: string) => Promise<void>;
  updateThumbnail: (id: string, dataUrl: string) => Promise<void>;
  setThumbnailFolder: (id: string, folderId: string | null) => Promise<void>;
  deleteThumbnail: (id: string) => Promise<void>;
  restoreThumbnail: (trashItem: {
    id: string;
    name: string;
    originalCreatedAt: number;
    originalUpdatedAt: number;
    canvasWidth?: number;
    canvasHeight?: number;
  }) => Promise<void>;
  loadFromDb: () => Promise<void>;

  // Lazy loading
  loadPreviewForId: (id: string) => Promise<string | null>;
  loadFullImageForId: (id: string) => Promise<string | null>;
  loadLayerDataForId: (id: string) => Promise<any[] | null>;
}

export const useGalleryStore = create<GalleryState>()((set, get) => ({
  thumbnails: [],
  isLoaded: false,
  dbError: null,
  sortField: "updatedAt",
  sortOrder: "desc",
  previewCache: new Map(),

  setSortField: (field) => set({ sortField: field }),
  setSortOrder: (order) => set({ sortOrder: order }),

  addThumbnail: async (dataUrl, name) => {
    const now = Date.now();
    const id = crypto.randomUUID();
    const itemName = name || `Thumbnail ${get().thumbnails.length + 1}`;

    logger.info({ itemName }, "[Gallery] Adding thumbnail");

    // Save image files (full + preview)
    const { previewUrl } = await saveThumbnail(id, dataUrl);

    const newItem: ThumbnailItem = {
      id,
      name: itemName,
      createdAt: now,
      updatedAt: now,
      previewUrl, // Include preview for immediate display
    };

    set((state) => ({
      thumbnails: [newItem, ...state.thumbnails],
      previewCache: new Map(state.previewCache).set(id, previewUrl),
    }));

    try {
      const database = await getDb();
      await database.execute(
        "INSERT INTO thumbnails (id, name, createdAt, updatedAt) VALUES ($1, $2, $3, $4)",
        [id, itemName, now, now]
      );
      logger.info({ thumbnailId: id }, "[Gallery] Thumbnail saved");
    } catch (error) {
      logger.error({ err: error }, "[Gallery] Failed to save thumbnail");
      set({ dbError: String(error) });
    }

    return id;
  },

  duplicateThumbnail: async (id) => {
    const original = get().thumbnails.find((t) => t.id === id);
    if (!original) {
      return;
    }

    logger.info(
      { originalName: original.name },
      "[Gallery] Duplicating thumbnail"
    );

    // Load full image from original
    const fullImage = await loadFullImage(id);
    if (!fullImage) {
      logger.error("[Gallery] Failed to load original image for duplication");
      return;
    }

    // Save as new thumbnail
    const newId = crypto.randomUUID();
    const now = Date.now();
    const { previewUrl } = await saveThumbnail(newId, fullImage);

    // Copy layer data if exists
    const layers = await loadLayerData(id);
    if (layers) {
      await saveLayerData(newId, layers);
    }

    const newItem: ThumbnailItem = {
      id: newId,
      name: `${original.name} Copy`,
      createdAt: now,
      updatedAt: now,
      canvasWidth: original.canvasWidth,
      canvasHeight: original.canvasHeight,
      previewUrl,
    };

    set((state) => ({
      thumbnails: [newItem, ...state.thumbnails],
      previewCache: new Map(state.previewCache).set(newId, previewUrl),
    }));

    try {
      const database = await getDb();
      await database.execute(
        "INSERT INTO thumbnails (id, name, createdAt, updatedAt, canvasWidth, canvasHeight) VALUES ($1, $2, $3, $4, $5, $6)",
        [
          newId,
          newItem.name,
          now,
          now,
          newItem.canvasWidth || null,
          newItem.canvasHeight || null,
        ]
      );
      logger.info({ newId }, "[Gallery] Duplicate saved");
    } catch (error) {
      logger.error({ err: error }, "[Gallery] Failed to duplicate thumbnail");
      set({ dbError: String(error) });
    }
  },

  duplicateThumbnailsBatch: async (ids) => {
    const state = get();
    const originals = ids
      .map((id) => state.thumbnails.find((t) => t.id === id))
      .filter((t): t is ThumbnailItem => t !== undefined);

    if (originals.length === 0) {
      return;
    }

    logger.info(
      { count: originals.length },
      "[Gallery] Batch duplicating thumbnails"
    );

    const now = Date.now();
    const newPreviews = new Map<string, string>();

    // Process each original in parallel
    const promises = originals.map(async (original, i) => {
      const fullImage = await loadFullImage(original.id);
      if (!fullImage) {
        return null;
      }

      const newId = crypto.randomUUID();
      const { previewUrl } = await saveThumbnail(newId, fullImage);

      // Copy layer data if exists
      const layers = await loadLayerData(original.id);
      if (layers) {
        await saveLayerData(newId, layers);
      }

      newPreviews.set(newId, previewUrl);

      return {
        id: newId,
        name: `${original.name} (Copy)`,
        createdAt: now + i,
        updatedAt: now + i,
        canvasWidth: original.canvasWidth,
        canvasHeight: original.canvasHeight,
        previewUrl,
      } as ThumbnailItem;
    });

    const results = await Promise.all(promises);
    const newItems: ThumbnailItem[] = results.filter(
      (item): item is ThumbnailItem => item !== null
    );

    // Single state update
    set((state) => ({
      thumbnails: [...newItems, ...state.thumbnails],
      previewCache: new Map([...state.previewCache, ...newPreviews]),
    }));

    // Batch DB insert
    try {
      const database = await getDb();
      await database.execute("BEGIN TRANSACTION");

      // Chunk inserts to avoid SQLite parameter limits (safe limit ~900 params)
      // 6 params per item implies max 150 items per chunk. Using 50 for safety.
      const BATCH_SIZE = 50;
      for (let i = 0; i < newItems.length; i += BATCH_SIZE) {
        const chunk = newItems.slice(i, i + BATCH_SIZE);
        const placeholders = chunk
          .map(
            (_, idx) =>
              `($${idx * 6 + 1}, $${idx * 6 + 2}, $${idx * 6 + 3}, $${idx * 6 + 4}, $${idx * 6 + 5}, $${idx * 6 + 6})`
          )
          .join(", ");

        const values = chunk.flatMap((item) => [
          item.id,
          item.name,
          item.createdAt,
          item.updatedAt,
          item.canvasWidth ?? null,
          item.canvasHeight ?? null,
        ]);

        await database.execute(
          `INSERT INTO thumbnails (id, name, createdAt, updatedAt, canvasWidth, canvasHeight) VALUES ${placeholders}`,
          values
        );
      }

      await database.execute("COMMIT");
      logger.info(
        { count: newItems.length },
        "[Gallery] Batch duplicates saved"
      );
    } catch (error) {
      logger.error({ err: error }, "[Gallery] Failed to batch duplicate");
      try {
        const database = await getDb();
        await database.execute("ROLLBACK");
      } catch {}
      set({ dbError: String(error) });
    }
  },

  saveProject: async (
    id,
    name,
    previewDataUrl,
    layers,
    canvasWidth,
    canvasHeight,
    options
  ) => {
    const projectId = id || crypto.randomUUID();
    const now = Date.now();
    logger.info(
      { name, layerCount: layers.length },
      "[Gallery] Saving project"
    );

    // Save image files
    const { previewUrl } = await saveThumbnail(projectId, previewDataUrl);

    // Save layer data
    await saveLayerData(projectId, options?.pages || layers);

    const existingItem = get().thumbnails.find((t) => t.id === projectId);
    if (existingItem) {
      set((state) => ({
        thumbnails: state.thumbnails.map((t) =>
          t.id === projectId
            ? {
                ...t,
                name,
                canvasWidth,
                canvasHeight,
                updatedAt: now,
                previewUrl,
              }
            : t
        ),
        previewCache: new Map(state.previewCache).set(projectId, previewUrl),
      }));

      try {
        const database = await getDb();
        await database.execute(
          "UPDATE thumbnails SET name = $1, canvasWidth = $2, canvasHeight = $3, updatedAt = $4 WHERE id = $5",
          [name, canvasWidth, canvasHeight, now, projectId]
        );
        logger.info({ projectId }, "[Gallery] Project updated");
      } catch (error) {
        logger.error({ err: error }, "[Gallery] Failed to update project");
        set({ dbError: String(error) });
      }
    } else {
      const newItem: ThumbnailItem = {
        id: projectId,
        name,
        createdAt: now,
        updatedAt: now,
        canvasWidth,
        canvasHeight,
        previewUrl,
      };

      set((state) => ({
        thumbnails: [newItem, ...state.thumbnails],
        previewCache: new Map(state.previewCache).set(projectId, previewUrl),
      }));

      try {
        const database = await getDb();
        await database.execute(
          "INSERT INTO thumbnails (id, name, createdAt, updatedAt, canvasWidth, canvasHeight) VALUES ($1, $2, $3, $4, $5, $6)",
          [projectId, name, now, now, canvasWidth, canvasHeight]
        );
        logger.info({ projectId }, "[Gallery] Project saved");
      } catch (error) {
        logger.error({ err: error }, "[Gallery] Failed to save project");
        set({ dbError: String(error) });
      }
    }

    return projectId;
  },

  updateThumbnailName: async (id, name) => {
    const now = Date.now();
    set((state) => ({
      thumbnails: state.thumbnails.map((t) =>
        t.id === id ? { ...t, name, updatedAt: now } : t
      ),
    }));

    try {
      const database = await getDb();
      await database.execute(
        "UPDATE thumbnails SET name = $1, updatedAt = $2 WHERE id = $3",
        [name, now, id]
      );
      logger.info({ thumbnailId: id }, "[Gallery] Thumbnail name updated");
    } catch (error) {
      logger.error({ err: error }, "[Gallery] Failed to update name");
      set({ dbError: String(error) });
    }
  },

  updateThumbnail: async (id, dataUrl) => {
    const now = Date.now();

    // Update files
    const { previewUrl } = await saveThumbnail(id, dataUrl);

    set((state) => ({
      thumbnails: state.thumbnails.map((t) =>
        t.id === id ? { ...t, updatedAt: now, previewUrl } : t
      ),
      previewCache: new Map(state.previewCache).set(id, previewUrl),
    }));

    try {
      const database = await getDb();
      await database.execute(
        "UPDATE thumbnails SET updatedAt = $1 WHERE id = $2",
        [now, id]
      );
    } catch (error) {
      logger.error({ err: error }, "[Gallery] Failed to update thumbnail");
      set({ dbError: String(error) });
    }
  },

  deleteThumbnail: async (id) => {
    const thumbnail = get().thumbnails.find((t) => t.id === id);
    if (!thumbnail) {
      return;
    }

    // Move to trash
    await useTrashStore.getState().moveToTrash({
      id: thumbnail.id,
      name: thumbnail.name,
      createdAt: thumbnail.createdAt,
      updatedAt: thumbnail.updatedAt,
      canvasWidth: thumbnail.canvasWidth,
      canvasHeight: thumbnail.canvasHeight,
    });

    // Remove from gallery state
    set((state) => {
      const newCache = new Map(state.previewCache);
      newCache.delete(id);
      return {
        thumbnails: state.thumbnails.filter((t) => t.id !== id),
        previewCache: newCache,
      };
    });

    try {
      const database = await getDb();
      await database.execute("DELETE FROM thumbnails WHERE id = $1", [id]);
    } catch (error) {
      logger.error({ err: error }, "[Gallery] Failed to delete");
      set({ dbError: String(error) });
    }
  },

  deleteThumbnailsBatch: async (ids) => {
    if (ids.length === 0) {
      return;
    }

    const idsSet = new Set(ids);
    const thumbnailsToTrash = get().thumbnails.filter((t) => idsSet.has(t.id));
    logger.info(
      { count: thumbnailsToTrash.length },
      "[Gallery] Moving thumbnails to trash"
    );

    // Move to trash
    await useTrashStore.getState().moveToTrashBatch(
      thumbnailsToTrash.map((t) => ({
        id: t.id,
        name: t.name,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
        canvasWidth: t.canvasWidth,
        canvasHeight: t.canvasHeight,
      }))
    );

    // Remove from gallery state
    set((state) => {
      const newCache = new Map(state.previewCache);
      for (const id of ids) {
        newCache.delete(id);
      }
      return {
        thumbnails: state.thumbnails.filter((t) => !idsSet.has(t.id)),
        previewCache: newCache,
      };
    });

    try {
      const database = await getDb();
      await database.execute("BEGIN TRANSACTION");

      // Chunk deletes
      const BATCH_SIZE = 500;
      for (let i = 0; i < ids.length; i += BATCH_SIZE) {
        const chunk = ids.slice(i, i + BATCH_SIZE);
        const placeholders = chunk.map((_, idx) => `$${idx + 1}`).join(", ");
        await database.execute(
          `DELETE FROM thumbnails WHERE id IN (${placeholders})`,
          chunk
        );
      }

      await database.execute("COMMIT");
      logger.info(
        { count: ids.length },
        "[Gallery] Batch move to trash completed"
      );
    } catch (error) {
      logger.error({ err: error }, "[Gallery] Failed to batch delete");
      try {
        const database = await getDb();
        await database.execute("ROLLBACK");
      } catch {}
      set({ dbError: String(error) });
    }
  },

  restoreThumbnail: async (trashItem) => {
    logger.info({ itemName: trashItem.name }, "[Gallery] Restoring from trash");

    const restoredItem: ThumbnailItem = {
      id: trashItem.id,
      name: trashItem.name,
      createdAt: trashItem.originalCreatedAt,
      updatedAt: trashItem.originalUpdatedAt,
      canvasWidth: trashItem.canvasWidth,
      canvasHeight: trashItem.canvasHeight,
    };

    set((state) => ({
      thumbnails: [restoredItem, ...state.thumbnails],
    }));

    try {
      const database = await getDb();
      await database.execute(
        "INSERT INTO thumbnails (id, name, createdAt, updatedAt, canvasWidth, canvasHeight) VALUES ($1, $2, $3, $4, $5, $6)",
        [
          restoredItem.id,
          restoredItem.name,
          restoredItem.createdAt,
          restoredItem.updatedAt,
          restoredItem.canvasWidth || null,
          restoredItem.canvasHeight || null,
        ]
      );
      logger.info(
        { thumbnailId: restoredItem.id },
        "[Gallery] Thumbnail restored"
      );
    } catch (error) {
      logger.error({ err: error }, "[Gallery] Failed to restore thumbnail");
      set({ dbError: String(error) });
    }
  },

  loadFromDb: async () => {
    logger.info("[Gallery] Loading thumbnails from DB...");
    try {
      const database = await getDb();
      // Only load metadata - NO image data!
      const result = await database.select<ThumbnailItem[]>(
        "SELECT id, name, createdAt, updatedAt, canvasWidth, canvasHeight, folderId FROM thumbnails ORDER BY updatedAt DESC"
      );
      logger.info(
        { count: result.length },
        "[Gallery] Loaded thumbnails (metadata only)"
      );
      set({ thumbnails: result, isLoaded: true, dbError: null });
    } catch (error) {
      logger.error({ err: error }, "[Gallery] Failed to load");
      set({ isLoaded: true, dbError: String(error) });
    }
  },

  // Lazy loading methods
  loadPreviewForId: async (id) => {
    const cached = get().previewCache.get(id);
    if (cached) {
      return cached;
    }

    const previewUrl = await loadPreview(id);
    if (previewUrl) {
      set((state) => ({
        previewCache: new Map(state.previewCache).set(id, previewUrl),
      }));
    }
    return previewUrl;
  },

  loadFullImageForId: async (id) => {
    return loadFullImage(id);
  },

  loadLayerDataForId: async (id) => {
    const data = await loadLayerData(id);
    return data as Layer[] | null;
  },

  setThumbnailFolder: async (id, folderId) => {
    const now = Date.now();
    set((state) => ({
      thumbnails: state.thumbnails.map((t) =>
        t.id === id ? { ...t, folderId, updatedAt: now } : t
      ),
    }));
    try {
      const database = await getDb();
      await database.execute(
        "UPDATE thumbnails SET folderId = $1, updatedAt = $2 WHERE id = $3",
        [folderId, now, id]
      );
      logger.info({ id, folderId }, "[Gallery] Thumbnail folder updated");
    } catch (error) {
      logger.error({ err: error }, "[Gallery] Failed to update folder");
      set({ dbError: String(error) });
    }
  },
}));

async function migratePreviewsToV2() {
  if (localStorage.getItem("previewMigrationV3") === "1") return;
  const { thumbnails } = useGalleryStore.getState();
  for (const thumb of thumbnails) {
    const newUrl = await regeneratePreviewFromFull(thumb.id);
    if (newUrl) {
      useGalleryStore.setState((s) => ({
        previewCache: new Map(s.previewCache).set(thumb.id, newUrl),
      }));
    }
  }
  localStorage.setItem("previewMigrationV3", "1");
}

// Initialize on module load
useGalleryStore
  .getState()
  .loadFromDb()
  .then(() => {
    migratePreviewsToV2();
  });
