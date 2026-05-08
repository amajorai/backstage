"use client";

const ANALYTICS_KEY = "analytics-enabled";
const PERF_KEY = "perf-monitoring-enabled";

export function getAnalyticsEnabled(): boolean {
  if (typeof window === "undefined") return true;
  const val = localStorage.getItem(ANALYTICS_KEY);
  return val === null ? true : val === "true";
}

export function getPerfMonitoringEnabled(): boolean {
  if (typeof window === "undefined") return true;
  const val = localStorage.getItem(PERF_KEY);
  return val === null ? true : val === "true";
}

export function setAnalyticsEnabled(enabled: boolean): void {
  localStorage.setItem(ANALYTICS_KEY, String(enabled));
}

export function setPerfMonitoringEnabled(enabled: boolean): void {
  localStorage.setItem(PERF_KEY, String(enabled));
}
