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

export type AppTheme = "light" | "dark" | "system";
export type BgRemovalQuality = "fast" | "balanced" | "best";
export type BgRemovalProvider = "imgly" | "briaai";

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
  isInitialLoadDone: boolean;

  // Actions
  setShowDecemberSnow: (show: boolean) => Promise<void>;
  setTheme: (theme: AppTheme) => Promise<void>;
  setBgRemovalQuality: (quality: BgRemovalQuality) => Promise<void>;
  setBgRemovalProvider: (provider: BgRemovalProvider) => Promise<void>;
  setBgRemovalGeminiEnabled: (enabled: boolean) => Promise<void>;
  setBgRemovalGeminiModel: (model: string) => Promise<void>;
  setBgRemovalGeminiColor: (color: string) => Promise<void>;
  setBgRemovalGeminiAutoRemove: (autoRemove: boolean) => Promise<void>;
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
  isInitialLoadDone: false,

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
