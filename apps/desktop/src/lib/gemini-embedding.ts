import { GoogleGenerativeAI } from "@google/generative-ai";

/**
 * Cloud embedding fallback used on builds without the local fastembed/ONNX
 * engine (notably macOS Intel, where ort ships no prebuilt ONNX Runtime).
 *
 * Gemini's embedding API is text-only, so images are first captioned with a
 * vision model, then the caption is embedded. `text-embedding-004` returns
 * 768-dim vectors, matching the `vec0(embedding float[768])` schema — do not
 * swap in a model with a different dimensionality.
 */
const EMBEDDING_MODEL = "text-embedding-004";
const DESCRIPTION_MODEL = "gemini-flash-lite-latest";

export async function generateImageEmbedding(
  apiKey: string,
  imageDataUrl: string
): Promise<number[]> {
  const ai = new GoogleGenerativeAI(apiKey);

  // Step 1: Generate rich semantic description using vision model
  const genModel = ai.getGenerativeModel({ model: DESCRIPTION_MODEL });

  const commaIdx = imageDataUrl.indexOf(",");
  const base64 = imageDataUrl.slice(commaIdx + 1);
  const mimeType =
    imageDataUrl.slice(0, commaIdx).match(/data:([^;]+)/)?.[1] ?? "image/webp";

  const descResult = await genModel.generateContent([
    { inlineData: { data: base64, mimeType } },
    "Describe this image for semantic search indexing. Include: main subject and people, objects and items, colors and visual style, mood and atmosphere, setting and background, any visible text or numbers, and notable visual characteristics. Be factual, specific, and comprehensive. 100-150 words.",
  ]);

  const description = descResult.response.text().trim();

  // Step 2: Embed the description
  const embedModel = ai.getGenerativeModel({ model: EMBEDDING_MODEL });
  const embedResult = await embedModel.embedContent(description);

  return embedResult.embedding.values;
}

export async function embedText(
  apiKey: string,
  text: string
): Promise<number[]> {
  const ai = new GoogleGenerativeAI(apiKey);
  const model = ai.getGenerativeModel({ model: EMBEDDING_MODEL });
  const result = await model.embedContent(text);
  return result.embedding.values;
}
