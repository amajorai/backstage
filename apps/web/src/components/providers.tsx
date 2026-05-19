"use client";

import { Toaster } from "@repo/ui/sonner";
import { AxiomWebVitals } from "./axiom-web-vitals";
import { PostHogProvider } from "./posthog-provider";
import { ThemeProvider } from "./theme-provider";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      disableTransitionOnChange
      enableSystem
    >
      <PostHogProvider>
        <AxiomWebVitals />
        {children}
        <Toaster />
      </PostHogProvider>
    </ThemeProvider>
  );
}
