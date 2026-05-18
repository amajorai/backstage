import { load } from "@tauri-apps/plugin-store";
import { create } from "zustand";
import { logger } from "@/lib/logger";

const SETTINGS_STORE_NAME = "settings.json";
const SHOW_DECEMBER_SNOW_FIELD = "show_december_snow";
const THEME_FIELD = "app_theme";
const BG_REMOVAL_QUALITY_FIELD = "bg_removal_quality";
const BG_REMOVAL_PROVIDER_FIELD = "bg_removal_provider";
const BG_REMOVAL_GEMINI_ENABLED_FIELD = "bg_removal_gemini_enabled";
const BG_REMOVAL_GEMINI_MODEL_FIELD = "bg_removal_gemini_model";
const BG_REMOVAL_GEMINI_COLOR_FIELD = "bg_removal_gemini_color";
const BG_REMOVAL_GEMINI_AUTO_REMOVE_FIELD = "bg_removal_gemini_auto_remove";
const AUTO_CHECK_FOR_UPDATES_FIELD = "auto_check_for_updates";
const PERSIST_TABS_FIELD = "persist_tabs";
const ANALYTICS_ENABLED_FIELD = "analytics_enabled";
const LOGGING_ENABLED_FIELD = "logging_enabled";
const SEMANTIC_SEARCH_ENABLED_FIELD = "semantic_search_enabled";
const ACP_AGENTS_FIELD = "acp_agents";
const ACP_TEXT_GEN_AGENT_ID_FIELD = "acp_text_gen_agent_id";
const REMEMBER_WINDOW_BOUNDS_FIELD = "remember_window_bounds";
const SAVE_SEARCH_HISTORY_FIELD = "save_search_history";
const SHOW_FOLDER_BADGES_FIELD = "show_folder_badges";
const ONBOARDING_COMPLETED_FIELD = "onboarding_completed";

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
  showDecemberSnow: boolean;
  theme: AppTheme;
  bgRemovalQuality: BgRemovalQuality;
  bgRemovalProvider: BgRemovalProvider;
  bgRemovalGeminiEnabled: boolean;
  bgRemovalGeminiModel: string;
  bgRemovalGeminiColor: string;
  bgRemovalGeminiAutoRemove: boolean;
  autoCheckForUpdates: boolean;
  persistTabs: boolean;
  analyticsEnabled: boolean;
  loggingEnabled: boolean;
  semanticSearchEnabled: boolean;
  acpAgents: AcpAgent[];
  acpTextGenAgentId: string | null;
  rememberWindowBounds: boolean;
  saveSearchHistory: boolean;
  showFolderBadges: boolean;
  onboardingCompleted: boolean;
  isInitialLoadDone: boolean;
  previewSnow: boolean;

  // Actions
  setPreviewSnow: (preview: boolean) => void;
  setShowDecemberSnow: (show: boolean) => Promise<void>;
  setTheme: (theme: AppTheme) => Promise<void>;
  setBgRemovalQuality: (quality: BgRemovalQuality) => Promise<void>;
  setBgRemovalProvider: (provider: BgRemovalProvider) => Promise<void>;
  setBgRemovalGeminiEnabled: (enabled: boolean) => Promise<void>;
  setBgRemovalGeminiModel: (model: string) => Promise<void>;
  setBgRemovalGeminiColor: (color: string) => Promise<void>;
  setBgRemovalGeminiAutoRemove: (autoRemove: boolean) => Promise<void>;
  setAutoCheckForUpdates: (enabled: boolean) => Promise<void>;
  setPersistTabs: (enabled: boolean) => Promise<void>;
  setAnalyticsEnabled: (enabled: boolean) => Promise<void>;
  setLoggingEnabled: (enabled: boolean) => Promise<void>;
  setSemanticSearchEnabled: (enabled: boolean) => Promise<void>;
  setAcpAgents: (agents: AcpAgent[]) => Promise<void>;
  setAcpTextGenAgentId: (id: string | null) => Promise<void>;
  setRememberWindowBounds: (enabled: boolean) => Promise<void>;
  setSaveSearchHistory: (enabled: boolean) => Promise<void>;
  setShowFolderBadges: (enabled: boolean) => Promise<void>;
  setOnboardingCompleted: (completed: boolean) => Promise<void>;
  loadSettings: () => Promise<void>;
}

export const useAppSettingsStore = create<AppSettingsState>()((set, _get) => ({
  showDecemberSnow: true,
  theme: "dark",
  bgRemovalQuality: "balanced",
  bgRemovalProvider: "imgly",
  bgRemovalGeminiEnabled: false,
  bgRemovalGeminiModel: "gemini-2.5-flash-image",
  bgRemovalGeminiColor: "#00ff00",
  bgRemovalGeminiAutoRemove: true,
  autoCheckForUpdates: true,
  persistTabs: false,
  analyticsEnabled: true,
  loggingEnabled: true,
  semanticSearchEnabled: false,
  acpAgents: [],
  acpTextGenAgentId: null,
  rememberWindowBounds: false,
  saveSearchHistory: true,
  showFolderBadges: true,
  onboardingCompleted: false,
  isInitialLoadDone: false,
  previewSnow: false,

  setPreviewSnow: (preview: boolean) => set({ previewSnow: preview }),

  setShowDecemberSnow: async (show: boolean) => {
    try {
      const store = await load(SETTINGS_STORE_NAME, {
        autoSave: true,
      });
      await store.set(SHOW_DECEMBER_SNOW_FIELD, show);
      await store.save();
      set({ showDecemberSnow: show });
    } catch (error) {
      logger.error(
        { err: error },
        "[Settings] Failed to save setting: showDecemberSnow"
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

  loadSettings: async () => {
    try {
      logger.info("[Settings] Loading app settings...");
      const store = await load(SETTINGS_STORE_NAME, {
        defaults: {},
        autoSave: false,
      });
      const showSnow = await store.get<boolean>(SHOW_DECEMBER_SNOW_FIELD);
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
      const persistTabs = await store.get<boolean>(PERSIST_TABS_FIELD);
      const analyticsEnabled = await store.get<boolean>(
        ANALYTICS_ENABLED_FIELD
      );
      const loggingEnabled = await store.get<boolean>(LOGGING_ENABLED_FIELD);
      const semanticSearchEnabled = await store.get<boolean>(
        SEMANTIC_SEARCH_ENABLED_FIELD
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

      const finalTheme = theme ?? "dark";

      set({
        showDecemberSnow: showSnow ?? true,
        theme: finalTheme,
        bgRemovalQuality: bgRemovalQuality ?? "balanced",
        bgRemovalProvider: bgRemovalProvider ?? "imgly",
        bgRemovalGeminiEnabled: bgRemovalGeminiEnabled ?? false,
        bgRemovalGeminiModel: bgRemovalGeminiModel ?? "gemini-2.5-flash-image",
        bgRemovalGeminiColor: bgRemovalGeminiColor ?? "#00ff00",
        bgRemovalGeminiAutoRemove: bgRemovalGeminiAutoRemove ?? true,
        autoCheckForUpdates: autoCheckForUpdates ?? true,
        persistTabs: persistTabs ?? false,
        analyticsEnabled: analyticsEnabled ?? true,
        loggingEnabled: loggingEnabled ?? true,
        semanticSearchEnabled: semanticSearchEnabled ?? false,
        acpAgents: acpAgents ?? [],
        acpTextGenAgentId: acpTextGenAgentId ?? null,
        rememberWindowBounds: rememberWindowBounds ?? false,
        saveSearchHistory: saveSearchHistory ?? true,
        showFolderBadges: showFolderBadges ?? true,
        onboardingCompleted: onboardingCompleted ?? false,
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
