import posthog from "posthog-js";

const KEY = import.meta.env.VITE_POSTHOG_KEY as string | undefined;
const HOST =
  (import.meta.env.VITE_POSTHOG_HOST as string | undefined) ??
  "https://us.i.posthog.com";

export function initPostHog(enabled: boolean) {
  if (!KEY) return;

  if (!posthog.__loaded) {
    posthog.init(KEY, {
      api_host: HOST,
      capture_pageview: false,
      capture_pageleave: true,
      disable_session_recording: true,
      persistence: "localStorage+cookie",
      opt_out_capturing_by_default: !enabled,
    });
  } else if (enabled) {
    posthog.opt_in_capturing();
  } else {
    posthog.opt_out_capturing();
  }
}

export function setAnalyticsCaptureEnabled(enabled: boolean) {
  if (!(KEY && posthog.__loaded)) return;
  if (enabled) {
    posthog.opt_in_capturing();
  } else {
    posthog.opt_out_capturing();
  }
}

export function trackPage(page: string) {
  if (!posthog.__loaded) return;
  posthog.capture("$pageview", { page });
}

export function trackEvent(
  event: string,
  properties?: Record<string, unknown>
) {
  if (!posthog.__loaded) return;
  posthog.capture(event, properties);
}
