"use client";

import { Toaster as SileoToaster } from "sileo";
import "sileo/styles.css";
import { useAppSettingsStore } from "@/stores/use-app-settings-store";

const Toaster = () => {
  const theme = useAppSettingsStore((s) => s.theme);
  const resolvedTheme =
    theme === "system"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : theme;
  return (
    <SileoToaster offset={48} position="bottom-center" theme={resolvedTheme} />
  );
};

export { Toaster };
