import { create } from "zustand";
import { getDb } from "@/lib/db";
import { logger } from "@/lib/logger";
import {
  deleteAllProjectRevisionData,
  deleteAllRevisionData,
  deleteRevisionData,
  loadRevisionData,
  saveRevisionData,
} from "@/lib/revision-storage";
import type { Page } from "@/stores/use-editor-store";

export interface RevisionMeta {
  id: string;
  projectId: string;
  createdAt: number;
  name: string;
}

const MAX_REVISIONS = 10;

interface RevisionState {
  revisions: RevisionMeta[];
  isLoading: boolean;
  loadRevisions: (projectId: string) => Promise<void>;
  createRevision: (
    projectId: string,
    pages: Page[],
    name?: string
  ) => Promise<void>;
  restoreRevision: (
    revisionId: string,
    projectId: string
  ) => Promise<Page[] | null>;
  deleteRevision: (id: string, projectId: string) => Promise<void>;
  purgeProjectRevisions: (projectId: string) => Promise<void>;
  purgeAllRevisions: () => Promise<void>;
}

export const useRevisionStore = create<RevisionState>()((set, get) => ({
  revisions: [],
  isLoading: false,

  loadRevisions: async (projectId) => {
    set({ isLoading: true });
    try {
      const db = await getDb();
      const results = await db.select<RevisionMeta[]>(
        "SELECT id, projectId, createdAt, name FROM project_revisions WHERE projectId = $1 ORDER BY createdAt DESC",
        [projectId]
      );
      set({ revisions: results, isLoading: false });
    } catch (error) {
      logger.error({ err: error }, "[Revisions] Failed to load");
      set({ isLoading: false });
    }
  },

  createRevision: async (projectId, pages, name) => {
    const id = crypto.randomUUID();
    const now = Date.now();
    const revName = name ?? new Date(now).toLocaleString();
    try {
      await saveRevisionData(projectId, id, pages);
      const db = await getDb();
      await db.execute(
        "INSERT INTO project_revisions (id, projectId, createdAt, name) VALUES ($1, $2, $3, $4)",
        [id, projectId, now, revName]
      );
      // Prune oldest beyond MAX_REVISIONS
      const all = await db.select<{ id: string }[]>(
        "SELECT id FROM project_revisions WHERE projectId = $1 ORDER BY createdAt DESC",
        [projectId]
      );
      if (all.length > MAX_REVISIONS) {
        const toDelete = all.slice(MAX_REVISIONS);
        for (const rev of toDelete) {
          await deleteRevisionData(projectId, rev.id);
          await db.execute("DELETE FROM project_revisions WHERE id = $1", [
            rev.id,
          ]);
        }
      }
      await get().loadRevisions(projectId);
    } catch (error) {
      logger.error({ err: error }, "[Revisions] Failed to create");
    }
  },

  restoreRevision: async (revisionId, projectId) => {
    try {
      return await loadRevisionData(projectId, revisionId);
    } catch (error) {
      logger.error({ err: error }, "[Revisions] Failed to restore");
      return null;
    }
  },

  deleteRevision: async (id, projectId) => {
    try {
      await deleteRevisionData(projectId, id);
      const db = await getDb();
      await db.execute("DELETE FROM project_revisions WHERE id = $1", [id]);
      set((state) => ({
        revisions: state.revisions.filter((r) => r.id !== id),
      }));
    } catch (error) {
      logger.error({ err: error }, "[Revisions] Failed to delete");
    }
  },

  purgeProjectRevisions: async (projectId) => {
    try {
      await deleteAllProjectRevisionData(projectId);
      const db = await getDb();
      await db.execute("DELETE FROM project_revisions WHERE projectId = $1", [
        projectId,
      ]);
      set({ revisions: [] });
    } catch (error) {
      logger.error({ err: error }, "[Revisions] Failed to purge project");
    }
  },

  purgeAllRevisions: async () => {
    try {
      await deleteAllRevisionData();
      const db = await getDb();
      await db.execute("DELETE FROM project_revisions");
      set({ revisions: [] });
    } catch (error) {
      logger.error({ err: error }, "[Revisions] Failed to purge all");
    }
  },
}));
