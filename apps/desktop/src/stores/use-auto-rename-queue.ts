import { create } from "zustand";
import { generateThumbnailName } from "@/lib/gemini-rename";
import { getGeminiApiKey } from "@/lib/gemini-store";
import { useGalleryStore } from "./use-gallery-store";

export type AutoRenameStatus = "pending" | "processing" | "done" | "error";

export interface AutoRenameItem {
  id: string;
  thumbnailId: string;
  name: string;
  status: AutoRenameStatus;
  result?: string;
  error?: string;
}

interface AutoRenameQueueState {
  queue: AutoRenameItem[];
  isProcessing: boolean;
  addToQueue: (items: { thumbnailId: string; name: string }[]) => void;
  processQueue: () => Promise<void>;
  removeFromQueue: (id: string) => void;
  clearCompleted: () => void;
}

export const useAutoRenameQueue = create<AutoRenameQueueState>()(
  (set, get) => ({
    queue: [],
    isProcessing: false,

    addToQueue: (items) => {
      const newItems: AutoRenameItem[] = items.map((item) => ({
        id: crypto.randomUUID(),
        thumbnailId: item.thumbnailId,
        name: item.name,
        status: "pending" as const,
      }));

      set((state) => ({ queue: [...state.queue, ...newItems] }));

      if (!get().isProcessing) {
        get().processQueue();
      }
    },

    processQueue: async () => {
      const { queue, isProcessing } = get();
      if (isProcessing) return;

      const pendingItem = queue.find((item) => item.status === "pending");
      if (!pendingItem) return;

      set({ isProcessing: true });
      set((state) => ({
        queue: state.queue.map((item) =>
          item.id === pendingItem.id ? { ...item, status: "processing" } : item
        ),
      }));

      try {
        const apiKey = await getGeminiApiKey();
        if (!apiKey) {
          throw new Error("Gemini API key not set");
        }

        const { loadFullImageForId, updateThumbnailName } =
          useGalleryStore.getState();
        const fullImage = await loadFullImageForId(pendingItem.thumbnailId);
        if (!fullImage) {
          throw new Error("Image not found");
        }

        const generatedName = await generateThumbnailName(apiKey, fullImage);
        await updateThumbnailName(pendingItem.thumbnailId, generatedName);

        set((state) => ({
          queue: state.queue.map((item) =>
            item.id === pendingItem.id
              ? { ...item, status: "done", result: generatedName }
              : item
          ),
        }));
      } catch (error) {
        set((state) => ({
          queue: state.queue.map((item) =>
            item.id === pendingItem.id
              ? { ...item, status: "error", error: String(error) }
              : item
          ),
        }));
      }

      set({ isProcessing: false });

      if (get().queue.find((item) => item.status === "pending")) {
        get().processQueue();
      }
    },

    removeFromQueue: (id) =>
      set((state) => ({
        queue: state.queue.filter((item) => item.id !== id),
      })),

    clearCompleted: () =>
      set((state) => ({
        queue: state.queue.filter(
          (item) => item.status !== "done" && item.status !== "error"
        ),
      })),
  })
);
