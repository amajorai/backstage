import { create } from "zustand";
import { getDb } from "@/lib/db";
import { logger } from "@/lib/logger";

export interface Folder {
  id: string;
  name: string;
  createdAt: number;
}

interface FolderState {
  folders: Folder[];
  isLoaded: boolean;
  loadFolders: () => Promise<void>;
  createFolder: (name: string) => Promise<Folder>;
  renameFolder: (id: string, name: string) => Promise<void>;
  deleteFolder: (id: string) => Promise<void>;
}

export const useFolderStore = create<FolderState>()((set, get) => ({
  folders: [],
  isLoaded: false,

  loadFolders: async () => {
    try {
      const db = await getDb();
      const rows = await db.select<Folder[]>(
        "SELECT id, name, createdAt FROM folders ORDER BY createdAt ASC"
      );
      set({ folders: rows, isLoaded: true });
    } catch (error) {
      logger.error({ err: error }, "[Folders] Failed to load");
      set({ isLoaded: true });
    }
  },

  createFolder: async (name) => {
    const id = crypto.randomUUID();
    const createdAt = Date.now();
    const folder: Folder = { id, name, createdAt };
    set((s) => ({ folders: [...s.folders, folder] }));
    try {
      const db = await getDb();
      await db.execute(
        "INSERT INTO folders (id, name, createdAt) VALUES ($1, $2, $3)",
        [id, name, createdAt]
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
