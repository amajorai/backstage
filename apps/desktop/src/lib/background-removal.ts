// Utility to run background removal in a Web Worker
let worker: Worker | null = null;

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(
      new URL("../workers/background-removal.worker.ts", import.meta.url),
      { type: "module" }
    );
  }
  return worker;
}

interface WorkerResult {
  success: boolean;
  dataUrl?: string;
  error?: string;
}

export function removeBackgroundAsync(
  imageDataUrl: string,
  model?: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    const w = getWorker();

    const handleMessage = (event: MessageEvent<WorkerResult>) => {
      w.removeEventListener("message", handleMessage);
      w.removeEventListener("error", handleError);

      if (event.data.success && event.data.dataUrl) {
        resolve(event.data.dataUrl);
      } else {
        reject(new Error(event.data.error || "Background removal failed"));
      }
    };

    const handleError = (error: ErrorEvent) => {
      w.removeEventListener("message", handleMessage);
      w.removeEventListener("error", handleError);
      reject(new Error(error.message));
    };

    w.addEventListener("message", handleMessage);
    w.addEventListener("error", handleError);
    w.postMessage({ imageData: imageDataUrl, model });
  });
}

export function terminateWorker(): void {
  if (worker) {
    worker.terminate();
    worker = null;
  }
}
