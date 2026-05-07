import { removeBackground } from "@imgly/background-removal";

self.onmessage = async (
  event: MessageEvent<{ imageData: string; model?: string }>
) => {
  try {
    const { imageData, model } = event.data;

    const response = await fetch(imageData);
    const blob = await response.blob();

    const resultBlob = await removeBackground(blob, model ? { model } : {});

    // Convert result back to data URL
    const reader = new FileReader();
    const resultDataUrl = await new Promise<string>((resolve, reject) => {
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(resultBlob);
    });

    self.postMessage({ success: true, dataUrl: resultDataUrl });
  } catch (error) {
    self.postMessage({ success: false, error: String(error) });
  }
};
