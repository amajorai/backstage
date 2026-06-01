import { load } from "@tauri-apps/plugin-store";
import { create } from "zustand";
import { logger } from "@/lib/logger";

const SETTINGS_STORE_NAME = "settings.json";
const SEASONAL_EFFECTS_ENABLED_FIELD = "seasonal_effects_enabled";
const THEME_FIELD = "app_theme";
const BG_REMOVAL_QUALITY_FIELD = "bg_removal_quality";
const BG_REMOVAL_PROVIDER_FIELD = "bg_removal_provider";
const BG_REMOVAL_GEMINI_ENABLED_FIELD = "bg_removal_gemini_enabled";
const BG_REMOVAL_GEMINI_MODEL_FIELD = "bg_removal_gemini_model";
const BG_REMOVAL_GEMINI_COLOR_FIELD = "bg_removal_gemini_color";
const BG_REMOVAL_GEMINI_AUTO_REMOVE_FIELD = "bg_removal_gemini_auto_remove";
const AUTO_CHECK_FOR_UPDATES_FIELD = "auto_check_for_updates";
const BETA_UPDATES_ENABLED_FIELD = "beta_updates_enabled";
const PERSIST_TABS_FIELD = "persist_tabs";
const ANALYTICS_ENABLED_FIELD = "analytics_enabled";
const LOGGING_ENABLED_FIELD = "logging_enabled";
const SEMANTIC_SEARCH_ENABLED_FIELD = "semantic_search_enabled";
const EMBEDDING_IDLE_TIMEOUT_FIELD = "embedding_idle_timeout_secs";
const ACP_AGENTS_FIELD = "acp_agents";
const ACP_TEXT_GEN_AGENT_ID_FIELD = "acp_text_gen_agent_id";
const REMEMBER_WINDOW_BOUNDS_FIELD = "remember_window_bounds";
const SAVE_SEARCH_HISTORY_FIELD = "save_search_history";
const SHOW_FOLDER_BADGES_FIELD = "show_folder_badges";
const ONBOARDING_COMPLETED_FIELD = "onboarding_completed";
const EXPERIMENTAL_FEATURES_FIELD = "experimental_features_enabled";
const SOUNDS_ENABLED_FIELD = "sounds_enabled";
const MCP_PORT_FIELD = "mcp_port";

export type AppTheme = "light" | "dark" | "system";
export type BgRemovalQuality = "fast" | "balanced" | "best";
export type BgRemovalProvider = "imgly" | "briaai" | "briaai2";

export interface AcpAgentEnvVar {
  key: string;
  value: string;
}

export interface AcpAgent {
  id: string;
  name: string;
  command: string;
  args: string[];
  envVars: AcpAgentEnvVar[];
}

export const BG_REMOVAL_MODEL_MAP: Record<BgRemovalQuality, string> = {
  fast: "isnet_quint8",
  balanced: "isnet_fp16",
  best: "isnet",
};

interface AppSettingsState {
  seasonalEffectsEnabled: boolean;
  previewSeasonTheme: import("@/components/snow-flakes").SeasonalTheme | null;
  theme: AppTheme;
  bgRemovalQuality: BgRemovalQuality;
  bgRemovalProvider: BgRemovalProvider;
  bgRemovalGeminiEnabled: boolean;
  bgRemovalGeminiModel: string;
  bgRemovalGeminiColor: string;
  bgRemovalGeminiAutoRemove: boolean;
  autoCheckForUpdates: boolean;
  betaUpdatesEnabled: boolean;
  persistTabs: boolean;
  analyticsEnabled: boolean;
  loggingEnabled: boolean;
  semanticSearchEnabled: boolean;
  embeddingIdleTimeoutSecs: number;
  acpAgents: AcpAgent[];
  acpTextGenAgentId: string | null;
  rememberWindowBounds: boolean;
  saveSearchHistory: boolean;
  showFolderBadges: boolean;
  onboardingCompleted: boolean;
  experimentalFeaturesEnabled: boolean;
  soundsEnabled: boolean;
  mcpPort: number;
  isInitialLoadDone: boolean;

  // Actions
  setPreviewSeasonTheme: (
    theme: import("@/components/snow-flakes").SeasonalTheme | null
  ) => void;
  setSeasonalEffectsEnabled: (enabled: boolean) => Promise<void>;
  setTheme: (theme: AppTheme) => Promise<void>;
  setBgRemovalQuality: (quality: BgRemovalQuality) => Promise<void>;
  setBgRemovalProvider: (provider: BgRemovalProvider) => Promise<void>;
  setBgRemovalGeminiEnabled: (enabled: boolean) => Promise<void>;
  setBgRemovalGeminiModel: (model: string) => Promise<void>;
  setBgRemovalGeminiColor: (color: string) => Promise<void>;
  setBgRemovalGeminiAutoRemove: (autoRemove: boolean) => Promise<void>;
  setAutoCheckForUpdates: (enabled: boolean) => Promise<void>;
  setBetaUpdatesEnabled: (enabled: boolean) => Promise<void>;
  setPersistTabs: (enabled: boolean) => Promise<void>;
  setAnalyticsEnabled: (enabled: boolean) => Promise<void>;
  setLoggingEnabled: (enabled: boolean) => Promise<void>;
  setSemanticSearchEnabled: (enabled: boolean) => Promise<void>;
  setEmbeddingIdleTimeoutSecs: (secs: number) => Promise<void>;
  setAcpAgents: (agents: AcpAgent[]) => Promise<void>;
  setAcpTextGenAgentId: (id: string | null) => Promise<void>;
  setRememberWindowBounds: (enabled: boolean) => Promise<void>;
  setSaveSearchHistory: (enabled: boolean) => Promise<void>;
  setShowFolderBadges: (enabled: boolean) => Promise<void>;
  setOnboardingCompleted: (completed: boolean) => Promise<void>;
  setExperimentalFeaturesEnabled: (enabled: boolean) => Promise<void>;
  setSoundsEnabled: (enabled: boolean) => Promise<void>;
  setMcpPort: (port: number) => Promise<void>;
  loadSettings: () => Promise<void>;
}

export const useAppSettingsStore = create<AppSettingsState>()((set, _get) => ({
  seasonalEffectsEnabled: true,
  previewSeasonTheme: null,
  theme: "dark",
  bgRemovalQuality: "balanced",
  bgRemovalProvider: "imgly",
  bgRemovalGeminiEnabled: false,
  bgRemovalGeminiModel: "gemini-2.5-flash-image",
  bgRemovalGeminiColor: "#00ff00",
  bgRemovalGeminiAutoRemove: true,
  autoCheckForUpdates: true,
  betaUpdatesEnabled: false,
  persistTabs: false,
  analyticsEnabled: true,
  loggingEnabled: true,
  semanticSearchEnabled: false,
  embeddingIdleTimeoutSecs: 300,
  acpAgents: [],
  acpTextGenAgentId: null,
  rememberWindowBounds: false,
  saveSearchHistory: true,
  showFolderBadges: true,
  onboardingCompleted: false,
  experimentalFeaturesEnabled: false,
  soundsEnabled: true,
  mcpPort: 37_842,
  isInitialLoadDone: false,

  setPreviewSeasonTheme: (theme) => set({ previewSeasonTheme: theme }),

  setSeasonalEffectsEnabled: async (enabled: boolean) => {
    try {
      const store = await load(SETTINGS_STORE_NAME, {
        autoSave: true,
      });
      await store.set(SEASONAL_EFFECTS_ENABLED_FIELD, enabled);
      await store.save();
      set({ seasonalEffectsEnabled: enabled });
    } catch (error) {
      logger.error(
        { err: error },
        "[Settings] Failed to save setting: seasonalEffectsEnabled"
      );
    }
  },

  setTheme: async (theme: AppTheme) => {
    try {
      const store = await load(SETTINGS_STORE_NAME, {
        autoSave: true,
      });
      await store.set(THEME_FIELD, theme);
      await store.save();
      set({ theme });

      // Update DOM immediately
      if (theme === "system") {
        const isDark = window.matchMedia(
          "(prefers-color-scheme: dark)"
        ).matches;
        document.documentElement.classList.toggle("dark", isDark);
      } else {
        document.documentElement.classList.toggle("dark", theme === "dark");
      }
    } catch (error) {
      logger.error({ err: error }, "[Settings] Failed to save setting: theme");
    }
  },

  setBgRemovalQuality: async (quality: BgRemovalQuality) => {
    try {
      const store = await load(SETTINGS_STORE_NAME, {
        defaults: {},
        autoSave: true,
      });
      await store.set(BG_REMOVAL_QUALITY_FIELD, quality);
      await store.save();
      set({ bgRemovalQuality: quality });
    } catch (error) {
      logger.error(
        { err: error },
        "[Settings] Failed to save setting: bgRemovalQuality"
      );
    }
  },

  setBgRemovalProvider: async (provider: BgRemovalProvider) => {
    try {
      const store = await load(SETTINGS_STORE_NAME, {
        defaults: {},
        autoSave: true,
      });
      await store.set(BG_REMOVAL_PROVIDER_FIELD, provider);
      await store.save();
      set({ bgRemovalProvider: provider });
    } catch (error) {
      logger.error(
        { err: error },
        "[Settings] Failed to save setting: bgRemovalProvider"
      );
    }
  },

  setBgRemovalGeminiEnabled: async (enabled: boolean) => {
    try {
      const store = await load(SETTINGS_STORE_NAME, {
        defaults: {},
        autoSave: true,
      });
      await store.set(BG_REMOVAL_GEMINI_ENABLED_FIELD, enabled);
      await store.save();
      set({ bgRemovalGeminiEnabled: enabled });
    } catch (error) {
      logger.error(
        { err: error },
        "[Settings] Failed to save setting: bgRemovalGeminiEnabled"
      );
    }
  },

  setBgRemovalGeminiModel: async (model: string) => {
    try {
      const store = await load(SETTINGS_STORE_NAME, {
        defaults: {},
        autoSave: true,
      });
      await store.set(BG_REMOVAL_GEMINI_MODEL_FIELD, model);
      await store.save();
      set({ bgRemovalGeminiModel: model });
    } catch (error) {
      logger.error(
        { err: error },
        "[Settings] Failed to save setting: bgRemovalGeminiModel"
      );
    }
  },

  setBgRemovalGeminiColor: async (color: string) => {
    try {
      const store = await load(SETTINGS_STORE_NAME, {
        defaults: {},
        autoSave: true,
      });
      await store.set(BG_REMOVAL_GEMINI_COLOR_FIELD, color);
      await store.save();
      set({ bgRemovalGeminiColor: color });
    } catch (error) {
      logger.error(
        { err: error },
        "[Settings] Failed to save setting: bgRemovalGeminiColor"
      );
    }
  },

  setBgRemovalGeminiAutoRemove: async (autoRemove: boolean) => {
    try {
      const store = await load(SETTINGS_STORE_NAME, {
        defaults: {},
        autoSave: true,
      });
      await store.set(BG_REMOVAL_GEMINI_AUTO_REMOVE_FIELD, autoRemove);
      await store.save();
      set({ bgRemovalGeminiAutoRemove: autoRemove });
    } catch (error) {
      logger.error(
        { err: error },
        "[Settings] Failed to save setting: bgRemovalGeminiAutoRemove"
      );
    }
  },

  setAutoCheckForUpdates: async (enabled: boolean) => {
    try {
      const store = await load(SETTINGS_STORE_NAME, {
        defaults: {},
        autoSave: true,
      });
      await store.set(AUTO_CHECK_FOR_UPDATES_FIELD, enabled);
      await store.save();
      set({ autoCheckForUpdates: enabled });
    } catch (error) {
      logger.error(
        { err: error },
        "[Settings] Failed to save setting: autoCheckForUpdates"
      );
    }
  },

  setBetaUpdatesEnabled: async (enabled: boolean) => {
    try {
      const store = await load(SETTINGS_STORE_NAME, {
        defaults: {},
        autoSave: true,
      });
      await store.set(BETA_UPDATES_ENABLED_FIELD, enabled);
      await store.save();
      set({ betaUpdatesEnabled: enabled });
    } catch (error) {
      logger.error(
        { err: error },
        "[Settings] Failed to save setting: betaUpdatesEnabled"
      );
    }
  },

  setPersistTabs: async (enabled: boolean) => {
    try {
      const store = await load(SETTINGS_STORE_NAME, {
        defaults: {},
        autoSave: true,
      });
      await store.set(PERSIST_TABS_FIELD, enabled);
      await store.save();
      set({ persistTabs: enabled });
    } catch (error) {
      logger.error(
        { err: error },
        "[Settings] Failed to save setting: persistTabs"
      );
    }
  },

  setAnalyticsEnabled: async (enabled: boolean) => {
    try {
      const store = await load(SETTINGS_STORE_NAME, {
        defaults: {},
        autoSave: true,
      });
      await store.set(ANALYTICS_ENABLED_FIELD, enabled);
      await store.save();
      set({ analyticsEnabled: enabled });
    } catch (error) {
      logger.error(
        { err: error },
        "[Settings] Failed to save setting: analyticsEnabled"
      );
    }
  },

  setLoggingEnabled: async (enabled: boolean) => {
    try {
      const store = await load(SETTINGS_STORE_NAME, {
        defaults: {},
        autoSave: true,
      });
      await store.set(LOGGING_ENABLED_FIELD, enabled);
      await store.save();
      set({ loggingEnabled: enabled });
    } catch (error) {
      logger.error(
        { err: error },
        "[Settings] Failed to save setting: loggingEnabled"
      );
    }
  },

  setSemanticSearchEnabled: async (enabled: boolean) => {
    try {
      const store = await load(SETTINGS_STORE_NAME, {
        defaults: {},
        autoSave: true,
      });
      await store.set(SEMANTIC_SEARCH_ENABLED_FIELD, enabled);
      await store.save();
      set({ semanticSearchEnabled: enabled });
    } catch (error) {
      logger.error(
        { err: error },
        "[Settings] Failed to save setting: semanticSearchEnabled"
      );
    }
  },

  setEmbeddingIdleTimeoutSecs: async (secs: number) => {
    try {
      const store = await load(SETTINGS_STORE_NAME, {
        defaults: {},
        autoSave: true,
      });
      await store.set(EMBEDDING_IDLE_TIMEOUT_FIELD, secs);
      await store.save();
      set({ embeddingIdleTimeoutSecs: secs });
      // Push the new timeout to the running embedding engine immediately. Only
      // the local engine has models to unload; the Gemini fallback build has no
      // such command registered, so skip it there.
      const { isLocalEmbeddingAvailable } = await import(
        "@/lib/embedding-provider"
      );
      if (await isLocalEmbeddingAvailable()) {
        const { setEmbeddingIdleTimeout } = await import(
          "@/lib/local-embedding"
        );
        await setEmbeddingIdleTimeout(secs);
      }
    } catch (error) {
      logger.error(
        { err: error },
        "[Settings] Failed to save setting: embeddingIdleTimeoutSecs"
      );
    }
  },

  setAcpAgents: async (agents: AcpAgent[]) => {
    try {
      const store = await load(SETTINGS_STORE_NAME, {
        defaults: {},
        autoSave: true,
      });
      await store.set(ACP_AGENTS_FIELD, agents);
      await store.save();
      set({ acpAgents: agents });
    } catch (error) {
      logger.error(
        { err: error },
        "[Settings] Failed to save setting: acpAgents"
      );
    }
  },

  setAcpTextGenAgentId: async (id: string | null) => {
    try {
      const store = await load(SETTINGS_STORE_NAME, {
        defaults: {},
        autoSave: true,
      });
      await store.set(ACP_TEXT_GEN_AGENT_ID_FIELD, id);
      await store.save();
      set({ acpTextGenAgentId: id });
    } catch (error) {
      logger.error(
        { err: error },
        "[Settings] Failed to save setting: acpTextGenAgentId"
      );
    }
  },

  setRememberWindowBounds: async (enabled: boolean) => {
    try {
      const store = await load(SETTINGS_STORE_NAME, {
        defaults: {},
        autoSave: true,
      });
      await store.set(REMEMBER_WINDOW_BOUNDS_FIELD, enabled);
      await store.save();
      set({ rememberWindowBounds: enabled });
    } catch (error) {
      logger.error(
        { err: error },
        "[Settings] Failed to save setting: rememberWindowBounds"
      );
    }
  },

  setSaveSearchHistory: async (enabled: boolean) => {
    try {
      const store = await load(SETTINGS_STORE_NAME, {
        defaults: {},
        autoSave: true,
      });
      await store.set(SAVE_SEARCH_HISTORY_FIELD, enabled);
      await store.save();
      set({ saveSearchHistory: enabled });
    } catch (error) {
      logger.error(
        { err: error },
        "[Settings] Failed to save setting: saveSearchHistory"
      );
    }
  },

  setShowFolderBadges: async (enabled: boolean) => {
    try {
      const store = await load(SETTINGS_STORE_NAME, {
        defaults: {},
        autoSave: true,
      });
      await store.set(SHOW_FOLDER_BADGES_FIELD, enabled);
      await store.save();
      set({ showFolderBadges: enabled });
    } catch (error) {
      logger.error(
        { err: error },
        "[Settings] Failed to save setting: showFolderBadges"
      );
    }
  },

  setOnboardingCompleted: async (completed: boolean) => {
    try {
      const store = await load(SETTINGS_STORE_NAME, {
        defaults: {},
        autoSave: true,
      });
      await store.set(ONBOARDING_COMPLETED_FIELD, completed);
      await store.save();
      set({ onboardingCompleted: completed });
    } catch (error) {
      logger.error(
        { err: error },
        "[Settings] Failed to save setting: onboardingCompleted"
      );
    }
  },

  setExperimentalFeaturesEnabled: async (enabled: boolean) => {
    try {
      const store = await load(SETTINGS_STORE_NAME, {
        defaults: {},
        autoSave: true,
      });
      await store.set(EXPERIMENTAL_FEATURES_FIELD, enabled);
      await store.save();
      set({ experimentalFeaturesEnabled: enabled });
    } catch (error) {
      logger.error(
        { err: error },
        "[Settings] Failed to save setting: experimentalFeaturesEnabled"
      );
    }
  },

  setSoundsEnabled: async (enabled: boolean) => {
    try {
      const store = await load(SETTINGS_STORE_NAME, {
        defaults: {},
        autoSave: true,
      });
      await store.set(SOUNDS_ENABLED_FIELD, enabled);
      await store.save();
      set({ soundsEnabled: enabled });
    } catch (error) {
      logger.error(
        { err: error },
        "[Settings] Failed to save setting: soundsEnabled"
      );
    }
  },

  setMcpPort: async (port: number) => {
    try {
      const store = await load(SETTINGS_STORE_NAME, {
        defaults: {},
        autoSave: true,
      });
      await store.set(MCP_PORT_FIELD, port);
      await store.save();
      set({ mcpPort: port });
    } catch (error) {
      logger.error(
        { err: error },
        "[Settings] Failed to save setting: mcpPort"
      );
    }
  },

  loadSettings: async () => {
    try {
      logger.info("[Settings] Loading app settings...");
      const store = await load(SETTINGS_STORE_NAME, {
        defaults: {},
        autoSave: false,
      });
      const seasonalEffectsEnabled = await store.get<boolean>(
        SEASONAL_EFFECTS_ENABLED_FIELD
      );
      const theme = await store.get<AppTheme>(THEME_FIELD);
      const bgRemovalQuality = await store.get<BgRemovalQuality>(
        BG_REMOVAL_QUALITY_FIELD
      );
      const bgRemovalProvider = await store.get<BgRemovalProvider>(
        BG_REMOVAL_PROVIDER_FIELD
      );
      const bgRemovalGeminiEnabled = await store.get<boolean>(
        BG_REMOVAL_GEMINI_ENABLED_FIELD
      );
      const bgRemovalGeminiModel = await store.get<string>(
        BG_REMOVAL_GEMINI_MODEL_FIELD
      );
      const bgRemovalGeminiColor = await store.get<string>(
        BG_REMOVAL_GEMINI_COLOR_FIELD
      );
      const bgRemovalGeminiAutoRemove = await store.get<boolean>(
        BG_REMOVAL_GEMINI_AUTO_REMOVE_FIELD
      );
      const autoCheckForUpdates = await store.get<boolean>(
        AUTO_CHECK_FOR_UPDATES_FIELD
      );
      const betaUpdatesEnabled = await store.get<boolean>(
        BETA_UPDATES_ENABLED_FIELD
      );
      const persistTabs = await store.get<boolean>(PERSIST_TABS_FIELD);
      const analyticsEnabled = await store.get<boolean>(
        ANALYTICS_ENABLED_FIELD
      );
      const loggingEnabled = await store.get<boolean>(LOGGING_ENABLED_FIELD);
      const semanticSearchEnabled = await store.get<boolean>(
        SEMANTIC_SEARCH_ENABLED_FIELD
      );
      const embeddingIdleTimeoutSecs = await store.get<number>(
        EMBEDDING_IDLE_TIMEOUT_FIELD
      );
      const acpAgents = await store.get<AcpAgent[]>(ACP_AGENTS_FIELD);
      const acpTextGenAgentId = await store.get<string | null>(
        ACP_TEXT_GEN_AGENT_ID_FIELD
      );
      const rememberWindowBounds = await store.get<boolean>(
        REMEMBER_WINDOW_BOUNDS_FIELD
      );
      const saveSearchHistory = await store.get<boolean>(
        SAVE_SEARCH_HISTORY_FIELD
      );
      const showFolderBadges = await store.get<boolean>(
        SHOW_FOLDER_BADGES_FIELD
      );
      const onboardingCompleted = await store.get<boolean>(
        ONBOARDING_COMPLETED_FIELD
      );
      const experimentalFeaturesEnabled = await store.get<boolean>(
        EXPERIMENTAL_FEATURES_FIELD
      );
      const soundsEnabled = await store.get<boolean>(SOUNDS_ENABLED_FIELD);
      const mcpPort = await store.get<number>(MCP_PORT_FIELD);

      const finalTheme = theme ?? "dark";

      set({
        seasonalEffectsEnabled: seasonalEffectsEnabled ?? true,
        theme: finalTheme,
        bgRemovalQuality: bgRemovalQuality ?? "balanced",
        bgRemovalProvider: bgRemovalProvider ?? "imgly",
        bgRemovalGeminiEnabled: bgRemovalGeminiEnabled ?? false,
        bgRemovalGeminiModel: bgRemovalGeminiModel ?? "gemini-2.5-flash-image",
        bgRemovalGeminiColor: bgRemovalGeminiColor ?? "#00ff00",
        bgRemovalGeminiAutoRemove: bgRemovalGeminiAutoRemove ?? true,
        autoCheckForUpdates: autoCheckForUpdates ?? true,
        betaUpdatesEnabled: betaUpdatesEnabled ?? false,
        persistTabs: persistTabs ?? false,
        analyticsEnabled: analyticsEnabled ?? true,
        loggingEnabled: loggingEnabled ?? true,
        semanticSearchEnabled: semanticSearchEnabled ?? false,
        embeddingIdleTimeoutSecs: embeddingIdleTimeoutSecs ?? 300,
        acpAgents: acpAgents ?? [],
        acpTextGenAgentId: acpTextGenAgentId ?? null,
        rememberWindowBounds: rememberWindowBounds ?? false,
        saveSearchHistory: saveSearchHistory ?? true,
        showFolderBadges: showFolderBadges ?? true,
        onboardingCompleted: onboardingCompleted ?? false,
        experimentalFeaturesEnabled: experimentalFeaturesEnabled ?? false,
        soundsEnabled: soundsEnabled ?? true,
        mcpPort: mcpPort ?? 37_842,
        isInitialLoadDone: true,
      });

      // Apply theme to DOM
      if (finalTheme === "system") {
        const isDark = window.matchMedia(
          "(prefers-color-scheme: dark)"
        ).matches;
        document.documentElement.classList.toggle("dark", isDark);
      } else {
        document.documentElement.classList.toggle(
          "dark",
          finalTheme === "dark"
        );
      }

      logger.info("[Settings] App settings loaded successfully");
    } catch (error) {
      logger.error({ err: error }, "[Settings] Failed to load settings");
      set({ isInitialLoadDone: true });
    }
  },
}));
