import {
  getCurrentWindow,
  LogicalPosition,
  LogicalSize,
} from "@tauri-apps/api/window";
import { load } from "@tauri-apps/plugin-store";
import { useEffect, useRef } from "react";
import { useAppSettingsStore } from "@/stores/use-app-settings-store";

const STORE_NAME = "settings.json";
const BOUNDS_KEY = "window_bounds";

interface WindowBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

async function saveBounds(bounds: WindowBounds) {
  const store = await load(STORE_NAME, { defaults: {}, autoSave: true });
  await store.set(BOUNDS_KEY, bounds);
  await store.save();
}

async function loadBounds(): Promise<WindowBounds | undefined> {
  const store = await load(STORE_NAME, { defaults: {}, autoSave: false });
  return store.get<WindowBounds>(BOUNDS_KEY);
}

// Restore must happen exactly once per process. A component-level ref resets on
// remount; if the hook ever remounts (e.g. the app tree is torn down and
// rebuilt), re-running setSize/setPosition would un-maximize a maximized
// window. This module-level latch encodes the real "restore once" invariant.
let hasRestored = false;

export function useWindowBounds() {
  const rememberWindowBounds = useAppSettingsStore(
    (s) => s.rememberWindowBounds
  );
  const isInitialLoadDone = useAppSettingsStore((s) => s.isInitialLoadDone);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Restore bounds once settings are loaded
  useEffect(() => {
    if (!isInitialLoadDone || hasRestored) return;
    hasRestored = true;

    if (!rememberWindowBounds) return;

    loadBounds().then((bounds) => {
      if (!bounds) return;
      const win = getCurrentWindow();
      win.setPosition(new LogicalPosition(bounds.x, bounds.y)).catch(() => {});
      win.setSize(new LogicalSize(bounds.width, bounds.height)).catch(() => {});
    });
  }, [isInitialLoadDone, rememberWindowBounds]);

  // Save bounds on resize/move (debounced)
  useEffect(() => {
    if (!rememberWindowBounds) return;

    const win = getCurrentWindow();

    const debouncedSave = () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(async () => {
        try {
          const pos = await win.outerPosition();
          const size = await win.outerSize();
          const scaleFactor = await win.scaleFactor();
          await saveBounds({
            x: pos.x / scaleFactor,
            y: pos.y / scaleFactor,
            width: size.width / scaleFactor,
            height: size.height / scaleFactor,
          });
        } catch {
          // Window may be minimized or not ready
        }
      }, 500);
    };

    const unlistenResizePromise = win.onResized(debouncedSave);
    const unlistenMovePromise = win.onMoved(debouncedSave);

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      unlistenResizePromise.then((unlisten) => unlisten());
      unlistenMovePromise.then((unlisten) => unlisten());
    };
  }, [rememberWindowBounds]);
}
