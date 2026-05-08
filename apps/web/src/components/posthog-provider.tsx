"use client";

import { PostHogPageView } from "@posthog/next";
import posthog from "posthog-js";
import { PostHogProvider as PHProvider } from "posthog-js/react";
import { Suspense } from "react";
import { getAnalyticsEnabled } from "@/lib/analytics-prefs";

const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const host = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com";

if (typeof window !== "undefined" && key && !posthog.__loaded) {
  posthog.init(key, {
    api_host: host,
    capture_pageview: false,
    capture_pageleave: true,
    disable_session_recording: true,
    persistence: "localStorage+cookie",
    opt_out_capturing_by_default: !getAnalyticsEnabled(),
  });
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  if (!key) {
    return <>{children}</>;
  }

  return (
    <PHProvider client={posthog}>
      <Suspense fallback={null}>
        <PostHogPageView />
      </Suspense>
      {children}
    </PHProvider>
  );
}
