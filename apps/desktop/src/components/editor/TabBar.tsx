import { GalleryThumbnails, RotateCcw, X, XSquare } from "lucide-react";
import { useState } from "react";
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
  "ai-generate": "AI Generate",
  trash: "Trash",
  settings: "Settings",
};

export function TabBar({
  activePage = "gallery",
}: {
  activePage?: ActivePage;
}) {
  const [bounceKey, setBounceKey] = useState(0);
  const tabs = useTabsStore((s) => s.tabs);
  const activeTabId = useTabsStore((s) => s.activeTabId);
  const closedTabs = useTabsStore((s) => s.closedTabs);
  const editorVisible = useTabsStore((s) => s.editorVisible);
  const setActiveTab = useTabsStore((s) => s.setActiveTab);
  const setEditorVisible = useTabsStore((s) => s.setEditorVisible);
  const closeTab = useTabsStore((s) => s.closeTab);
  const closeOtherTabs = useTabsStore((s) => s.closeOtherTabs);
  const reopenClosedTab = useTabsStore((s) => s.reopenClosedTab);
  const historyIndex = useEditorStore((s) => s.historyIndex);

  const isTabDirty = (tab: TabEntry) => {
    if (tab.id === activeTabId) {
      return historyIndex !== tab.savedHistoryIndex;
    }
    const snapIndex = tab.snapshot?.historyIndex ?? -1;
    return snapIndex !== tab.savedHistoryIndex;
  };

  const isMac = /Mac/.test(navigator.userAgent);

  return (
    <div
      className={`scrollbar-none relative flex h-10 shrink-0 items-center gap-1 overflow-x-auto bg-neutral-950 ${isMac ? "pr-2 pl-[80px]" : "pr-[148px] pl-2"}`}
    >
      {/* Drag region sits behind everything */}
      <div className="absolute inset-0 z-0" data-tauri-drag-region />

      {/* App logo with bounce */}
      <button
        className="relative z-[1001] flex shrink-0 cursor-pointer items-center px-1.5 outline-none"
        onClick={() => setBounceKey((k) => k + 1)}
        type="button"
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
        <GalleryThumbnails
          className={`fill-foreground opacity-60 transition-opacity hover:opacity-90 active:opacity-50 ${bounceKey > 0 ? "tab-logo-bounce" : ""}`}
          key={bounceKey}
          size={14}
          strokeWidth={3}
        />
      </button>

      {/* Divider */}
      <div className="relative z-[1001] mx-0.5 h-4 w-px shrink-0 bg-neutral-700" />

      {/* Gallery/page tab — always visible, active when not in editor */}
      <div
        className={`relative z-[1001] flex h-7 shrink-0 cursor-pointer select-none items-center rounded-full px-3 text-xs transition-colors ${
          editorVisible
            ? "text-neutral-500 hover:bg-neutral-800 hover:text-neutral-300"
            : "bg-neutral-700 text-white"
        }`}
        onClick={() => setEditorVisible(false)}
      >
        {PAGE_LABELS[activePage]}
      </div>

      {/* Project tabs */}
      {tabs.map((tab) => {
        const isActive = tab.id === activeTabId && editorVisible;
        const dirty = isTabDirty(tab);

        return (
          <ContextMenu key={tab.id}>
            <ContextMenuTrigger className="contents">
              <div
                className={`group relative z-[1001] flex h-7 min-w-0 max-w-44 shrink-0 cursor-pointer select-none items-center gap-1.5 rounded-full px-3 text-xs transition-colors ${
                  isActive
                    ? "bg-neutral-700 text-white"
                    : "text-neutral-500 hover:bg-neutral-800 hover:text-neutral-300"
                }`}
                onClick={() => setActiveTab(tab.id)}
                onMouseDown={(e) => {
                  if (e.button === 1) {
                    e.preventDefault();
                    closeTab(tab.id);
                  }
                }}
              >
                <span className="truncate">{tab.name}</span>
                {dirty && (
                  <span className="size-1.5 shrink-0 rounded-full bg-amber-400" />
                )}
                <button
                  className={`ml-auto shrink-0 rounded-full p-0.5 transition-colors ${
                    isActive
                      ? "text-neutral-400 hover:bg-neutral-600 hover:text-white"
                      : "hover:!bg-neutral-700 hover:!text-white text-transparent group-hover:text-neutral-500"
                  }`}
                  onClick={(e) => {
                    e.stopPropagation();
                    closeTab(tab.id);
                  }}
                  type="button"
                >
                  <X className="size-3" />
                </button>
              </div>
            </ContextMenuTrigger>
            <ContextMenuContent className="w-52">
              <ContextMenuItem onClick={() => closeTab(tab.id)}>
                <X className="mr-2 size-4" />
                Close Tab
              </ContextMenuItem>
              <ContextMenuItem
                disabled={tabs.length <= 1}
                onClick={() => closeOtherTabs(tab.id)}
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
                Reopen Closed Tab
                {closedTabs.length > 0 && (
                  <span className="ml-auto text-muted-foreground text-xs">
                    {closedTabs[0].name}
                  </span>
                )}
              </ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>
        );
      })}
    </div>
  );
}
