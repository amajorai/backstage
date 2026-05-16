"use client";

import { Toaster as SileoToaster } from "sileo";
import "sileo/styles.css";
import { useTheme } from "next-themes";

const Toaster = () => {
  const { resolvedTheme } = useTheme();
  return (
    <SileoToaster
      position="bottom-right"
      theme={resolvedTheme as "light" | "dark"}
    />
  );
};

export { Toaster };
