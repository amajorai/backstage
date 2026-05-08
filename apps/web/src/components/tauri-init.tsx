"use client";
import { useEffect } from "react";

export function TauriInit() {
  useEffect(() => {
    if (!("__TAURI_INTERNALS__" in window)) return;
    document.documentElement.dataset.tauri = "true";
    const isMac = navigator.platform.toLowerCase().startsWith("mac");
    if (isMac) {
      document.documentElement.dataset.tauriPlatform = "macos";
    }
  }, []);
  return null;
}
