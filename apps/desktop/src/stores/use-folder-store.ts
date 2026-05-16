import { create } from "zustand";
import { getDb } from "@/lib/db";
import { logger } from "@/lib/logger";

export const FOLDER_COLORS = [
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#14b8a6",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
  "#6b7280",
] as const;

export interface Folder {
  id: string;
  name: string;
  createdAt: number;
  sortOrder: number;
  isCharacterSet: boolean;
  color: string | null;
}

interface FolderState {
  folders: Folder[];
  isLoaded: boolean;
  loadFolders: () => Promise<void>;
  createFolder: (name: string, color?: string | null) => Promise<Folder>;
  renameFolder: (id: string, name: string) => Promise<void>;
  deleteFolder: (id: string) => Promise<void>;
  reorderFolders: (orderedIds: string[]) => Promise<void>;
  toggleCharacterSet: (id: string, value: boolean) => Promise<void>;
  updateFolderColor: (id: string, color: string | null) => Promise<void>;
}

export const useFolderStore = create<FolderState>()((set, get) => ({
  folders: [],
  isLoaded: false,

  loadFolders: async () => {
    try {
      const db = await getDb();
      const rows = await db.select<
        (Omit<Folder, "isCharacterSet"> & {
          isCharacterSet: number;
          color: string | null;
        })[]
      >(
        "SELECT id, name, createdAt, sortOrder, isCharacterSet, color FROM folders ORDER BY sortOrder ASC, createdAt ASC"
      );
      set({
        folders: rows.map((r) => ({
          ...r,
          isCharacterSet: r.isCharacterSet === 1,
          color: r.color ?? null,
        })),
        isLoaded: true,
      });
    } catch (error) {
      logger.error({ err: error }, "[Folders] Failed to load");
      set({ isLoaded: true });
    }
  },

  createFolder: async (name, color = null) => {
    const id = crypto.randomUUID();
    const createdAt = Date.now();
    const sortOrder = get().folders.length;
    const folder: Folder = {
      id,
      name,
      createdAt,
      sortOrder,
      isCharacterSet: false,
      color,
    };
    set((s) => ({ folders: [...s.folders, folder] }));
    try {
      const db = await getDb();
      await db.execute(
        "INSERT INTO folders (id, name, createdAt, sortOrder, color) VALUES ($1, $2, $3, $4, $5)",
        [id, name, createdAt, sortOrder, color]
      );
      logger.info({ id, name }, "[Folders] Created");
    } catch (error) {
      logger.error({ err: error }, "[Folders] Failed to create");
      set((s) => ({ folders: s.folders.filter((f) => f.id !== id) }));
    }
    return folder;
  },

  renameFolder: async (id, name) => {
    set((s) => ({
      folders: s.folders.map((f) => (f.id === id ? { ...f, name } : f)),
    }));
    try {
      const db = await getDb();
      await db.execute("UPDATE folders SET name = $1 WHERE id = $2", [
        name,
        id,
      ]);
      logger.info({ id, name }, "[Folders] Renamed");
    } catch (error) {
      logger.error({ err: error }, "[Folders] Failed to rename");
    }
  },

  reorderFolders: async (orderedIds) => {
    const currentFolders = get().folders;
    const folderMap = new Map(currentFolders.map((f) => [f.id, f]));
    const reordered = orderedIds.flatMap((fid, i) => {
      const f = folderMap.get(fid);
      return f ? [{ ...f, sortOrder: i }] : [];
    });
    set({ folders: reordered });
    try {
      const db = await getDb();
      for (let i = 0; i < orderedIds.length; i++) {
        await db.execute("UPDATE folders SET sortOrder = $1 WHERE id = $2", [
          i,
          orderedIds[i],
        ]);
      }
      logger.info("[Folders] Reordered");
    } catch (error) {
      logger.error({ err: error }, "[Folders] Failed to reorder");
      set({ folders: currentFolders });
    }
  },

  toggleCharacterSet: async (id, value) => {
    set((s) => ({
      folders: s.folders.map((f) =>
        f.id === id ? { ...f, isCharacterSet: value } : f
      ),
    }));
    try {
      const db = await getDb();
      await db.execute("UPDATE folders SET isCharacterSet = $1 WHERE id = $2", [
        value ? 1 : 0,
        id,
      ]);
      logger.info({ id, value }, "[Folders] Character set toggled");
    } catch (error) {
      logger.error({ err: error }, "[Folders] Failed to toggle character set");
    }
  },

  updateFolderColor: async (id, color) => {
    set((s) => ({
      folders: s.folders.map((f) => (f.id === id ? { ...f, color } : f)),
    }));
    try {
      const db = await getDb();
      await db.execute("UPDATE folders SET color = $1 WHERE id = $2", [
        color,
        id,
      ]);
      logger.info({ id, color }, "[Folders] Color updated");
    } catch (error) {
      logger.error({ err: error }, "[Folders] Failed to update color");
    }
  },

  deleteFolder: async (id) => {
    const prev = get().folders;
    set((s) => ({ folders: s.folders.filter((f) => f.id !== id) }));
    try {
      const db = await getDb();
      // Unassign thumbnails from this folder
      await db.execute(
        "UPDATE thumbnails SET folderId = NULL WHERE folderId = $1",
        [id]
      );
      await db.execute("DELETE FROM folders WHERE id = $1", [id]);
      logger.info({ id }, "[Folders] Deleted");
    } catch (error) {
      logger.error({ err: error }, "[Folders] Failed to delete");
      set({ folders: prev });
    }
  },
}));

// Load on module init
useFolderStore.getState().loadFolders();
