"use client";

const KEY = "sounds-enabled";

export function getSoundsEnabled(): boolean {
  if (typeof window === "undefined") return false;
  const v = localStorage.getItem(KEY);
  return v === null ? true : v === "true";
}

export function setSoundsEnabled(enabled: boolean): void {
  localStorage.setItem(KEY, String(enabled));
}
