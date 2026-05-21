import { create } from "zustand";
import { getDb } from "@/lib/db";

export interface YtCollection {
  id: string;
  name: string;
  color: string | null;
  sortOrder: number;
  createdAt: number;
  updatedAt: number;
}

/** Sentinel used by the UI to mean "show every saved video" (no folder filter). */
export const ALL_SAVED_ID = "__all_saved__" as const;

function makeCollectionId(): string {
  return `col_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

interface YtCollectionsState {
  collections: YtCollection[];
  /** videoId -> Set<collectionId>. Reverse lookup for "which folders is this in?". */
  membership: Map<string, Set<string>>;
  isLoaded: boolean;

  loadFromDb: () => Promise<void>;
  createCollection: (
    name: string,
    color?: string | null
  ) => Promise<YtCollection | null>;
  renameCollection: (id: string, name: string) => Promise<void>;
  setCollectionColor: (id: string, color: string | null) => Promise<void>;
  deleteCollection: (id: string) => Promise<void>;
  reorderCollections: (fromIndex: number, toIndex: number) => Promise<void>;

  addVideoToCollection: (
    videoId: string,
    collectionId: string
  ) => Promise<void>;
  removeVideoFromCollection: (
    videoId: string,
    collectionId: string
  ) => Promise<void>;
  toggleVideoInCollection: (
    videoId: string,
    collectionId: string
  ) => Promise<void>;

  /** Returns videoIds in this collection, or null if collectionId is ALL_SAVED_ID. */
  getVideoIdsInCollection: (collectionId: string) => Set<string> | null;
  isVideoInCollection: (videoId: string, collectionId: string) => boolean;
}

export const useYtCollectionsStore = create<YtCollectionsState>()(
  (set, get) => ({
    collections: [],
    membership: new Map(),
    isLoaded: false,

    loadFromDb: async () => {
      try {
        const db = await getDb();

        const cols = await db.select<
          {
            id: string;
            name: string;
            color: string | null;
            sortOrder: number;
            createdAt: number;
            updatedAt: number;
          }[]
        >("SELECT * FROM yt_collections ORDER BY sortOrder ASC, createdAt ASC");

        const items = await db.select<
          { collectionId: string; videoId: string }[]
        >("SELECT collectionId, videoId FROM yt_collection_items");

        const membership = new Map<string, Set<string>>();
        for (const { videoId, collectionId } of items) {
          const existing = membership.get(videoId);
          if (existing) {
            existing.add(collectionId);
          } else {
            membership.set(videoId, new Set([collectionId]));
          }
        }

        set({ collections: cols, membership, isLoaded: true });
      } catch {
        set({ isLoaded: true });
      }
    },

    createCollection: async (name, color = null) => {
      const trimmed = name.trim();
      if (!trimmed) return null;

      const now = Date.now();
      const maxOrder = get().collections.reduce(
        (m, c) => (c.sortOrder > m ? c.sortOrder : m),
        -1
      );
      const collection: YtCollection = {
        id: makeCollectionId(),
        name: trimmed,
        color,
        sortOrder: maxOrder + 1,
        createdAt: now,
        updatedAt: now,
      };

      set((state) => ({ collections: [...state.collections, collection] }));

      try {
        const db = await getDb();
        await db.execute(
          `INSERT INTO yt_collections (id, name, color, sortOrder, createdAt, updatedAt)
         VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            collection.id,
            collection.name,
            collection.color,
            collection.sortOrder,
            collection.createdAt,
            collection.updatedAt,
          ]
        );
        return collection;
      } catch {
        set((state) => ({
          collections: state.collections.filter((c) => c.id !== collection.id),
        }));
        return null;
      }
    },

    renameCollection: async (id, name) => {
      const trimmed = name.trim();
      if (!trimmed) return;

      const prev = get().collections.find((c) => c.id === id);
      if (!prev) return;
      const now = Date.now();

      set((state) => ({
        collections: state.collections.map((c) =>
          c.id === id ? { ...c, name: trimmed, updatedAt: now } : c
        ),
      }));

      try {
        const db = await getDb();
        await db.execute(
          "UPDATE yt_collections SET name = $1, updatedAt = $2 WHERE id = $3",
          [trimmed, now, id]
        );
      } catch {
        set((state) => ({
          collections: state.collections.map((c) => (c.id === id ? prev : c)),
        }));
      }
    },

    setCollectionColor: async (id, color) => {
      const prev = get().collections.find((c) => c.id === id);
      if (!prev) return;
      const now = Date.now();

      set((state) => ({
        collections: state.collections.map((c) =>
          c.id === id ? { ...c, color, updatedAt: now } : c
        ),
      }));

      try {
        const db = await getDb();
        await db.execute(
          "UPDATE yt_collections SET color = $1, updatedAt = $2 WHERE id = $3",
          [color, now, id]
        );
      } catch {
        set((state) => ({
          collections: state.collections.map((c) => (c.id === id ? prev : c)),
        }));
      }
    },

    deleteCollection: async (id) => {
      const prev = get().collections.find((c) => c.id === id);
      if (!prev) return;

      const prevMembership = get().membership;
      const nextMembership = new Map<string, Set<string>>();
      for (const [videoId, set_] of prevMembership) {
        if (set_.has(id)) {
          const updated = new Set(set_);
          updated.delete(id);
          if (updated.size > 0) nextMembership.set(videoId, updated);
        } else {
          nextMembership.set(videoId, set_);
        }
      }

      set((state) => ({
        collections: state.collections.filter((c) => c.id !== id),
        membership: nextMembership,
      }));

      try {
        const db = await getDb();
        await db.execute(
          "DELETE FROM yt_collection_items WHERE collectionId = $1",
          [id]
        );
        await db.execute("DELETE FROM yt_collections WHERE id = $1", [id]);
      } catch {
        // Rollback: reload from DB to recover.
        get().loadFromDb();
      }
    },

    reorderCollections: async (fromIndex, toIndex) => {
      const list = [...get().collections];
      if (
        fromIndex < 0 ||
        fromIndex >= list.length ||
        toIndex < 0 ||
        toIndex >= list.length ||
        fromIndex === toIndex
      ) {
        return;
      }
      const [moved] = list.splice(fromIndex, 1);
      list.splice(toIndex, 0, moved);
      const reordered = list.map((c, i) => ({ ...c, sortOrder: i }));

      const prev = get().collections;
      set({ collections: reordered });

      try {
        const db = await getDb();
        // Persist each updated sortOrder. Small N (folders), so a loop is fine.
        for (const c of reordered) {
          await db.execute(
            "UPDATE yt_collections SET sortOrder = $1 WHERE id = $2",
            [c.sortOrder, c.id]
          );
        }
      } catch {
        set({ collections: prev });
      }
    },

    addVideoToCollection: async (videoId, collectionId) => {
      if (collectionId === ALL_SAVED_ID) return;
      const current = get().membership.get(videoId);
      if (current?.has(collectionId)) return;

      const next = new Map(get().membership);
      const updated = new Set(current ?? []);
      updated.add(collectionId);
      next.set(videoId, updated);
      set({ membership: next });

      try {
        const db = await getDb();
        await db.execute(
          `INSERT OR IGNORE INTO yt_collection_items (collectionId, videoId, addedAt)
         VALUES ($1, $2, $3)`,
          [collectionId, videoId, Date.now()]
        );
      } catch {
        const rollback = new Map(get().membership);
        const rolled = new Set(rollback.get(videoId) ?? []);
        rolled.delete(collectionId);
        if (rolled.size === 0) rollback.delete(videoId);
        else rollback.set(videoId, rolled);
        set({ membership: rollback });
      }
    },

    removeVideoFromCollection: async (videoId, collectionId) => {
      if (collectionId === ALL_SAVED_ID) return;
      const current = get().membership.get(videoId);
      if (!current?.has(collectionId)) return;

      const next = new Map(get().membership);
      const updated = new Set(current);
      updated.delete(collectionId);
      if (updated.size === 0) next.delete(videoId);
      else next.set(videoId, updated);
      set({ membership: next });

      try {
        const db = await getDb();
        await db.execute(
          "DELETE FROM yt_collection_items WHERE collectionId = $1 AND videoId = $2",
          [collectionId, videoId]
        );
      } catch {
        const rollback = new Map(get().membership);
        const rolled = new Set(rollback.get(videoId) ?? []);
        rolled.add(collectionId);
        rollback.set(videoId, rolled);
        set({ membership: rollback });
      }
    },

    toggleVideoInCollection: async (videoId, collectionId) => {
      if (get().isVideoInCollection(videoId, collectionId)) {
        await get().removeVideoFromCollection(videoId, collectionId);
      } else {
        await get().addVideoToCollection(videoId, collectionId);
      }
    },

    getVideoIdsInCollection: (collectionId) => {
      if (collectionId === ALL_SAVED_ID) return null;
      const ids = new Set<string>();
      for (const [videoId, set_] of get().membership) {
        if (set_.has(collectionId)) ids.add(videoId);
      }
      return ids;
    },

    isVideoInCollection: (videoId, collectionId) => {
      if (collectionId === ALL_SAVED_ID) return false;
      return get().membership.get(videoId)?.has(collectionId) ?? false;
    },
  })
);

useYtCollectionsStore.getState().loadFromDb();
