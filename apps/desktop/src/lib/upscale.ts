import { invoke } from "@tauri-apps/api/core";

export interface UpscalerStatus {
  available: boolean;
  path: string;
}

export interface UpscaleModel {
  id: string;
  name: string;
}

export const UPSCALE_MODELS: UpscaleModel[] = [
  { id: "realesrgan-x4plus", name: "Photo (General)" },
  { id: "realesrgan-x4plus-anime", name: "Anime / Illustration" },
];

export async function getUpscalerStatus(): Promise<UpscalerStatus> {
  return invoke<UpscalerStatus>("upscaler_status");
}

export async function downloadUpscaler(): Promise<void> {
  return invoke("download_upscaler");
}

export async function upscaleImage(
  dataUrl: string,
  scale: 2 | 4,
  model = "realesrgan-x4plus"
): Promise<string> {
  return invoke<string>("upscale_image", { dataUrl, scale, model });
}
