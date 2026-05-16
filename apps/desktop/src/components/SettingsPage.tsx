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
  mkdir,
  readDir,
  readFile,
  writeFile,
} from "@tauri-apps/plugin-fs";
import { openUrl } from "@tauri-apps/plugin-opener";
import { relaunch } from "@tauri-apps/plugin-process";
import JSZip from "jszip";
import {
  ArrowLeft,
  Check,
  Download,
  ExternalLink,
  Monitor,
  Moon,
  RefreshCw,
  Sparkles,
  Sun,
  Trash2,
  Upload,
  Wand2,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { sileo } from "sileo";
import { Button } from "@/components/ui/button";
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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  checkForUpdate,
  downloadAndInstall,
  useUpdateStore,
} from "@/hooks/use-app-updater";
import { closeDb, getDb } from "@/lib/db";
import {
  getGeminiApiKey,
  removeGeminiApiKey,
  setGeminiApiKey,
} from "@/lib/gemini-store";
import { getHfToken, removeHfToken, setHfToken } from "@/lib/hf-store";
import { POLAR_CONFIG } from "@/lib/polar-config";
import {
  getYoutubeApiKey,
  removeYoutubeApiKey,
  setYoutubeApiKey,
} from "@/lib/youtube-store";
import {
  type AcpAgent,
  type AcpAgentEnvVar,
  type BgRemovalProvider,
  type BgRemovalQuality,
  useAppSettingsStore,
} from "@/stores/use-app-settings-store";
import { useLicenseStore } from "@/stores/use-license-store";

interface SettingsPageProps {
  onClose: () => void;
}

const TRIGGER_CLASS =
  "flex-none h-auto justify-start border-none px-3 py-2 data-[state=active]:bg-background/70 data-[state=active]:shadow-none";

export function SettingsPage({ onClose }: SettingsPageProps) {
  return (
    <div className="mx-1 flex flex-1">
      <Tabs
        className="flex flex-1"
        defaultValue="general"
        orientation="vertical"
      >
        {/* Left sidebar — sits in muted bg, flush with outer edge */}
        <div className="flex w-52 flex-col">
          <TabsList className="flex flex-1 flex-col items-stretch justify-start gap-1 rounded-none border-none bg-transparent p-4">
            <TabsTrigger className={TRIGGER_CLASS} value="general">
              General
            </TabsTrigger>
            <TabsTrigger className={TRIGGER_CLASS} value="ai">
              AI
            </TabsTrigger>
            <TabsTrigger className={TRIGGER_CLASS} value="explore">
              Explore
            </TabsTrigger>
            <TabsTrigger className={TRIGGER_CLASS} value="storage">
              Storage
            </TabsTrigger>
            <TabsTrigger className={TRIGGER_CLASS} value="updates">
              Updates
            </TabsTrigger>
            <TabsTrigger className={TRIGGER_CLASS} value="privacy">
              Privacy
            </TabsTrigger>
            <TabsTrigger className={TRIGGER_CLASS} value="data-transfer">
              Data Transfer
            </TabsTrigger>
          </TabsList>
          <div className="p-4 pt-0">
            <Button
              onClick={onClose}
              size="icon-sm"
              type="button"
              variant="ghost"
            >
              <ArrowLeft className="size-4" />
            </Button>
          </div>
        </div>

        {/* Content card — border lives here, flush to bottom like gallery */}
        <div className="flex-1 overflow-auto rounded-xl border-2 border-border bg-background p-6">
          <div className="max-w-2xl">
            <TabsContent className="mt-0" value="general">
              <GeneralSettings />
            </TabsContent>
            <TabsContent className="mt-0" value="ai">
              <AiSettings />
            </TabsContent>
            <TabsContent className="mt-0" value="explore">
              <ExploreSettings />
            </TabsContent>
            <TabsContent className="mt-0" value="storage">
              <StorageSettings />
            </TabsContent>
            <TabsContent className="mt-0" value="updates">
              <UpdateSettings />
            </TabsContent>
            <TabsContent className="mt-0" value="privacy">
              <PrivacySettings />
            </TabsContent>
            <TabsContent className="mt-0" value="data-transfer">
              <DataTransferSettings />
            </TabsContent>
          </div>
        </div>
      </Tabs>
    </div>
  );
}

interface SettingRowProps {
  title: string;
  description?: React.ReactNode;
  children: React.ReactNode;
}

function SettingRow({ title, description, children }: SettingRowProps) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between rounded-lg bg-muted/50 p-4">
        <p className="font-medium">{title}</p>
        <div className="flex items-center gap-2">{children}</div>
      </div>
      {description && (
        <p className="pl-2 text-muted-foreground text-xs leading-snug">
          {description}
        </p>
      )}
    </div>
  );
}

function GeminiKeySection() {
  const [apiKey, setApiKey] = useState("");
  const [hasKey, setHasKey] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    getGeminiApiKey()
      .then((key) => {
        setHasKey(!!key);
        setApiKey("");
      })
      .finally(() => setIsLoading(false));
  }, []);

  const handleSave = useCallback(async () => {
    if (!apiKey.trim()) {
      sileo.error({ title: "Please enter an API key" });
      return;
    }
    try {
      await setGeminiApiKey(apiKey.trim());
      setHasKey(true);
      setApiKey("");
      sileo.success({ title: "API key saved securely" });
    } catch {
      sileo.error({ title: "Failed to save API key" });
    }
  }, [apiKey]);

  const handleRemove = useCallback(async () => {
    try {
      await removeGeminiApiKey();
      setHasKey(false);
      sileo.success({ title: "API key removed" });
    } catch {
      sileo.error({ title: "Failed to remove API key" });
    }
  }, []);

  if (isLoading) {
    return (
      <div className="py-4 text-center text-muted-foreground text-sm">
        Loading…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="mb-3 pl-2 font-medium text-muted-foreground text-xs">
        API Keys
      </p>
      <SettingRow
        description={
          <>
            Required for AI image generation.{" "}
            <button
              className="inline-flex items-center gap-1 hover:text-foreground hover:underline"
              onClick={() => openUrl("https://aistudio.google.com/apikey")}
              type="button"
            >
              <ExternalLink className="size-3" />
              Get your key from Google AI Studio
            </button>
          </>
        }
        title="Gemini"
      >
        {hasKey ? (
          <Button onClick={handleRemove} size="sm" variant="destructive">
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
                onClick={handleSave}
                size="icon"
                variant="ghost"
              >
                <Check className="size-4" />
              </Button>
            )}
          </div>
        )}
      </SettingRow>
    </div>
  );
}

function ExploreSettings() {
  const [youtubeKey, setYoutubeKey] = useState("");
  const [hasYoutubeKey, setHasYoutubeKey] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    getYoutubeApiKey()
      .then((key) => {
        setHasYoutubeKey(!!key);
        setYoutubeKey("");
      })
      .finally(() => setIsLoading(false));
  }, []);

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
      <h2 className="pl-2 font-semibold text-lg">Explore</h2>
      <div className="space-y-4">
        <p className="mb-3 pl-2 font-medium text-muted-foreground text-xs">
          API Keys
        </p>
        <SettingRow
          description={
            <>
              Required for the Explore page.{" "}
              <button
                className="inline-flex items-center gap-1 hover:text-foreground hover:underline"
                onClick={() =>
                  openUrl(
                    "https://console.cloud.google.com/apis/library/youtube.googleapis.com"
                  )
                }
                type="button"
              >
                <ExternalLink className="size-3" />
                Enable YouTube Data API v3 in Google Cloud Console
              </button>
            </>
          }
          title="YouTube"
        >
          {hasYoutubeKey ? (
            <Button onClick={handleRemove} size="sm" variant="destructive">
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
                  onClick={handleSave}
                  size="icon"
                  variant="ghost"
                >
                  <Check className="size-4" />
                </Button>
              )}
            </div>
          )}
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
      <BillingSettings />
    </div>
  );
}

function AiSettings() {
  return (
    <div className="space-y-6">
      <h2 className="pl-2 font-semibold text-lg">AI</h2>
      <GeminiKeySection />
      <ProcessingSettings />
      <AgentSettings />
    </div>
  );
}

function AppearanceSettings() {
  const {
    showDecemberSnow,
    setShowDecemberSnow,
    theme,
    setTheme,
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
    } catch {
      sileo.error({ title: "Failed to update launch at startup" });
    }
  }, []);

  return (
    <div className="space-y-4">
      <p className="mb-3 pl-2 font-medium text-muted-foreground text-xs">
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
      <SettingRow
        description="Reopen your last open projects when launching the app."
        title="Restore tabs on startup"
      >
        <Switch checked={persistTabs} onCheckedChange={setPersistTabs} />
      </SettingRow>
      <SettingRow
        description="Save and restore window position and size between sessions."
        title="Remember window position & size"
      >
        <Switch
          checked={rememberWindowBounds}
          onCheckedChange={setRememberWindowBounds}
        />
      </SettingRow>
      <SettingRow
        description="Open Backstage automatically when you log in to your computer."
        title="Launch at startup"
      >
        <Switch
          checked={launchAtStartup ?? false}
          disabled={launchAtStartup === null}
          onCheckedChange={handleLaunchAtStartup}
        />
      </SettingRow>
      <SettingRow
        description="Show a festive snowfall effect in the title bar during December."
        title="December Snowfall"
      >
        <Switch
          checked={showDecemberSnow}
          onCheckedChange={setShowDecemberSnow}
        />
      </SettingRow>
    </div>
  );
}

const BG_QUALITY_OPTIONS: {
  value: BgRemovalQuality;
  label: string;
  description: string;
  detail: string;
  icon: React.ReactNode;
}[] = [
  {
    value: "fast",
    label: "Fast",
    description: "Quickest processing, good for previews",
    detail: "~40 MB model · lowest resource usage",
    icon: <Zap className="size-5" />,
  },
  {
    value: "balanced",
    label: "Balanced",
    description: "Great results with reasonable speed",
    detail: "~80 MB model · recommended",
    icon: <Wand2 className="size-5" />,
  },
  {
    value: "best",
    label: "Best Quality",
    description: "Sharpest edges, highest accuracy",
    detail: "~160 MB model · slower, more memory",
    icon: <Sparkles className="size-5" />,
  },
];

const BG_PROVIDER_OPTIONS: {
  value: BgRemovalProvider;
  label: string;
  description: string;
}[] = [
  {
    value: "imgly",
    label: "ISNet (img.ly)",
    description: "Runs in-browser, no extra download needed",
  },
  {
    value: "briaai",
    label: "BRIA RMBG-1.4",
    description: "Higher accuracy · requires one-time ~176 MB model download",
  },
  {
    value: "briaai2",
    label: "BRIA RMBG-2.0",
    description:
      "Latest BRIA model · improved accuracy · requires one-time ~890 MB model download · non-commercial license",
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
    <SettingRow description={description} title={title}>
      {briaStatus?.exists ? (
        <Button
          disabled={isDownloading}
          onClick={onDownload}
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
          <Button disabled={isDownloading} onClick={onDownload} size="sm">
            <Download className="mr-2 size-4" />
            {isDownloading ? "Downloading…" : "Download Model"}
          </Button>
        </div>
      )}
    </SettingRow>
  );
}

function ProcessingSettings() {
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
        Processing
      </p>

      <div className="space-y-4">
        {/* Provider selector, hidden in commercial builds without BRIA */}
        {isBriaAvailable && (
          <div className="pt-2">
            <p className="mb-3 pl-2 font-medium text-muted-foreground text-xs">
              Background Removal Engine
            </p>
            <div className="flex flex-col gap-2">
              {BG_PROVIDER_OPTIONS.map((option) => {
                const isSelected = bgRemovalProvider === option.value;
                return (
                  <button
                    className={`flex items-center gap-4 rounded-lg border p-4 text-left transition-colors ${
                      isSelected
                        ? "border-primary bg-primary/5"
                        : "border-transparent bg-muted/50 hover:bg-muted"
                    }`}
                    key={option.value}
                    onClick={() => setBgRemovalProvider(option.value)}
                    type="button"
                  >
                    <div className="flex-1">
                      <span className="font-medium text-sm">
                        {option.label}
                      </span>
                      <p className="text-muted-foreground text-xs">
                        {option.description}
                      </p>
                    </div>
                    {isSelected && (
                      <Check className="size-4 shrink-0 text-primary" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* BRIA model download status */}
        {isBriaAvailable && bgRemovalProvider === "briaai" && (
          <BriaModelRow
            briaStatus={briaStatus}
            downloadPercent={downloadPercent}
            downloadProgress={downloadProgress}
            downloadSizeMb="176 MB"
            isDownloading={isDownloading}
            onDownload={handleDownload}
            title="BRIA RMBG-1.4 Model"
          />
        )}
        {isBriaAvailable && bgRemovalProvider === "briaai2" && (
          <>
            <SettingRow
              description={
                hfTokenSaved ? (
                  "Token saved · used for gated model downloads"
                ) : (
                  <>
                    RMBG-2.0 is gated. Agree to the license then enter your
                    access token.{" "}
                    <button
                      className="inline-flex items-center gap-1 hover:text-foreground hover:underline"
                      onClick={() =>
                        openUrl("https://huggingface.co/briaai/RMBG-2.0")
                      }
                      type="button"
                    >
                      <ExternalLink className="size-3" />
                      Agree &amp; get token
                    </button>
                  </>
                )
              }
              title="HuggingFace Access Token"
            >
              {hfTokenSaved ? (
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
                    <div className="size-2 rounded-full bg-green-500" />
                    Saved
                  </div>
                  <Button
                    onClick={async () => {
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
                    onClick={handleSaveHfToken}
                    size="sm"
                  >
                    Save
                  </Button>
                </div>
              )}
            </SettingRow>
            <BriaModelRow
              briaStatus={briaV2Status}
              downloadPercent={downloadPercentV2}
              downloadProgress={downloadProgressV2}
              downloadSizeMb="~890 MB"
              isDownloading={isDownloadingV2}
              onDownload={handleDownloadV2}
              title="BRIA RMBG-2.0 Model"
            />
          </>
        )}

        {/* Quality tiers are only applicable when using the imgly provider */}
        {bgRemovalProvider === "imgly" && (
          <div className="pt-2">
            <p className="mb-1 pl-2 font-medium text-muted-foreground text-xs">
              Background Removal Quality
            </p>
            <p className="mb-3 pl-2 text-muted-foreground text-xs">
              Higher quality uses a larger AI model downloaded on first use. The
              model is cached locally after that.
            </p>
            <div className="flex flex-col gap-2">
              {BG_QUALITY_OPTIONS.map((option) => {
                const isSelected = bgRemovalQuality === option.value;
                return (
                  <button
                    className={`flex items-center gap-4 rounded-lg border p-4 text-left transition-colors ${
                      isSelected
                        ? "border-primary bg-primary/5"
                        : "border-transparent bg-muted/50 hover:bg-muted"
                    }`}
                    key={option.value}
                    onClick={() => setBgRemovalQuality(option.value)}
                    type="button"
                  >
                    <div
                      className={`shrink-0 ${isSelected ? "text-primary" : "text-muted-foreground"}`}
                    >
                      {option.icon}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">
                          {option.label}
                        </span>
                        {option.value === "balanced" && (
                          <span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground text-xs">
                            Default
                          </span>
                        )}
                      </div>
                      <p className="text-muted-foreground text-sm">
                        {option.description}
                      </p>
                      <p className="mt-0.5 text-muted-foreground/70 text-xs">
                        {option.detail}
                      </p>
                    </div>
                    {isSelected && (
                      <Check className="size-4 shrink-0 text-primary" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Gemini Pre-processing */}
        <div className="pt-2">
          <p className="mb-3 pl-2 font-medium text-muted-foreground text-xs">
            Gemini Pre-processing
          </p>
          <SettingRow
            description="Use Gemini to fill the background with a solid color before running background removal for potentially cleaner subject cuts"
            title="Enable Pre-processing"
          >
            <Switch
              checked={bgRemovalGeminiEnabled}
              onCheckedChange={setBgRemovalGeminiEnabled}
            />
          </SettingRow>

          {bgRemovalGeminiEnabled && (
            <div className="mt-2 space-y-3">
              <SettingRow title="Gemini Model">
                <Select
                  onValueChange={(v) => v && setBgRemovalGeminiModel(v)}
                  value={bgRemovalGeminiModel}
                >
                  <SelectTrigger
                    className="w-56 border-none bg-transparent shadow-none focus:bg-transparent dark:bg-transparent"
                    size="sm"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {GEMINI_BG_MODELS.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </SettingRow>

              <SettingRow
                description="Color Gemini fills the background with before removal"
                title="Background Color"
              >
                <div className="flex items-center gap-3">
                  <div className="flex gap-1.5">
                    {["#00ff00", "#000000", "#808080", "#ffffff"].map((c) => (
                      <button
                        className="h-5 w-5 rounded border border-input transition-transform hover:scale-110"
                        key={c}
                        onClick={() => setBgRemovalGeminiColor(c)}
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
              </SettingRow>

              <SettingRow
                description="Pass Gemini output through the background remover for a transparent result"
                title="Auto-remove background"
              >
                <Switch
                  checked={bgRemovalGeminiAutoRemove}
                  onCheckedChange={setBgRemovalGeminiAutoRemove}
                />
              </SettingRow>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StorageSettings() {
  const [isPurging, setIsPurging] = useState(false);
  const [storageSize, setStorageSize] = useState<number | null>(null);

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

  const sizeLabel =
    storageSize === null
      ? "Calculating…"
      : storageSize === 0
        ? "No data stored"
        : formatBytes(storageSize);

  return (
    <div className="space-y-6">
      <h2 className="pl-2 font-semibold text-lg">Storage</h2>
      <div className="space-y-4">
        <SettingRow
          description={`${sizeLabel} · Remove all saved revision checkpoints to free up disk space.`}
          title="Revision History"
        >
          <Button
            disabled={isPurging}
            onClick={handlePurge}
            size="sm"
            variant="destructive"
          >
            <Trash2 className="mr-2 size-4" />
            {isPurging ? "Purging…" : "Purge All"}
          </Button>
        </SettingRow>
      </div>
    </div>
  );
}

function BillingSettings() {
  const { validatedData, clearLicense } = useLicenseStore();

  const handleManageLicense = useCallback(() => {
    openUrl(POLAR_CONFIG.customerPortalUrl);
  }, []);

  const handleDeactivate = useCallback(async () => {
    await clearLicense();
    sileo.success({ title: "License deactivated" });
  }, [clearLicense]);

  return (
    <div className="space-y-4">
      <p className="mb-3 pl-2 font-medium text-muted-foreground text-xs">
        Billing &amp; License
      </p>
      <SettingRow
        description={
          validatedData?.customerEmail
            ? `${validatedData.customerEmail} · To transfer to another device, deactivate here first and reactivate via the portal.`
            : "To transfer to another device, deactivate here first and reactivate via the portal."
        }
        title="Lifetime License"
      >
        <Button onClick={handleManageLicense} size="sm" variant="ghost">
          <ExternalLink className="mr-2 size-4" />
          Manage
        </Button>
        <Button onClick={handleDeactivate} size="sm" variant="destructive">
          Deactivate
        </Button>
      </SettingRow>
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

        <SettingRow
          description="Save recent searches in Gallery, Explore, and Trash. Up to 10 per page."
          title="Search History"
        >
          <Switch
            checked={saveSearchHistory}
            onCheckedChange={setSaveSearchHistory}
          />
        </SettingRow>
      </div>

      <div className="space-y-4">
        <p className="pl-2 font-medium text-muted-foreground text-xs">
          Analytics &amp; Telemetry
        </p>

        <SettingRow
          description="Helps us understand how you use the app so we can improve it. No personal data is collected."
          title="Product Analytics"
        >
          <Switch
            checked={analyticsEnabled}
            onCheckedChange={setAnalyticsEnabled}
          />
        </SettingRow>

        <SettingRow
          description="Sends app logs and error reports to help diagnose issues."
          title="Diagnostic Logging"
        >
          <Switch
            checked={loggingEnabled}
            onCheckedChange={setLoggingEnabled}
          />
        </SettingRow>

        <p className="pl-2 text-muted-foreground text-xs">
          Both are enabled by default. Changes take effect immediately.
        </p>
      </div>
    </div>
  );
}

function UpdateSettings() {
  const { autoCheckForUpdates, setAutoCheckForUpdates } = useAppSettingsStore();
  const { checking, downloading, progress, available } = useUpdateStore();
  const [currentVersion, setCurrentVersion] = useState<string | null>(null);

  useEffect(() => {
    getVersion()
      .then(setCurrentVersion)
      .catch(() => {});
  }, []);

  const handleCheckNow = useCallback(async () => {
    await checkForUpdate();
    if (!useUpdateStore.getState().available) {
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

  return (
    <div className="space-y-6">
      <h2 className="pl-2 font-semibold text-lg">Updates</h2>

      <div className="space-y-4">
        <p className="mb-3 pl-2 font-medium text-muted-foreground text-xs">
          Version
        </p>

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
              onClick={handleCheckNow}
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
          <div className="space-y-3">
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
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
                  onClick={handleInstall}
                  size="sm"
                >
                  <Download className="mr-2 size-4" />
                  {downloading ? "Installing…" : "Update now"}
                </Button>
              </div>

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
          </div>
        )}

        <div className="pt-2">
          <p className="mb-3 pl-2 font-medium text-muted-foreground text-xs">
            Preferences
          </p>
          <SettingRow
            description="Automatically check for updates when the app starts"
            title="Check for updates automatically"
          >
            <Switch
              checked={autoCheckForUpdates}
              onCheckedChange={setAutoCheckForUpdates}
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
      const bytes = await readFile(fullPath);
      zip.file(zipPath, bytes);
    }
  }
}

function DataTransferSettings() {
  const [exporting, setExporting] = useState(false);
  const [exportStatus, setExportStatus] = useState("");
  const [importing, setImporting] = useState(false);
  const [pendingZipPath, setPendingZipPath] = useState<string | null>(null);

  const handleExport = useCallback(async () => {
    setExporting(true);
    setExportStatus("Flushing database…");
    try {
      const db = await getDb();
      await db.execute("PRAGMA wal_checkpoint(TRUNCATE)");

      const appData = await appDataDir();
      const zip = new JSZip();

      setExportStatus("Adding database…");
      try {
        zip.file(
          "gallery.db",
          await readFile(await join(appData, "gallery.db"))
        );
      } catch {
        /* not yet created */
      }

      setExportStatus("Adding settings…");
      try {
        zip.file(
          "settings.json",
          await readFile(await join(appData, "settings.json"))
        );
      } catch {
        /* not yet created */
      }

      try {
        zip.file(
          "license.json",
          await readFile(await join(appData, "license.json"))
        );
      } catch {
        /* not yet created */
      }

      for (const dir of [
        "thumbnails",
        "trash",
        "revisions",
        "recovery",
      ] as const) {
        const dirPath = await join(appData, dir);
        if (await exists(dirPath)) {
          setExportStatus(`Adding ${dir}…`);
          await addDirToZip(zip, dirPath, dir);
        }
      }

      setExportStatus("Compressing…");
      const blob = await zip.generateAsync({
        type: "blob",
        compression: "DEFLATE",
        compressionOptions: { level: 3 },
      });
      const buffer = await blob.arrayBuffer();

      const savePath = await saveDialog({
        defaultPath: `backstage-backup-${new Date().toISOString().split("T")[0]}.zip`,
        filters: [{ name: "ZIP Archive", extensions: ["zip"] }],
      });
      if (!savePath) return;

      setExportStatus("Saving…");
      await writeFile(savePath, new Uint8Array(buffer));
      sileo.success({ title: "Full backup exported" });
    } catch (err) {
      sileo.error({ title: `Export failed: ${err}` });
    } finally {
      setExporting(false);
      setExportStatus("");
    }
  }, []);

  const handlePickImport = useCallback(async () => {
    const filePath = await openDialog({
      multiple: false,
      filters: [{ name: "ZIP Archive", extensions: ["zip"] }],
    });
    if (!filePath) return;
    setPendingZipPath(filePath as string);
  }, []);

  const handleCancelImport = useCallback(() => {
    setPendingZipPath(null);
  }, []);

  const handleConfirmImport = useCallback(async () => {
    if (!pendingZipPath) return;
    setPendingZipPath(null);
    setImporting(true);
    try {
      const bytes = await readFile(pendingZipPath);
      const zip = await JSZip.loadAsync(bytes);
      const appData = await appDataDir();

      await closeDb();

      const fileEntries = Object.entries(zip.files).filter(([, f]) => !f.dir);
      for (const [zipPath, zipFile] of fileEntries) {
        const slashIdx = zipPath.lastIndexOf("/");
        if (slashIdx > 0) {
          const dirPart = zipPath.substring(0, slashIdx);
          await mkdir(await join(appData, dirPart), { recursive: true }).catch(
            () => {}
          );
        }
        const content = await zipFile.async("uint8array");
        await writeFile(await join(appData, zipPath), content);
      }

      sileo.success({ title: "Backup restored — restarting…" });
      setTimeout(() => relaunch(), 1500);
    } catch (err) {
      sileo.error({ title: `Import failed: ${err}` });
      setImporting(false);
    }
  }, [pendingZipPath]);

  return (
    <div className="space-y-6">
      <h2 className="pl-2 font-semibold text-lg">Data Transfer</h2>
      <p className="pl-2 text-muted-foreground text-sm">
        Export everything — projects, images, settings — as a single ZIP. Import
        on another device to restore.
      </p>

      <div className="space-y-4">
        <SettingRow
          description="All projects, images, revision history, and settings."
          title="Export Full Backup"
        >
          <Button
            disabled={exporting}
            onClick={handleExport}
            size="sm"
            variant="outline"
          >
            <Download className="mr-2 size-4" />
            {exporting ? exportStatus || "Exporting…" : "Export"}
          </Button>
        </SettingRow>

        <SettingRow
          description="Restore from a previously exported backup ZIP."
          title="Import Backup"
        >
          <Button
            disabled={importing || !!pendingZipPath}
            onClick={handlePickImport}
            size="sm"
            variant="outline"
          >
            <Upload className="mr-2 size-4" />
            {importing ? "Restoring…" : "Import"}
          </Button>
        </SettingRow>

        {pendingZipPath && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4">
            <p className="mb-1 font-medium text-sm">
              Replace all current data?
            </p>
            <p className="mb-4 text-muted-foreground text-xs">
              This will overwrite all your projects and settings. The app will
              restart automatically. This cannot be undone.
            </p>
            <div className="flex gap-2">
              <Button
                onClick={handleConfirmImport}
                size="sm"
                variant="destructive"
              >
                Yes, restore backup
              </Button>
              <Button onClick={handleCancelImport} size="sm" variant="ghost">
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>

      <p className="pl-2 text-muted-foreground text-xs">
        Note: Gemini API key and HuggingFace token are stored in the OS keychain
        and are not included in the backup. Re-enter them after restoring.
        Launch at startup is a system-level setting and is not transferred.
      </p>
    </div>
  );
}

const AGENT_PRESETS: Pick<AcpAgent, "name" | "command" | "args" | "envVars">[] =
  [
    { name: "Claude Code", command: "claude", args: ["--acp"], envVars: [] },
    { name: "OpenAI Codex", command: "codex", args: ["--acp"], envVars: [] },
    { name: "Cursor", command: "cursor-agent", args: ["--acp"], envVars: [] },
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

  const [isAdding, setIsAdding] = useState(false);
  const [editingAgent, setEditingAgent] = useState<AcpAgent | null>(null);
  const [formName, setFormName] = useState("");
  const [formCommand, setFormCommand] = useState("");
  const [formArgs, setFormArgs] = useState("");
  const [formEnvVars, setFormEnvVars] = useState("");

  const resetForm = useCallback(() => {
    setIsAdding(false);
    setEditingAgent(null);
    setFormName("");
    setFormCommand("");
    setFormArgs("");
    setFormEnvVars("");
  }, []);

  const handleEdit = useCallback((agent: AcpAgent) => {
    setEditingAgent(agent);
    setIsAdding(true);
    setFormName(agent.name);
    setFormCommand(agent.command);
    setFormArgs(agent.args.join(" "));
    setFormEnvVars(serializeEnvVars(agent.envVars));
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
    <div className="space-y-6">
      <p className="mb-3 pl-2 font-medium text-muted-foreground text-xs">
        Agents
      </p>

      <div className="space-y-3">
        <p className="pl-2 font-medium text-muted-foreground text-xs uppercase tracking-wide">
          Text generation
        </p>
        <div className="rounded-lg bg-muted/50 p-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="font-medium">Active agent</p>
              <p className="text-muted-foreground text-sm">
                Used for auto-rename and other text tasks
              </p>
            </div>
            <Select
              onValueChange={(v) =>
                setAcpTextGenAgentId(v === "none" ? null : v)
              }
              value={acpTextGenAgentId ?? "none"}
            >
              <SelectTrigger className="w-44" size="sm">
                <SelectValue />
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
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <p className="pl-2 font-medium text-muted-foreground text-xs uppercase tracking-wide">
          Configured agents
        </p>

        {acpAgents.length === 0 && !isAdding && (
          <p className="pl-2 text-muted-foreground text-sm">
            No agents configured yet.
          </p>
        )}

        {acpAgents.map((agent) => (
          <div
            className="flex items-center justify-between rounded-lg bg-muted/50 px-4 py-3"
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
                onClick={() => handleEdit(agent)}
                size="icon-sm"
                variant="ghost"
              >
                <Wand2 className="size-4" />
              </Button>
              <Button
                onClick={() => handleDelete(agent.id)}
                size="icon-sm"
                variant="ghost"
              >
                <Trash2 className="size-4 text-destructive" />
              </Button>
            </div>
          </div>
        ))}

        {isAdding ? (
          <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-4">
            <p className="font-medium text-sm">
              {editingAgent ? "Edit agent" : "Add agent"}
            </p>

            {!editingAgent && (
              <div className="flex flex-wrap gap-2">
                {AGENT_PRESETS.map((p) => (
                  <Button
                    key={p.name}
                    onClick={() => applyPreset(p)}
                    size="sm"
                    variant="outline"
                  >
                    {p.name}
                  </Button>
                ))}
              </div>
            )}

            <div className="space-y-1.5">
              <label
                className="text-muted-foreground text-xs"
                htmlFor="agent-name"
              >
                Name
              </label>
              <Input
                id="agent-name"
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Claude Code"
                value={formName}
              />
            </div>

            <div className="space-y-1.5">
              <label
                className="text-muted-foreground text-xs"
                htmlFor="agent-command"
              >
                Command
              </label>
              <Input
                id="agent-command"
                onChange={(e) => setFormCommand(e.target.value)}
                placeholder="claude"
                value={formCommand}
              />
            </div>

            <div className="space-y-1.5">
              <label
                className="text-muted-foreground text-xs"
                htmlFor="agent-args"
              >
                Arguments{" "}
                <span className="text-muted-foreground/60">
                  (space-separated)
                </span>
              </label>
              <Input
                id="agent-args"
                onChange={(e) => setFormArgs(e.target.value)}
                placeholder="--acp"
                value={formArgs}
              />
            </div>

            <div className="space-y-1.5">
              <label
                className="text-muted-foreground text-xs"
                htmlFor="agent-env"
              >
                Environment variables{" "}
                <span className="text-muted-foreground/60">
                  (KEY=VALUE, one per line)
                </span>
              </label>
              <textarea
                className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 font-mono text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                id="agent-env"
                onChange={(e) => setFormEnvVars(e.target.value)}
                placeholder={
                  "ANTHROPIC_API_KEY=sk-ant-...\nCLAUDE_CODE_MAX_THINKING_TOKENS=5000"
                }
                rows={3}
                value={formEnvVars}
              />
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button onClick={resetForm} size="sm" variant="ghost">
                Cancel
              </Button>
              <Button onClick={handleSave} size="sm">
                Save
              </Button>
            </div>
          </div>
        ) : (
          <Button
            className="ml-2"
            onClick={() => setIsAdding(true)}
            size="sm"
            variant="outline"
          >
            + Add agent
          </Button>
        )}
      </div>
    </div>
  );
}
