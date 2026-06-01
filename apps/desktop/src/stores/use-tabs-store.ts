import { load } from "@tauri-apps/plugin-store";
import { create } from "zustand";
import { logger } from "@/lib/logger";
import type { EditorSnapshot } from "@/stores/use-editor-store";
import { useEditorStore } from "@/stores/use-editor-store";
import type { ThumbnailItem } from "@/stores/use-gallery-store";

const TABS_STORE_NAME = "settings.json";
const PERSISTED_TABS_KEY = "persisted_open_tabs";

// The set of full-screen "pages" that can each live in their own tab, exactly
// like a browser tab. Mirrors the `Page` union in App.tsx / use-navigation-store.
export type PageId =
  | "gallery"
  | "ai-generate"
  | "ai-projects"
  | "trash"
  | "settings"
  | "explore"
  | "my-channel"
  | "archive";

export interface ProjectTabEntry {
  kind: "project";
  id: string;
  thumbnailId: string;
  name: string;
  snapshot: EditorSnapshot | null;
  savedHistoryIndex: number;
}

export interface PageTabEntry {
  kind: "page";
  id: string;
  page: PageId;
}

export type TabEntry = ProjectTabEntry | PageTabEntry;

// How tabs are written to disk. Page tabs survive a restart just like project
// tabs so the strip restores exactly as the user left it.
type PersistedTabDescriptor =
  | { kind: "page"; page: PageId }
  | { kind: "project"; thumbnailId: string };

interface TabsState {
  tabs: TabEntry[];
  activeTabId: string | null;
  closedTabs: TabEntry[];

  openTab: (thumbnail: ThumbnailItem) => string;
  openTabBackground: (thumbnail: ThumbnailItem) => void;
  openPageTab: (page: PageId) => string;
  closeTab: (tabId: string) => void;
  closeOtherTabs: (tabId: string) => void;
  duplicateTab: (tabId: string) => void;
  reopenClosedTab: () => void;
  reorderTabs: (fromIndex: number, toIndex: number) => void;
  setActiveTab: (tabId: string) => void;
  updateTabName: (tabId: string, name: string) => void;
  markTabSaved: (tabId: string, historyIndex: number) => void;
  clearAllTabs: () => void;
  savePersistedTabs: () => Promise<void>;
  restorePersistedTabs: () => Promise<void>;
}

function captureSnapshot(savedHistoryIndex: number): EditorSnapshot {
  const s = useEditorStore.getState();
  return {
    pages: s.pages,
    activePageIndex: s.activePageIndex,
    layers: s.layers,
    activeLayerIds: s.activeLayerIds,
    activeTool: s.activeTool,
    canvasWidth: s.canvasWidth,
    canvasHeight: s.canvasHeight,
    brushSize: s.brushSize,
    brushColor: s.brushColor,
    brushOpacity: s.brushOpacity,
    magicSelectTolerance: s.magicSelectTolerance,
    historyPast: s.historyPast,
    historyFuture: s.historyFuture,
    historyIndex: s.historyIndex,
    showRulers: s.showRulers,
    showGrid: s.showGrid,
    userGuides: s.userGuides,
    savedHistoryIndex,
  };
}

function createGalleryTab(): PageTabEntry {
  return { kind: "page", id: crypto.randomUUID(), page: "gallery" };
}

function makeProjectTab(thumbnailId: string, name: string): ProjectTabEntry {
  return {
    kind: "project",
    id: crypto.randomUUID(),
    thumbnailId,
    name,
    snapshot: null,
    savedHistoryIndex: -1,
  };
}

// Returns `tabs` with the live editor state folded into the currently-active
// project tab's snapshot, so switching away never loses unsaved work. Page tabs
// (and "no active tab") have no editor state, so the list is returned untouched.
function withActiveSnapshot(
  tabs: TabEntry[],
  activeTabId: string | null
): TabEntry[] {
  if (!activeTabId) return tabs;
  const current = tabs.find((t) => t.id === activeTabId);
  if (!current || current.kind !== "project") return tabs;
  const snapshot = captureSnapshot(current.savedHistoryIndex);
  return tabs.map((t) => (t.id === activeTabId ? { ...t, snapshot } : t));
}

export const useTabsStore = create<TabsState>()((set, get) => {
  // Seed with a single Home tab so the strip is never empty on first launch.
  const initialGallery = createGalleryTab();

  return {
    tabs: [initialGallery],
    activeTabId: initialGallery.id,
    closedTabs: [],

    openTab: (thumbnail: ThumbnailItem) => {
      const { tabs, activeTabId } = get();

      const existing = tabs.find(
        (t) => t.kind === "project" && t.thumbnailId === thumbnail.id
      );
      if (existing) {
        get().setActiveTab(existing.id);
        return existing.id;
      }

      const newTab = makeProjectTab(thumbnail.id, thumbnail.name);
      set({
        tabs: [...withActiveSnapshot(tabs, activeTabId), newTab],
        activeTabId: newTab.id,
      });

      void get().savePersistedTabs();
      return newTab.id;
    },

    openTabBackground: (thumbnail: ThumbnailItem) => {
      const { tabs, activeTabId } = get();
      const existing = tabs.find(
        (t) => t.kind === "project" && t.thumbnailId === thumbnail.id
      );
      if (existing) return;

      const newTab = makeProjectTab(thumbnail.id, thumbnail.name);
      set({ tabs: [...withActiveSnapshot(tabs, activeTabId), newTab] });
      void get().savePersistedTabs();
    },

    openPageTab: (page: PageId) => {
      const { tabs, activeTabId } = get();

      // Focus an existing page tab rather than opening a duplicate.
      const existing = tabs.find((t) => t.kind === "page" && t.page === page);
      if (existing) {
        get().setActiveTab(existing.id);
        return existing.id;
      }

      const newTab: PageTabEntry = {
        kind: "page",
        id: crypto.randomUUID(),
        page,
      };
      set({
        tabs: [...withActiveSnapshot(tabs, activeTabId), newTab],
        activeTabId: newTab.id,
      });

      void get().savePersistedTabs();
      return newTab.id;
    },

    closeTab: (tabId: string) => {
      const { tabs, activeTabId, closedTabs } = get();
      const tabIndex = tabs.findIndex((t) => t.id === tabId);
      if (tabIndex === -1) return;

      const closingTab = tabs[tabIndex];
      const newClosedTabs = [closingTab, ...closedTabs].slice(0, 10);
      const newTabs = tabs.filter((t) => t.id !== tabId);

      // Never leave the strip empty — fall back to a fresh Home tab.
      if (newTabs.length === 0) {
        const gallery = createGalleryTab();
        set({
          tabs: [gallery],
          activeTabId: gallery.id,
          closedTabs: newClosedTabs,
        });
        void get().savePersistedTabs();
        return;
      }

      if (activeTabId === tabId) {
        const newActive = newTabs[Math.max(0, tabIndex - 1)];
        if (newActive.kind === "project") {
          useEditorStore
            .getState()
            .resetHistoryIndex(newActive.savedHistoryIndex);
        }
        set({
          tabs: newTabs,
          activeTabId: newActive.id,
          closedTabs: newClosedTabs,
        });
      } else {
        set({ tabs: newTabs, closedTabs: newClosedTabs });
      }

      void get().savePersistedTabs();
    },

    closeOtherTabs: (tabId: string) => {
      const { tabs, closedTabs } = get();
      const tabToKeep = tabs.find((t) => t.id === tabId);
      if (!tabToKeep) return;
      const closing = tabs.filter((t) => t.id !== tabId);
      const newClosedTabs = [...closing, ...closedTabs].slice(0, 10);
      set({ tabs: [tabToKeep], activeTabId: tabId, closedTabs: newClosedTabs });
      void get().savePersistedTabs();
    },

    duplicateTab: (tabId: string) => {
      const { tabs, activeTabId } = get();
      const source = tabs.find((t) => t.id === tabId);
      if (!source || source.kind !== "project") return;

      const snapshot =
        tabId === activeTabId
          ? captureSnapshot(source.savedHistoryIndex)
          : source.snapshot
            ? JSON.parse(JSON.stringify(source.snapshot))
            : null;

      const newTab: ProjectTabEntry = {
        kind: "project",
        id: crypto.randomUUID(),
        thumbnailId: source.thumbnailId,
        name: source.name,
        snapshot,
        savedHistoryIndex: source.savedHistoryIndex,
      };

      const withSnapshot = withActiveSnapshot(tabs, activeTabId);
      const sourceIndex = withSnapshot.findIndex((t) => t.id === tabId);
      const newTabs = [
        ...withSnapshot.slice(0, sourceIndex + 1),
        newTab,
        ...withSnapshot.slice(sourceIndex + 1),
      ];

      set({ tabs: newTabs, activeTabId: newTab.id });
      void get().savePersistedTabs();
    },

    reorderTabs: (fromIndex: number, toIndex: number) => {
      if (fromIndex === toIndex) return;
      set((s) => {
        const tabs = [...s.tabs];
        const [moved] = tabs.splice(fromIndex, 1);
        tabs.splice(toIndex, 0, moved);
        return { tabs };
      });
      void get().savePersistedTabs();
    },

    reopenClosedTab: () => {
      const { closedTabs, tabs, activeTabId } = get();
      if (closedTabs.length === 0) return;

      const [tabToReopen, ...remainingClosed] = closedTabs;
      const newTab: TabEntry = {
        ...tabToReopen,
        id: crypto.randomUUID(),
      };

      set({
        tabs: [...withActiveSnapshot(tabs, activeTabId), newTab],
        activeTabId: newTab.id,
        closedTabs: remainingClosed,
      });

      void get().savePersistedTabs();
    },

    setActiveTab: (tabId: string) => {
      const { tabs, activeTabId } = get();
      if (activeTabId === tabId) return;
      set({ tabs: withActiveSnapshot(tabs, activeTabId), activeTabId: tabId });
    },

    updateTabName: (tabId: string, name: string) => {
      set((s) => ({
        tabs: s.tabs.map((t) =>
          t.id === tabId && t.kind === "project" ? { ...t, name } : t
        ),
      }));
    },

    markTabSaved: (tabId: string, historyIndex: number) => {
      set((s) => ({
        tabs: s.tabs.map((t) =>
          t.id === tabId && t.kind === "project"
            ? { ...t, savedHistoryIndex: historyIndex }
            : t
        ),
      }));
    },

    clearAllTabs: () => {
      const gallery = createGalleryTab();
      set({ tabs: [gallery], activeTabId: gallery.id });
    },

    savePersistedTabs: async () => {
      try {
        const { useAppSettingsStore } = await import(
          "@/stores/use-app-settings-store"
        );
        if (!useAppSettingsStore.getState().persistTabs) return;
        const { tabs } = get();
        const descriptors: PersistedTabDescriptor[] = tabs.map((t) =>
          t.kind === "project"
            ? { kind: "project", thumbnailId: t.thumbnailId }
            : { kind: "page", page: t.page }
        );
        const store = await load(TABS_STORE_NAME, { autoSave: true });
        await store.set(PERSISTED_TABS_KEY, descriptors);
        await store.save();
      } catch (error) {
        logger.error({ err: error }, "[Tabs] Failed to persist tabs");
      }
    },

    restorePersistedTabs: async () => {
      try {
        const { useAppSettingsStore } = await import(
          "@/stores/use-app-settings-store"
        );
        if (!useAppSettingsStore.getState().persistTabs) return;

        const store = await load(TABS_STORE_NAME, { autoSave: false });
        const raw = await store.get<unknown>(PERSISTED_TABS_KEY);
        if (!Array.isArray(raw) || raw.length === 0) return;

        const { useGalleryStore } = await import("@/stores/use-gallery-store");
        const { thumbnails } = useGalleryStore.getState();

        const restored: TabEntry[] = [];
        for (const item of raw) {
          // Back-compat: the legacy format persisted bare thumbnailId strings.
          if (typeof item === "string") {
            const thumb = thumbnails.find((t) => t.id === item);
            if (thumb) restored.push(makeProjectTab(item, thumb.name));
            continue;
          }
          if (item && typeof item === "object" && "kind" in item) {
            const desc = item as PersistedTabDescriptor;
            if (desc.kind === "project") {
              const thumb = thumbnails.find((t) => t.id === desc.thumbnailId);
              if (thumb)
                restored.push(makeProjectTab(desc.thumbnailId, thumb.name));
            } else if (desc.kind === "page") {
              restored.push({
                kind: "page",
                id: crypto.randomUUID(),
                page: desc.page,
              });
            }
          }
        }

        if (restored.length > 0) {
          set({ tabs: restored, activeTabId: restored[0].id });
        }
      } catch (error) {
        logger.error({ err: error }, "[Tabs] Failed to restore tabs");
      }
    },
  };
});
