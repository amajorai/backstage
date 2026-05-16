import { load } from "@tauri-apps/plugin-store";
import { create } from "zustand";

const STORE_NAME = "settings.json";
const SEARCH_HISTORIES_FIELD = "search_histories";
const MAX_HISTORY = 10;

export type SearchHistoryContext = "gallery" | "explore" | "trash";

type Histories = Record<SearchHistoryContext, string[]>;

interface SearchHistoryState {
  histories: Histories;
  addSearch: (context: SearchHistoryContext, query: string) => Promise<void>;
  removeSearch: (context: SearchHistoryContext, query: string) => Promise<void>;
  clearHistory: (context: SearchHistoryContext) => Promise<void>;
  loadHistories: () => Promise<void>;
}

const EMPTY: Histories = { gallery: [], explore: [], trash: [] };

async function saveHistories(histories: Histories): Promise<void> {
  const store = await load(STORE_NAME, { autoSave: true });
  await store.set(SEARCH_HISTORIES_FIELD, histories);
  await store.save();
}

export const useSearchHistoryStore = create<SearchHistoryState>()(
  (set, get) => ({
    histories: { ...EMPTY },

    addSearch: async (context, query) => {
      const q = query.trim();
      if (!q) return;
      const current = get().histories;
      const list = current[context].filter((h) => h !== q);
      const updated: Histories = {
        ...current,
        [context]: [q, ...list].slice(0, MAX_HISTORY),
      };
      set({ histories: updated });
      await saveHistories(updated);
    },

    removeSearch: async (context, query) => {
      const current = get().histories;
      const updated: Histories = {
        ...current,
        [context]: current[context].filter((h) => h !== query),
      };
      set({ histories: updated });
      await saveHistories(updated);
    },

    clearHistory: async (context) => {
      const current = get().histories;
      const updated: Histories = { ...current, [context]: [] };
      set({ histories: updated });
      await saveHistories(updated);
    },

    loadHistories: async () => {
      try {
        const store = await load(STORE_NAME, { autoSave: false });
        const saved = await store.get<Histories>(SEARCH_HISTORIES_FIELD);
        if (saved) {
          set({
            histories: {
              gallery: saved.gallery ?? [],
              explore: saved.explore ?? [],
              trash: saved.trash ?? [],
            },
          });
        }
      } catch {
        // keep defaults
      }
    },
  })
);

useSearchHistoryStore.getState().loadHistories();
