import { create } from "zustand";
import { useGalleryStore } from "./use-gallery-store";

export type QueueItemStatus = "pending" | "processing" | "done" | "error";

export interface QueueItem {
  id: string;
  thumbnailId: string;
  name: string;
  status: QueueItemStatus;
  error?: string;
}

interface BackgroundRemovalQueueState {
  queue: QueueItem[];
  isProcessing: boolean;
  // Changed: no longer needs dataUrl - will load from files
  addToQueue: (items: { thumbnailId: string; name: string }[]) => void;
  processQueue: () => Promise<void>;
  removeFromQueue: (id: string) => void;
  clearCompleted: () => void;
}

export const useBackgroundRemovalQueue = create<BackgroundRemovalQueueState>()(
  (set, get) => ({
    queue: [],
    isProcessing: false,

    addToQueue: (items) => {
      const newItems: QueueItem[] = items.map((item) => ({
        id: crypto.randomUUID(),
        thumbnailId: item.thumbnailId,
        name: item.name,
        status: "pending" as const,
      }));

      set((state) => ({
        queue: [...state.queue, ...newItems],
      }));

      // Start processing if not already
      if (!get().isProcessing) {
        get().processQueue();
      }
    },

    processQueue: async () => {
      const { queue, isProcessing } = get();
      if (isProcessing) {
        return;
      }

      const pendingItem = queue.find((item) => item.status === "pending");
      if (!pendingItem) {
        return;
      }

      set({ isProcessing: true });

      // Update status to processing
      set((state) => ({
        queue: state.queue.map((item) =>
          item.id === pendingItem.id ? { ...item, status: "processing" } : item
        ),
      }));

      try {
        // Load full image from file storage
        const loadFullImageForId =
          useGalleryStore.getState().loadFullImageForId;
        const fullImageUrl = await loadFullImageForId(pendingItem.thumbnailId);

        if (!fullImageUrl) {
          throw new Error("Image data not found in file storage");
        }

        const { removeBackgroundAsync } = await import(
          "@/lib/background-removal"
        );
        const { BG_REMOVAL_MODEL_MAP, useAppSettingsStore } = await import(
          "@/stores/use-app-settings-store"
        );
        const model =
          BG_REMOVAL_MODEL_MAP[useAppSettingsStore.getState().bgRemovalQuality];
        const resultDataUrl = await removeBackgroundAsync(fullImageUrl, model);

        // Add the result as a new thumbnail
        const addThumbnail = useGalleryStore.getState().addThumbnail;
        await addThumbnail(resultDataUrl, `${pendingItem.name} (no bg)`);

        // Update status to done
        set((state) => ({
          queue: state.queue.map((item) =>
            item.id === pendingItem.id ? { ...item, status: "done" } : item
          ),
        }));
      } catch (error) {
        // Update status to error
        set((state) => ({
          queue: state.queue.map((item) =>
            item.id === pendingItem.id
              ? { ...item, status: "error", error: String(error) }
              : item
          ),
        }));
      }

      set({ isProcessing: false });

      // Process next item
      const remaining = get().queue.find((item) => item.status === "pending");
      if (remaining) {
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
