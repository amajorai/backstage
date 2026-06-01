import { getVersion } from "@tauri-apps/api/app";
import { appCacheDir } from "@tauri-apps/api/path";
import { exists, remove } from "@tauri-apps/plugin-fs";
import { openUrl } from "@tauri-apps/plugin-opener";
import { relaunch } from "@tauri-apps/plugin-process";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { useEffect } from "react";
import { sileo } from "sileo";
import { create } from "zustand";
import {
  type GitHubRelease,
  getLatestRelease,
  getMaxEntitledVersion,
  isVersionOutsideEntitlement,
  normaliseTag,
  releaseTagUrl,
  semverGt,
} from "@/lib/github-releases";
import { logger } from "@/lib/logger";
import { useAppSettingsStore } from "@/stores/use-app-settings-store";
import {
  isUpdateWindowExpired,
  useLicenseStore,
} from "@/stores/use-license-store";

async function cleanInstallerCache() {
  try {
    const cacheDir = await appCacheDir();
    const updatesDir = `${cacheDir}updates`;
    if (await exists(updatesDir)) {
      await remove(updatesDir, { recursive: true });
    }
  } catch {
    // Cleanup failure is non-critical
  }
}

// ─── Update download store ────────────────────────────────────────────────────

/**
 * A release the in-app updater can't silently install (a beta pre-release, or a
 * version offered to an expired-license user). Surfaced as a notification that
 * links to the GitHub release page for a manual download.
 */
export interface ManualUpdate {
  version: string;
  url: string;
  body?: string;
  date?: string;
  prerelease: boolean;
}

interface UpdateStore {
  checking: boolean;
  downloading: boolean;
  progress: number;
  available: Update | null;
  manualUpdate: ManualUpdate | null;
  setChecking: (v: boolean) => void;
  setDownloading: (v: boolean) => void;
  setProgress: (v: number) => void;
  setAvailable: (v: Update | null) => void;
  setManualUpdate: (v: ManualUpdate | null) => void;
}

export const useUpdateStore = create<UpdateStore>()((set) => ({
  checking: false,
  downloading: false,
  progress: 0,
  available: null,
  manualUpdate: null,
  setChecking: (v) => set({ checking: v }),
  setDownloading: (v) => set({ downloading: v }),
  setProgress: (v) => set({ progress: v }),
  setAvailable: (v) => set({ available: v }),
  setManualUpdate: (v) => set({ manualUpdate: v }),
}));

function toManualUpdate(release: GitHubRelease): ManualUpdate {
  const version = normaliseTag(release.tag_name);
  return {
    version,
    url: release.html_url || releaseTagUrl(version),
    body: release.body ?? undefined,
    date: release.published_at || undefined,
    prerelease: release.prerelease,
  };
}

function notifyManualUpdate(update: ManualUpdate) {
  useUpdateStore.getState().setManualUpdate(update);
  sileo.show({
    title: update.prerelease ? "Beta update available" : "Update Available",
    description: `Version ${update.version} is available to download.`,
    duration: 10_000,
    button: {
      title: "View release",
      onClick: () => {
        openUrl(update.url);
      },
    },
  });
}

// ─── Version gate store ───────────────────────────────────────────────────────

interface VersionGateStore {
  blocked: boolean;
  runningVersion: string;
  entitledVersion: string;
  setGate: (running: string, entitled: string) => void;
  clearGate: () => void;
}

export const useVersionGateStore = create<VersionGateStore>()((set) => ({
  blocked: false,
  runningVersion: "",
  entitledVersion: "",
  setGate: (running, entitled) =>
    set({ blocked: true, runningVersion: running, entitledVersion: entitled }),
  clearGate: () => set({ blocked: false }),
}));

// ─── Session guards (resettable so renewal mid-session can re-fire checks) ───

let sessionChecked = false;
let sessionGateChecked = false;

/** Reset session guards so a license refresh re-fires update + gate checks. */
export function resetUpdateSession(): void {
  sessionChecked = false;
  sessionGateChecked = false;
}

// ─── Download & install ───────────────────────────────────────────────────────

export async function downloadAndInstall(update: Update) {
  const { setDownloading, setProgress } = useUpdateStore.getState();
  setDownloading(true);
  setProgress(0);

  const toastId = sileo.show({
    title: "Downloading update...",
    type: "loading",
    duration: null,
    description: "0%",
  }) as string;

  let totalBytes = 0;
  let downloadedBytes = 0;

  try {
    await update.downloadAndInstall((event) => {
      if (event.event === "Started" && event.data.contentLength) {
        totalBytes = event.data.contentLength;
      } else if (event.event === "Progress") {
        downloadedBytes += event.data.chunkLength;
        const progress =
          totalBytes > 0 ? Math.round((downloadedBytes / totalBytes) * 100) : 0;
        setProgress(progress);
        sileo.show({
          title: "Downloading update...",
          type: "loading",
          duration: null,
          description: `${progress}%`,
          id: toastId,
        } as Parameters<typeof sileo.show>[0]);
      } else if (event.event === "Finished") {
        sileo.success({
          title: "Update downloaded",
          description: "Restarting app...",
          id: toastId,
        } as Parameters<typeof sileo.success>[0]);
      }
    });
    await cleanInstallerCache();
    await relaunch();
  } catch {
    sileo.error({
      title: "Update failed",
      description: "Please try again later.",
      id: toastId,
    } as Parameters<typeof sileo.error>[0]);
    setDownloading(false);
  }
}

// ─── Update check ─────────────────────────────────────────────────────────────

export async function checkForUpdate() {
  const { checking, downloading, setChecking, setAvailable, setManualUpdate } =
    useUpdateStore.getState();
  if (checking || downloading) return;

  setChecking(true);
  setAvailable(null);
  setManualUpdate(null);
  try {
    const betaEnabled = useAppSettingsStore.getState().betaUpdatesEnabled;
    const licenseData = useLicenseStore.getState().validatedData;
    const currentVersion = await getVersion();

    // No update window restriction → normal auto-update flow
    if (!(licenseData && isUpdateWindowExpired(licenseData))) {
      // Stable channel still installs silently via the Tauri updater endpoint.
      const update = await check();
      if (update) {
        setAvailable(update);
        sileo.show({
          title: "Update Available",
          description: `Version ${update.version} is ready to install.`,
          duration: 10_000,
          button: {
            title: "Install",
            onClick: () => downloadAndInstall(update),
          },
        });
      }

      // Beta opt-in: offer the newest pre-release when it beats both the running
      // version and any stable update the silent updater just found.
      if (betaEnabled) {
        const release = await getLatestRelease({ includePrerelease: true });
        const beatsCurrent =
          release && semverGt(normaliseTag(release.tag_name), currentVersion);
        const beatsStable =
          !update ||
          (release && semverGt(normaliseTag(release.tag_name), update.version));
        if (release?.prerelease && beatsCurrent && beatsStable) {
          notifyManualUpdate(toManualUpdate(release));
        }
      }
      return;
    }

    // Update window expired → respect `expiresAt`, but follow the chosen channel.
    const updatesUntil = new Date(licenseData.expiresAt as string);
    const release = await getLatestRelease({
      includePrerelease: betaEnabled,
      updatesUntil,
    });
    if (release && semverGt(normaliseTag(release.tag_name), currentVersion)) {
      notifyManualUpdate(toManualUpdate(release));
    }
  } catch {
    // Network unavailable or no release found — silent
  } finally {
    setChecking(false);
  }
}

// ─── Version gate check ───────────────────────────────────────────────────────

export async function checkVersionGate() {
  const { validatedData: licenseData, usingCachedValidation } =
    useLicenseStore.getState();
  if (!licenseData?.expiresAt) return;
  if (!isUpdateWindowExpired(licenseData)) return;

  // If license data came from disk cache (Polar unreachable), `expiresAt` may
  // be stale — possibly a renewal landed server-side but we can't see it.
  // Fail open: don't block the user based on data we can't trust.
  if (usingCachedValidation) {
    logger.warn(
      "[VersionGate] Skipping gate decision: license data from cache, can't trust entitlement window"
    );
    return;
  }

  try {
    const currentVersion = await getVersion();
    const updatesUntil = new Date(licenseData.expiresAt);
    const outside = await isVersionOutsideEntitlement(
      currentVersion,
      updatesUntil
    );
    if (!outside) return;

    const maxVersion = await getMaxEntitledVersion(updatesUntil);
    // Guard against degenerate case: no releases within the entitlement window
    // means we can't render a useful download link. Skip the gate.
    if (maxVersion && maxVersion.length > 0) {
      useVersionGateStore.getState().setGate(currentVersion, maxVersion);
    }
  } catch (error) {
    logger.warn(
      { err: error },
      "[VersionGate] Failed to check entitlement, not blocking app"
    );
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAppUpdater() {
  const isInitialLoadDone = useAppSettingsStore((s) => s.isInitialLoadDone);
  const autoCheckForUpdates = useAppSettingsStore((s) => s.autoCheckForUpdates);
  const isValidated = useLicenseStore((s) => s.isValidated);

  useEffect(() => {
    if (!(isInitialLoadDone && isValidated)) return;

    if (!sessionGateChecked) {
      sessionGateChecked = true;
      // Delay slightly so license data is fully settled
      setTimeout(() => checkVersionGate(), 4000);
    }

    if (!autoCheckForUpdates) return;
    if (sessionChecked) return;
    sessionChecked = true;
    setTimeout(() => checkForUpdate(), 3000);
  }, [isInitialLoadDone, autoCheckForUpdates, isValidated]);
}
