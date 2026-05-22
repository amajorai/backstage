import { sileo } from "sileo";
import { create } from "zustand";
import { useGalleryStore } from "./use-gallery-store";

export type QueueItemStatus = "pending" | "processing" | "done" | "error";

export interface QueueItem {
  id: string;
  thumbnailId: string;
  name: string;
  status: QueueItemStatus;
  operation: "remove-bg" | "add-color-bg";
  color?: string;
  error?: string;
  stage?: string;
}

interface BackgroundRemovalQueueState {
  queue: QueueItem[];
  isProcessing: boolean;
  addToQueue: (items: { thumbnailId: string; name: string }[]) => void;
  addColorBgToQueue: (
    items: { thumbnailId: string; name: string; color: string }[]
  ) => void;
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
        operation: "remove-bg" as const,
      }));
      set((state) => ({ queue: [...state.queue, ...newItems] }));
      if (!get().isProcessing) get().processQueue();
    },

    addColorBgToQueue: (items) => {
      const newItems: QueueItem[] = items.map((item) => ({
        id: crypto.randomUUID(),
        thumbnailId: item.thumbnailId,
        name: item.name,
        status: "pending" as const,
        operation: "add-color-bg" as const,
        color: item.color,
      }));
      set((state) => ({ queue: [...state.queue, ...newItems] }));
      if (!get().isProcessing) get().processQueue();
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
        const loadFullImageForId =
          useGalleryStore.getState().loadFullImageForId;
        const fullImageUrl = await loadFullImageForId(pendingItem.thumbnailId);

        if (!fullImageUrl) {
          throw new Error("Image data not found in file storage");
        }

        let resultDataUrl: string;
        let outputName: string;

        if (pendingItem.operation === "add-color-bg") {
          const { getGeminiApiKey } = await import("@/lib/gemini-store");
          const apiKey = await getGeminiApiKey();
          if (!apiKey) {
            throw new Error(
              "Gemini API key not set. Add it in Settings → API Keys."
            );
          }
          const { generateImageWithGemini, base64ToDataUrl } = await import(
            "@/lib/gemini-image"
          );
          const { useAppSettingsStore } = await import(
            "@/stores/use-app-settings-store"
          );
          const model = useAppSettingsStore.getState()
            .bgRemovalGeminiModel as import("@/lib/gemini-image").GeminiImageModel;
          const color = pendingItem.color ?? "#ffffff";
          const prompt = `Replace the background of this image with a solid flat ${color} color. Keep the subject exactly as-is. Output the full image with the new solid color background.`;
          const geminiResult = await generateImageWithGemini(
            apiKey,
            model,
            prompt,
            [fullImageUrl]
          );
          resultDataUrl = base64ToDataUrl(
            geminiResult.imageBase64,
            geminiResult.mimeType
          );
          outputName = `${pendingItem.name} (${color} bg)`;
        } else {
          const { runBgRemovalPipeline } = await import(
            "@/lib/bg-removal-pipeline"
          );
          const result = await runBgRemovalPipeline(fullImageUrl, (stage) => {
            set((state) => ({
              queue: state.queue.map((item) =>
                item.id === pendingItem.id ? { ...item, stage } : item
              ),
            }));
          });
          resultDataUrl = result.dataUrl;
          outputName =
            result.kind === "gemini-only"
              ? `${pendingItem.name} (gemini bg)`
              : `${pendingItem.name} (no bg)`;
        }

        const addThumbnail = useGalleryStore.getState().addThumbnail;
        await addThumbnail(resultDataUrl, outputName);

        set((state) => ({
          queue: state.queue.map((item) =>
            item.id === pendingItem.id ? { ...item, status: "done" } : item
          ),
        }));
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Background removal failed";
        sileo.error({ title: message });
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
