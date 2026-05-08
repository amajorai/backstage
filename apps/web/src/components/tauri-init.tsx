"use client";
import { useEffect } from "react";

export function TauriInit() {
  useEffect(() => {
    if (!("__TAURI_INTERNALS__" in window)) return;
    const html = document.documentElement;
    html.dataset.tauri = "true";
    const isMac = navigator.platform.toLowerCase().startsWith("mac");
    if (isMac) {
      html.dataset.tauriPlatform = "macos";
      // Reserve space for native traffic lights (left side)
      html.style.setProperty("--titlebar-left", "80px");
      html.style.setProperty("--titlebar-right", "0px");
    } else {
      // Reserve space for our custom window controls (right side, 3×48px)
      html.style.setProperty("--titlebar-left", "0px");
      html.style.setProperty("--titlebar-right", "144px");
    }
  }, []);
  return null;
}
