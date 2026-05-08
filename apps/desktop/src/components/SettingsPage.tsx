import { getVersion } from "@tauri-apps/api/app";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { openUrl } from "@tauri-apps/plugin-opener";
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
  Wand2,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { TitleBar } from "@/components/TitleBar";
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
import {
  getGeminiApiKey,
  removeGeminiApiKey,
  setGeminiApiKey,
} from "@/lib/gemini-store";
import { POLAR_CONFIG } from "@/lib/polar-config";
import {
  type BgRemovalProvider,
  type BgRemovalQuality,
  useAppSettingsStore,
} from "@/stores/use-app-settings-store";
import { useLicenseStore } from "@/stores/use-license-store";

interface SettingsPageProps {
  onClose: () => void;
}

export function SettingsPage({ onClose }: SettingsPageProps) {
  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Header */}
      <TitleBar
        showIcon={false}
        title={
          <div className="flex items-center gap-3">
            <Button
              className="relative z-[110]"
              onClick={onClose}
              size="icon-sm"
              type="button"
              variant="ghost"
            >
              <ArrowLeft className="size-4" />
            </Button>
            <span className="font-medium text-sm">Settings</span>
          </div>
        }
      />

      {/* Content */}
      <div className="flex flex-1 overflow-hidden">
        <Tabs
          className="flex flex-1"
          defaultValue="api-key"
          orientation="vertical"
        >
          {/* Left sidebar tabs */}
          <TabsList className="flex h-full w-56 flex-col items-stretch justify-start gap-1 rounded-none border-none bg-transparent p-4">
            <TabsTrigger
              className="justify-start border-none px-3 py-2 data-[state=active]:bg-muted data-[state=active]:shadow-none"
              value="api-key"
            >
              API Key
            </TabsTrigger>
            <TabsTrigger
              className="justify-start border-none px-3 py-2 data-[state=active]:bg-muted data-[state=active]:shadow-none"
              value="appearance"
            >
              Appearance
            </TabsTrigger>
            <TabsTrigger
              className="justify-start border-none px-3 py-2 data-[state=active]:bg-muted data-[state=active]:shadow-none"
              value="processing"
            >
              Processing
            </TabsTrigger>
            <TabsTrigger
              className="justify-start border-none px-3 py-2 data-[state=active]:bg-muted data-[state=active]:shadow-none"
              value="billing"
            >
              Billing
            </TabsTrigger>
            <TabsTrigger
              className="justify-start border-none px-3 py-2 data-[state=active]:bg-muted data-[state=active]:shadow-none"
              value="storage"
            >
              Storage
            </TabsTrigger>
            <TabsTrigger
              className="justify-start border-none px-3 py-2 data-[state=active]:bg-muted data-[state=active]:shadow-none"
              value="updates"
            >
              Updates
            </TabsTrigger>
            <TabsTrigger
              className="justify-start border-none px-3 py-2 data-[state=active]:bg-muted data-[state=active]:shadow-none"
              value="privacy"
            >
              Privacy
            </TabsTrigger>
          </TabsList>

          {/* Content area */}
          <div className="flex-1 overflow-auto p-6">
            <div className="max-w-2xl">
              <TabsContent className="mt-0" value="api-key">
                <ApiKeySettings />
              </TabsContent>

              <TabsContent className="mt-0" value="appearance">
                <AppearanceSettings />
              </TabsContent>

              <TabsContent className="mt-0" value="processing">
                <ProcessingSettings />
              </TabsContent>

              <TabsContent className="mt-0" value="billing">
                <BillingSettings />
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
            </div>
          </div>
        </Tabs>
      </div>
    </div>
  );
}

interface SettingRowProps {
  title: string;
  description?: string;
  children: React.ReactNode;
}

function SettingRow({ title, description, children }: SettingRowProps) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-muted/50 p-4">
      <div className="space-y-0.5">
        <p className="font-medium">{title}</p>
        {description && (
          <p className="text-muted-foreground text-sm leading-tight">
            {description}
          </p>
        )}
      </div>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  );
}

function ApiKeySettings() {
  const [apiKey, setApiKey] = useState("");
  const [hasKey, setHasKey] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    getGeminiApiKey()
      .then((key) => {
        setHasKey(!!key);
        setApiKey("");
      })
      .finally(() => setIsLoading(false));
  }, []);

  const handleSave = useCallback(async () => {
    if (!apiKey.trim()) {
      toast.error("Please enter an API key");
      return;
    }
    try {
      await setGeminiApiKey(apiKey.trim());
      setHasKey(true);
      setApiKey("");
      toast.success("API key saved securely");
    } catch (error) {
      toast.error("Failed to save API key");
    }
  }, [apiKey]);

  const handleRemove = useCallback(async () => {
    try {
      await removeGeminiApiKey();
      setHasKey(false);
      toast.success("API key removed");
    } catch (error) {
      toast.error("Failed to remove API key");
    }
  }, []);

  if (isLoading) {
    return (
      <div className="py-8 text-center text-muted-foreground">Loading...</div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="pl-2 font-semibold text-lg">Gemini API Key</h2>

      <div className="space-y-4">
        {hasKey ? (
          <SettingRow title="API Key">
            <Button onClick={handleRemove} size="sm" variant="destructive">
              <Trash2 className="mr-2 size-4" />
              Remove
            </Button>
          </SettingRow>
        ) : (
          <SettingRow title="API Key">
            <div className="flex items-center gap-2">
              <Input
                className="w-64"
                id="api-key"
                onChange={(e) => setApiKey(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleSave();
                  }
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
          </SettingRow>
        )}

        <p className="-mt-2 pl-2 text-muted-foreground text-xs">
          Required for AI image generation features.{" "}
          <button
            className="inline-flex items-center gap-1 hover:text-foreground hover:underline"
            onClick={() => openUrl("https://aistudio.google.com/apikey")}
            type="button"
          >
            <ExternalLink className="size-3" />
            Get your API key from Google AI Studio
          </button>
        </p>
      </div>
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
  } = useAppSettingsStore();

  return (
    <div className="space-y-6">
      <h2 className="pl-2 font-semibold text-lg">Appearance</h2>

      <div className="space-y-4">
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

        <div className="pt-4">
          <p className="mb-4 pl-2 font-medium text-muted-foreground text-xs">
            Miscellaneous
          </p>
          <SettingRow
            description="Reopen your last open projects when launching the app."
            title="Restore tabs on startup"
          >
            <Switch checked={persistTabs} onCheckedChange={setPersistTabs} />
          </SettingRow>
          <SettingRow title="December Snowfall">
            <Switch
              checked={showDecemberSnow}
              onCheckedChange={setShowDecemberSnow}
            />
          </SettingRow>
        </div>

        <p className="-mt-2 pl-2 text-muted-foreground text-xs">
          Show a festive snowfall effect in the title bar during December.
        </p>
      </div>
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
  briaStatus: BriaModelStatus | null;
  isDownloading: boolean;
  downloadProgress: { downloaded: number; total: number } | null;
  downloadPercent: number | null;
  onDownload: () => void;
}

function BriaModelRow({
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
      : "Model not found. Download it once (~176 MB) to use BRIA background removal.";
  }

  return (
    <SettingRow description={description} title="BRIA RMBG-1.4 Model">
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
  const [briaStatus, setBriaStatus] = useState<BriaModelStatus | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<{
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

  useEffect(() => {
    loadBriaStatus();
  }, [loadBriaStatus]);

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

  const handleDownload = useCallback(async () => {
    setIsDownloading(true);
    setDownloadProgress(null);
    try {
      await invoke("download_bria_model");
      await loadBriaStatus();
      toast.success("BRIA model downloaded successfully");
    } catch (error) {
      toast.error(`Download failed: ${error}`);
    } finally {
      setIsDownloading(false);
      setDownloadProgress(null);
    }
  }, [loadBriaStatus]);

  const downloadPercent =
    downloadProgress && downloadProgress.total > 0
      ? Math.round((downloadProgress.downloaded / downloadProgress.total) * 100)
      : null;

  return (
    <div className="space-y-6">
      <h2 className="pl-2 font-semibold text-lg">Processing</h2>

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
            isDownloading={isDownloading}
            onDownload={handleDownload}
          />
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
      toast.success("All revision history deleted");
    } catch {
      toast.error("Failed to purge revision history");
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
    <div className="space-y-3 pt-4">
      <p className="pl-2 font-medium text-muted-foreground text-xs">Storage</p>
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
  );
}

function BillingSettings() {
  const { validatedData, clearLicense } = useLicenseStore();

  const handleManageLicense = useCallback(() => {
    openUrl(POLAR_CONFIG.customerPortalUrl);
  }, []);

  const handleDeactivate = useCallback(async () => {
    await clearLicense();
    toast.success("License deactivated");
  }, [clearLicense]);

  return (
    <div className="space-y-6">
      <h2 className="pl-2 font-semibold text-lg">Billing & License</h2>

      <div className="space-y-4">
        <SettingRow
          description={validatedData?.customerEmail}
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

        <p className="-mt-2 pl-2 text-muted-foreground text-xs">
          To transfer your license to another device, deactivate it here first.
          You can reactivate it anytime by logging into the portal with your
          email.
        </p>
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
  } = useAppSettingsStore();

  return (
    <div className="space-y-6">
      <h2 className="pl-2 font-semibold text-lg">Privacy</h2>

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
      toast.success("You're up to date", {
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
