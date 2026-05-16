import { useState } from "react";
import type { ViewMode } from "@/App";

const VALID_MODES = new Set<string>(["3", "4", "5", "row"]);

export function usePersistedViewMode(key: string, defaultMode: ViewMode) {
  const [viewMode, setViewModeState] = useState<ViewMode>(() => {
    const stored = localStorage.getItem(key);
    return stored && VALID_MODES.has(stored)
      ? (stored as ViewMode)
      : defaultMode;
  });

  const setViewMode = (mode: ViewMode) => {
    localStorage.setItem(key, mode);
    setViewModeState(mode);
  };

  return [viewMode, setViewMode] as const;
}
