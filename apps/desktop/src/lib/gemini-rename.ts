import { GoogleGenerativeAI } from "@google/generative-ai";

const MODEL = "gemini-3.1-flash-lite-preview";
const QUOTE_TRIM_REGEX = /^["']|["']$/g;

export async function generateThumbnailName(
  apiKey: string,
  imageDataUrl: string
): Promise<string> {
  const ai = new GoogleGenerativeAI(apiKey);
  const model = ai.getGenerativeModel({ model: MODEL });

  const commaIndex = imageDataUrl.indexOf(",");
  const header = imageDataUrl.slice(0, commaIndex);
  const base64Data = imageDataUrl.slice(commaIndex + 1);
  const mimeType = header.match(/data:([^;]+)/)?.[1] ?? "image/webp";

  const result = await model.generateContent([
    {
      inlineData: {
        data: base64Data,
        mimeType,
      },
    },
    "Generate a concise, descriptive title for this YouTube thumbnail image. Return ONLY the title text, nothing else. Max 60 characters.",
  ]);

  return result.response.text().trim().replace(QUOTE_TRIM_REGEX, "");
}
