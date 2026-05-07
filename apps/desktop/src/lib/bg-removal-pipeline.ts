import {
  BG_REMOVAL_MODEL_MAP,
  useAppSettingsStore,
} from "@/stores/use-app-settings-store";

export type BgRemovalPipelineResult =
  | { kind: "removed"; dataUrl: string }
  | { kind: "gemini-only"; dataUrl: string };

export async function runBgRemovalPipeline(
  imageDataUrl: string
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
    if (!apiKey) {
      throw new Error("Gemini API key not set. Add it in Settings → API Keys.");
    }
    const { generateImageWithGemini, base64ToDataUrl } = await import(
      "@/lib/gemini-image"
    );
    const prompt = `Replace the background of this image with a solid flat ${bgRemovalGeminiColor} color. Keep the subject (person, object, or foreground element) exactly as-is. Output the full image with the new background.`;
    const geminiResult = await generateImageWithGemini(
      apiKey,
      bgRemovalGeminiModel as import("@/lib/gemini-image").GeminiImageModel,
      prompt,
      workingUrl
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

  let resultDataUrl: string;
  if (bgRemovalProvider === "briaai") {
    const { invoke } = await import("@tauri-apps/api/core");
    resultDataUrl = await invoke<string>("remove_background_bria", {
      imageData: workingUrl,
    });
  } else {
    const { removeBackgroundAsync } = await import("@/lib/background-removal");
    const model = BG_REMOVAL_MODEL_MAP[bgRemovalQuality];
    resultDataUrl = await removeBackgroundAsync(workingUrl, model);
  }

  return { kind: "removed", dataUrl: resultDataUrl };
}
