"use client";

import { AxiomWebVitals } from "./axiom-web-vitals";
import { PostHogProvider } from "./posthog-provider";
import { ThemeProvider } from "./theme-provider";
import { Toaster } from "./ui/sonner";

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
        <Toaster richColors />
      </PostHogProvider>
    </ThemeProvider>
  );
}
