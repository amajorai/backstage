import {
  File,
  GalleryHorizontal,
  GalleryThumbnails,
  RotateCcw,
  Settings,
  Sparkles,
  Trash2,
  X,
  XSquare,
} from "lucide-react";
import { Fragment, useLayoutEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { useEditorStore } from "@/stores/use-editor-store";
import type { TabEntry } from "@/stores/use-tabs-store";
import { useTabsStore } from "@/stores/use-tabs-store";

type ActivePage = "gallery" | "ai-generate" | "trash" | "settings";

const PAGE_LABELS: Record<ActivePage, string> = {
  gallery: "Gallery",
  "ai-generate": "Generate",
  trash: "Trash",
  settings: "Settings",
};

const PAGE_ICONS: Record<ActivePage, React.ReactNode> = {
  gallery: <GalleryHorizontal className="size-3 shrink-0" />,
  "ai-generate": <Sparkles className="size-3 shrink-0" />,
  trash: <Trash2 className="size-3 shrink-0" />,
  settings: <Settings className="size-3 shrink-0" />,
};

const noDrag = { WebkitAppRegion: "no-drag" } as React.CSSProperties;

export function TabBar({
  activePage = "gallery",
}: {
  activePage?: ActivePage;
}) {
  const [bounceKey, setBounceKey] = useState(0);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const tabContainerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number | null>(null);
  const [ctrlTabPendingId, setCtrlTabPendingId] = useState<string | null>(null);
  const ctrlTabPendingIdRef = useRef<string | null>(null);
  const ctrlTabLastTimeRef = useRef<number>(0);

  useLayoutEffect(() => {
    const el = tabContainerRef.current;
    if (!el) return;
    setContainerWidth(el.offsetWidth);
    const ro = new ResizeObserver(() => setContainerWidth(el.offsetWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Prevent WebView2 native context menu so Radix can handle right-clicks
  useLayoutEffect(() => {
    const prevent = (e: MouseEvent) => e.preventDefault();
    document.addEventListener("contextmenu", prevent);
    return () => document.removeEventListener("contextmenu", prevent);
  }, []);

  const tabs = useTabsStore((s) => s.tabs);
  const activeTabId = useTabsStore((s) => s.activeTabId);
  const closedTabs = useTabsStore((s) => s.closedTabs);
  const editorVisible = useTabsStore((s) => s.editorVisible);
  const setActiveTab = useTabsStore((s) => s.setActiveTab);
  const setEditorVisible = useTabsStore((s) => s.setEditorVisible);
  const closeTab = useTabsStore((s) => s.closeTab);
  const closeOtherTabs = useTabsStore((s) => s.closeOtherTabs);
  const reopenClosedTab = useTabsStore((s) => s.reopenClosedTab);
  const reorderTabs = useTabsStore((s) => s.reorderTabs);
  const historyIndex = useEditorStore((s) => s.historyIndex);

  // Stable refs so keyboard handler never goes stale
  const tabsRef = useRef(tabs);
  const activeTabIdRef = useRef(activeTabId);
  const historyIndexRef = useRef(historyIndex);
  tabsRef.current = tabs;
  activeTabIdRef.current = activeTabId;
  historyIndexRef.current = historyIndex;
  ctrlTabPendingIdRef.current = ctrlTabPendingId;

  const isTabDirty = (tab: TabEntry) => {
    if (tab.id === activeTabId) {
      return historyIndex !== tab.savedHistoryIndex;
    }
    const snapIndex = tab.snapshot?.historyIndex ?? -1;
    return snapIndex !== tab.savedHistoryIndex;
  };

  const guardDirty = (tab: TabEntry | null, action: () => void) => {
    if (tab && isTabDirty(tab)) {
      setPendingAction(() => action);
    } else {
      action();
    }
  };

  const handleCloseTab = (tab: TabEntry) => {
    guardDirty(tab, () => closeTab(tab.id));
  };

  const handleCloseOtherTabs = (tab: TabEntry) => {
    const others = tabs.filter((t) => t.id !== tab.id);
    const anyDirty = others.some((t) => isTabDirty(t));
    if (anyDirty) {
      setPendingAction(() => () => closeOtherTabs(tab.id));
    } else {
      closeOtherTabs(tab.id);
    }
  };

  // Keyboard shortcuts — use refs so the handler is registered once
  useLayoutEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!e.ctrlKey) return;
      const tabs = tabsRef.current;
      const activeTabId = activeTabIdRef.current;

      if (e.key === "Tab") {
        e.preventDefault();
        if (tabs.length === 0) return;
        const now = performance.now();
        if (now - ctrlTabLastTimeRef.current < 80) return;
        ctrlTabLastTimeRef.current = now;
        const currentId = ctrlTabPendingIdRef.current ?? activeTabId;
        const idx = tabs.findIndex((t) => t.id === currentId);
        const next = e.shiftKey
          ? (idx - 1 + tabs.length) % tabs.length
          : (idx + 1) % tabs.length;
        const nextId = tabs[next].id;
        ctrlTabPendingIdRef.current = nextId;
        flushSync(() => setCtrlTabPendingId(nextId));
      } else if (e.shiftKey && e.key === "T") {
        e.preventDefault();
        reopenClosedTab();
      } else if (e.key === "w") {
        e.preventDefault();
        const activeTab = tabs.find((t) => t.id === activeTabId);
        if (!activeTab) return;
        const hi = historyIndexRef.current;
        const isDirty =
          hi !== activeTab.savedHistoryIndex &&
          activeTab.savedHistoryIndex !== -1;
        if (isDirty) {
          setPendingAction(() => () => closeTab(activeTab.id));
        } else {
          closeTab(activeTab.id);
        }
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key !== "Control") return;
      const pendingId = ctrlTabPendingIdRef.current;
      if (pendingId) {
        setActiveTab(pendingId);
        ctrlTabPendingIdRef.current = null;
        setCtrlTabPendingId(null);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [setActiveTab, reopenClosedTab, closeTab]);

  const handleGalleryClick = () => {
    if (!editorVisible) return;
    setEditorVisible(false);
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggingIndex(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    const rect = e.currentTarget.getBoundingClientRect();
    setDragOverIndex(
      e.clientX < rect.left + rect.width / 2 ? index : index + 1
    );
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (draggingIndex !== null && dragOverIndex !== null) {
      let to = dragOverIndex;
      if (draggingIndex < dragOverIndex) to--;
      if (to !== draggingIndex) reorderTabs(draggingIndex, to);
    }
    setDraggingIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggingIndex(null);
    setDragOverIndex(null);
  };

  const showIndicator = (atIndex: number) => {
    if (draggingIndex === null || dragOverIndex !== atIndex) return false;
    if (dragOverIndex === draggingIndex || dragOverIndex === draggingIndex + 1)
      return false;
    return true;
  };

  const isMac = /Mac/.test(navigator.userAgent);

  const GAP_PX = 8;
  const MAX_TAB_PX = 176;
  const MIN_TAB_PX = 40;
  const tabWidth =
    containerWidth !== null && tabs.length > 0
      ? Math.max(
          MIN_TAB_PX,
          Math.min(
            MAX_TAB_PX,
            (containerWidth - (tabs.length - 1) * GAP_PX) / tabs.length
          )
        )
      : MAX_TAB_PX;

  return (
    <>
      <div
        className={`relative flex h-10 shrink-0 items-center bg-muted ${isMac ? "pr-2 pl-[80px]" : "pr-[148px] pl-2"}`}
        data-tauri-drag-region
      >
        <style>{`
          @keyframes tab-logo-bounce {
            0%   { transform: scale(1); }
            25%  { transform: scale(1.2); }
            50%  { transform: scale(0.9); }
            75%  { transform: scale(1.1); }
            90%  { transform: scale(0.97); }
            100% { transform: scale(1); }
          }
          .tab-logo-bounce { animation: tab-logo-bounce 0.5s cubic-bezier(0.36,0.07,0.19,0.97); }
        `}</style>

        {/* Logo */}
        <button
          className="relative z-[1001] flex shrink-0 cursor-pointer items-center px-1.5 outline-none"
          onClick={() => setBounceKey((k) => k + 1)}
          style={noDrag}
          type="button"
        >
          <GalleryThumbnails
            className={`fill-foreground opacity-60 transition-opacity hover:opacity-90 active:opacity-50 ${bounceKey > 0 ? "tab-logo-bounce" : ""}`}
            key={bounceKey}
            size={14}
            strokeWidth={3}
          />
        </button>

        {/* Gallery/page tab */}
        <div
          className={`relative z-[1001] flex h-7 shrink-0 cursor-pointer select-none items-center gap-1.5 rounded-md px-3 text-xs transition-colors ${
            editorVisible || ctrlTabPendingId
              ? "text-muted-foreground hover:bg-muted hover:text-foreground"
              : "bg-background text-foreground"
          }`}
          onClick={handleGalleryClick}
          style={noDrag}
        >
          {PAGE_ICONS[activePage]}
          {PAGE_LABELS[activePage]}
        </div>

        {/* Divider between page tab and project tabs */}
        {tabs.length > 0 && (
          <div className="mx-2 h-4 w-px shrink-0 bg-border" />
        )}

        {/* Project tabs — shrink like Chrome, no scroll */}
        <div
          className={`relative z-[1001] flex flex-1 items-center gap-2 overflow-hidden ${containerWidth === null ? "invisible" : ""}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOverIndex(tabs.length);
          }}
          onDrop={handleDrop}
          ref={tabContainerRef}
        >
          {tabs.map((tab, index) => {
            const isActive = ctrlTabPendingId
              ? tab.id === ctrlTabPendingId
              : tab.id === activeTabId && editorVisible;
            const dirty = isTabDirty(tab);
            const isDragging = draggingIndex === index;

            return (
              <Fragment key={tab.id}>
                {showIndicator(index) && (
                  <div className="h-5 w-0.5 shrink-0 rounded-full bg-blue-400" />
                )}
                <ContextMenu>
                  <ContextMenuTrigger asChild>
                    <div
                      className={`group relative z-[1001] flex h-7 shrink-0 cursor-pointer select-none items-center gap-1.5 overflow-hidden rounded-md px-3 text-xs ${
                        isActive
                          ? "bg-background text-foreground"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      } ${isDragging ? "opacity-40" : ""}`}
                      draggable
                      onClick={() => setActiveTab(tab.id)}
                      onDragEnd={handleDragEnd}
                      onDragOver={(e) => handleDragOver(e, index)}
                      onDragStart={(e) => handleDragStart(e, index)}
                      onDrop={handleDrop}
                      onPointerDown={(e) => {
                        if (e.button === 1) {
                          e.preventDefault();
                          e.stopPropagation();
                          handleCloseTab(tab);
                        }
                      }}
                      style={{ width: tabWidth, ...noDrag }}
                    >
                      <File className="size-3 shrink-0 opacity-60" />
                      <span className="truncate">{tab.name}</span>
                      {dirty && (
                        <span className="size-1.5 shrink-0 rounded-full bg-amber-400" />
                      )}
                      <button
                        className={`ml-auto shrink-0 rounded-full p-0.5 transition-colors ${
                          isActive
                            ? "text-muted-foreground hover:bg-background hover:text-foreground"
                            : "hover:!bg-muted hover:!text-foreground text-transparent group-hover:text-muted-foreground"
                        }`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCloseTab(tab);
                        }}
                        style={noDrag}
                        type="button"
                      >
                        <X className="size-3" />
                      </button>
                    </div>
                  </ContextMenuTrigger>
                  <ContextMenuContent className="w-52">
                    <ContextMenuItem onClick={() => handleCloseTab(tab)}>
                      <X className="mr-2 size-4" />
                      Close Tab
                    </ContextMenuItem>
                    <ContextMenuItem
                      disabled={tabs.length <= 1}
                      onClick={() => handleCloseOtherTabs(tab)}
                    >
                      <XSquare className="mr-2 size-4" />
                      Close Other Tabs
                    </ContextMenuItem>
                    <ContextMenuSeparator />
                    <ContextMenuItem
                      disabled={closedTabs.length === 0}
                      onClick={() => reopenClosedTab()}
                    >
                      <RotateCcw className="mr-2 size-4" />
                      <div className="flex flex-col">
                        Reopen Closed Tab
                        {closedTabs.length > 0 && (
                          <span className="text-muted-foreground text-xs">
                            {closedTabs[0].name}
                          </span>
                        )}
                      </div>
                    </ContextMenuItem>
                  </ContextMenuContent>
                </ContextMenu>
              </Fragment>
            );
          })}
          {showIndicator(tabs.length) && (
            <div className="h-5 w-0.5 shrink-0 rounded-full bg-blue-400" />
          )}
        </div>
      </div>

      <AlertDialog
        onOpenChange={(open) => {
          if (!open) setPendingAction(null);
        }}
        open={pendingAction !== null}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unsaved Changes</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes. Discard them and continue, or cancel to
              go back and save first.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                pendingAction?.();
                setPendingAction(null);
              }}
            >
              Discard
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
