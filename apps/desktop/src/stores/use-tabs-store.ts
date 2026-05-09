import { load } from "@tauri-apps/plugin-store";
import { create } from "zustand";
import { logger } from "@/lib/logger";
import type { EditorSnapshot } from "@/stores/use-editor-store";
import { useEditorStore } from "@/stores/use-editor-store";
import type { ThumbnailItem } from "@/stores/use-gallery-store";

const TABS_STORE_NAME = "settings.json";
const PERSISTED_TABS_KEY = "persisted_open_tabs";

export interface TabEntry {
  id: string;
  thumbnailId: string;
  name: string;
  snapshot: EditorSnapshot | null;
  savedHistoryIndex: number;
}

interface TabsState {
  tabs: TabEntry[];
  activeTabId: string | null;
  closedTabs: TabEntry[];
  editorVisible: boolean;

  openTab: (thumbnail: ThumbnailItem) => string;
  openTabBackground: (thumbnail: ThumbnailItem) => void;
  closeTab: (tabId: string) => void;
  closeOtherTabs: (tabId: string) => void;
  duplicateTab: (tabId: string) => void;
  reopenClosedTab: () => void;
  reorderTabs: (fromIndex: number, toIndex: number) => void;
  setActiveTab: (tabId: string) => void;
  setEditorVisible: (visible: boolean) => void;
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

export const useTabsStore = create<TabsState>()((set, get) => ({
  tabs: [],
  activeTabId: null,
  closedTabs: [],
  editorVisible: false,

  openTab: (thumbnail: ThumbnailItem) => {
    const { tabs, activeTabId } = get();

    const existing = tabs.find((t) => t.thumbnailId === thumbnail.id);
    if (existing) {
      get().setActiveTab(existing.id);
      return existing.id;
    }

    const newTab: TabEntry = {
      id: crypto.randomUUID(),
      thumbnailId: thumbnail.id,
      name: thumbnail.name,
      snapshot: null,
      savedHistoryIndex: -1,
    };

    if (activeTabId) {
      const currentTab = tabs.find((t) => t.id === activeTabId);
      const snapshot = captureSnapshot(currentTab?.savedHistoryIndex ?? -1);
      set({
        tabs: [
          ...tabs.map((t) => (t.id === activeTabId ? { ...t, snapshot } : t)),
          newTab,
        ],
        activeTabId: newTab.id,
        editorVisible: true,
      });
    } else {
      set({
        tabs: [...tabs, newTab],
        activeTabId: newTab.id,
        editorVisible: true,
      });
    }

    void get().savePersistedTabs();
    return newTab.id;
  },

  openTabBackground: (thumbnail: ThumbnailItem) => {
    const { tabs, activeTabId } = get();
    const existing = tabs.find((t) => t.thumbnailId === thumbnail.id);
    if (existing) return;

    const newTab: TabEntry = {
      id: crypto.randomUUID(),
      thumbnailId: thumbnail.id,
      name: thumbnail.name,
      snapshot: null,
      savedHistoryIndex: -1,
    };

    if (activeTabId) {
      const currentTab = tabs.find((t) => t.id === activeTabId);
      const snapshot = captureSnapshot(currentTab?.savedHistoryIndex ?? -1);
      set({
        tabs: [
          ...tabs.map((t) => (t.id === activeTabId ? { ...t, snapshot } : t)),
          newTab,
        ],
      });
    } else {
      set({ tabs: [...tabs, newTab] });
    }

    void get().savePersistedTabs();
  },

  closeTab: (tabId: string) => {
    const { tabs, activeTabId, closedTabs } = get();
    const tabIndex = tabs.findIndex((t) => t.id === tabId);
    if (tabIndex === -1) return;

    const closingTab = tabs[tabIndex];
    const newClosedTabs = [closingTab, ...closedTabs].slice(0, 10);
    const newTabs = tabs.filter((t) => t.id !== tabId);

    if (activeTabId === tabId) {
      if (newTabs.length === 0) {
        set({
          tabs: [],
          activeTabId: null,
          closedTabs: newClosedTabs,
          editorVisible: false,
        });
      } else {
        const newActive = newTabs[Math.max(0, tabIndex - 1)];
        useEditorStore
          .getState()
          .resetHistoryIndex(newActive.savedHistoryIndex);
        set({
          tabs: newTabs,
          activeTabId: newActive.id,
          closedTabs: newClosedTabs,
        });
      }
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
    if (!source) return;

    const snapshot =
      tabId === activeTabId
        ? captureSnapshot(source.savedHistoryIndex)
        : source.snapshot
          ? JSON.parse(JSON.stringify(source.snapshot))
          : null;

    const newTab: TabEntry = {
      id: crypto.randomUUID(),
      thumbnailId: source.thumbnailId,
      name: source.name,
      snapshot,
      savedHistoryIndex: source.savedHistoryIndex,
    };

    const sourceIndex = tabs.findIndex((t) => t.id === tabId);
    const newTabs = [
      ...tabs.slice(0, sourceIndex + 1),
      newTab,
      ...tabs.slice(sourceIndex + 1),
    ];

    if (activeTabId) {
      const currentTab = tabs.find((t) => t.id === activeTabId);
      const currentSnapshot = captureSnapshot(
        currentTab?.savedHistoryIndex ?? -1
      );
      set({
        tabs: newTabs.map((t) =>
          t.id === activeTabId ? { ...t, snapshot: currentSnapshot } : t
        ),
        activeTabId: newTab.id,
        editorVisible: true,
      });
    } else {
      set({ tabs: newTabs, activeTabId: newTab.id, editorVisible: true });
    }

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

    if (activeTabId) {
      const currentTab = tabs.find((t) => t.id === activeTabId);
      const snapshot = captureSnapshot(currentTab?.savedHistoryIndex ?? -1);
      set({
        tabs: [
          ...tabs.map((t) => (t.id === activeTabId ? { ...t, snapshot } : t)),
          newTab,
        ],
        activeTabId: newTab.id,
        closedTabs: remainingClosed,
        editorVisible: true,
      });
    } else {
      set({
        tabs: [...tabs, newTab],
        activeTabId: newTab.id,
        closedTabs: remainingClosed,
        editorVisible: true,
      });
    }

    void get().savePersistedTabs();
  },

  setActiveTab: (tabId: string) => {
    const { tabs, activeTabId } = get();
    if (activeTabId === tabId) {
      set({ editorVisible: true });
      return;
    }

    if (activeTabId) {
      const currentTab = tabs.find((t) => t.id === activeTabId);
      const snapshot = captureSnapshot(currentTab?.savedHistoryIndex ?? -1);
      set({
        tabs: tabs.map((t) => (t.id === activeTabId ? { ...t, snapshot } : t)),
        activeTabId: tabId,
        editorVisible: true,
      });
    } else {
      set({ activeTabId: tabId, editorVisible: true });
    }
  },

  setEditorVisible: (visible: boolean) => {
    set({ editorVisible: visible });
  },

  updateTabName: (tabId: string, name: string) => {
    set((s) => ({
      tabs: s.tabs.map((t) => (t.id === tabId ? { ...t, name } : t)),
    }));
  },

  markTabSaved: (tabId: string, historyIndex: number) => {
    set((s) => ({
      tabs: s.tabs.map((t) =>
        t.id === tabId ? { ...t, savedHistoryIndex: historyIndex } : t
      ),
    }));
  },

  clearAllTabs: () => {
    set({ tabs: [], activeTabId: null, editorVisible: false });
  },

  savePersistedTabs: async () => {
    try {
      const { useAppSettingsStore } = await import(
        "@/stores/use-app-settings-store"
      );
      if (!useAppSettingsStore.getState().persistTabs) return;
      const { tabs } = get();
      const store = await load(TABS_STORE_NAME, { autoSave: true });
      await store.set(
        PERSISTED_TABS_KEY,
        tabs.map((t) => t.thumbnailId)
      );
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
      const thumbnailIds = await store.get<string[]>(PERSISTED_TABS_KEY);
      if (!thumbnailIds || thumbnailIds.length === 0) return;

      const { useGalleryStore } = await import("@/stores/use-gallery-store");
      const { thumbnails } = useGalleryStore.getState();

      const restoredTabs: TabEntry[] = [];
      for (const tid of thumbnailIds) {
        const thumb = thumbnails.find((t) => t.id === tid);
        if (thumb) {
          restoredTabs.push({
            id: crypto.randomUUID(),
            thumbnailId: tid,
            name: thumb.name,
            snapshot: null,
            savedHistoryIndex: -1,
          });
        }
      }

      if (restoredTabs.length > 0) {
        set({
          tabs: restoredTabs,
          activeTabId: restoredTabs[0].id,
          editorVisible: true,
        });
      }
    } catch (error) {
      logger.error({ err: error }, "[Tabs] Failed to restore tabs");
    }
  },
}));
