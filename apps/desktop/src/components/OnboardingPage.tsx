import { Button } from "@repo/ui/button";
import { Input } from "@repo/ui/input";
import { Skeleton } from "@repo/ui/skeleton";
import { Toaster } from "@repo/ui/sonner";
import { Switch } from "@repo/ui/switch";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { openUrl } from "@tauri-apps/plugin-opener";
import {
  ArrowLeft,
  Check,
  ChevronRight,
  Download,
  ExternalLink,
  HardDrive,
  Loader2,
  Lock,
  MessageCircle,
  Monitor,
  Moon,
  RefreshCw,
  Sun,
  WifiOff,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { AiMockup } from "@/components/onboarding/AiMockup";
import { EditorMockup } from "@/components/onboarding/EditorMockup";
import { ExploreMockup } from "@/components/onboarding/ExploreMockup";
import { GalleryMockup } from "@/components/onboarding/GalleryMockup";
import {
  checkForUpdate,
  downloadAndInstall,
  useUpdateStore,
} from "@/hooks/use-app-updater";
import { getGeminiApiKey, setGeminiApiKey } from "@/lib/gemini-store";
import { getHfToken, setHfToken } from "@/lib/hf-store";
import * as sounds from "@/lib/sounds";
import { getYoutubeApiKey, setYoutubeApiKey } from "@/lib/youtube-store";
import {
  type AppTheme,
  type BgRemovalProvider,
  useAppSettingsStore,
} from "@/stores/use-app-settings-store";

interface OnboardingPageProps {
  onComplete: () => void;
}

function UpdateStep() {
  const { checking, downloading, progress, available } = useUpdateStore();
  const { autoCheckForUpdates, setAutoCheckForUpdates } = useAppSettingsStore();
  const [didCheck, setDidCheck] = useState(false);

  useEffect(() => {
    if (didCheck) return;
    setDidCheck(true);
    checkForUpdate();
  }, [didCheck]);

  return (
    <div className="flex w-full max-w-md flex-col gap-8">
      <div
        className="flex w-full items-start"
        style={{ animation: "fade-slide-up 0.38s ease-out 0ms both" }}
      >
        {checking ? (
          <Loader2 className="size-10 animate-spin text-foreground" />
        ) : (
          <RefreshCw className="size-10 text-foreground" />
        )}
      </div>

      <div
        className="flex w-full flex-col"
        style={{ animation: "fade-slide-up 0.38s ease-out 80ms both" }}
      >
        <h1 className="font-medium text-xl">
          {checking
            ? "Checking for updates"
            : available
              ? "Update available"
              : "You're on the latest version"}
        </h1>
        <p className="font-medium text-muted-foreground text-xl">
          {checking
            ? "Just a moment..."
            : available
              ? `Version ${available.version} is ready`
              : "Backstage is fully up to date"}
        </p>
      </div>

      {available && (
        <Button
          className="h-14 w-full"
          disabled={downloading}
          onClick={() => {
            sounds.download();
            downloadAndInstall(available);
          }}
          size="lg"
          style={{ animation: "fade-slide-up 0.38s ease-out 160ms both" }}
          variant="contrast"
        >
          {downloading ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" />
              {progress > 0 ? `Downloading ${progress}%` : "Downloading..."}
            </>
          ) : (
            <>
              <Download className="mr-2 size-4" />
              Update Now
            </>
          )}
        </Button>
      )}

      <div
        className="flex items-center justify-between rounded-lg bg-muted/50 px-4 py-3"
        style={{ animation: "fade-slide-up 0.38s ease-out 240ms both" }}
      >
        <div className="flex-1 pr-4">
          <p className="font-medium text-sm">Check for updates automatically</p>
          <p className="mt-0.5 text-muted-foreground text-xs leading-snug">
            Backstage checks for updates when you launch the app
          </p>
        </div>
        <Switch
          checked={autoCheckForUpdates}
          onCheckedChange={setAutoCheckForUpdates}
        />
      </div>
    </div>
  );
}

function PreferencesStep() {
  const { theme, setTheme } = useAppSettingsStore();

  const themes: { value: AppTheme; label: string; icon: React.ReactNode }[] = [
    { value: "light", label: "Light", icon: <Sun className="size-4" /> },
    { value: "dark", label: "Dark", icon: <Moon className="size-4" /> },
    { value: "system", label: "System", icon: <Monitor className="size-4" /> },
  ];

  return (
    <div className="flex w-full flex-col gap-6">
      <div style={{ animation: "fade-slide-up 0.38s ease-out 120ms both" }}>
        <p className="mb-3 font-medium text-muted-foreground text-xs">
          Appearance
        </p>
        <div className="flex gap-2">
          {themes.map((t) => (
            <button
              className={`flex flex-1 flex-col items-center gap-2 rounded-lg border py-4 text-sm transition-colors ${
                theme === t.value
                  ? "border-foreground bg-muted text-foreground"
                  : "border-border text-muted-foreground hover:border-foreground/40"
              }`}
              key={t.value}
              onClick={() => {
                sounds.click();
                setTheme(t.value);
              }}
              type="button"
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function StartupStep() {
  const {
    persistTabs,
    setPersistTabs,
    rememberWindowBounds,
    setRememberWindowBounds,
  } = useAppSettingsStore();
  const [launchAtStartup, setLaunchAtStartupState] = useState<boolean | null>(
    null
  );

  useEffect(() => {
    import("@tauri-apps/plugin-autostart").then(({ isEnabled }) => {
      isEnabled()
        .then((v) => setLaunchAtStartupState(v))
        .catch(() => setLaunchAtStartupState(false));
    });
  }, []);

  const handleLaunchAtStartup = useCallback(async (enabled: boolean) => {
    try {
      const { enable, disable } = await import("@tauri-apps/plugin-autostart");
      if (enabled) {
        await enable();
      } else {
        await disable();
      }
      setLaunchAtStartupState(enabled);
    } catch {}
  }, []);

  const items = [
    {
      title: "Launch at startup",
      desc: "Open Backstage automatically when you log in to your computer",
      checked: launchAtStartup ?? false,
      disabled: launchAtStartup === null,
      onCheckedChange: handleLaunchAtStartup,
      delay: "120ms",
    },
    {
      title: "Restore tabs on startup",
      desc: "Re-open your last open projects when launching the app",
      checked: persistTabs,
      disabled: false,
      onCheckedChange: setPersistTabs,
      delay: "200ms",
    },
    {
      title: "Remember window position & size",
      desc: "Save and restore window position and size between sessions",
      checked: rememberWindowBounds,
      disabled: false,
      onCheckedChange: setRememberWindowBounds,
      delay: "280ms",
    },
  ];

  return (
    <div className="flex w-full flex-col gap-2">
      {items.map((item) => (
        <div
          className="flex items-center justify-between rounded-lg bg-muted/50 px-4 py-3"
          key={item.title}
          style={{
            animation: `fade-slide-up 0.38s ease-out ${item.delay} both`,
          }}
        >
          <div className="flex-1 pr-4">
            <p className="font-medium text-sm">{item.title}</p>
            <p className="mt-0.5 text-muted-foreground text-xs leading-snug">
              {item.desc}
            </p>
          </div>
          <Switch
            checked={item.checked}
            disabled={item.disabled}
            onCheckedChange={item.onCheckedChange}
          />
        </div>
      ))}
    </div>
  );
}

function GeminiKeyStep() {
  const [geminiKey, setGeminiKeyValue] = useState("");
  const [hasGeminiKey, setHasGeminiKey] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getGeminiApiKey()
      .then((k) => setHasGeminiKey(!!k))
      .finally(() => setLoading(false));
  }, []);

  const save = useCallback(async () => {
    if (!geminiKey.trim()) return;
    await setGeminiApiKey(geminiKey.trim());
    setHasGeminiKey(true);
    setGeminiKeyValue("");
  }, [geminiKey]);

  if (loading) {
    return (
      <div
        className="flex w-full flex-col gap-3"
        style={{ animation: "fade-slide-up 0.38s ease-out 120ms both" }}
      >
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    );
  }

  if (hasGeminiKey) {
    return (
      <div
        className="flex w-full flex-col gap-3"
        style={{ animation: "fade-slide-up 0.38s ease-out 120ms both" }}
      >
        <div className="flex h-14 items-center gap-2 rounded-lg bg-muted/50 px-4 text-green-600 text-sm dark:text-green-400">
          <Check className="size-4" />
          Gemini API key saved
        </div>
        <p className="text-muted-foreground text-xs">
          Change it anytime in Settings
        </p>
      </div>
    );
  }

  return (
    <div
      className="flex w-full flex-col gap-3"
      style={{ animation: "fade-slide-up 0.38s ease-out 120ms both" }}
    >
      <div className="flex items-center gap-2">
        <Input
          autoFocus
          className="h-14 flex-1 text-lg"
          onChange={(e) => setGeminiKeyValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
          }}
          placeholder="Gemini API key"
          type="password"
          value={geminiKey}
        />
        {geminiKey.trim() && (
          <Button
            className="size-14"
            onClick={save}
            size="icon"
            variant="ghost"
          >
            <Check className="size-4" />
          </Button>
        )}
      </div>
      <p className="text-muted-foreground text-xs">
        Free from Google AI Studio.{" "}
        <button
          className="inline-flex items-center gap-0.5 text-foreground hover:underline"
          onClick={() => {
            sounds.click();
            openUrl("https://aistudio.google.com/apikey");
          }}
          type="button"
        >
          Get your key
          <ExternalLink className="ml-0.5 size-3" />
        </button>
      </p>
    </div>
  );
}

function smartSearchDescription({
  isWorking,
  downloadPct,
  ready,
  provider,
}: {
  isWorking: boolean;
  downloadPct: number | null;
  ready: boolean | null;
  provider: "local" | "gemini";
}): string {
  if (provider === "gemini") {
    return ready
      ? "Search your projects by what they look like, powered by your Gemini API key."
      : "Search your projects by what they look like. Needs a Gemini API key on this device.";
  }
  if (isWorking) {
    return downloadPct === null
      ? "Setting up on-device search (~880 MB, one time). This can take a few minutes."
      : `Downloading the search model… ${downloadPct}% (~880 MB, one time)`;
  }
  return ready
    ? "Search your projects by what they look like. Runs fully on your device."
    : "Search your projects by what they look like. Enabling downloads a ~880 MB model once, then works offline.";
}

function SmartSearchStep() {
  const { semanticSearchEnabled, setSemanticSearchEnabled } =
    useAppSettingsStore();
  const [ready, setReady] = useState<boolean | null>(null);
  const [provider, setProvider] = useState<"local" | "gemini">("local");
  const [isWorking, setIsWorking] = useState(false);
  const [downloadPct, setDownloadPct] = useState<number | null>(null);

  useEffect(() => {
    import("@/lib/embedding-provider")
      .then(({ getEmbeddingProviderStatus }) => getEmbeddingProviderStatus())
      .then((s) => {
        setProvider(s.provider);
        setReady(s.ready);
      })
      .catch(() => setReady(false));
  }, []);

  useEffect(() => {
    const p = listen<{ downloaded: number; total: number }>(
      "embedding-download-progress",
      (e) => {
        if (e.payload.total > 0) {
          setDownloadPct(
            Math.round((e.payload.downloaded / e.payload.total) * 100)
          );
        }
      }
    );
    return () => {
      p.then((un) => un());
    };
  }, []);

  const handleToggle = useCallback(
    async (enabled: boolean) => {
      if (!enabled) {
        await setSemanticSearchEnabled(false);
        return;
      }
      setIsWorking(true);
      try {
        const { ensureEmbeddingModelsReady, getActiveEmbeddingModelVersion } =
          await import("@/lib/embedding-provider");
        if (!ready) {
          // No-op on the Gemini fallback build; downloads models locally.
          await ensureEmbeddingModelsReady();
          setReady(true);
        }
        // Purge any incompatible vectors from a previous model before enabling.
        const { clearEmbeddingsOtherModel } = await import(
          "@/lib/semantic-search"
        );
        const modelVersion = await getActiveEmbeddingModelVersion();
        await clearEmbeddingsOtherModel(modelVersion).catch(() => {});
        await setSemanticSearchEnabled(true);
      } catch {
        await setSemanticSearchEnabled(false);
      } finally {
        setIsWorking(false);
        setDownloadPct(null);
      }
    },
    [ready, setSemanticSearchEnabled]
  );

  return (
    <div className="flex w-full flex-col gap-3">
      <div
        className="flex items-center justify-between rounded-lg bg-muted/50 px-4 py-3"
        style={{ animation: "fade-slide-up 0.38s ease-out 120ms both" }}
      >
        <div className="flex-1 pr-4">
          <p className="font-medium text-sm">Smart image search</p>
          <p className="mt-0.5 text-muted-foreground text-xs leading-snug">
            {smartSearchDescription({
              isWorking,
              downloadPct,
              ready,
              provider,
            })}
          </p>
        </div>
        {isWorking ? (
          <Loader2 className="size-5 shrink-0 animate-spin text-muted-foreground" />
        ) : (
          <Switch
            checked={semanticSearchEnabled}
            disabled={ready === null}
            onCheckedChange={handleToggle}
          />
        )}
      </div>
    </div>
  );
}

function YoutubeKeyStep() {
  const [youtubeKey, setYoutubeKeyValue] = useState("");
  const [hasYoutubeKey, setHasYoutubeKey] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getYoutubeApiKey()
      .then((k) => setHasYoutubeKey(!!k))
      .finally(() => setLoading(false));
  }, []);

  const save = useCallback(async () => {
    if (!youtubeKey.trim()) return;
    await setYoutubeApiKey(youtubeKey.trim());
    setHasYoutubeKey(true);
    setYoutubeKeyValue("");
  }, [youtubeKey]);

  if (loading) {
    return (
      <div
        className="flex w-full flex-col gap-3"
        style={{ animation: "fade-slide-up 0.38s ease-out 120ms both" }}
      >
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    );
  }

  if (hasYoutubeKey) {
    return (
      <div
        className="flex w-full flex-col gap-3"
        style={{ animation: "fade-slide-up 0.38s ease-out 120ms both" }}
      >
        <div className="flex h-14 items-center gap-2 rounded-lg bg-muted/50 px-4 text-green-600 text-sm dark:text-green-400">
          <Check className="size-4" />
          YouTube API key saved
        </div>
        <p className="text-muted-foreground text-xs">
          Change it anytime in Settings
        </p>
      </div>
    );
  }

  return (
    <div
      className="flex w-full flex-col gap-3"
      style={{ animation: "fade-slide-up 0.38s ease-out 120ms both" }}
    >
      <div className="flex items-center gap-2">
        <Input
          autoFocus
          className="h-14 flex-1 text-lg"
          onChange={(e) => setYoutubeKeyValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
          }}
          placeholder="YouTube API key"
          type="password"
          value={youtubeKey}
        />
        {youtubeKey.trim() && (
          <Button
            className="size-14"
            onClick={save}
            size="icon"
            variant="ghost"
          >
            <Check className="size-4" />
          </Button>
        )}
      </div>
      <p className="text-muted-foreground text-xs">
        Free from Google Cloud Console.{" "}
        <button
          className="inline-flex items-center gap-0.5 text-foreground hover:underline"
          onClick={() => {
            sounds.click();
            openUrl(
              "https://console.cloud.google.com/apis/library/youtube.googleapis.com"
            );
          }}
          type="button"
        >
          Get your key
          <ExternalLink className="ml-0.5 size-3" />
        </button>
      </p>
    </div>
  );
}

interface BriaModelStatus {
  exists: boolean;
  path: string;
  size_bytes: number;
}

const PROVIDERS: {
  value: BgRemovalProvider;
  label: string;
  desc: string;
  briaOnly?: boolean;
}[] = [
  {
    value: "imgly",
    label: "ISNet (img.ly)",
    desc: "No extra download needed",
  },
  {
    value: "briaai",
    label: "BRIA RMBG-1.4",
    desc: "Higher accuracy · one-time ~176 MB download",
    briaOnly: true,
  },
  {
    value: "briaai2",
    label: "BRIA RMBG-2.0",
    desc: "Best accuracy · one-time ~890 MB download · non-commercial license",
    briaOnly: true,
  },
];

function BgRemovalStep() {
  const { bgRemovalProvider, setBgRemovalProvider } = useAppSettingsStore();
  const [isBriaAvailable, setIsBriaAvailable] = useState(false);
  const [briaStatus, setBriaStatus] = useState<BriaModelStatus | null>(null);
  const [briaV2Status, setBriaV2Status] = useState<BriaModelStatus | null>(
    null
  );
  const [isDownloading, setIsDownloading] = useState(false);
  const [isDownloadingV2, setIsDownloadingV2] = useState(false);
  const [downloadPct, setDownloadPct] = useState<number | null>(null);
  const [downloadPctV2, setDownloadPctV2] = useState<number | null>(null);
  const [hfToken, setHfTokenValue] = useState("");
  const [hfTokenSaved, setHfTokenSaved] = useState(false);

  useEffect(() => {
    invoke<boolean>("is_bria_available")
      .then(setIsBriaAvailable)
      .catch(() => setIsBriaAvailable(false));
    getHfToken().then((t) => {
      if (t) setHfTokenSaved(true);
    });
  }, []);

  const loadStatuses = useCallback(async () => {
    try {
      const s = await invoke<BriaModelStatus>("bria_model_status");
      setBriaStatus(s);
    } catch {}
    try {
      const s2 = await invoke<BriaModelStatus>("bria_v2_model_status");
      setBriaV2Status(s2);
    } catch {}
  }, []);

  useEffect(() => {
    if (!isBriaAvailable) return;
    loadStatuses();
  }, [isBriaAvailable, loadStatuses]);

  useEffect(() => {
    const p1 = listen<{ downloaded: number; total: number }>(
      "bria-download-progress",
      (e) => {
        if (e.payload.total > 0)
          setDownloadPct(
            Math.round((e.payload.downloaded / e.payload.total) * 100)
          );
      }
    );
    const p2 = listen<{ downloaded: number; total: number }>(
      "bria-v2-download-progress",
      (e) => {
        if (e.payload.total > 0)
          setDownloadPctV2(
            Math.round((e.payload.downloaded / e.payload.total) * 100)
          );
      }
    );
    return () => {
      p1.then((u) => u());
      p2.then((u) => u());
    };
  }, []);

  const handleDownload = useCallback(async () => {
    setIsDownloading(true);
    setDownloadPct(null);
    try {
      await invoke("download_bria_model");
      await loadStatuses();
    } catch {}
    setIsDownloading(false);
    setDownloadPct(null);
  }, [loadStatuses]);

  const handleDownloadV2 = useCallback(async () => {
    setIsDownloadingV2(true);
    setDownloadPctV2(null);
    try {
      const token = await getHfToken();
      await invoke("download_bria_v2_model", { hfToken: token ?? undefined });
      await loadStatuses();
    } catch {}
    setIsDownloadingV2(false);
    setDownloadPctV2(null);
  }, [loadStatuses]);

  const handleSaveHfToken = useCallback(async () => {
    if (!hfToken.trim()) return;
    await setHfToken(hfToken.trim());
    setHfTokenSaved(true);
    setHfTokenValue("");
  }, [hfToken]);

  const visibleProviders = PROVIDERS.filter(
    (p) => !p.briaOnly || isBriaAvailable
  );

  return (
    <div className="flex w-full flex-col gap-3">
      {/* Provider selector */}
      <div className="flex flex-col gap-2">
        {visibleProviders.map((p, i) => (
          <button
            className={`flex items-start gap-3 rounded-lg px-4 py-3 text-left transition-colors ${
              bgRemovalProvider === p.value
                ? "bg-foreground text-background"
                : "bg-muted/50 hover:bg-muted"
            }`}
            key={p.value}
            onClick={() => {
              sounds.click();
              setBgRemovalProvider(p.value);
            }}
            style={{
              animation: `fade-slide-up 0.38s ease-out ${120 + i * 80}ms both`,
            }}
            type="button"
          >
            <div className="flex-1">
              <p className="font-medium text-sm">{p.label}</p>
              <p
                className={`mt-0.5 text-xs leading-snug ${bgRemovalProvider === p.value ? "text-background/60" : "text-muted-foreground"}`}
              >
                {p.desc}
              </p>
            </div>
            {bgRemovalProvider === p.value && (
              <Check className="mt-0.5 size-4 shrink-0 text-background" />
            )}
          </button>
        ))}
      </div>

      {/* BRIA RMBG-1.4 model download */}
      {isBriaAvailable && bgRemovalProvider === "briaai" && (
        <div
          className="flex items-center justify-between rounded-lg bg-muted/50 px-4 py-3"
          style={{ animation: "fade-slide-up 0.38s ease-out 0ms both" }}
        >
          <div className="flex-1 pr-4">
            <p className="font-medium text-sm">BRIA RMBG-1.4 Model</p>
            <p className="mt-0.5 text-muted-foreground text-xs">
              {briaStatus === null
                ? "Checking..."
                : briaStatus.exists
                  ? `Downloaded (${(briaStatus.size_bytes / 1024 / 1024).toFixed(0)} MB)`
                  : "Not downloaded yet (~176 MB)"}
            </p>
          </div>
          {!briaStatus?.exists && (
            <Button disabled={isDownloading} onClick={handleDownload} size="sm">
              {isDownloading ? (
                <>
                  <Loader2 className="mr-1.5 size-3 animate-spin" />
                  {downloadPct !== null ? `${downloadPct}%` : "Downloading..."}
                </>
              ) : (
                <>
                  <Download className="mr-1.5 size-3" />
                  Download
                </>
              )}
            </Button>
          )}
        </div>
      )}

      {/* BRIA RMBG-2.0: HF token + model download */}
      {isBriaAvailable && bgRemovalProvider === "briaai2" && (
        <div
          className="flex flex-col gap-2"
          style={{ animation: "fade-slide-up 0.38s ease-out 0ms both" }}
        >
          {/* HF token row */}
          <div className="flex items-center justify-between rounded-lg bg-muted/50 px-4 py-3">
            <div className="flex-1 pr-4">
              <p className="font-medium text-sm">HuggingFace Access Token</p>
              <p className="mt-0.5 text-muted-foreground text-xs">
                {hfTokenSaved ? (
                  "Token saved"
                ) : (
                  <>
                    RMBG-2.0 is gated.{" "}
                    <button
                      className="inline-flex items-center gap-0.5 text-foreground hover:underline"
                      onClick={() => {
                        sounds.click();
                        openUrl("https://huggingface.co/briaai/RMBG-2.0");
                      }}
                      type="button"
                    >
                      Agree &amp; get token
                      <ExternalLink className="ml-0.5 size-3" />
                    </button>
                  </>
                )}
              </p>
            </div>
            {hfTokenSaved ? (
              <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
                <div className="size-2 rounded-full bg-green-500" />
                Saved
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Input
                  className="h-8 w-36 text-sm"
                  onChange={(e) => setHfTokenValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSaveHfToken();
                  }}
                  placeholder="hf_…"
                  type="password"
                  value={hfToken}
                />
                <Button
                  disabled={!hfToken.trim()}
                  onClick={handleSaveHfToken}
                  size="sm"
                >
                  Save
                </Button>
              </div>
            )}
          </div>

          {/* Model download row */}
          <div className="flex items-center justify-between rounded-lg bg-muted/50 px-4 py-3">
            <div className="flex-1 pr-4">
              <p className="font-medium text-sm">BRIA RMBG-2.0 Model</p>
              <p className="mt-0.5 text-muted-foreground text-xs">
                {briaV2Status === null
                  ? "Checking..."
                  : briaV2Status.exists
                    ? `Downloaded (${(briaV2Status.size_bytes / 1024 / 1024).toFixed(0)} MB)`
                    : "Not downloaded yet (~890 MB)"}
              </p>
            </div>
            {!briaV2Status?.exists && (
              <Button
                disabled={isDownloadingV2 || !hfTokenSaved}
                onClick={handleDownloadV2}
                size="sm"
              >
                {isDownloadingV2 ? (
                  <>
                    <Loader2 className="mr-1.5 size-3 animate-spin" />
                    {downloadPctV2 !== null
                      ? `${downloadPctV2}%`
                      : "Downloading..."}
                  </>
                ) : (
                  <>
                    <Download className="mr-1.5 size-3" />
                    Download
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function PrivacyStep() {
  const {
    analyticsEnabled,
    setAnalyticsEnabled,
    loggingEnabled,
    setLoggingEnabled,
    saveSearchHistory,
    setSaveSearchHistory,
  } = useAppSettingsStore();

  return (
    <div className="flex w-full flex-col gap-4">
      <div
        className="flex items-center justify-between rounded-lg bg-muted/50 px-4 py-3"
        style={{ animation: "fade-slide-up 0.38s ease-out 120ms both" }}
      >
        <div className="flex-1 pr-4">
          <p className="font-medium text-sm">Save search history</p>
          <p className="mt-0.5 text-muted-foreground text-xs leading-snug">
            Remember recent searches so you can quickly find past work
          </p>
        </div>
        <Switch
          checked={saveSearchHistory}
          onCheckedChange={setSaveSearchHistory}
        />
      </div>

      <div className="flex flex-col gap-2">
        <div
          className="flex items-center justify-between rounded-lg bg-muted/50 px-4 py-3"
          style={{ animation: "fade-slide-up 0.38s ease-out 320ms both" }}
        >
          <div className="flex-1 pr-4">
            <p className="font-medium text-sm">Product analytics</p>
            <p className="mt-0.5 text-muted-foreground text-xs leading-snug">
              Helps us understand which features matter most. No personal data
              ever collected
            </p>
          </div>
          <Switch
            checked={analyticsEnabled}
            onCheckedChange={setAnalyticsEnabled}
          />
        </div>
        <div
          className="flex items-center justify-between rounded-lg bg-muted/50 px-4 py-3"
          style={{ animation: "fade-slide-up 0.38s ease-out 390ms both" }}
        >
          <div className="flex-1 pr-4">
            <p className="font-medium text-sm">Diagnostic logs</p>
            <p className="mt-0.5 text-muted-foreground text-xs leading-snug">
              Stored locally only, never shared automatically
            </p>
          </div>
          <Switch
            checked={loggingEnabled}
            onCheckedChange={setLoggingEnabled}
          />
        </div>
      </div>
    </div>
  );
}

function FeedbackStep() {
  const appTheme = useAppSettingsStore((s) => s.theme);

  const openFeedback = () => {
    const uj = (window as any).uj;
    const resolved =
      appTheme === "system"
        ? window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light"
        : appTheme;
    uj?.setTheme?.(resolved);
    uj?.showWidget?.();
  };

  return (
    <div className="flex w-full flex-col items-center gap-3">
      <Button
        className="h-14 w-full"
        onClick={() => {
          sounds.click();
          openFeedback();
        }}
        size="lg"
        style={{ animation: "fade-slide-up 0.38s ease-out 120ms both" }}
        variant="contrast"
      >
        <MessageCircle className="mr-2 size-4" />
        Send Feedback
      </Button>
      <p
        className="text-muted-foreground text-xs"
        style={{ animation: "fade-slide-up 0.38s ease-out 200ms both" }}
      >
        Always available in the bottom right of Settings
      </p>
    </div>
  );
}

const STEPS = [
  { id: "update", title: "", subtitle: "" },
  {
    id: "preferences",
    title: "Make it yours",
    subtitle: "Set up Backstage to match how you work",
  },
  {
    id: "startup",
    title: "Start your way",
    subtitle: "Control how Backstage behaves when your computer starts",
  },
  {
    id: "welcome",
    title: "This is your Backstage",
    subtitle: "The workspace where your creative work lives and grows",
  },
  {
    id: "local",
    title: "Your work stays on your device",
    subtitle: "Backstage runs locally. Your files never leave your machine",
  },
  {
    id: "gallery",
    title: "Your projects, all in one place",
    subtitle: "Everything you make, organized exactly the way your brain works",
  },
  {
    id: "editor",
    title: "Edit anything, exactly how you want",
    subtitle: "Your canvas. Your layers. Built to move as fast as you think",
  },
  {
    id: "ai",
    title: "AI that works for you",
    subtitle:
      "Generate images, remove backgrounds, remix ideas. Your creativity, amplified",
  },
  {
    id: "explore",
    title: "Find what inspires you",
    subtitle:
      "Browse YouTube for creative fuel. Extract frames and make them yours",
  },
  {
    id: "gemini",
    title: "Supercharge with AI",
    subtitle:
      "Generate images, remove backgrounds, and remix your ideas with Gemini",
  },
  {
    id: "smartsearch",
    title: "Find work by how it looks",
    subtitle:
      "Search your projects visually, right on your device. No account, no cloud",
  },
  {
    id: "youtube",
    title: "Enable Discovery",
    subtitle:
      "Explore real thumbnails on YouTube for inspiration or ask AI to remix them directly",
  },
  {
    id: "bgremoval",
    title: "Background removal engine",
    subtitle: "Choose how Backstage removes backgrounds from your images",
  },
  {
    id: "privacy",
    title: "Your data, your rules",
    subtitle: "Choose what Backstage remembers and shares",
  },
  {
    id: "feedback",
    title: "We're listening",
    subtitle: "Let us know what features you want or bugs you find",
  },
] as const;

function WelcomeIllustration() {
  const tiles = [
    {
      bg: "radial-gradient(ellipse at 20% 80%, #7c3aed 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, #2563eb 0%, transparent 55%), #0d0a1e",
      h: "h-28",
    },
    {
      bg: "radial-gradient(ellipse at 10% 90%, #dc2626 0%, transparent 55%), radial-gradient(ellipse at 90% 10%, #ea580c 0%, transparent 60%), #1a0a00",
      h: "h-28",
    },
    {
      bg: "radial-gradient(ellipse at 80% 80%, #059669 0%, transparent 55%), radial-gradient(ellipse at 20% 20%, #0891b2 0%, transparent 60%), #001a12",
      h: "h-20",
    },
    {
      bg: "radial-gradient(ellipse at 0% 100%, #9333ea 0%, transparent 60%), radial-gradient(ellipse at 100% 0%, #ec4899 0%, transparent 55%), #1a0018",
      h: "h-20",
    },
  ];
  return (
    <div className="flex h-full w-full items-center justify-center">
      <div className="grid w-full max-w-md grid-cols-2 gap-3">
        {tiles.map((t, i) => (
          <div
            className={`${t.h} w-full rounded-xl`}
            // biome-ignore lint/suspicious/noArrayIndexKey: static list
            key={i}
            style={{
              background: t.bg,
              animation: `fade-slide-up 0.42s ease-out ${120 + i * 80}ms both`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

function LocalIllustration() {
  const items = [
    {
      icon: <HardDrive className="size-4 shrink-0 text-muted-foreground" />,
      title: "Your projects",
      desc: "Stored on your device, not in the cloud",
    },
    {
      icon: <Lock className="size-4 shrink-0 text-muted-foreground" />,
      title: "Your API keys",
      desc: "Stored in your OS secure keychain, never transmitted",
    },
    {
      icon: <WifiOff className="size-4 shrink-0 text-muted-foreground" />,
      title: "Works offline",
      desc: "Core editing features work without an internet connection",
    },
  ];

  return (
    <div className="flex w-full flex-col gap-3">
      {items.map((item, i) => (
        <div
          className="flex items-center gap-3 rounded-lg bg-muted/50 px-4 py-3"
          key={item.title}
          style={{
            animation: `fade-slide-up 0.38s ease-out ${120 + i * 80}ms both`,
          }}
        >
          {item.icon}
          <div>
            <p className="font-medium text-sm">{item.title}</p>
            <p className="mt-0.5 text-muted-foreground text-xs">{item.desc}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

export function OnboardingPage({ onComplete }: OnboardingPageProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [animDir, setAnimDir] = useState<"forward" | "backward">("forward");
  const [animKey, setAnimKey] = useState(0);

  const step = STEPS[stepIndex];
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === STEPS.length - 1;
  const isUpdateStep = step.id === "update";
  const isWelcomeStep = step.id === "welcome";
  const isLocalStep = step.id === "local";
  const isPreferencesStep = step.id === "preferences";
  const isStartupStep = step.id === "startup";
  const isGeminiStep = step.id === "gemini";
  const isSmartSearchStep = step.id === "smartsearch";
  const isYoutubeStep = step.id === "youtube";
  const isBgRemovalStep = step.id === "bgremoval";
  const isPrivacyStep = step.id === "privacy";
  const isFeedbackStep = step.id === "feedback";
  const hasMockup =
    step.id === "gallery" ||
    step.id === "editor" ||
    step.id === "ai" ||
    step.id === "explore";

  const go = (dir: "forward" | "backward", nextIndex: number) => {
    setAnimDir(dir);
    setStepIndex(Math.max(0, Math.min(STEPS.length - 1, nextIndex)));
    setAnimKey((k) => k + 1);
  };

  const handleNext = () => {
    if (!isLast) go("forward", stepIndex + 1);
  };
  const handleBack = () => {
    if (!isFirst) go("backward", stepIndex - 1);
  };

  const animStyle: React.CSSProperties = {
    animation:
      animDir === "forward"
        ? "onboard-slide-right 0.32s cubic-bezier(0.25, 0.46, 0.45, 0.94) both"
        : "onboard-slide-left 0.32s cubic-bezier(0.25, 0.46, 0.45, 0.94) both",
  };

  return (
    <div className="flex h-screen flex-col bg-muted">
      <Toaster />
      <style>{`
        @keyframes onboard-slide-right {
          from { opacity: 0; transform: translateX(40px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes onboard-slide-left {
          from { opacity: 0; transform: translateX(-40px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes fade-slide-up {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* Titlebar drag region */}
      <div
        className="relative flex h-10 shrink-0 items-center pr-[148px] pl-[96px]"
        data-tauri-drag-region=""
      ></div>

      {/* Content card */}
      <div className="mx-1 flex flex-1 flex-col overflow-hidden rounded-xl border-2 border-border bg-background">
        <div
          className="flex flex-1 items-center justify-center overflow-y-auto p-8"
          key={animKey}
          style={animStyle}
        >
          {isUpdateStep && <UpdateStep />}

          {!isUpdateStep && (
            <div
              className={`flex w-full flex-col gap-6 ${hasMockup || isWelcomeStep ? "max-w-xl" : "max-w-md"}`}
            >
              <div
                style={{ animation: "fade-slide-up 0.38s ease-out 0ms both" }}
              >
                <h1 className="font-medium text-xl">{step.title}</h1>
                <p className="font-medium text-muted-foreground text-xl">
                  {step.subtitle}
                </p>
              </div>

              {isWelcomeStep && (
                <div className="h-64">
                  <WelcomeIllustration />
                </div>
              )}

              {isLocalStep && <LocalIllustration />}

              {hasMockup && (
                <div
                  className="h-72"
                  style={{
                    animation: "fade-slide-up 0.42s ease-out 120ms both",
                  }}
                >
                  {step.id === "gallery" && <GalleryMockup />}
                  {step.id === "editor" && <EditorMockup />}
                  {step.id === "ai" && <AiMockup />}
                  {step.id === "explore" && <ExploreMockup />}
                </div>
              )}

              {isPreferencesStep && <PreferencesStep />}
              {isStartupStep && <StartupStep />}
              {isGeminiStep && <GeminiKeyStep />}
              {isSmartSearchStep && <SmartSearchStep />}
              {isYoutubeStep && <YoutubeKeyStep />}
              {isBgRemovalStep && <BgRemovalStep />}
              {isPrivacyStep && <PrivacyStep />}
              {isFeedbackStep && <FeedbackStep />}
            </div>
          )}
        </div>
      </div>

      {/* Bottom bar */}
      <div className="mx-1 mb-1">
        <div className="relative flex h-12 items-center bg-muted px-4">
          <button
            className="flex items-center gap-1 rounded-md px-3 py-1.5 text-muted-foreground text-sm transition-colors hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
            disabled={isFirst}
            onClick={() => {
              sounds.click();
              handleBack();
            }}
            type="button"
          >
            <ArrowLeft className="size-4" />
            Back
          </button>

          <div className="absolute left-1/2 flex -translate-x-1/2 items-center gap-1.5">
            {STEPS.map((s, i) => (
              <button
                aria-label={`Step ${i + 1}`}
                className={`rounded-full transition-all duration-200 ${
                  i === stepIndex
                    ? "h-1.5 w-5 bg-foreground"
                    : i < stepIndex
                      ? "size-1.5 bg-foreground/40"
                      : "size-1.5 bg-foreground/15"
                }`}
                key={s.id}
                onClick={() => {
                  sounds.click();
                  go(i > stepIndex ? "forward" : "backward", i);
                }}
                type="button"
              />
            ))}
          </div>

          {isLast ? (
            <div className="ml-auto">
              <Button
                onClick={() => {
                  sounds.success();
                  onComplete();
                }}
                size="sm"
                variant="contrast"
              >
                Get Started
              </Button>
            </div>
          ) : (
            <div className="ml-auto">
              <button
                className="flex items-center gap-1 rounded-md px-3 py-1.5 text-muted-foreground text-sm transition-colors hover:text-foreground"
                onClick={() => {
                  sounds.click();
                  handleNext();
                }}
                type="button"
              >
                Next
                <ChevronRight className="size-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
