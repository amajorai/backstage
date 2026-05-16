import { create } from "zustand";
import { acpPrompt } from "@/lib/acp-client";
import { generateThumbnailName } from "@/lib/gemini-rename";
import { getGeminiApiKey } from "@/lib/gemini-store";
import { useAppSettingsStore } from "./use-app-settings-store";
import { useGalleryStore } from "./use-gallery-store";

const ACP_RENAME_PROMPT =
  "Generate a concise, descriptive title for this YouTube thumbnail image. Return ONLY the title text, nothing else. Max 60 characters.";

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
        const { loadFullImageForId, updateThumbnailName } =
          useGalleryStore.getState();
        const fullImage = await loadFullImageForId(pendingItem.thumbnailId);
        if (!fullImage) {
          throw new Error("Image not found");
        }

        const { acpAgents, acpTextGenAgentId } = useAppSettingsStore.getState();
        const activeAgent = acpTextGenAgentId
          ? acpAgents.find((a) => a.id === acpTextGenAgentId)
          : null;

        let generatedName: string;

        if (activeAgent) {
          // Extract base64 data from data URL (strip "data:image/...;base64," prefix)
          const commaIdx = fullImage.indexOf(",");
          const base64Data =
            commaIdx >= 0 ? fullImage.slice(commaIdx + 1) : fullImage;
          const mimeMatch = fullImage.match(/^data:([^;]+);/);
          const mimeType = mimeMatch ? mimeMatch[1] : "image/webp";

          generatedName = await acpPrompt(
            activeAgent,
            ACP_RENAME_PROMPT,
            base64Data,
            mimeType
          );
        } else {
          const apiKey = await getGeminiApiKey();
          if (!apiKey) {
            throw new Error(
              "No AI configured: add an agent in Settings → Agents or set a Gemini API key"
            );
          }
          generatedName = await generateThumbnailName(apiKey, fullImage);
        }

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
