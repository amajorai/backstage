import { create } from "zustand";
import { getDb } from "@/lib/db";
import { logger } from "@/lib/logger";
import { loadPreview } from "@/lib/thumbnail-storage";

export interface ArchiveItem {
  id: string;
  name: string;
  archivedAt: number;
  createdAt: number;
  updatedAt: number;
  canvasWidth?: number;
  canvasHeight?: number;
  archiveFolderId?: string | null;
  previewUrl?: string;
}

export interface ArchiveFolder {
  id: string;
  name: string;
  createdAt: number;
  sortOrder: number;
  color: string | null;
}

interface ArchiveState {
  archiveItems: ArchiveItem[];
  archiveFolders: ArchiveFolder[];
  isLoaded: boolean;
  previewCache: Map<string, string>;

  loadFromDb: () => Promise<void>;

  archiveItem: (item: {
    id: string;
    name: string;
    createdAt: number;
    updatedAt: number;
    canvasWidth?: number;
    canvasHeight?: number;
    archiveFolderId?: string | null;
  }) => Promise<void>;
  archiveItemsBatch: (
    items: {
      id: string;
      name: string;
      createdAt: number;
      updatedAt: number;
      canvasWidth?: number;
      canvasHeight?: number;
      archiveFolderId?: string | null;
    }[]
  ) => Promise<void>;
  unarchiveItem: (id: string) => Promise<ArchiveItem | null>;
  unarchiveItemsBatch: (ids: string[]) => Promise<ArchiveItem[]>;
  unarchiveAll: () => Promise<ArchiveItem[]>;

  createArchiveFolder: (
    name: string,
    color?: string | null
  ) => Promise<ArchiveFolder>;
  renameArchiveFolder: (id: string, name: string) => Promise<void>;
  deleteArchiveFolder: (id: string) => Promise<void>;
  updateArchiveFolderColor: (id: string, color: string | null) => Promise<void>;
  moveItemToArchiveFolder: (
    itemId: string,
    folderId: string | null
  ) => Promise<void>;
  moveItemsBatchToArchiveFolder: (
    ids: string[],
    folderId: string | null
  ) => Promise<void>;

  loadPreviewForId: (id: string) => Promise<string | null>;
}

export const useArchiveStore = create<ArchiveState>()((set, get) => ({
  archiveItems: [],
  archiveFolders: [],
  isLoaded: false,
  previewCache: new Map(),

  loadFromDb: async () => {
    logger.info("[Archive] Loading from DB...");
    try {
      const database = await getDb();
      const items = await database.select<ArchiveItem[]>(
        "SELECT id, name, archivedAt, createdAt, updatedAt, canvasWidth, canvasHeight, archiveFolderId FROM thumbnails WHERE archivedAt IS NOT NULL ORDER BY archivedAt DESC"
      );
      const folders = await database.select<ArchiveFolder[]>(
        "SELECT id, name, createdAt, sortOrder, color FROM archive_folders ORDER BY sortOrder ASC, createdAt ASC"
      );
      logger.info(
        { itemCount: items.length, folderCount: folders.length },
        "[Archive] Loaded"
      );
      set({ archiveItems: items, archiveFolders: folders, isLoaded: true });
    } catch (error) {
      logger.error({ err: error }, "[Archive] Failed to load");
      set({ isLoaded: true });
    }
  },

  archiveItem: async (item) => {
    const archivedAt = Date.now();
    logger.info({ itemName: item.name }, "[Archive] Archiving item");

    const archiveItem: ArchiveItem = {
      id: item.id,
      name: item.name,
      archivedAt,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      canvasWidth: item.canvasWidth,
      canvasHeight: item.canvasHeight,
      archiveFolderId: item.archiveFolderId ?? null,
    };

    set((state) => ({
      archiveItems: [archiveItem, ...state.archiveItems],
    }));

    try {
      const database = await getDb();
      await database.execute(
        "UPDATE thumbnails SET archivedAt = $1, archiveFolderId = $2 WHERE id = $3",
        [archivedAt, item.archiveFolderId ?? null, item.id]
      );
      logger.info({ itemId: item.id }, "[Archive] Item archived");
    } catch (error) {
      logger.error({ err: error }, "[Archive] Failed to archive item");
    }
  },

  archiveItemsBatch: async (items) => {
    if (items.length === 0) return;

    const archivedAt = Date.now();
    logger.info({ count: items.length }, "[Archive] Batch archiving items");

    const archiveItems: ArchiveItem[] = items.map((item, i) => ({
      id: item.id,
      name: item.name,
      archivedAt: archivedAt + i,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      canvasWidth: item.canvasWidth,
      canvasHeight: item.canvasHeight,
      archiveFolderId: item.archiveFolderId ?? null,
    }));

    set((state) => ({
      archiveItems: [...archiveItems, ...state.archiveItems],
    }));

    try {
      const database = await getDb();
      const BATCH_SIZE = 50;
      for (let i = 0; i < archiveItems.length; i += BATCH_SIZE) {
        const chunk = archiveItems.slice(i, i + BATCH_SIZE);
        for (const archItem of chunk) {
          await database.execute(
            "UPDATE thumbnails SET archivedAt = $1, archiveFolderId = $2 WHERE id = $3",
            [archItem.archivedAt, archItem.archiveFolderId ?? null, archItem.id]
          );
        }
      }
      logger.info(
        { count: archiveItems.length },
        "[Archive] Batch archive completed"
      );
    } catch (error) {
      logger.error({ err: error }, "[Archive] Failed to batch archive");
      const idsToRemove = new Set(items.map((i) => i.id));
      set((state) => ({
        archiveItems: state.archiveItems.filter((a) => !idsToRemove.has(a.id)),
      }));
      throw error;
    }
  },

  unarchiveItem: async (id) => {
    const item = get().archiveItems.find((a) => a.id === id);
    if (!item) return null;

    logger.info({ itemName: item.name }, "[Archive] Unarchiving item");

    set((state) => {
      const newCache = new Map(state.previewCache);
      newCache.delete(id);
      return {
        archiveItems: state.archiveItems.filter((a) => a.id !== id),
        previewCache: newCache,
      };
    });

    try {
      const database = await getDb();
      await database.execute(
        "UPDATE thumbnails SET archivedAt = NULL, archiveFolderId = NULL WHERE id = $1",
        [id]
      );
      logger.info({ itemId: id }, "[Archive] Item unarchived");
    } catch (error) {
      logger.error({ err: error }, "[Archive] Failed to unarchive item");
    }

    return item;
  },

  unarchiveItemsBatch: async (ids) => {
    if (ids.length === 0) return [];

    const idsSet = new Set(ids);
    const items = get().archiveItems.filter((a) => idsSet.has(a.id));

    logger.info({ count: items.length }, "[Archive] Batch unarchiving items");

    set((state) => {
      const newCache = new Map(state.previewCache);
      for (const id of ids) newCache.delete(id);
      return {
        archiveItems: state.archiveItems.filter((a) => !idsSet.has(a.id)),
        previewCache: newCache,
      };
    });

    try {
      const database = await getDb();
      const BATCH_SIZE = 500;
      for (let i = 0; i < ids.length; i += BATCH_SIZE) {
        const chunk = ids.slice(i, i + BATCH_SIZE);
        const placeholders = chunk.map((_, idx) => `$${idx + 1}`).join(", ");
        await database.execute(
          `UPDATE thumbnails SET archivedAt = NULL, archiveFolderId = NULL WHERE id IN (${placeholders})`,
          chunk
        );
      }
      logger.info(
        { count: items.length },
        "[Archive] Batch unarchive completed"
      );
    } catch (error) {
      logger.error({ err: error }, "[Archive] Failed to batch unarchive");
      throw error;
    }

    return items;
  },

  unarchiveAll: async () => {
    const items = get().archiveItems;
    const ids = items.map((a) => a.id);
    return get().unarchiveItemsBatch(ids);
  },

  createArchiveFolder: async (name, color = null) => {
    const id = crypto.randomUUID();
    const createdAt = Date.now();
    const sortOrder = get().archiveFolders.length;
    const folder: ArchiveFolder = { id, name, createdAt, sortOrder, color };
    set((s) => ({ archiveFolders: [...s.archiveFolders, folder] }));
    try {
      const db = await getDb();
      await db.execute(
        "INSERT INTO archive_folders (id, name, createdAt, sortOrder, color) VALUES ($1, $2, $3, $4, $5)",
        [id, name, createdAt, sortOrder, color]
      );
      logger.info({ id, name }, "[Archive] Folder created");
    } catch (error) {
      logger.error({ err: error }, "[Archive] Failed to create folder");
      set((s) => ({
        archiveFolders: s.archiveFolders.filter((f) => f.id !== id),
      }));
    }
    return folder;
  },

  renameArchiveFolder: async (id, name) => {
    set((s) => ({
      archiveFolders: s.archiveFolders.map((f) =>
        f.id === id ? { ...f, name } : f
      ),
    }));
    try {
      const db = await getDb();
      await db.execute("UPDATE archive_folders SET name = $1 WHERE id = $2", [
        name,
        id,
      ]);
      logger.info({ id, name }, "[Archive] Folder renamed");
    } catch (error) {
      logger.error({ err: error }, "[Archive] Failed to rename folder");
    }
  },

  deleteArchiveFolder: async (id) => {
    const prev = get().archiveFolders;
    set((s) => ({
      archiveFolders: s.archiveFolders.filter((f) => f.id !== id),
    }));
    set((s) => ({
      archiveItems: s.archiveItems.map((a) =>
        a.archiveFolderId === id ? { ...a, archiveFolderId: null } : a
      ),
    }));
    try {
      const db = await getDb();
      await db.execute(
        "UPDATE thumbnails SET archiveFolderId = NULL WHERE archiveFolderId = $1",
        [id]
      );
      await db.execute("DELETE FROM archive_folders WHERE id = $1", [id]);
      logger.info({ id }, "[Archive] Folder deleted");
    } catch (error) {
      logger.error({ err: error }, "[Archive] Failed to delete folder");
      set({ archiveFolders: prev });
    }
  },

  updateArchiveFolderColor: async (id, color) => {
    set((s) => ({
      archiveFolders: s.archiveFolders.map((f) =>
        f.id === id ? { ...f, color } : f
      ),
    }));
    try {
      const db = await getDb();
      await db.execute("UPDATE archive_folders SET color = $1 WHERE id = $2", [
        color,
        id,
      ]);
      logger.info({ id, color }, "[Archive] Folder color updated");
    } catch (error) {
      logger.error({ err: error }, "[Archive] Failed to update folder color");
    }
  },

  moveItemToArchiveFolder: async (itemId, folderId) => {
    set((s) => ({
      archiveItems: s.archiveItems.map((a) =>
        a.id === itemId ? { ...a, archiveFolderId: folderId } : a
      ),
    }));
    try {
      const db = await getDb();
      await db.execute(
        "UPDATE thumbnails SET archiveFolderId = $1 WHERE id = $2",
        [folderId, itemId]
      );
      logger.info({ itemId, folderId }, "[Archive] Item moved to folder");
    } catch (error) {
      logger.error({ err: error }, "[Archive] Failed to move item to folder");
    }
  },

  moveItemsBatchToArchiveFolder: async (ids, folderId) => {
    if (ids.length === 0) return;
    const idsSet = new Set(ids);
    set((s) => ({
      archiveItems: s.archiveItems.map((a) =>
        idsSet.has(a.id) ? { ...a, archiveFolderId: folderId } : a
      ),
    }));
    try {
      const db = await getDb();
      const BATCH_SIZE = 500;
      for (let i = 0; i < ids.length; i += BATCH_SIZE) {
        const chunk = ids.slice(i, i + BATCH_SIZE);
        const placeholders = chunk.map((_, idx) => `$${idx + 2}`).join(", ");
        await db.execute(
          `UPDATE thumbnails SET archiveFolderId = $1 WHERE id IN (${placeholders})`,
          [folderId, ...chunk]
        );
      }
      logger.info(
        { count: ids.length, folderId },
        "[Archive] Batch move to folder"
      );
    } catch (error) {
      logger.error({ err: error }, "[Archive] Failed to batch move to folder");
    }
  },

  loadPreviewForId: async (id) => {
    const cached = get().previewCache.get(id);
    if (cached) return cached;
    const previewUrl = await loadPreview(id);
    if (previewUrl) {
      set((state) => ({
        previewCache: new Map(state.previewCache).set(id, previewUrl),
      }));
    }
    return previewUrl;
  },
}));

useArchiveStore.getState().loadFromDb();
