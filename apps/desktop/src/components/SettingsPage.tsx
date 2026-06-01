import { Badge } from "@repo/ui/badge";
import { Button } from "@repo/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/dialog";
import { Frame, FrameHeader, FramePanel } from "@repo/ui/frame";
import { Input } from "@repo/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/select";
import { Switch } from "@repo/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@repo/ui/tooltip";
import { getVersion } from "@tauri-apps/api/app";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { appDataDir, join } from "@tauri-apps/api/path";
import {
  open as openDialog,
  save as saveDialog,
} from "@tauri-apps/plugin-dialog";
import {
  exists,
  readDir,
  readFile,
  remove,
  writeFile,
} from "@tauri-apps/plugin-fs";
import { openUrl } from "@tauri-apps/plugin-opener";
import { relaunch } from "@tauri-apps/plugin-process";
import JSZip from "jszip";
import {
  ArrowLeft,
  Check,
  Copy,
  Download,
  ExternalLink,
  Loader2,
  MessageCircle,
  Monitor,
  Moon,
  Pencil,
  RefreshCw,
  Sun,
  Trash2,
  Upload,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { sileo } from "sileo";
import {
  getSeasonDisplayEmoji,
  SEASONS,
  type SeasonalTheme,
} from "@/components/snow-flakes";
import {
  ColorPicker,
  ColorPickerAlphaSlider,
  ColorPickerArea,
  ColorPickerContent,
  ColorPickerEyeDropper,
  ColorPickerHueSlider,
  ColorPickerInput,
  ColorPickerSwatch,
  ColorPickerTrigger,
} from "@/components/ui/color-picker";
import {
  checkForUpdate,
  downloadAndInstall,
  useUpdateStore,
} from "@/hooks/use-app-updater";
import {
  APP_DATA_DIRS,
  APP_DATA_FILES,
  DATA_SCHEMA_VERSIONS,
} from "@/lib/data-versions";
import { closeDb, getDb, getSqliteSchemaVersion } from "@/lib/db";
import {
  getGeminiApiKey,
  removeGeminiApiKey,
  setGeminiApiKey,
} from "@/lib/gemini-store";
import { getHfToken, removeHfToken, setHfToken } from "@/lib/hf-store";
import {
  downloadEmbeddingModels,
  EMBEDDING_MODEL_VERSION,
  getEmbeddingModelStatus,
} from "@/lib/local-embedding";
import { POLAR_CONFIG } from "@/lib/polar-config";
import {
  clearEmbeddingsOtherModel,
  deleteEmbeddingsBatch,
  getEmbeddedProjectIds,
  getEmbeddingStats,
  getFailureReasons,
  resetFailedEmbeddings,
} from "@/lib/semantic-search";
import * as sounds from "@/lib/sounds";
import { getOAuthCredentials } from "@/lib/youtube-oauth";
import {
  getYoutubeApiKey,
  removeYoutubeApiKey,
  setYoutubeApiKey,
} from "@/lib/youtube-store";
import { useAppSettingsStore } from "@/stores/use-app-settings-store";
import { useGalleryStore } from "@/stores/use-gallery-store";
import { useLicenseStore } from "@/stores/use-license-store";
import { useYtOAuthStore } from "@/stores/use-yt-oauth-store";

interface SettingsPageProps {
  onClose: () => void;
}

type SettingsTab =
  | "general"
  | "ai"
  | "explore"
  | "storage"
  | "updates"
  | "privacy";

const TABS: { value: SettingsTab; label: string }[] = [
  { value: "general", label: "General" },
  { value: "ai", label: "AI" },
  { value: "explore", label: "Discovery" },
  { value: "storage", label: "Storage" },
  { value: "updates", label: "Updates" },
  { value: "privacy", label: "Privacy" },
];

export function SettingsPage({ onClose }: SettingsPageProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>("general");
  const [isTransferring, setIsTransferring] = useState(false);
  const appTheme = useAppSettingsStore((s) => s.theme);

  return (
    <>
      {/* Content card */}
      <div className="mx-1 flex flex-1 flex-col overflow-hidden rounded-xl border-2 border-border bg-background">
        <div className="flex-1 overflow-auto px-6 pt-10 pb-6">
          <div className="mx-auto max-w-2xl">
            {activeTab === "general" && <GeneralSettings />}
            {activeTab === "ai" && <AiSettings />}
            {activeTab === "explore" && <ExploreSettings />}
            {activeTab === "storage" && (
              <StorageSettings onTransferChange={setIsTransferring} />
            )}
            {activeTab === "updates" && <UpdateSettings />}
            {activeTab === "privacy" && <PrivacySettings />}
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="mx-1 mb-1">
        <div className="relative flex h-12 items-center bg-muted px-4">
          <Button
            disabled={isTransferring}
            onClick={() => {
              sounds.click();
              onClose();
            }}
            size="icon-sm"
            type="button"
            variant="ghost"
          >
            <ArrowLeft className="size-4" />
          </Button>
          {/* Centered tabs */}
          <div className="absolute left-1/2 flex -translate-x-1/2 gap-1">
            {TABS.map((tab) => (
              <button
                className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                  activeTab === tab.value
                    ? "bg-muted-foreground/15 font-medium text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                } disabled:pointer-events-none disabled:opacity-40`}
                disabled={isTransferring}
                key={tab.value}
                onClick={() => {
                  sounds.click();
                  setActiveTab(tab.value);
                }}
                type="button"
              >
                {tab.label}
              </button>
            ))}
          </div>
          {/* Feedback button — fixed to viewport bottom-right */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                className="fixed right-5 bottom-16 z-50 flex size-14 items-center justify-center rounded-full border border-border bg-muted text-foreground shadow-lg transition-all hover:scale-110"
                onClick={() => {
                  sounds.click();
                  // biome-ignore lint/suspicious/noExplicitAny: userjot sdk
                  const uj = (window as any).uj;
                  const resolved =
                    appTheme === "system"
                      ? window.matchMedia("(prefers-color-scheme: dark)")
                          .matches
                        ? "dark"
                        : "light"
                      : appTheme;
                  uj?.setTheme?.(resolved);
                  uj?.showWidget?.();
                }}
                type="button"
              >
                <MessageCircle className="size-6" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="left">Send feedback</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </>
  );
}

interface SettingRowProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
}

function SettingRow({ title, description, children }: SettingRowProps) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-muted/50 px-4 py-3">
      <div className="flex-1 pr-4">
        <p className="font-medium text-sm">{title}</p>
        {description && (
          <p className="mt-0.5 text-muted-foreground text-xs leading-snug">
            {description}
          </p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">{children}</div>
    </div>
  );
}

interface GeminiKeySectionProps {
  hasKey: boolean;
  onKeyChange: (hasKey: boolean) => void;
}

function GeminiKeySection({ hasKey, onKeyChange }: GeminiKeySectionProps) {
  const [apiKey, setApiKey] = useState("");
  const [showRemoveDialog, setShowRemoveDialog] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);

  const { bgRemovalGeminiEnabled, setBgRemovalGeminiEnabled } =
    useAppSettingsStore();

  const handleSave = useCallback(async () => {
    if (!apiKey.trim()) {
      sileo.error({ title: "Please enter an API key" });
      return;
    }
    try {
      await setGeminiApiKey(apiKey.trim());
      onKeyChange(true);
      setApiKey("");
      sileo.success({ title: "API key saved securely" });
    } catch {
      sileo.error({ title: "Failed to save API key" });
    }
  }, [apiKey, onKeyChange]);

  const handleConfirmRemove = useCallback(async () => {
    setIsRemoving(true);
    try {
      await removeGeminiApiKey();
      onKeyChange(false);
      if (bgRemovalGeminiEnabled) await setBgRemovalGeminiEnabled(false);
      setShowRemoveDialog(false);
      sileo.success({ title: "API key removed" });
    } catch {
      sileo.error({ title: "Failed to remove API key" });
    } finally {
      setIsRemoving(false);
    }
  }, [onKeyChange, bgRemovalGeminiEnabled, setBgRemovalGeminiEnabled]);

  const willDisableAnything = bgRemovalGeminiEnabled;

  return (
    <div className="space-y-4">
      <Dialog
        onOpenChange={(open) => {
          open ? sounds.dialogOpen() : sounds.dialogClose();
          setShowRemoveDialog(open);
        }}
        open={showRemoveDialog}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Gemini API key?</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {willDisableAnything && (
              <>
                <p className="text-muted-foreground text-sm">
                  This will also disable:
                </p>
                <ul className="space-y-1 text-sm">
                  {bgRemovalGeminiEnabled && (
                    <li className="text-muted-foreground">
                      • Gemini Pre-processing
                    </li>
                  )}
                </ul>
              </>
            )}
          </div>
          <DialogFooter>
            <Button
              onClick={() => {
                sounds.click();
                setShowRemoveDialog(false);
              }}
              variant="ghost"
            >
              Cancel
            </Button>
            <Button
              disabled={isRemoving}
              onClick={() => {
                sounds.delete_();
                handleConfirmRemove();
              }}
              variant="destructive"
            >
              {isRemoving ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 size-4" />
              )}
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <p className="mb-3 pl-2 font-medium text-muted-foreground text-xs">
        API Keys
      </p>
      <div>
        <SettingRow
          description="Required for AI image generation."
          title="Gemini"
        >
          {hasKey ? (
            <Button
              onClick={() => {
                sounds.dialogOpen();
                setShowRemoveDialog(true);
              }}
              size="sm"
              variant="destructive"
            >
              <Trash2 className="mr-2 size-4" />
              Remove
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <Input
                className="w-64"
                id="gemini-api-key"
                onChange={(e) => setApiKey(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSave();
                }}
                placeholder="Enter your API key"
                type="password"
                value={apiKey}
              />
              {apiKey.trim().length > 0 && (
                <Button
                  className="size-8 text-muted-foreground hover:text-foreground"
                  onClick={() => {
                    sounds.success();
                    handleSave();
                  }}
                  size="icon"
                  variant="ghost"
                >
                  <Check className="size-4" />
                </Button>
              )}
            </div>
          )}
        </SettingRow>
        <button
          className="mt-1.5 inline-flex items-center gap-1 pl-4 text-muted-foreground text-xs hover:text-foreground hover:underline"
          onClick={() => {
            sounds.click();
            openUrl("https://aistudio.google.com/apikey");
          }}
          type="button"
        >
          <ExternalLink className="size-3" />
          Get your key from Google AI Studio
        </button>
      </div>
    </div>
  );
}

function ExploreSettings() {
  const [youtubeKey, setYoutubeKey] = useState("");
  const [hasYoutubeKey, setHasYoutubeKey] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const {
    isConnected,
    isConnecting,
    channelName,
    channelThumbnail,
    connect,
    cancel,
    disconnect,
    load,
  } = useYtOAuthStore();

  const [oauthClientId, setOauthClientId] = useState("");
  const [oauthClientSecret, setOauthClientSecret] = useState("");
  const [showCancelAuth, setShowCancelAuth] = useState(false);

  useEffect(() => {
    if (!isConnecting) {
      setShowCancelAuth(false);
      return;
    }
    const timer = setTimeout(() => setShowCancelAuth(true), 3000);
    return () => clearTimeout(timer);
  }, [isConnecting]);

  useEffect(() => {
    getYoutubeApiKey()
      .then((key) => {
        setHasYoutubeKey(!!key);
        setYoutubeKey("");
      })
      .finally(() => setIsLoading(false));
    getOAuthCredentials().then((creds) => {
      if (creds) {
        setOauthClientId(creds.clientId);
        setOauthClientSecret(creds.clientSecret);
      }
    });
    load();
  }, [load]);

  const handleSave = useCallback(async () => {
    if (!youtubeKey.trim()) {
      sileo.error({ title: "Please enter an API key" });
      return;
    }
    try {
      await setYoutubeApiKey(youtubeKey.trim());
      setHasYoutubeKey(true);
      setYoutubeKey("");
      sileo.success({ title: "API key saved securely" });
    } catch {
      sileo.error({ title: "Failed to save API key" });
    }
  }, [youtubeKey]);

  const handleRemove = useCallback(async () => {
    try {
      await removeYoutubeApiKey();
      setHasYoutubeKey(false);
      sileo.success({ title: "API key removed" });
    } catch {
      sileo.error({ title: "Failed to remove API key" });
    }
  }, []);

  if (isLoading) {
    return (
      <div className="py-8 text-center text-muted-foreground">Loading…</div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="pl-2 font-semibold text-lg">Discovery</h2>
      <div className="space-y-4">
        <div className="mb-3 flex items-center justify-between pr-2 pl-2">
          <p className="font-medium text-muted-foreground text-xs">
            YouTube Account
          </p>
          <Badge variant="destructive">Experimental</Badge>
        </div>
        <div>
          <SettingRow
            description={
              isConnected
                ? "Channel connected."
                : "Required to upload thumbnails and view your channel analytics."
            }
            title="Google OAuth"
          >
            {isConnecting ? (
              <div className="flex flex-col items-end gap-1">
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <Loader2 className="size-4 animate-spin" />
                  Waiting for Google authorization…
                </div>
                <button
                  className={`text-muted-foreground/50 text-xs transition-opacity duration-700 hover:text-muted-foreground ${showCancelAuth ? "opacity-100" : "opacity-0"}`}
                  onClick={() => {
                    sounds.click();
                    cancel();
                  }}
                  type="button"
                >
                  Cancel
                </button>
              </div>
            ) : isConnected ? (
              <div className="flex items-center gap-3">
                {channelThumbnail && (
                  <img
                    alt={channelName ?? "Channel"}
                    className="size-7 rounded-full"
                    src={channelThumbnail}
                  />
                )}
                {channelName && <span className="text-sm">{channelName}</span>}
                <Button
                  onClick={() => {
                    sounds.click();
                    disconnect();
                  }}
                  size="sm"
                  variant="destructive"
                >
                  Disconnect
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Input
                  className="w-48"
                  onChange={(e) => setOauthClientId(e.target.value)}
                  placeholder="OAuth Client ID"
                  type="password"
                  value={oauthClientId}
                />
                <Input
                  className="w-48"
                  onChange={(e) => setOauthClientSecret(e.target.value)}
                  placeholder="OAuth Client Secret"
                  type="password"
                  value={oauthClientSecret}
                />
                <Button
                  disabled={
                    !(oauthClientId.trim() && oauthClientSecret.trim()) ||
                    isConnecting
                  }
                  onClick={() => {
                    sounds.click();
                    connect(oauthClientId.trim(), oauthClientSecret.trim());
                  }}
                  size="sm"
                >
                  Connect
                </Button>
              </div>
            )}
          </SettingRow>
          {!(isConnected || isConnecting) && (
            <button
              className="mt-1.5 inline-flex items-center gap-1 pl-4 text-muted-foreground text-xs hover:text-foreground hover:underline"
              onClick={() => {
                sounds.click();
                openUrl("https://console.cloud.google.com/apis/credentials");
              }}
              type="button"
            >
              <ExternalLink className="size-3" />
              Create Desktop app credentials in Google Cloud Console
            </button>
          )}
        </div>
      </div>
      <div className="space-y-4">
        <p className="mb-3 pl-2 font-medium text-muted-foreground text-xs">
          API Keys
        </p>
        <div>
          <SettingRow
            description="Required for the Discovery page."
            title="YouTube"
          >
            {hasYoutubeKey ? (
              <Button
                onClick={() => {
                  sounds.delete_();
                  handleRemove();
                }}
                size="sm"
                variant="destructive"
              >
                <Trash2 className="mr-2 size-4" />
                Remove
              </Button>
            ) : (
              <div className="flex items-center gap-2">
                <Input
                  className="w-64"
                  id="youtube-api-key"
                  onChange={(e) => setYoutubeKey(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSave();
                  }}
                  placeholder="Enter your API key"
                  type="password"
                  value={youtubeKey}
                />
                {youtubeKey.trim().length > 0 && (
                  <Button
                    className="size-8 text-muted-foreground hover:text-foreground"
                    onClick={() => {
                      sounds.success();
                      handleSave();
                    }}
                    size="icon"
                    variant="ghost"
                  >
                    <Check className="size-4" />
                  </Button>
                )}
              </div>
            )}
          </SettingRow>
          <button
            className="mt-1.5 inline-flex items-center gap-1 pl-4 text-muted-foreground text-xs hover:text-foreground hover:underline"
            onClick={() => {
              sounds.click();
              openUrl(
                "https://console.cloud.google.com/apis/library/youtube.googleapis.com"
              );
            }}
            type="button"
          >
            <ExternalLink className="size-3" />
            Enable YouTube Data API v3 in Google Cloud Console
          </button>
        </div>
      </div>
    </div>
  );
}

function OnboardingSettings() {
  const setOnboardingCompleted = useAppSettingsStore(
    (s) => s.setOnboardingCompleted
  );

  return (
    <div className="space-y-4">
      <p className="pl-2 font-medium text-muted-foreground text-xs">
        Onboarding
      </p>
      <div>
        <SettingRow
          description="Replay the getting-started tour to rediscover features."
          title="Reset onboarding"
        >
          <Button
            onClick={() => {
              sounds.click();
              setOnboardingCompleted(false);
            }}
            size="sm"
          >
            <RefreshCw className="mr-1.5 size-3.5" />
            Reset
          </Button>
        </SettingRow>
      </div>
    </div>
  );
}

function ExperimentalSettings() {
  const { experimentalFeaturesEnabled, setExperimentalFeaturesEnabled } =
    useAppSettingsStore();
  return (
    <div className="space-y-4">
      <p className="mb-3 pl-2 font-medium text-muted-foreground text-xs">
        Experimental
      </p>
      <div className="space-y-2">
        <SettingRow
          description="Enable early-access features that are still in development. Changes take effect immediately."
          title="Experimental features"
        >
          <Switch
            checked={experimentalFeaturesEnabled}
            onCheckedChange={(v) => {
              v ? sounds.switchOn() : sounds.switchOff();
              setExperimentalFeaturesEnabled(v);
            }}
          />
        </SettingRow>
      </div>
    </div>
  );
}

function SoundsSettings() {
  const { soundsEnabled, setSoundsEnabled } = useAppSettingsStore();
  return (
    <div className="space-y-4">
      <p className="pl-2 font-medium text-muted-foreground text-xs">Sound</p>
      <div className="space-y-2">
        <SettingRow
          description="Play sounds for clicks, dialogs, switches, and other interactions."
          title="Sound Effects"
        >
          <Switch
            checked={soundsEnabled}
            onCheckedChange={(v) => {
              v ? sounds.switchOn() : sounds.switchOff();
              setSoundsEnabled(v);
            }}
          />
        </SettingRow>
      </div>
    </div>
  );
}

function GeneralSettings() {
  return (
    <div className="space-y-6">
      <h2 className="pl-2 font-semibold text-lg">General</h2>
      <AppearanceSettings />
      <SoundsSettings />
      <OnboardingSettings />
      <BillingSettings />
      <ExperimentalSettings />
    </div>
  );
}

const EMBEDDING_IDLE_OPTIONS = [
  { value: "60", label: "After 1 minute" },
  { value: "300", label: "After 5 minutes" },
  { value: "900", label: "After 15 minutes" },
  { value: "0", label: "Never (fastest)" },
] as const;

function EmbeddingSettings() {
  const {
    semanticSearchEnabled,
    setSemanticSearchEnabled,
    embeddingIdleTimeoutSecs,
    setEmbeddingIdleTimeoutSecs,
  } = useAppSettingsStore();
  const [modelInstalled, setModelInstalled] = useState<boolean | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadPct, setDownloadPct] = useState<number | null>(null);
  const [isBackfilling, setIsBackfilling] = useState(false);
  const [backfillProgress, setBackfillProgress] = useState<{
    current: number;
    total: number;
    failed: number;
  } | null>(null);
  const [showClearPrompt, setShowClearPrompt] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [embeddedCount, setEmbeddedCount] = useState<number | null>(null);
  const [failedCount, setFailedCount] = useState<number | null>(null);
  const [failureReasons, setFailureReasons] = useState<
    { reason: string; count: number }[] | null
  >(null);

  const loadStats = useCallback(async () => {
    const stats = await getEmbeddingStats();
    setEmbeddedCount(stats.embedded);
    setFailedCount(stats.failed);
    if (stats.failed > 0) {
      const reasons = await getFailureReasons();
      setFailureReasons(reasons);
    } else {
      setFailureReasons(null);
    }
  }, []);

  useEffect(() => {
    getEmbeddingModelStatus()
      .then((s) => setModelInstalled(s.installed))
      .catch(() => setModelInstalled(false));
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

  useEffect(() => {
    if (semanticSearchEnabled) {
      loadStats().catch(() => {});
    }
  }, [semanticSearchEnabled, loadStats]);

  const runBackfill = useCallback(async () => {
    setIsBackfilling(true);
    setBackfillProgress({ current: 0, total: 0, failed: 0 });
    try {
      const { useEmbeddingStore } = await import(
        "@/stores/use-embedding-store"
      );
      const allIds = useGalleryStore.getState().thumbnails.map((t) => t.id);
      await useEmbeddingStore
        .getState()
        .checkAndEmbedMissing(allIds, (p) => setBackfillProgress(p));
      await loadStats();
    } finally {
      setIsBackfilling(false);
      setBackfillProgress(null);
    }
  }, [loadStats]);

  const handleToggle = useCallback(
    async (enabled: boolean) => {
      if (!enabled) {
        await setSemanticSearchEnabled(false);
        setShowClearPrompt(true);
        return;
      }

      // Download the on-device model the first time it's enabled.
      if (!modelInstalled) {
        setIsDownloading(true);
        try {
          await downloadEmbeddingModels();
          setModelInstalled(true);
        } catch {
          sileo.error({ title: "Couldn't set up on-device search" });
          setIsDownloading(false);
          setDownloadPct(null);
          return;
        }
        setIsDownloading(false);
        setDownloadPct(null);
      }

      // Purge any vectors from a previous embedding model before indexing.
      await clearEmbeddingsOtherModel(EMBEDDING_MODEL_VERSION).catch(() => {});
      await setSemanticSearchEnabled(true);
      setShowClearPrompt(false);
      await runBackfill();
    },
    [modelInstalled, setSemanticSearchEnabled, runBackfill]
  );

  const handleRetry = useCallback(async () => {
    await resetFailedEmbeddings();
    setFailedCount(0);
    setFailureReasons(null);
    await runBackfill();
  }, [runBackfill]);

  const handleClear = useCallback(async () => {
    setIsClearing(true);
    try {
      const ids = await getEmbeddedProjectIds();
      await deleteEmbeddingsBatch(ids);
      setEmbeddedCount(0);
      setFailedCount(0);
      setFailureReasons(null);
      setShowClearPrompt(false);
      sileo.success({ title: "Embeddings cleared" });
    } catch {
      sileo.error({ title: "Failed to clear embeddings" });
    } finally {
      setIsClearing(false);
    }
  }, []);

  const description =
    semanticSearchEnabled && embeddedCount !== null
      ? `${embeddedCount} project${embeddedCount !== 1 ? "s" : ""} indexed · runs on your device`
      : modelInstalled
        ? "Search your projects by what they look like, fully on your device"
        : "Enabling downloads a one-time ~880 MB model, then works offline";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between pr-2 pl-2">
        <p className="font-medium text-muted-foreground text-xs">
          Semantic Search
        </p>
        <Badge variant="destructive">Experimental</Badge>
      </div>
      <div className="space-y-2">
        <SettingRow description={description} title="Image Embeddings">
          {isDownloading ? (
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          ) : (
            <Switch
              checked={semanticSearchEnabled}
              disabled={modelInstalled === null}
              onCheckedChange={handleToggle}
            />
          )}
        </SettingRow>
        {isDownloading && (
          <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-4 py-3">
            <Loader2 className="size-3.5 shrink-0 animate-spin text-muted-foreground" />
            <p className="text-muted-foreground text-xs">
              {downloadPct !== null
                ? `Downloading on-device search model… ${downloadPct}% (~880 MB, one time)`
                : "Setting up on-device search (~880 MB, one time). This can take a few minutes…"}
            </p>
          </div>
        )}
        {semanticSearchEnabled && !isDownloading && (
          <SettingRow
            description="Frees memory when search sits unused. First search after reloads briefly."
            title="Unload model when idle"
          >
            <Select
              onValueChange={(v) => v && setEmbeddingIdleTimeoutSecs(Number(v))}
              value={String(embeddingIdleTimeoutSecs)}
            >
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EMBEDDING_IDLE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </SettingRow>
        )}
        {isBackfilling && (
          <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-4 py-3">
            <Loader2 className="size-3.5 shrink-0 animate-spin text-muted-foreground" />
            <p className="text-muted-foreground text-xs">
              {backfillProgress && backfillProgress.total > 0
                ? `Indexing ${backfillProgress.current} / ${backfillProgress.total}…${backfillProgress.failed > 0 ? ` (${backfillProgress.failed} failed)` : ""}`
                : "Indexing projects…"}
            </p>
          </div>
        )}
        {!isBackfilling &&
          semanticSearchEnabled &&
          failedCount !== null &&
          failedCount > 0 && (
            <div className="space-y-2 rounded-lg bg-destructive/10 px-4 py-3">
              <p className="font-medium text-destructive text-xs">
                {failedCount} project{failedCount !== 1 ? "s" : ""} failed to
                index
              </p>
              {failureReasons && failureReasons.length > 0 && (
                <p className="break-all font-mono text-muted-foreground text-xs">
                  {failureReasons[0].reason}
                </p>
              )}
              <Button
                onClick={() => {
                  sounds.click();
                  handleRetry();
                }}
                size="sm"
                variant="outline"
              >
                Retry failed
              </Button>
            </div>
          )}
        {showClearPrompt && (
          <div className="space-y-3 rounded-lg bg-muted/50 px-4 py-3">
            <p className="font-medium text-sm">Clear embeddings?</p>
            <p className="text-muted-foreground text-xs leading-snug">
              Stored embeddings are kept on disk. Keep them so they're ready if
              you re-enable later, or clear them to free up space.
            </p>
            <div className="flex gap-2">
              <Button
                onClick={() => {
                  sounds.click();
                  setShowClearPrompt(false);
                }}
                size="sm"
                variant="ghost"
              >
                Keep
              </Button>
              <Button
                disabled={isClearing}
                onClick={() => {
                  sounds.delete_();
                  handleClear();
                }}
                size="sm"
                variant="destructive"
              >
                {isClearing ? (
                  <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                ) : (
                  <Trash2 className="mr-1.5 size-3.5" />
                )}
                Clear
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function AiSettings() {
  const experimentalFeaturesEnabled = useAppSettingsStore(
    (s) => s.experimentalFeaturesEnabled
  );
  const [hasGeminiKey, setHasGeminiKey] = useState(false);
  const [geminiKeyLoaded, setGeminiKeyLoaded] = useState(false);

  useEffect(() => {
    getGeminiApiKey()
      .then((k) => {
        const hasKey = !!k;
        setHasGeminiKey(hasKey);
        if (!hasKey) {
          const { bgRemovalGeminiEnabled, setBgRemovalGeminiEnabled } =
            useAppSettingsStore.getState();
          if (bgRemovalGeminiEnabled) setBgRemovalGeminiEnabled(false);
        }
      })
      .finally(() => setGeminiKeyLoaded(true));
  }, []);

  if (!geminiKeyLoaded) {
    return (
      <div className="py-8 text-center text-muted-foreground text-sm">
        Loading…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="pl-2 font-semibold text-lg">AI</h2>
      <GeminiKeySection hasKey={hasGeminiKey} onKeyChange={setHasGeminiKey} />
      {experimentalFeaturesEnabled && <EmbeddingSettings />}
      <ProcessingSettings hasGeminiKey={hasGeminiKey} />
      {experimentalFeaturesEnabled && <AgentSettings />}
      {experimentalFeaturesEnabled && <McpServerSettings />}
    </div>
  );
}

function AppearanceSettings() {
  const {
    seasonalEffectsEnabled,
    setSeasonalEffectsEnabled,
    theme,
    setTheme,
    persistTabs,
    setPersistTabs,
    rememberWindowBounds,
    setRememberWindowBounds,
    previewSeasonTheme,
    setPreviewSeasonTheme,
  } = useAppSettingsStore();

  const [selectedPreviewSeason, setSelectedPreviewSeason] =
    useState<SeasonalTheme>("christmas");

  const selectedSeasonConfig = SEASONS.find(
    (s) => s.id === selectedPreviewSeason
  );

  const [previewTimer, setPreviewTimer] = useState<ReturnType<
    typeof setTimeout
  > | null>(null);

  const handlePreviewSeason = useCallback(() => {
    if (previewTimer) clearTimeout(previewTimer);
    setPreviewSeasonTheme(selectedPreviewSeason);
    const t = setTimeout(() => {
      setPreviewSeasonTheme(null);
      setPreviewTimer(null);
    }, 5000);
    setPreviewTimer(t);
  }, [previewTimer, setPreviewSeasonTheme, selectedPreviewSeason]);

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
    } catch {
      sileo.error({ title: "Failed to update launch at startup" });
    }
  }, []);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <SettingRow
          description="Open Backstage automatically when you log in to your computer."
          title="Launch at startup"
        >
          <Switch
            checked={launchAtStartup ?? false}
            disabled={launchAtStartup === null}
            onCheckedChange={(v) => {
              v ? sounds.switchOn() : sounds.switchOff();
              handleLaunchAtStartup(v);
            }}
          />
        </SettingRow>
        <SettingRow
          description="Reopen your last open projects when launching the app."
          title="Restore tabs on startup"
        >
          <Switch
            checked={persistTabs}
            onCheckedChange={(v) => {
              v ? sounds.switchOn() : sounds.switchOff();
              setPersistTabs(v);
            }}
          />
        </SettingRow>
        <SettingRow
          description="Save and restore window position and size between sessions."
          title="Remember window position & size"
        >
          <Switch
            checked={rememberWindowBounds}
            onCheckedChange={(v) => {
              v ? sounds.switchOn() : sounds.switchOff();
              setRememberWindowBounds(v);
            }}
          />
        </SettingRow>
      </div>
      <p className="pl-2 font-medium text-muted-foreground text-xs">
        Appearance
      </p>
      <SettingRow title="Theme">
        <Select onValueChange={(val: any) => setTheme(val)} value={theme}>
          <SelectTrigger
            className="w-32 border-none bg-transparent shadow-none focus:bg-transparent dark:bg-transparent"
            size="sm"
          >
            <SelectValue>
              {theme === "light" && (
                <>
                  <Sun className="size-4" />
                  Light
                </>
              )}
              {theme === "dark" && (
                <>
                  <Moon className="size-4" />
                  Dark
                </>
              )}
              {theme === "system" && (
                <>
                  <Monitor className="size-4" />
                  System
                </>
              )}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="light">
              <Sun className="size-4" />
              Light
            </SelectItem>
            <SelectItem value="dark">
              <Moon className="size-4" />
              Dark
            </SelectItem>
            <SelectItem value="system">
              <Monitor className="size-4" />
              System
            </SelectItem>
          </SelectContent>
        </Select>
      </SettingRow>
      <Frame>
        <FrameHeader className="px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex-1 pr-4">
              <p className="font-medium text-sm">Seasonal Effects</p>
              <p className="mt-0.5 text-muted-foreground text-xs leading-snug">
                Show festive effects in the title bar during special dates.
              </p>
            </div>
            <Switch
              checked={seasonalEffectsEnabled}
              onCheckedChange={(v) => {
                v ? sounds.switchOn() : sounds.switchOff();
                setSeasonalEffectsEnabled(v);
              }}
            />
          </div>
        </FrameHeader>
        <FramePanel className="px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <Select
                onValueChange={(v) =>
                  setSelectedPreviewSeason(v as SeasonalTheme)
                }
                value={selectedPreviewSeason}
              >
                <SelectTrigger
                  className="w-full border-none bg-transparent shadow-none focus:bg-transparent dark:bg-transparent"
                  size="sm"
                >
                  <SelectValue>
                    {selectedSeasonConfig &&
                      `${getSeasonDisplayEmoji(selectedSeasonConfig)} ${selectedSeasonConfig.label}`}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {SEASONS.map((season) => (
                    <SelectItem key={season.id} value={season.id}>
                      {getSeasonDisplayEmoji(season)} {season.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              disabled={!!previewSeasonTheme}
              onClick={() => {
                sounds.click();
                handlePreviewSeason();
              }}
              size="sm"
            >
              {previewSeasonTheme ? "Previewing…" : "Preview"}
            </Button>
          </div>
        </FramePanel>
      </Frame>
    </div>
  );
}

const BG_QUALITY_OPTIONS: {
  value: BgRemovalQuality;
  label: string;
  size: string;
  accuracy: number;
  speed: number;
}[] = [
  { value: "fast", label: "Fast", size: "40 MB", accuracy: 40, speed: 95 },
  {
    value: "balanced",
    label: "Balanced",
    size: "80 MB",
    accuracy: 70,
    speed: 65,
  },
  { value: "best", label: "Best", size: "160 MB", accuracy: 95, speed: 30 },
];

const BG_PROVIDER_OPTIONS: {
  value: BgRemovalProvider;
  label: string;
  description: string;
}[] = [
  {
    value: "imgly",
    label: "ISNet (img.ly)",
    description: "No extra download needed",
  },
  {
    value: "briaai",
    label: "BRIA RMBG-1.4",
    description: "Higher accuracy · one-time ~176 MB download",
  },
  {
    value: "briaai2",
    label: "BRIA RMBG-2.0",
    description:
      "Best accuracy · one-time ~890 MB download · non-commercial license",
  },
];

interface BriaModelStatus {
  exists: boolean;
  path: string;
  size_bytes: number;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(1)} MB`;
}

const GEMINI_BG_MODELS: { value: string; label: string }[] = [
  {
    value: "gemini-2.5-flash-image",
    label: "Gemini 2.5 Flash Image (Nano Banana)",
  },
  {
    value: "gemini-3.1-flash-image-preview",
    label: "Gemini 3.1 Flash Image (Nano Banana 2)",
  },
  {
    value: "gemini-3-pro-image-preview",
    label: "Gemini 3 Pro Image (Nano Banana Pro)",
  },
];

interface BriaModelRowProps {
  title: string;
  downloadSizeMb: string;
  briaStatus: BriaModelStatus | null;
  isDownloading: boolean;
  downloadProgress: { downloaded: number; total: number } | null;
  downloadPercent: number | null;
  onDownload: () => void;
}

function BriaModelRow({
  title,
  downloadSizeMb,
  briaStatus,
  isDownloading,
  downloadProgress,
  downloadPercent,
  onDownload,
}: BriaModelRowProps) {
  let description = "Checking status…";
  if (briaStatus !== null) {
    description = briaStatus.exists
      ? `${formatBytes(briaStatus.size_bytes)} · ${briaStatus.path}`
      : `Model not found. Download it once (~${downloadSizeMb}) to use BRIA background removal.`;
  }

  return (
    <div className="flex items-center justify-between">
      <div className="flex-1 pr-4">
        <p className="font-medium text-sm">{title}</p>
        <p className="mt-0.5 text-muted-foreground text-xs leading-snug">
          {description}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {briaStatus?.exists ? (
          <Button
            disabled={isDownloading}
            onClick={() => {
              sounds.download();
              onDownload();
            }}
            size="sm"
            variant="ghost"
          >
            Re-download
          </Button>
        ) : (
          <div className="flex flex-col items-end gap-2">
            {isDownloading && downloadProgress && (
              <div className="w-40 space-y-1">
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{ width: `${downloadPercent ?? 0}%` }}
                  />
                </div>
                <p className="text-muted-foreground text-xs">
                  {formatBytes(downloadProgress.downloaded)} /{" "}
                  {formatBytes(downloadProgress.total)} ({downloadPercent}%)
                </p>
              </div>
            )}
            <Button
              disabled={isDownloading}
              onClick={() => {
                sounds.download();
                onDownload();
              }}
              size="sm"
            >
              <Download className="mr-2 size-4" />
              {isDownloading ? "Downloading…" : "Download Model"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function ProcessingSettings({ hasGeminiKey }: { hasGeminiKey: boolean }) {
  const {
    bgRemovalQuality,
    setBgRemovalQuality,
    bgRemovalProvider,
    setBgRemovalProvider,
    bgRemovalGeminiEnabled,
    setBgRemovalGeminiEnabled,
    bgRemovalGeminiModel,
    setBgRemovalGeminiModel,
    bgRemovalGeminiColor,
    setBgRemovalGeminiColor,
    bgRemovalGeminiAutoRemove,
    setBgRemovalGeminiAutoRemove,
  } = useAppSettingsStore();

  const [isBriaAvailable, setIsBriaAvailable] = useState(false);

  // HuggingFace token (for gated models like RMBG-2.0)
  const [hfToken, setHfTokenState] = useState("");
  const [hfTokenSaved, setHfTokenSaved] = useState(false);

  useEffect(() => {
    getHfToken().then((t) => {
      if (t) {
        setHfTokenSaved(true);
      }
    });
  }, []);

  const handleSaveHfToken = useCallback(async () => {
    try {
      await setHfToken(hfToken.trim());
      setHfTokenSaved(true);
      setHfTokenState("");
      sileo.success({ title: "HuggingFace token saved" });
    } catch {
      sileo.error({ title: "Failed to save token" });
    }
  }, [hfToken]);

  // RMBG-1.4 state
  const [briaStatus, setBriaStatus] = useState<BriaModelStatus | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<{
    downloaded: number;
    total: number;
  } | null>(null);

  // RMBG-2.0 state
  const [briaV2Status, setBriaV2Status] = useState<BriaModelStatus | null>(
    null
  );
  const [isDownloadingV2, setIsDownloadingV2] = useState(false);
  const [downloadProgressV2, setDownloadProgressV2] = useState<{
    downloaded: number;
    total: number;
  } | null>(null);

  useEffect(() => {
    invoke<boolean>("is_bria_available")
      .then(setIsBriaAvailable)
      .catch(() => setIsBriaAvailable(false));
  }, []);

  const loadBriaStatus = useCallback(async () => {
    try {
      const status = await invoke<BriaModelStatus>("bria_model_status");
      setBriaStatus(status);
    } catch {
      // not available outside Tauri, safe to ignore
    }
  }, []);

  const loadBriaV2Status = useCallback(async () => {
    try {
      const status = await invoke<BriaModelStatus>("bria_v2_model_status");
      setBriaV2Status(status);
    } catch {
      // not available outside Tauri, safe to ignore
    }
  }, []);

  useEffect(() => {
    loadBriaStatus();
    loadBriaV2Status();
  }, [loadBriaStatus, loadBriaV2Status]);

  useEffect(() => {
    const unlistenPromise = listen<{ downloaded: number; total: number }>(
      "bria-download-progress",
      (event) => {
        setDownloadProgress(event.payload);
      }
    );
    return () => {
      unlistenPromise.then((unlisten) => unlisten());
    };
  }, []);

  useEffect(() => {
    const unlistenPromise = listen<{ downloaded: number; total: number }>(
      "bria-v2-download-progress",
      (event) => {
        setDownloadProgressV2(event.payload);
      }
    );
    return () => {
      unlistenPromise.then((unlisten) => unlisten());
    };
  }, []);

  const handleDownload = useCallback(async () => {
    setIsDownloading(true);
    setDownloadProgress(null);
    try {
      await invoke("download_bria_model");
      await loadBriaStatus();
      sileo.success({ title: "BRIA RMBG-1.4 model downloaded successfully" });
    } catch (error) {
      sileo.error({ title: `Download failed: ${error}` });
    } finally {
      setIsDownloading(false);
      setDownloadProgress(null);
    }
  }, [loadBriaStatus]);

  const handleDownloadV2 = useCallback(async () => {
    setIsDownloadingV2(true);
    setDownloadProgressV2(null);
    try {
      const token = await getHfToken();
      await invoke("download_bria_v2_model", { hfToken: token ?? undefined });
      await loadBriaV2Status();
      sileo.success({ title: "BRIA RMBG-2.0 model downloaded successfully" });
    } catch (error) {
      sileo.error({ title: `Download failed: ${error}` });
    } finally {
      setIsDownloadingV2(false);
      setDownloadProgressV2(null);
    }
  }, [loadBriaV2Status]);

  const downloadPercent =
    downloadProgress && downloadProgress.total > 0
      ? Math.round((downloadProgress.downloaded / downloadProgress.total) * 100)
      : null;

  const downloadPercentV2 =
    downloadProgressV2 && downloadProgressV2.total > 0
      ? Math.round(
          (downloadProgressV2.downloaded / downloadProgressV2.total) * 100
        )
      : null;

  return (
    <div className="space-y-6">
      <p className="mb-3 pl-2 font-medium text-muted-foreground text-xs">
        Background Removal
      </p>

      <div className="space-y-4">
        <Frame>
          {isBriaAvailable && (
            <FrameHeader className="px-4 py-3">
              <p className="mb-3 font-medium text-sm">Engine</p>
              <div className="flex flex-col gap-2">
                {BG_PROVIDER_OPTIONS.map((option) => {
                  const isSelected = bgRemovalProvider === option.value;
                  return (
                    <button
                      className={`flex items-center gap-4 rounded-lg p-4 text-left transition-colors ${
                        isSelected
                          ? "bg-foreground text-background"
                          : "bg-muted/50 hover:bg-muted"
                      }`}
                      key={option.value}
                      onClick={() => {
                        sounds.click();
                        setBgRemovalProvider(option.value);
                      }}
                      type="button"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm">{option.label}</p>
                          {option.value === "imgly" && (
                            <span
                              className={`rounded-full px-2 py-0.5 text-xs ${isSelected ? "bg-background/20 text-background/70" : "bg-muted text-muted-foreground"}`}
                            >
                              Default
                            </span>
                          )}
                          {isSelected && (
                            <Check className="size-3.5 shrink-0 text-background" />
                          )}
                        </div>
                        <p
                          className={`mt-0.5 text-xs leading-snug ${isSelected ? "text-background/60" : "text-muted-foreground"}`}
                        >
                          {option.description}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </FrameHeader>
          )}
          {bgRemovalProvider === "imgly" && (
            <FramePanel className="px-4 py-3">
              <p className="mb-1 font-medium text-sm">Quality</p>
              <p className="mb-3 text-muted-foreground text-xs">
                Higher quality uses a larger AI model downloaded on first use.
                The model is cached locally after that.
              </p>
              <div className="flex flex-col gap-2">
                {BG_QUALITY_OPTIONS.map((option) => {
                  const isSelected = bgRemovalQuality === option.value;
                  return (
                    <button
                      className={`flex items-center gap-4 rounded-lg p-3 text-left transition-colors ${
                        isSelected
                          ? "bg-foreground text-background"
                          : "bg-muted/50 hover:bg-muted"
                      }`}
                      key={option.value}
                      onClick={() => {
                        sounds.click();
                        setBgRemovalQuality(option.value);
                      }}
                      type="button"
                    >
                      {/* Left: label + size */}
                      <div className="flex flex-1 flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">
                            {option.label}
                          </span>
                          {option.value === "balanced" && (
                            <span
                              className={`rounded-full px-2 py-0.5 text-xs ${isSelected ? "bg-background/20 text-background/70" : "bg-muted text-muted-foreground"}`}
                            >
                              Default
                            </span>
                          )}
                          {isSelected && (
                            <Check className="size-3.5 shrink-0 text-background" />
                          )}
                        </div>
                        <div
                          className={`flex items-center gap-1 ${isSelected ? "text-background/60" : "text-muted-foreground"}`}
                        >
                          <Download className="size-3 shrink-0" />
                          <span className="text-xs">{option.size}</span>
                        </div>
                      </div>
                      {/* Right: progress bars */}
                      <div className="flex w-32 shrink-0 flex-col gap-1.5">
                        {[
                          { label: "Accuracy", value: option.accuracy },
                          { label: "Speed", value: option.speed },
                        ].map((bar) => (
                          <div
                            className="flex items-center gap-2"
                            key={bar.label}
                          >
                            <span
                              className={`w-12 shrink-0 text-xs ${isSelected ? "text-background/60" : "text-muted-foreground"}`}
                            >
                              {bar.label}
                            </span>
                            <div
                              className={`h-1 flex-1 overflow-hidden rounded-full ${isSelected ? "bg-background/20" : "bg-muted"}`}
                            >
                              <div
                                className={`h-full rounded-full transition-all ${isSelected ? "bg-background" : "bg-foreground/40"}`}
                                style={{ width: `${bar.value}%` }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </button>
                  );
                })}
              </div>
            </FramePanel>
          )}
          {bgRemovalProvider === "briaai" && (
            <FramePanel className="px-4 py-3">
              <BriaModelRow
                briaStatus={briaStatus}
                downloadPercent={downloadPercent}
                downloadProgress={downloadProgress}
                downloadSizeMb="176 MB"
                isDownloading={isDownloading}
                onDownload={handleDownload}
                title="BRIA RMBG-1.4 Model"
              />
            </FramePanel>
          )}
          {bgRemovalProvider === "briaai2" && (
            <FramePanel className="overflow-hidden p-0">
              <div className="px-4 py-3">
                <div className="flex items-center justify-between">
                  <div className="flex-1 pr-4">
                    <p className="font-medium text-sm">
                      HuggingFace Access Token
                    </p>
                    <p className="mt-0.5 text-muted-foreground text-xs leading-snug">
                      {hfTokenSaved
                        ? "Token saved · used for gated model downloads"
                        : "RMBG-2.0 is gated. Agree to the license then enter your access token."}
                    </p>
                    {!hfTokenSaved && (
                      <button
                        className="mt-1.5 inline-flex items-center gap-1 text-muted-foreground text-xs hover:text-foreground hover:underline"
                        onClick={() =>
                          openUrl("https://huggingface.co/briaai/RMBG-2.0")
                        }
                        type="button"
                      >
                        <ExternalLink className="size-3" />
                        Agree &amp; get token
                      </button>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {hfTokenSaved ? (
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
                          <div className="size-2 rounded-full bg-green-500" />
                          Saved
                        </div>
                        <Button
                          onClick={async () => {
                            sounds.delete_();
                            await removeHfToken();
                            setHfTokenSaved(false);
                            sileo.success({ title: "Token removed" });
                          }}
                          size="sm"
                          variant="ghost"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Input
                          className="w-52"
                          onChange={(e) => setHfTokenState(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleSaveHfToken();
                          }}
                          placeholder="hf_…"
                          type="password"
                          value={hfToken}
                        />
                        <Button
                          disabled={!hfToken.trim()}
                          onClick={() => {
                            sounds.success();
                            handleSaveHfToken();
                          }}
                          size="sm"
                        >
                          Save
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="mx-4 h-px bg-border" />
              <div className="px-4 py-3">
                <BriaModelRow
                  briaStatus={briaV2Status}
                  downloadPercent={downloadPercentV2}
                  downloadProgress={downloadProgressV2}
                  downloadSizeMb="~890 MB"
                  isDownloading={isDownloadingV2}
                  onDownload={handleDownloadV2}
                  title="BRIA RMBG-2.0 Model"
                />
              </div>
            </FramePanel>
          )}
        </Frame>

        <Frame>
          <FrameHeader className="px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex-1 pr-4">
                <p className="font-medium text-sm">Gemini Pre-processing</p>
                <p className="mt-0.5 text-muted-foreground text-xs leading-snug">
                  {hasGeminiKey
                    ? "Replace the background with a solid color first — gives the remover cleaner subject edges, or use it on its own for a flat backdrop"
                    : "Requires a Gemini API key"}
                </p>
              </div>
              <Switch
                checked={bgRemovalGeminiEnabled}
                disabled={!hasGeminiKey}
                onCheckedChange={(v) => {
                  v ? sounds.switchOn() : sounds.switchOff();
                  setBgRemovalGeminiEnabled(v);
                }}
              />
            </div>
          </FrameHeader>
          {bgRemovalGeminiEnabled && (
            <FramePanel className="overflow-hidden p-0">
              <div className="flex items-center justify-between px-4 py-3">
                <p className="font-medium text-sm">Gemini Model</p>
                <Select
                  onValueChange={(v) => v && setBgRemovalGeminiModel(v)}
                  value={bgRemovalGeminiModel}
                >
                  <SelectTrigger
                    className="w-56 border-none bg-transparent shadow-none focus:bg-transparent dark:bg-transparent"
                    size="sm"
                  >
                    <SelectValue>
                      {
                        GEMINI_BG_MODELS.find(
                          (m) => m.value === bgRemovalGeminiModel
                        )?.label
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {GEMINI_BG_MODELS.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="mx-4 h-px bg-border" />
              <div className="flex items-center justify-between px-4 py-3">
                <div className="flex-1 pr-4">
                  <p className="font-medium text-sm">Background Color</p>
                  <p className="mt-0.5 text-muted-foreground text-xs leading-snug">
                    Color Gemini fills the background with before removal
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <div className="flex gap-1.5">
                    {["#00ff00", "#000000", "#808080", "#ffffff"].map((c) => (
                      <button
                        className="h-5 w-5 rounded border border-input transition-transform hover:scale-110"
                        key={c}
                        onClick={() => {
                          sounds.click();
                          setBgRemovalGeminiColor(c);
                        }}
                        style={{ background: c }}
                        title={c}
                        type="button"
                      />
                    ))}
                  </div>
                  <span className="font-mono text-muted-foreground text-xs">
                    {bgRemovalGeminiColor}
                  </span>
                  <ColorPicker
                    onValueChange={setBgRemovalGeminiColor}
                    value={bgRemovalGeminiColor}
                  >
                    <ColorPickerTrigger className="h-9 w-12 px-1">
                      <ColorPickerSwatch className="size-full rounded" />
                    </ColorPickerTrigger>
                    <ColorPickerContent>
                      <ColorPickerArea className="h-40 w-full rounded-md border" />
                      <div className="flex gap-2">
                        <ColorPickerHueSlider />
                        <ColorPickerAlphaSlider />
                      </div>
                      <div className="flex gap-2">
                        <ColorPickerInput />
                        <ColorPickerEyeDropper />
                      </div>
                    </ColorPickerContent>
                  </ColorPicker>
                </div>
              </div>
              <div className="mx-4 h-px bg-border" />
              <div className="flex items-center justify-between px-4 py-3">
                <div className="flex-1 pr-4">
                  <p className="font-medium text-sm">Auto-remove background</p>
                  <p className="mt-0.5 text-muted-foreground text-xs leading-snug">
                    Pass Gemini output through the background remover for a
                    transparent result
                  </p>
                </div>
                <Switch
                  checked={bgRemovalGeminiAutoRemove}
                  onCheckedChange={(v) => {
                    v ? sounds.switchOn() : sounds.switchOff();
                    setBgRemovalGeminiAutoRemove(v);
                  }}
                />
              </div>
            </FramePanel>
          )}
        </Frame>
      </div>
    </div>
  );
}

const progressLatest: Record<string, string> = {};

function ProgressDescription({ event }: { event: string }) {
  const [text, setText] = useState(() => progressLatest[event] ?? "Preparing…");
  useEffect(() => {
    // Sync in case events fired before mount
    if (progressLatest[event]) setText(progressLatest[event]);
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<string>).detail;
      progressLatest[event] = detail;
      setText(detail);
    };
    window.addEventListener(event, handler);
    return () => window.removeEventListener(event, handler);
  }, [event]);
  return <span>{text}</span>;
}

function StorageSettings({
  onTransferChange,
}: {
  onTransferChange: (active: boolean) => void;
}) {
  const [isPurging, setIsPurging] = useState(false);
  const [storageSize, setStorageSize] = useState<number | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportPhase, setExportPhase] = useState("Preparing…");
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importPhase, setImportPhase] = useState("Reading…");
  const [regenerating, setRegenerating] = useState(false);
  const [regenerateProgress, setRegenerateProgress] = useState("");
  const [isWiping, setIsWiping] = useState(false);

  useEffect(() => {
    onTransferChange(exporting || importing);
  }, [exporting, importing, onTransferChange]);

  const loadSize = useCallback(async () => {
    const { getRevisionStorageSize } = await import("@/lib/revision-storage");
    const size = await getRevisionStorageSize();
    setStorageSize(size);
  }, []);

  useEffect(() => {
    loadSize();
  }, [loadSize]);

  const handlePurge = async () => {
    setIsPurging(true);
    try {
      const { purgeAllRevisions } = await import(
        "@/stores/use-revision-store"
      ).then((m) => m.useRevisionStore.getState());
      await purgeAllRevisions();
      setStorageSize(0);
      sileo.success({ title: "All revision history deleted" });
    } catch {
      sileo.error({ title: "Failed to purge revision history" });
    } finally {
      setIsPurging(false);
    }
  };

  const handleRegeneratePreviews = useCallback(async () => {
    setRegenerating(true);
    setRegenerateProgress("Loading…");
    try {
      const { regeneratePreviewFromFull } = await import(
        "@/lib/thumbnail-storage"
      );
      const { useGalleryStore } = await import("@/stores/use-gallery-store");
      const { thumbnails, previewCache } = useGalleryStore.getState();
      const missing = thumbnails.filter((t) => !previewCache.has(t.id));
      let done = 0;
      for (const t of missing) {
        setRegenerateProgress(`${done}/${missing.length}`);
        const url = await regeneratePreviewFromFull(t.id);
        if (url) {
          useGalleryStore.setState((s) => ({
            previewCache: new Map(s.previewCache).set(t.id, url),
          }));
        }
        done++;
      }
      setRegenerateProgress("");
      sileo.success({
        title: `Regenerated ${done} preview${done === 1 ? "" : "s"}`,
      });
    } catch (err) {
      sileo.error({ title: `Failed: ${err}` });
    } finally {
      setRegenerating(false);
      setRegenerateProgress("");
    }
  }, []);

  const handleExport = useCallback(async () => {
    const savePath = await saveDialog({
      defaultPath: `backstage-backup-${new Date().toISOString().split("T")[0]}.zip`,
      filters: [{ name: "ZIP Archive", extensions: ["zip"] }],
    });
    if (!savePath) return;

    setExporting(true);
    setExportProgress(0);
    setExportPhase("Preparing…");
    try {
      await sileo.promise(
        (async () => {
          const db = await getDb();
          await db.execute("PRAGMA wal_checkpoint(TRUNCATE)");
          const appData = await appDataDir();
          const zip = new JSZip();

          const emitToast = (msg: string) => {
            progressLatest["export-progress"] = msg;
            window.dispatchEvent(
              new CustomEvent("export-progress", { detail: msg })
            );
          };
          const setPhase = (label: string) => {
            setExportPhase(label);
            emitToast(label);
          };

          // Write manifest so future imports can check compatibility
          const appVersion = await getVersion();
          const sqliteVersion = await getSqliteSchemaVersion();
          const manifest = {
            schemaVersion: 1,
            appVersion,
            createdAt: new Date().toISOString(),
            dataSchemaVersions: {
              ...DATA_SCHEMA_VERSIONS,
              sqlite: sqliteVersion,
            },
          };
          zip.file("manifest.json", JSON.stringify(manifest, null, 2));

          setPhase("Backing up database…");
          for (const fname of APP_DATA_FILES) {
            try {
              zip.file(fname, await readFile(await join(appData, fname)));
            } catch {
              /* file may not exist */
            }
          }

          const dirLabels: Record<(typeof APP_DATA_DIRS)[number], string> = {
            thumbnails: "Backing up projects…",
            trash: "Backing up trash…",
            revisions: "Backing up revision history…",
            recovery: "Backing up recovery files…",
            "ai-projects": "Backing up AI projects…",
          };
          for (const dir of APP_DATA_DIRS) {
            const dirPath = await join(appData, dir);
            if (await exists(dirPath)) {
              setPhase(dirLabels[dir]);
              await addDirToZip(zip, dirPath, dir);
            }
          }

          setPhase("Compressing…");
          const zipData = await zip.generateAsync(
            {
              type: "uint8array",
              compression: "DEFLATE",
              compressionOptions: { level: 3 },
            },
            ({ percent, currentFile }) => {
              const p = Math.round(percent);
              setExportProgress(p);
              const name = currentFile?.split("/").pop() ?? "";
              emitToast(`${name ? `${name} · ` : ""}${p}%`);
            }
          );

          setPhase("Saving…");
          await writeFile(savePath, zipData);

          // Verify the written file starts with PK local-file-header magic
          const verify = await readFile(savePath);
          if (
            verify.length < 4 ||
            verify[0] !== 0x50 ||
            verify[1] !== 0x4b ||
            verify[2] !== 0x03 ||
            verify[3] !== 0x04
          ) {
            throw new Error(
              `Export wrote ${verify.length} bytes but ZIP magic is wrong: ${Array.from(
                verify.subarray(0, 4)
              )
                .map((x) => x.toString(16).padStart(2, "0"))
                .join(" ")}`
            );
          }
          setExportProgress(100);
        })(),
        {
          loading: {
            title: "Exporting backup…",
            description: <ProgressDescription event="export-progress" />,
            duration: 600_000,
            autopilot: { expand: 0 },
          },
          success: { title: "Full backup exported" },
          error: (err: unknown) => ({ title: `Export failed: ${err}` }),
        }
      );
    } catch {
      /* sileo handled display */
    } finally {
      setExporting(false);
      setExportProgress(0);
    }
  }, []);

  const handleConfirmImport = useCallback(async (zipPath: string) => {
    setImporting(true);
    setImportProgress(0);
    setImportPhase("Extracting…");
    let succeeded = false;

    const emitToast = (msg: string) => {
      progressLatest["import-progress"] = msg;
      window.dispatchEvent(new CustomEvent("import-progress", { detail: msg }));
    };
    const setPhase = (label: string) => {
      setImportPhase(label);
      emitToast(label);
    };

    const loadingId = sileo.info({
      id: "import-backup",
      title: "Restoring backup…",
      description: <ProgressDescription event="import-progress" />,
      duration: null,
      autopilot: { expand: 0 },
    });

    // Wire up Tauri event → UI progress before invoking Rust
    const unlisten = await listen<{ pct: number; name: string }>(
      "import-progress",
      (event) => {
        const { pct, name } = event.payload;
        setImportProgress(pct);
        const section = name.split("/")[0];
        setPhase(`Restoring ${section}…`);
        emitToast(`${name.split("/").pop()} · ${pct}%`);
      }
    );

    try {
      setPhase("Checking backup compatibility…");
      // Read manifest from the ZIP to verify schema compatibility before touching the DB.
      // - Missing manifest is OK (legacy backups from before manifest support).
      // - Present but malformed → abort (don't risk corrupting current data).
      // - Present and any data schema version exceeds what this app supports → abort.
      const zipBytes = await readFile(zipPath);
      const peekZip = await JSZip.loadAsync(zipBytes);
      const manifestFile = peekZip.file("manifest.json");
      if (manifestFile) {
        let manifest: {
          dataSchemaVersions?: Record<string, number>;
        };
        try {
          manifest = JSON.parse(await manifestFile.async("string"));
        } catch {
          throw new Error(
            "Backup manifest is corrupt. Refusing to restore — file an issue if this backup was produced by a recent version."
          );
        }
        const backupVersions = manifest.dataSchemaVersions ?? {};
        const currentSqliteVersion = await getSqliteSchemaVersion();
        const currentVersions: Record<string, number> = {
          ...DATA_SCHEMA_VERSIONS,
          sqlite: currentSqliteVersion,
        };
        for (const [key, backupVer] of Object.entries(backupVersions)) {
          const currentVer = currentVersions[key];
          if (currentVer === undefined) {
            // Backup carries a versioned surface this app doesn't know about
            // → newer app made the backup. Refuse to restore.
            throw new Error(
              `This backup contains data type "${key}" (v${backupVer}) that this version of the app doesn't recognise. Please update the app before restoring this backup.`
            );
          }
          if (backupVer > currentVer) {
            throw new Error(
              `This backup requires ${key} schema v${backupVer} but you are running v${currentVer}. Please update the app before restoring this backup.`
            );
          }
        }
      }

      setPhase("Extracting backup…");
      // Checkpoint the WAL into the main DB file before closing so no stale
      // WAL pages are left on disk to corrupt the restored database on reopen.
      try {
        const db = await getDb();
        await db.execute("PRAGMA wal_checkpoint(TRUNCATE)");
      } catch {
        // Non-fatal — best effort; the Rust side also cleans up WAL after extract.
      }
      await closeDb();
      await invoke("import_backup", { zipPath });
      unlisten();
      sileo.dismiss(loadingId);
      sileo.success({ title: "Backup restored. Restarting…" });
      succeeded = true;
    } catch (err) {
      unlisten();
      sileo.dismiss(loadingId);
      sileo.error({
        title: "Import failed",
        description: String(err),
        duration: null,
      });
    } finally {
      // Keep UI locked on success so nothing re-activates DB queries during
      // the restart window. Only re-enable on failure.
      if (!succeeded) {
        setImporting(false);
        setImportProgress(0);
      }
    }

    if (succeeded) {
      setTimeout(async () => {
        try {
          await relaunch();
        } catch (err) {
          setImporting(false);
          setImportProgress(0);
          sileo.error({
            title: "Restart failed — please relaunch manually",
            description: String(err),
            duration: null,
          });
        }
      }, 1500);
    }
  }, []);

  const handlePickImport = useCallback(async () => {
    const filePath = await openDialog({
      multiple: false,
      filters: [{ name: "ZIP Archive", extensions: ["zip"] }],
    });
    if (!filePath) return;
    const zipPath = filePath as string;
    const toastId = sileo.warning({
      title: "Replace all current data?",
      description:
        "This will overwrite all your projects and settings. The app will restart automatically. This cannot be undone.",
      duration: null,
      button: {
        title: "Yes, restore backup",
        onClick: () => {
          sileo.dismiss(toastId);
          handleConfirmImport(zipPath);
        },
      },
    });
  }, [handleConfirmImport]);

  const handleConfirmWipe = useCallback(async () => {
    setIsWiping(true);
    try {
      await closeDb();
      const appData = await appDataDir();
      // gallery.db-wal/shm are write-ahead-log files SQLite recreates; include
      // them in wipe so a stale WAL doesn't replay on the next launch.
      for (const fname of [
        ...APP_DATA_FILES,
        "gallery.db-wal",
        "gallery.db-shm",
      ]) {
        try {
          await remove(await join(appData, fname));
        } catch {
          /* may not exist */
        }
      }
      for (const dir of APP_DATA_DIRS) {
        try {
          const dirPath = await join(appData, dir);
          if (await exists(dirPath)) {
            await remove(dirPath, { recursive: true });
          }
        } catch {
          /* may not exist */
        }
      }
      sileo.success({ title: "Workspace wiped. Restarting…" });
      await relaunch();
    } catch (err) {
      sileo.error({ title: `Wipe failed: ${err}` });
      setIsWiping(false);
    }
  }, []);

  const busy = exporting || importing;

  const sizeLabel =
    storageSize === null
      ? "Calculating…"
      : storageSize === 0
        ? "0 MB"
        : formatBytes(storageSize);

  return (
    <div className="space-y-6">
      <h2 className="pl-2 font-semibold text-lg">Storage</h2>

      <div className="space-y-4">
        <p className="pl-2 font-medium text-muted-foreground text-xs">
          Backup &amp; Restore
        </p>
        <div className="space-y-2">
          <SettingRow
            description="All projects, images, revision history, and settings."
            title="Export Full Backup"
          >
            <Button
              className="relative overflow-hidden"
              disabled={busy}
              onClick={() => {
                sounds.download();
                handleExport();
              }}
              size="sm"
            >
              {exporting && (
                <span
                  className="absolute inset-0 bg-primary/20 transition-[width] duration-200"
                  style={{ width: `${exportProgress}%` }}
                />
              )}
              <span className="relative z-10 flex items-center gap-1.5">
                {exporting ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Download className="size-4" />
                )}
                {exporting ? (
                  <>
                    <span>{exportPhase}</span>
                    {exportProgress > 0 && (
                      <span className="shrink-0">{exportProgress}%</span>
                    )}
                  </>
                ) : (
                  "Export"
                )}
              </span>
            </Button>
          </SettingRow>
          <SettingRow
            description="Restore from a previously exported backup ZIP."
            title="Import Backup"
          >
            <Button
              className="relative overflow-hidden"
              disabled={busy}
              onClick={() => {
                sounds.click();
                handlePickImport();
              }}
              size="sm"
            >
              {importing && (
                <span
                  className="absolute inset-0 bg-primary/20 transition-[width] duration-200"
                  style={{ width: `${importProgress}%` }}
                />
              )}
              <span className="relative z-10 flex items-center gap-1.5">
                {importing ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Upload className="size-4" />
                )}
                {importing ? (
                  <>
                    <span>{importPhase}</span>
                    {importProgress > 0 && (
                      <span className="shrink-0">{importProgress}%</span>
                    )}
                  </>
                ) : (
                  "Import"
                )}
              </span>
            </Button>
          </SettingRow>
        </div>
      </div>

      <div className="space-y-4">
        <p className="pl-2 font-medium text-muted-foreground text-xs">
          Maintenance
        </p>
        <div>
          <SettingRow
            description="Regenerate preview images for items missing thumbnails."
            title="Regenerate Previews"
          >
            <Button
              disabled={regenerating || busy}
              onClick={() => {
                sounds.click();
                handleRegeneratePreviews();
              }}
              size="sm"
              variant="default"
            >
              {regenerating ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  {regenerateProgress || "Regenerating…"}
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 size-4" />
                  Regenerate
                </>
              )}
            </Button>
          </SettingRow>
        </div>
      </div>

      <div className="space-y-4">
        <p className="pl-2 font-medium text-muted-foreground text-xs">
          Danger Zone
        </p>
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3">
            <div className="flex-1 pr-4">
              <p className="font-medium text-sm">Purge Revision History</p>
              <p className="mt-0.5 text-muted-foreground text-xs leading-snug">
                Remove all saved revision checkpoints to free up disk space.
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button
                disabled={isPurging || storageSize === 0 || busy}
                onClick={() => {
                  sounds.delete_();
                  handlePurge();
                }}
                size="sm"
                variant="destructive"
              >
                <Trash2 className="mr-2 size-4" />
                {isPurging ? "Purging…" : `Purge ${sizeLabel}`}
              </Button>
            </div>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3">
            <div className="flex-1 pr-4">
              <p className="font-medium text-sm">Delete Workspace</p>
              <p className="mt-0.5 text-muted-foreground text-xs leading-snug">
                Permanently delete all projects, images, settings, and revision
                history. This cannot be undone.
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button
                disabled={isWiping || busy}
                onClick={() => {
                  const toastId = sileo.warning({
                    title: "Delete everything permanently?",
                    description:
                      "All projects, images, thumbnails, revision history, and settings will be wiped. The app will restart. This cannot be undone.",
                    duration: null,
                    button: {
                      title: "Yes, delete everything",
                      onClick: () => {
                        sileo.dismiss(toastId);
                        handleConfirmWipe();
                      },
                    },
                  });
                }}
                size="sm"
                variant="destructive"
              >
                <Trash2 className="mr-2 size-4" />
                {isWiping ? "Wiping…" : "Wipe"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function BillingSettings() {
  const { isValidated, validatedData, clearLicense, openLicenseGate } =
    useLicenseStore();

  const handleManageLicense = useCallback(() => {
    openUrl(POLAR_CONFIG.customerPortalUrl);
  }, []);

  const handleDeactivate = useCallback(async () => {
    await clearLicense();
    sileo.success({ title: "License deactivated" });
  }, [clearLicense]);

  return (
    <div className="space-y-4">
      <p className="pl-2 font-medium text-muted-foreground text-xs">Billing</p>
      <div>
        <SettingRow
          description={
            isValidated
              ? validatedData?.customerEmail
                ? `${validatedData.customerEmail} · To transfer to another device, deactivate here first and reactivate via the portal.`
                : "To transfer to another device, deactivate here first and reactivate via the portal."
              : "Not activated. The app is free to use. Activate a license to export your thumbnails."
          }
          title="License"
        >
          {isValidated ? (
            <>
              <Button
                onClick={() => {
                  sounds.click();
                  handleManageLicense();
                }}
                size="sm"
                variant="ghost"
              >
                <ExternalLink className="mr-2 size-4" />
                Manage
              </Button>
              <Button
                onClick={() => {
                  sounds.delete_();
                  handleDeactivate();
                }}
                size="sm"
                variant="destructive"
              >
                Deactivate
              </Button>
            </>
          ) : (
            <Button
              onClick={() => {
                sounds.click();
                openLicenseGate();
              }}
              size="sm"
            >
              Activate
            </Button>
          )}
        </SettingRow>
      </div>
    </div>
  );
}

function PrivacySettings() {
  const {
    analyticsEnabled,
    setAnalyticsEnabled,
    loggingEnabled,
    setLoggingEnabled,
    saveSearchHistory,
    setSaveSearchHistory,
  } = useAppSettingsStore();

  return (
    <div className="space-y-6">
      <h2 className="pl-2 font-semibold text-lg">Privacy</h2>

      <div className="space-y-4">
        <p className="pl-2 font-medium text-muted-foreground text-xs">Search</p>
        <div>
          <SettingRow
            description="Save recent searches in Home, Discovery, and Trash. Up to 10 per page."
            title="Search History"
          >
            <Switch
              checked={saveSearchHistory}
              onCheckedChange={(v) => {
                v ? sounds.switchOn() : sounds.switchOff();
                setSaveSearchHistory(v);
              }}
            />
          </SettingRow>
        </div>
      </div>

      <div className="space-y-4">
        <p className="pl-2 font-medium text-muted-foreground text-xs">
          Analytics &amp; Telemetry
        </p>
        <div className="space-y-2">
          <SettingRow
            description="Helps us understand how you use the app so we can improve it. No personal data is collected."
            title="Product Analytics"
          >
            <Switch
              checked={analyticsEnabled}
              onCheckedChange={(v) => {
                v ? sounds.switchOn() : sounds.switchOff();
                setAnalyticsEnabled(v);
              }}
            />
          </SettingRow>
          <SettingRow
            description="Sends app logs and error reports to help diagnose issues."
            title="Diagnostic Logging"
          >
            <Switch
              checked={loggingEnabled}
              onCheckedChange={(v) => {
                v ? sounds.switchOn() : sounds.switchOff();
                setLoggingEnabled(v);
              }}
            />
          </SettingRow>
        </div>
      </div>
    </div>
  );
}

// Strip a trailing commit reference like " ([8d12463](https://…/commit/…))".
const COMMIT_REF_RE = /\s*\(\[[0-9a-f]{6,40}\]\([^)]*\)\)\s*$/i;
// Reduce a markdown link "[text](url)" down to just its text.
const MD_LINK_RE = /\[([^\]]+)\]\([^)]*\)/g;
const HEADING_PREFIX_RE = /^#+\s*/;
const META_LINE_RE = /^\*\*(Full Changelog|All Commits)\*\*/i;
const DOWNLOADS_HEADING_RE = /^##\s+Downloads/i;

function cleanReleaseLine(text: string): string {
  return text
    .replace(COMMIT_REF_RE, "")
    .replace(MD_LINK_RE, "$1")
    .replaceAll("**", "")
    .trim();
}

interface ReleaseLine {
  kind: "h2" | "h3" | "li" | "p";
  text: string;
}

function parseReleaseNotes(body: string): ReleaseLine[] {
  const lines: ReleaseLine[] = [];
  for (const raw of body.split("\n")) {
    const trimmed = raw.trim();
    // The generated changelog ends with a Downloads table that is noise in-app.
    if (DOWNLOADS_HEADING_RE.test(trimmed)) {
      break;
    }
    if (!trimmed || META_LINE_RE.test(trimmed)) {
      continue;
    }
    if (trimmed.startsWith("### ")) {
      lines.push({ kind: "h3", text: cleanReleaseLine(trimmed.slice(4)) });
    } else if (trimmed.startsWith("## ")) {
      lines.push({ kind: "h2", text: cleanReleaseLine(trimmed.slice(3)) });
    } else if (trimmed.startsWith("#")) {
      lines.push({
        kind: "h2",
        text: cleanReleaseLine(trimmed.replace(HEADING_PREFIX_RE, "")),
      });
    } else if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      lines.push({ kind: "li", text: cleanReleaseLine(trimmed.slice(2)) });
    } else {
      lines.push({ kind: "p", text: cleanReleaseLine(trimmed) });
    }
  }
  return lines.filter((l) => l.text.length > 0);
}

function ReleaseNotes({ body }: { body: string }) {
  const lines = parseReleaseNotes(body);
  if (lines.length === 0) {
    return null;
  }

  return (
    <div className="mt-3 max-h-56 space-y-1.5 overflow-y-auto rounded-md bg-background/60 p-3 text-xs">
      {lines.map((line, i) => {
        // Notes are static once rendered, so index keys are safe here.
        const key = `${i}-${line.kind}`;
        if (line.kind === "h2") {
          return (
            <p className="font-semibold text-sm" key={key}>
              {line.text}
            </p>
          );
        }
        if (line.kind === "h3") {
          return (
            <p className="pt-1 font-medium text-muted-foreground" key={key}>
              {line.text}
            </p>
          );
        }
        if (line.kind === "li") {
          return (
            <div className="flex gap-1.5" key={key}>
              <span className="text-muted-foreground">•</span>
              <span>{line.text}</span>
            </div>
          );
        }
        return (
          <p className="text-muted-foreground" key={key}>
            {line.text}
          </p>
        );
      })}
    </div>
  );
}

function UpdateSettings() {
  const {
    autoCheckForUpdates,
    setAutoCheckForUpdates,
    betaUpdatesEnabled,
    setBetaUpdatesEnabled,
  } = useAppSettingsStore();
  const { checking, downloading, progress, available, manualUpdate } =
    useUpdateStore();
  const [currentVersion, setCurrentVersion] = useState<string | null>(null);

  useEffect(() => {
    getVersion()
      .then(setCurrentVersion)
      .catch(() => {});
  }, []);

  const handleCheckNow = useCallback(async () => {
    await checkForUpdate();
    const state = useUpdateStore.getState();
    if (!(state.available || state.manualUpdate)) {
      sileo.success({
        title: "You're up to date",
        description: currentVersion
          ? `Version ${currentVersion} is the latest.`
          : undefined,
      });
    }
  }, [currentVersion]);

  const handleInstall = useCallback(async () => {
    if (available) {
      await downloadAndInstall(available);
    }
  }, [available]);

  const handleBetaToggle = useCallback(
    async (enabled: boolean) => {
      if (enabled) {
        sounds.switchOn();
      } else {
        sounds.switchOff();
      }
      // Persist first so checkForUpdate() reads the new channel, then re-check
      // immediately instead of waiting for the next launch's auto-check.
      await setBetaUpdatesEnabled(enabled);
      await checkForUpdate();
    },
    [setBetaUpdatesEnabled]
  );

  return (
    <div className="space-y-6">
      <h2 className="pl-2 font-semibold text-lg">Updates</h2>

      <div className="space-y-4">
        <p className="pl-2 font-medium text-muted-foreground text-xs">
          Version
        </p>
        <div className="space-y-2">
          <SettingRow
            description={
              currentVersion ? `Current version: ${currentVersion}` : undefined
            }
            title="Backstage"
          >
            <div className="flex items-center gap-2">
              {available && !downloading && (
                <span className="rounded-full bg-primary/10 px-2 py-0.5 font-medium text-primary text-xs">
                  v{available.version} available
                </span>
              )}
              <Button
                disabled={checking || downloading}
                onClick={() => {
                  sounds.click();
                  handleCheckNow();
                }}
                size="sm"
                variant="ghost"
              >
                <RefreshCw
                  className={`mr-2 size-4 ${checking ? "animate-spin" : ""}`}
                />
                {checking ? "Checking…" : "Check for updates"}
              </Button>
            </div>
          </SettingRow>
          {available && (
            <div className="rounded-lg bg-muted/50 p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-0.5">
                  <p className="font-medium text-sm">
                    Version {available.version} is available
                  </p>
                  {available.date && (
                    <p className="text-muted-foreground text-xs">
                      Released{" "}
                      {new Date(available.date).toLocaleDateString(undefined, {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </p>
                  )}
                </div>
                <Button
                  disabled={downloading}
                  onClick={() => {
                    sounds.download();
                    handleInstall();
                  }}
                  size="sm"
                >
                  <Download className="mr-2 size-4" />
                  {downloading ? "Installing…" : "Update now"}
                </Button>
              </div>
              {available.body && <ReleaseNotes body={available.body} />}
              {downloading && (
                <div className="mt-3 space-y-1">
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-primary/20">
                    <div
                      className="h-full bg-primary transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <p className="text-muted-foreground text-xs">{progress}%</p>
                </div>
              )}
            </div>
          )}
          {manualUpdate && (
            <div className="rounded-lg bg-muted/50 p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm">
                      Version {manualUpdate.version} is available
                    </p>
                    {manualUpdate.prerelease && (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 font-medium text-primary text-xs">
                        Beta
                      </span>
                    )}
                  </div>
                  {manualUpdate.date && (
                    <p className="text-muted-foreground text-xs">
                      Released{" "}
                      {new Date(manualUpdate.date).toLocaleDateString(
                        undefined,
                        { year: "numeric", month: "long", day: "numeric" }
                      )}
                    </p>
                  )}
                </div>
                <Button
                  onClick={() => {
                    sounds.click();
                    openUrl(manualUpdate.url);
                  }}
                  size="sm"
                  variant="outline"
                >
                  <ExternalLink className="mr-2 size-4" />
                  View release
                </Button>
              </div>
              {manualUpdate.body && <ReleaseNotes body={manualUpdate.body} />}
            </div>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <p className="pl-2 font-medium text-muted-foreground text-xs">
          Preferences
        </p>
        <div className="space-y-2">
          <SettingRow
            description="Automatically check for updates when the app starts"
            title="Check for updates automatically"
          >
            <Switch
              checked={autoCheckForUpdates}
              onCheckedChange={(v) => {
                v ? sounds.switchOn() : sounds.switchOff();
                setAutoCheckForUpdates(v);
              }}
            />
          </SettingRow>
          <SettingRow
            description="Get early beta releases. These are pre-release builds and may be unstable."
            title="Receive beta updates"
          >
            <Switch
              checked={betaUpdatesEnabled}
              onCheckedChange={handleBetaToggle}
            />
          </SettingRow>
        </div>
      </div>
    </div>
  );
}

async function addDirToZip(
  zip: JSZip,
  dirPath: string,
  zipPrefix: string
): Promise<void> {
  const entries = await readDir(dirPath);
  for (const entry of entries) {
    if (!entry.name) continue;
    const fullPath = await join(dirPath, entry.name);
    const zipPath = `${zipPrefix}/${entry.name}`;
    if (entry.isDirectory) {
      await addDirToZip(zip, fullPath, zipPath);
    } else {
      // Pass Promise — JSZip resolves lazily during generateAsync so only
      // one file is in memory at a time instead of all files upfront.
      zip.file(zipPath, readFile(fullPath));
    }
  }
}

const DEFAULT_MCP_PORT = 37_842;

function McpServerSettings() {
  const { mcpPort, setMcpPort } = useAppSettingsStore();
  const [bridgeRunning, setBridgeRunning] = useState<boolean | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    const poll = async () => {
      try {
        const res = await fetch(`http://localhost:${mcpPort}/api/tools`, {
          signal: controller.signal,
        });
        setBridgeRunning(res.ok);
      } catch (err) {
        if ((err as Error)?.name === "AbortError") return;
        setBridgeRunning(false);
      }
    };

    poll();
    const id = setInterval(poll, 5000);

    return () => {
      controller.abort();
      clearInterval(id);
    };
  }, [mcpPort]);

  const claudeConfig = JSON.stringify(
    {
      mcpServers: {
        backstage: {
          command: "node",
          args: ["/path/to/backstage-mcp/dist/index.js"],
          env: { BACKSTAGE_API_URL: `http://localhost:${mcpPort}` },
        },
      },
    },
    null,
    2
  );

  const handleCopy = async () => {
    await navigator.clipboard.writeText(claudeConfig);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePortChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const port = Number.parseInt(e.target.value, 10);
    if (!Number.isNaN(port) && port >= 1025 && port <= 65_534) {
      setMcpPort(port);
    }
  };

  return (
    <div className="space-y-4">
      <div className="mb-3 flex items-center justify-between pr-2 pl-2">
        <p className="font-medium text-muted-foreground text-xs">MCP Server</p>
        <Badge variant="destructive">Experimental</Badge>
      </div>
      <div className="space-y-2">
        <SettingRow
          description={
            bridgeRunning === null
              ? "Checking status..."
              : bridgeRunning
                ? "Running"
                : "Stopped"
          }
          title={
            <span className="flex items-center gap-2">
              MCP Bridge
              <span
                aria-label={
                  bridgeRunning === null
                    ? "Checking"
                    : bridgeRunning
                      ? "Running"
                      : "Stopped"
                }
                className={`inline-block size-2 rounded-full ${
                  bridgeRunning === null
                    ? "bg-muted-foreground"
                    : bridgeRunning
                      ? "bg-green-500"
                      : "bg-red-500"
                }`}
                role="status"
              />
            </span>
          }
        >
          <div className="flex items-center gap-2">
            <label
              className="text-muted-foreground text-xs"
              htmlFor="mcp-port-input"
            >
              Port
            </label>
            <Input
              className="w-24"
              id="mcp-port-input"
              max={65_534}
              min={1025}
              onChange={handlePortChange}
              type="number"
              value={mcpPort}
            />
          </div>
        </SettingRow>
        <p className="pl-4 text-muted-foreground text-xs">
          Port changes require app restart
        </p>
      </div>
      <div className="space-y-2">
        <p className="pl-2 font-medium text-muted-foreground text-xs">
          Claude Desktop config
        </p>
        <div className="relative rounded-lg bg-muted/50">
          <pre className="overflow-x-auto px-4 py-3 font-mono text-xs">
            {claudeConfig}
          </pre>
          <button
            aria-label="Copy config to clipboard"
            className="absolute top-2 right-2 flex items-center gap-1 rounded-md px-2 py-1 text-muted-foreground text-xs transition-colors hover:bg-muted hover:text-foreground"
            onClick={() => {
              sounds.click();
              handleCopy();
            }}
            type="button"
          >
            {copied ? (
              <Check className="size-3.5" />
            ) : (
              <Copy className="size-3.5" />
            )}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </div>
    </div>
  );
}

// Each agent speaks ACP differently. Claude Code and Codex have no native ACP
// mode — they're driven through the Zed adapter packages run via npx. Gemini
// CLI and Cursor expose ACP natively (a flag / a subcommand). npx-based entries
// auto-install the adapter on first run.
const AGENT_PRESETS: Pick<AcpAgent, "name" | "command" | "args" | "envVars">[] =
  [
    {
      name: "Claude Code",
      command: "npx",
      args: ["-y", "@zed-industries/claude-code-acp"],
      envVars: [],
    },
    {
      name: "Gemini CLI",
      command: "gemini",
      args: ["--experimental-acp"],
      envVars: [],
    },
    {
      name: "OpenAI Codex",
      command: "npx",
      args: ["-y", "@zed-industries/codex-acp"],
      envVars: [],
    },
    {
      name: "Cursor",
      command: "cursor-agent",
      args: ["acp"],
      envVars: [],
    },
  ];

function serializeEnvVars(vars: AcpAgentEnvVar[]): string {
  return vars.map((v) => `${v.key}=${v.value}`).join("\n");
}

function parseEnvVars(raw: string): AcpAgentEnvVar[] {
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.includes("="))
    .map((line) => {
      const eqIdx = line.indexOf("=");
      return { key: line.slice(0, eqIdx).trim(), value: line.slice(eqIdx + 1) };
    });
}

function AgentSettings() {
  const { acpAgents, acpTextGenAgentId, setAcpAgents, setAcpTextGenAgentId } =
    useAppSettingsStore();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<AcpAgent | null>(null);
  const [presetChosen, setPresetChosen] = useState(false);
  const [formName, setFormName] = useState("");
  const [formCommand, setFormCommand] = useState("");
  const [formArgs, setFormArgs] = useState("");
  const [formEnvVars, setFormEnvVars] = useState("");

  const resetForm = useCallback(() => {
    setDialogOpen(false);
    setEditingAgent(null);
    setPresetChosen(false);
    setFormName("");
    setFormCommand("");
    setFormArgs("");
    setFormEnvVars("");
  }, []);

  const openAddDialog = useCallback(() => {
    setEditingAgent(null);
    setPresetChosen(false);
    setFormName("");
    setFormCommand("");
    setFormArgs("");
    setFormEnvVars("");
    setDialogOpen(true);
  }, []);

  const handleEdit = useCallback((agent: AcpAgent) => {
    setEditingAgent(agent);
    setFormName(agent.name);
    setFormCommand(agent.command);
    setFormArgs(agent.args.join(" "));
    setFormEnvVars(serializeEnvVars(agent.envVars));
    setDialogOpen(true);
  }, []);

  const handleSave = useCallback(async () => {
    if (!(formName.trim() && formCommand.trim())) {
      sileo.error({ title: "Name and command are required" });
      return;
    }
    const envVars = parseEnvVars(formEnvVars);
    const args = formArgs.trim() ? formArgs.trim().split(/\s+/) : [];

    let updated: AcpAgent[];
    if (editingAgent) {
      updated = acpAgents.map((a) =>
        a.id === editingAgent.id
          ? {
              ...a,
              name: formName.trim(),
              command: formCommand.trim(),
              args,
              envVars,
            }
          : a
      );
    } else {
      const newAgent: AcpAgent = {
        id: crypto.randomUUID(),
        name: formName.trim(),
        command: formCommand.trim(),
        args,
        envVars,
      };
      updated = [...acpAgents, newAgent];
    }

    await setAcpAgents(updated);
    sileo.success({ title: editingAgent ? "Agent updated" : "Agent added" });
    resetForm();
  }, [
    formName,
    formCommand,
    formArgs,
    formEnvVars,
    editingAgent,
    acpAgents,
    setAcpAgents,
    resetForm,
  ]);

  const handleDelete = useCallback(
    async (id: string) => {
      await setAcpAgents(acpAgents.filter((a) => a.id !== id));
      if (acpTextGenAgentId === id) {
        await setAcpTextGenAgentId(null);
      }
      sileo.success({ title: "Agent removed" });
    },
    [acpAgents, acpTextGenAgentId, setAcpAgents, setAcpTextGenAgentId]
  );

  const applyPreset = useCallback((preset: (typeof AGENT_PRESETS)[0]) => {
    setFormName(preset.name);
    setFormCommand(preset.command);
    setFormArgs(preset.args.join(" "));
    setFormEnvVars(serializeEnvVars(preset.envVars));
  }, []);

  return (
    <div className="space-y-4">
      <div className="mb-3 flex items-center justify-between pr-2 pl-2">
        <p className="font-medium text-muted-foreground text-xs">Agents</p>
        <Badge variant="destructive">Experimental</Badge>
      </div>

      <Dialog
        onOpenChange={(open) => {
          open ? sounds.dialogOpen() : sounds.dialogClose();
          setDialogOpen(open);
        }}
        open={dialogOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingAgent ? "Edit agent" : "Add agent"}
            </DialogTitle>
          </DialogHeader>

          {editingAgent || presetChosen ? (
            <div className="space-y-3">
              <Input
                className="h-14"
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Name"
                value={formName}
              />
              <Input
                className="h-14"
                onChange={(e) => setFormCommand(e.target.value)}
                placeholder="Command (e.g. claude)"
                value={formCommand}
              />
              <Input
                className="h-14"
                onChange={(e) => setFormArgs(e.target.value)}
                placeholder="Arguments, space-separated (e.g. --acp)"
                value={formArgs}
              />
              <textarea
                className="w-full resize-none rounded-3xl border border-transparent bg-input/50 px-3 py-3 font-mono text-sm placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
                onChange={(e) => setFormEnvVars(e.target.value)}
                placeholder={
                  "Environment variables, one per line\nANTHROPIC_API_KEY=sk-ant-…"
                }
                rows={3}
                value={formEnvVars}
              />
            </div>
          ) : (
            <Select
              onValueChange={(v) => {
                if (v !== "custom") {
                  const preset = AGENT_PRESETS.find((p) => p.name === v);
                  if (preset) applyPreset(preset);
                }
                setPresetChosen(true);
              }}
              value=""
            >
              <SelectTrigger className="w-full" size="lg">
                <SelectValue placeholder="Choose a preset or start from scratch…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="custom">Custom</SelectItem>
                {AGENT_PRESETS.map((p) => (
                  <SelectItem key={p.name} value={p.name}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <DialogFooter>
            <Button
              onClick={() => {
                sounds.click();
                resetForm();
              }}
              size="sm"
              variant="ghost"
            >
              Cancel
            </Button>
            {(editingAgent || presetChosen) && (
              <Button
                onClick={() => {
                  sounds.success();
                  handleSave();
                }}
                size="sm"
              >
                Save
              </Button>
            )}
          </DialogFooter>
        </DialogContent>

        <Frame>
          <FrameHeader className="px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="flex-1 pr-2">
                <p className="font-medium text-sm">Active agent</p>
                <p className="mt-0.5 text-muted-foreground text-xs leading-snug">
                  Used for auto-rename and other text tasks
                </p>
              </div>
              <Select
                onValueChange={(v) =>
                  setAcpTextGenAgentId(v === "none" ? null : v)
                }
                value={acpTextGenAgentId ?? "none"}
              >
                <SelectTrigger
                  className="w-44 border-none bg-transparent shadow-none focus:bg-transparent dark:bg-transparent"
                  size="sm"
                >
                  <SelectValue>
                    {acpTextGenAgentId === null
                      ? "Gemini (default)"
                      : (acpAgents.find((a) => a.id === acpTextGenAgentId)
                          ?.name ?? "Gemini (default)")}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Gemini (default)</SelectItem>
                  {acpAgents.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                onClick={() => {
                  sounds.click();
                  openAddDialog();
                }}
                size="sm"
              >
                + Add agent
              </Button>
            </div>
          </FrameHeader>
          {acpAgents.length === 0 && (
            <FramePanel className="px-4 py-3">
              <p className="text-muted-foreground text-xs">
                No agents configured yet.
              </p>
            </FramePanel>
          )}
          {acpAgents.map((agent) => (
            <FramePanel
              className="flex items-center justify-between px-4 py-3"
              key={agent.id}
            >
              <div className="min-w-0">
                <p className="font-medium text-sm">{agent.name}</p>
                <p className="truncate text-muted-foreground text-xs">
                  {agent.command} {agent.args.join(" ")}
                </p>
              </div>
              <div className="ml-2 flex shrink-0 items-center gap-1">
                <Button
                  onClick={() => {
                    sounds.click();
                    handleEdit(agent);
                  }}
                  size="icon-sm"
                  variant="ghost"
                >
                  <Pencil className="size-4" />
                </Button>
                <Button
                  onClick={() => {
                    sounds.delete_();
                    handleDelete(agent.id);
                  }}
                  size="icon-sm"
                  variant="ghost"
                >
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </div>
            </FramePanel>
          ))}
        </Frame>
      </Dialog>
    </div>
  );
}
