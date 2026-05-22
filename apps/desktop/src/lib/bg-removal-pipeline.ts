import {
  BG_REMOVAL_MODEL_MAP,
  useAppSettingsStore,
} from "@/stores/use-app-settings-store";

export type BgRemovalPipelineResult =
  | { kind: "removed"; dataUrl: string }
  | { kind: "gemini-only"; dataUrl: string };

export async function runBgRemovalPipeline(
  imageDataUrl: string,
  onProgress?: (stage: string) => void
): Promise<BgRemovalPipelineResult> {
  const {
    bgRemovalProvider,
    bgRemovalQuality,
    bgRemovalGeminiEnabled,
    bgRemovalGeminiModel,
    bgRemovalGeminiColor,
    bgRemovalGeminiAutoRemove,
  } = useAppSettingsStore.getState();

  let workingUrl = imageDataUrl;

  if (bgRemovalGeminiEnabled) {
    const { getGeminiApiKey } = await import("@/lib/gemini-store");
    const apiKey = await getGeminiApiKey();
    if (apiKey) {
      onProgress?.("Pre-processing with Gemini...");
      const { generateImageWithGemini, base64ToDataUrl } = await import(
        "@/lib/gemini-image"
      );
      const prompt = `Replace the background of this image with a solid flat ${bgRemovalGeminiColor} color. Keep the subject (person, object, or foreground element) exactly as-is. Output the full image with the new background.`;
      const geminiResult = await generateImageWithGemini(
        apiKey,
        bgRemovalGeminiModel as import("@/lib/gemini-image").GeminiImageModel,
        prompt,
        [workingUrl]
      );
      const geminiDataUrl = base64ToDataUrl(
        geminiResult.imageBase64,
        geminiResult.mimeType
      );

      if (!bgRemovalGeminiAutoRemove) {
        return { kind: "gemini-only", dataUrl: geminiDataUrl };
      }

      workingUrl = geminiDataUrl;
    }
  }

  onProgress?.("Removing background...");
  let resultDataUrl: string;
  if (bgRemovalProvider === "briaai" || bgRemovalProvider === "briaai2") {
    const { invoke } = await import("@tauri-apps/api/core");
    const command =
      bgRemovalProvider === "briaai2"
        ? "remove_background_bria_v2"
        : "remove_background_bria";
    resultDataUrl = await invoke<string>(command, {
      imageData: workingUrl,
    });
  } else {
    const { removeBackgroundAsync } = await import("@/lib/background-removal");
    const model = BG_REMOVAL_MODEL_MAP[bgRemovalQuality];
    resultDataUrl = await removeBackgroundAsync(workingUrl, model);
  }

  return { kind: "removed", dataUrl: resultDataUrl };
}
