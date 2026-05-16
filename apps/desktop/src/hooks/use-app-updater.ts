import { relaunch } from "@tauri-apps/plugin-process";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { useEffect } from "react";
import { sileo } from "sileo";
import { create } from "zustand";
import { useAppSettingsStore } from "@/stores/use-app-settings-store";

interface UpdateStore {
  checking: boolean;
  downloading: boolean;
  progress: number;
  available: Update | null;
  setChecking: (v: boolean) => void;
  setDownloading: (v: boolean) => void;
  setProgress: (v: number) => void;
  setAvailable: (v: Update | null) => void;
}

export const useUpdateStore = create<UpdateStore>()((set) => ({
  checking: false,
  downloading: false,
  progress: 0,
  available: null,
  setChecking: (v) => set({ checking: v }),
  setDownloading: (v) => set({ downloading: v }),
  setProgress: (v) => set({ progress: v }),
  setAvailable: (v) => set({ available: v }),
}));

// Module-level guard: only auto-check once per process lifetime
let sessionChecked = false;

export async function downloadAndInstall(update: Update) {
  const { setDownloading, setProgress } = useUpdateStore.getState();
  setDownloading(true);
  setProgress(0);

  const toastId = sileo.show({
    title: "Downloading update...",
    type: "loading",
    duration: null,
    description: "0%",
  }) as string;

  let totalBytes = 0;
  let downloadedBytes = 0;

  try {
    await update.downloadAndInstall((event) => {
      if (event.event === "Started" && event.data.contentLength) {
        totalBytes = event.data.contentLength;
      } else if (event.event === "Progress") {
        downloadedBytes += event.data.chunkLength;
        const progress =
          totalBytes > 0 ? Math.round((downloadedBytes / totalBytes) * 100) : 0;
        setProgress(progress);
        sileo.show({
          title: "Downloading update...",
          type: "loading",
          duration: null,
          description: `${progress}%`,
          id: toastId,
        } as any);
      } else if (event.event === "Finished") {
        sileo.success({
          title: "Update downloaded",
          description: "Restarting app...",
          id: toastId,
        } as any);
      }
    });

    await relaunch();
  } catch (error) {
    console.error("Update failed:", error);
    sileo.error({
      title: "Update failed",
      description: "Please try again later.",
      id: toastId,
    } as any);
    setDownloading(false);
  }
}

export async function checkForUpdate() {
  const { checking, downloading, setChecking, setAvailable } =
    useUpdateStore.getState();

  if (checking || downloading) return;

  setChecking(true);

  try {
    const update = await check();

    if (update) {
      setAvailable(update);
      sileo.show({
        title: "Update Available",
        description: `Version ${update.version} is ready to install.`,
        duration: 10_000,
        button: {
          title: "Install",
          onClick: () => downloadAndInstall(update),
        },
      });
    }
  } catch {
    // No release published yet or network unavailable — not an error
  } finally {
    setChecking(false);
  }
}

export function useAppUpdater() {
  const isInitialLoadDone = useAppSettingsStore((s) => s.isInitialLoadDone);
  const autoCheckForUpdates = useAppSettingsStore((s) => s.autoCheckForUpdates);

  useEffect(() => {
    if (!isInitialLoadDone) return;
    if (!autoCheckForUpdates) return;
    if (sessionChecked) return;

    sessionChecked = true;

    const timer = setTimeout(() => {
      checkForUpdate();
    }, 3000);

    return () => clearTimeout(timer);
  }, [isInitialLoadDone, autoCheckForUpdates]);
}
