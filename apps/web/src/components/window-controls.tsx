"use client";
import { useEffect, useRef, useState } from "react";

type AppWindow = import("@tauri-apps/api/window").Window;

export function WindowControls() {
  const winRef = useRef<AppWindow | null>(null);
  const [ready, setReady] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [isMac, setIsMac] = useState(false);

  useEffect(() => {
    if (!("__TAURI_INTERNALS__" in window)) return;

    const mac = navigator.platform.toLowerCase().startsWith("mac");
    setIsMac(mac);

    import("@tauri-apps/api/window").then(async ({ getCurrentWindow }) => {
      const appWindow = getCurrentWindow();
      winRef.current = appWindow;
      setIsMaximized(await appWindow.isMaximized());
      setReady(true);

      const unlisten = await appWindow.onResized(async () => {
        setIsMaximized(await appWindow.isMaximized());
      });

      return unlisten;
    });
  }, []);

  // macOS: decorum renders native traffic lights — no custom controls needed
  if (!ready || isMac) return null;

  const win = winRef.current as AppWindow;

  return (
    <div
      className="absolute top-0 right-0 flex h-full items-center"
      style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
    >
      <button
        aria-label="Minimize"
        className="flex h-full w-12 cursor-default items-center justify-center text-neutral-400 hover:bg-white/10 hover:text-white"
        onClick={() => win.minimize()}
        type="button"
      >
        <svg fill="currentColor" height="10" viewBox="0 0 10 1" width="10">
          <rect height="1" width="10" />
        </svg>
      </button>
      <button
        aria-label={isMaximized ? "Restore" : "Maximize"}
        className="flex h-full w-12 cursor-default items-center justify-center text-neutral-400 hover:bg-white/10 hover:text-white"
        onClick={() => win.toggleMaximize()}
        type="button"
      >
        {isMaximized ? (
          <svg
            fill="none"
            height="10"
            stroke="currentColor"
            strokeWidth="1.2"
            viewBox="0 0 10 10"
            width="10"
          >
            <path d="M3 0v7H10M0 3h7v7" />
          </svg>
        ) : (
          <svg
            fill="none"
            height="10"
            stroke="currentColor"
            strokeWidth="1.2"
            viewBox="0 0 10 10"
            width="10"
          >
            <rect height="9" width="9" x="0.5" y="0.5" />
          </svg>
        )}
      </button>
      <button
        aria-label="Close"
        className="flex h-full w-12 cursor-default items-center justify-center text-neutral-400 hover:bg-red-500 hover:text-white"
        onClick={() => win.close()}
        type="button"
      >
        <svg
          fill="none"
          height="10"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="1.5"
          viewBox="0 0 10 10"
          width="10"
        >
          <path d="M1 1L9 9M9 1L1 9" />
        </svg>
      </button>
    </div>
  );
}
