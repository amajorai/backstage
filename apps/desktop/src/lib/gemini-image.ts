import { GoogleGenAI } from "@google/genai";

export type GeminiImageModel =
  | "gemini-3.1-flash-image-preview"
  | "gemini-3-pro-image-preview"
  | "gemini-2.5-flash-image";

// Pricing as of mid-2025 (Vertex AI / Gemini API). Per-image costs at ~1K resolution (1280×720).
// Source: cloud.google.com/vertex-ai/generative-ai/pricing
const INPUT_IMAGE_TOKENS = 560;

export const GEMINI_IMAGE_PRICING: Record<
  GeminiImageModel,
  { perImage: number; inputPerMToken: number }
> = {
  "gemini-2.5-flash-image": { perImage: 0.039, inputPerMToken: 0.3 },
  "gemini-3.1-flash-image-preview": { perImage: 0.067, inputPerMToken: 0.5 },
  "gemini-3-pro-image-preview": { perImage: 0.134, inputPerMToken: 2.0 },
};

export function estimateGenerationCost(
  model: GeminiImageModel,
  generationCount: number,
  promptTokens = 100,
  inputImageCount = 0
): number {
  const p = GEMINI_IMAGE_PRICING[model];
  const inputTokens = promptTokens + inputImageCount * INPUT_IMAGE_TOKENS;
  return (
    p.perImage * generationCount +
    ((inputTokens * generationCount) / 1_000_000) * p.inputPerMToken
  );
}

export const GEMINI_IMAGE_MODELS: { value: GeminiImageModel; label: string }[] =
  [
    {
      value: "gemini-3.1-flash-image-preview",
      label: "Gemini 3.1 Flash Image (Nano Banana 2)",
    },
    {
      value: "gemini-3-pro-image-preview",
      label: "Gemini 3 Pro Image (Nano Banana Pro)",
    },
    {
      value: "gemini-2.5-flash-image",
      label: "Gemini 2.5 Flash Image (Nano Banana)",
    },
  ];

export interface GenerateImageResult {
  imageBase64: string;
  mimeType: string;
}

export async function generateImageWithGemini(
  apiKey: string,
  model: GeminiImageModel,
  prompt: string,
  inputImages?: string[],
  inputMimeType = "image/png"
): Promise<GenerateImageResult> {
  const ai = new GoogleGenAI({ apiKey });

  const contentParts: {
    inlineData?: { mimeType: string; data: string };
    text?: string;
  }[] = [];

  if (inputImages && inputImages.length > 0) {
    for (const img of inputImages) {
      const base64Data = img.includes(",") ? img.split(",")[1] : img;
      contentParts.push({
        inlineData: { mimeType: inputMimeType, data: base64Data },
      });
    }
  }

  contentParts.push({ text: prompt });

  const response = await ai.models.generateContent({
    model,
    contents: [{ role: "user", parts: contentParts }],
    config: {
      responseModalities: ["TEXT", "IMAGE"],
    },
  });

  // Find the image part in the response
  const parts = response.candidates?.[0]?.content?.parts;
  if (!parts) {
    throw new Error("No response parts received from Gemini API");
  }

  for (const part of parts) {
    if (part.inlineData?.data) {
      return {
        imageBase64: part.inlineData.data,
        mimeType: part.inlineData.mimeType ?? "image/png",
      };
    }
  }

  throw new Error("No image generated in response");
}

export function base64ToDataUrl(base64: string, mimeType: string): string {
  return `data:${mimeType};base64,${base64}`;
}
