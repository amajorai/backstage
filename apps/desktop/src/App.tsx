import { Button } from "@repo/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/dialog";
import { Input } from "@repo/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@repo/ui/tooltip";
import { MessageCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { sileo } from "sileo";
import { AiProjectPage } from "@/components/AiProjectPage";
import { AiProjectsGallery } from "@/components/AiProjectsGallery";
import { ArchivePage } from "@/components/ArchivePage";
import { AutoRenameQueue } from "@/components/AutoRenameQueue";
import { BackgroundRemovalQueue } from "@/components/BackgroundRemovalQueue";
import { BottomToolbar } from "@/components/BottomToolbar";
import { CommandPalette } from "@/components/CommandPalette";
import { ExplorePage } from "@/components/ExplorePage";
import { ExportDialog } from "@/components/ExportDialog";
import { TabBar } from "@/components/editor/TabBar";
import { FolderColorPicker } from "@/components/FolderColorPicker";
import { Gallery } from "@/components/Gallery";
import { GeminiImagePage } from "@/components/GeminiImagePage";
import { ChatPanel } from "@/components/GlobalChat";
import { NewProjectDialog } from "@/components/gallery/NewProjectDialog";
import { ImageEditor } from "@/components/ImageEditor";
import { LicenseActivation } from "@/components/LicenseActivation";
import { MyChannelPage } from "@/components/MyChannelPage";
// biome-ignore lint/correctness/noUnusedImports: used in JSX below
import { OnboardingPage } from "@/components/OnboardingPage";
import { SettingsPage } from "@/components/SettingsPage";
import { TrashPage } from "@/components/TrashPage";
import { ResizablePanel } from "@/components/ui/resizable-panel";
import { Toaster } from "@/components/ui/sonner";
import { VersionGateModal } from "@/components/VersionGateModal";
import { VideoExtractor } from "@/components/VideoExtractor";
import { useAcpToolRunner } from "@/hooks/use-acp-tool-runner";
import { useAppUpdater } from "@/hooks/use-app-updater";
import { usePersistedViewMode } from "@/hooks/use-persisted-view-mode";
import { useWindowBounds } from "@/hooks/use-window-bounds";
import { setAxiomLoggingEnabled } from "@/lib/logger";
import { runMigrations } from "@/lib/migration";
import { initPostHog, trackPage } from "@/lib/posthog";
import * as sounds from "@/lib/sounds";
import { useAppSettingsStore } from "@/stores/use-app-settings-store";
import { type Layer, useEditorStore } from "@/stores/use-editor-store";
import { useFolderStore } from "@/stores/use-folder-store";
import {
  type ThumbnailItem,
  useGalleryStore,
} from "@/stores/use-gallery-store";
import { useLicenseStore } from "@/stores/use-license-store";
import { useNavigationStore } from "@/stores/use-navigation-store";
import { useSelectionStore } from "@/stores/use-selection-store";
import { useTabsStore } from "@/stores/use-tabs-store";

export type ViewMode = "3" | "4" | "5" | "row";
export type Page =
  | "gallery"
  | "ai-generate"
  | "ai-projects"
  | "trash"
  | "settings"
  | "explore"
  | "my-channel"
  | "archive";

function UpdateChecker() {
  useAppUpdater();
  return null;
}

function WindowBoundsManager() {
  useWindowBounds();
  return null;
}

export default function App() {
  const [viewMode, setViewMode] = usePersistedViewMode(
    "view-mode:gallery",
    "4"
  );
  const [commandOpen, setCommandOpen] = useState(false);
  const [showExtractor, setShowExtractor] = useState(false);
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [newFolderColor, setNewFolderColor] = useState<string | null>(null);
  const [exportingThumbnail, setExportingThumbnail] =
    useState<ThumbnailItem | null>(null);
  const [exportingThumbnails, setExportingThumbnails] = useState<
    ThumbnailItem[]
  >([]);
  const [aiEditorLayers, setAiEditorLayers] = useState<Layer[] | null>(null);
  const [aiCanvasWidth, setAiCanvasWidth] = useState(1280);
  const [aiCanvasHeight, setAiCanvasHeight] = useState(720);
  const [aiGenerateSource, setAiGenerateSource] = useState<
    "editor" | "gallery" | "remix"
  >("editor");
  const [remixSourceUrl, setRemixSourceUrl] = useState<string | null>(null);
  const [remixTitle, setRemixTitle] = useState<string | null>(null);
  const [openAiProjectId, setOpenAiProjectId] = useState<string | null>(null);
  const [editorRightPanel, setEditorRightPanel] = useState<
    "settings" | "ai-generate" | null
  >(null);
  const [chatOpen, setChatOpen] = useState(false);

  const saveProject = useGalleryStore((s) => s.saveProject);
  const thumbnails = useGalleryStore((s) => s.thumbnails);
  const isGalleryLoaded = useGalleryStore((s) => s.isLoaded);

  const tabs = useTabsStore((s) => s.tabs);
  const activeTabId = useTabsStore((s) => s.activeTabId);
  const openTab = useTabsStore((s) => s.openTab);
  const openPageTab = useTabsStore((s) => s.openPageTab);

  // The tab strip is the single source of truth for what's on screen. `page` and
  // `editorVisible` are derived from the active tab so every existing
  // `page === X && !editorVisible` guard below keeps working unchanged.
  const activeTab = tabs.find((t) => t.id === activeTabId);
  const editorVisible = activeTab?.kind === "project";
  const page: Page = activeTab?.kind === "page" ? activeTab.page : "gallery";

  // Keep the editor mounted for the most recently active project tab even while
  // a page tab is showing, so switching back preserves its in-memory UI state
  // (per-tab chrome, scroll, selection) instead of remounting from a snapshot.
  const lastProjectTabIdRef = useRef<string | null>(null);
  if (activeTab?.kind === "project") {
    lastProjectTabIdRef.current = activeTab.id;
  }
  const editorTabRaw = tabs.find((t) => t.id === lastProjectTabIdRef.current);
  const editorTab = editorTabRaw?.kind === "project" ? editorTabRaw : undefined;

  const mainContentRef = useRef<HTMLDivElement>(null);
  // Latches true once the app first renders its main UI. The full-screen loader
  // is only for the initial load; an in-flight `isValidating` from an
  // interactive license activation must NOT tear the tree down and remount it
  // (that re-runs window-bounds restore, which un-maximizes the window).
  const hasPassedInitialLoadRef = useRef(false);

  const {
    isValidated,
    isValidating,
    loadStoredLicense,
    gateOpen: licenseGateOpen,
    openLicenseGate,
    closeLicenseGate,
  } = useLicenseStore();
  // Export the user intended before hitting the license gate. Replayed once the
  // license activates so they land straight in the export dialog they wanted.
  const pendingExportRef = useRef<
    | { kind: "single"; thumbnail: ThumbnailItem }
    | { kind: "multi"; thumbnails: ThumbnailItem[] }
    | null
  >(null);
  const {
    loadSettings,
    isInitialLoadDone,
    analyticsEnabled,
    loggingEnabled,
    onboardingCompleted,
    setOnboardingCompleted,
    experimentalFeaturesEnabled,
  } = useAppSettingsStore();

  useEffect(() => {
    // App-data migration must finish first — it moves files from the old
    // `pub.youtube.desktop` appdata dir to the current one. Reading the
    // license/settings before it completes can show a freshly-installed user
    // as unlicensed on upgrade from the rebranded build.
    (async () => {
      try {
        await runMigrations();
      } catch {
        // best-effort migration; still load license/settings
      }
      loadStoredLicense();
      loadSettings();
    })();
  }, [loadStoredLicense, loadSettings]);

  useEffect(() => {
    if (!isInitialLoadDone) return;
    initPostHog(analyticsEnabled);
    setAxiomLoggingEnabled(loggingEnabled);
  }, [isInitialLoadDone, analyticsEnabled, loggingEnabled]);

  useEffect(() => {
    trackPage(page);
  }, [page]);

  // Restore persisted tabs once gallery and settings are ready
  useEffect(() => {
    if (!(isInitialLoadDone && isGalleryLoaded)) return;
    void useTabsStore.getState().restorePersistedTabs();
  }, [isInitialLoadDone, isGalleryLoaded]);

  // Once the license activates while the gate is open, close it and replay the
  // export the user was reaching for.
  useEffect(() => {
    if (!(isValidated && licenseGateOpen)) return;
    closeLicenseGate();
    const pending = pendingExportRef.current;
    pendingExportRef.current = null;
    if (pending?.kind === "single") {
      setExportingThumbnail(pending.thumbnail);
    } else if (pending?.kind === "multi") {
      setExportingThumbnails(pending.thumbnails);
    }
  }, [isValidated, licenseGateOpen, closeLicenseGate]);

  // ACP tool runner: handle tool calls from AI agents
  useAcpToolRunner();

  const { pendingPage, clearPending } = useNavigationStore();
  useEffect(() => {
    if (!pendingPage) return;
    if (pendingPage === "ai-generate") {
      // Generate needs its source state primed or the full-page block renders
      // blank; mirror handleOpenAiGenerateFromGallery here.
      setAiEditorLayers(null);
      setRemixSourceUrl(null);
      setRemixTitle(null);
      setAiGenerateSource("gallery");
      openPageTab("ai-generate");
    } else {
      openPageTab(pendingPage);
    }
    clearPending();
  }, [pendingPage, clearPending, openPageTab]);

  const showInitialLoading =
    !isInitialLoadDone || (isValidating && !isValidated);
  if (showInitialLoading && !hasPassedInitialLoadRef.current) {
    return (
      <div className="flex h-screen items-center justify-center bg-muted">
        <div className="flex flex-col items-center gap-4">
          <div className="size-8 animate-spin rounded-full border-4 border-foreground border-t-transparent" />
          <p className="text-muted-foreground text-sm">Loading...</p>
        </div>
      </div>
    );
  }
  hasPassedInitialLoadRef.current = true;

  if (!onboardingCompleted) {
    return <OnboardingPage onComplete={() => setOnboardingCompleted(true)} />;
  }

  // Route an export request through the license gate. Activated users go
  // straight to the export dialog; everyone else sees the activation page and
  // their export is replayed once they activate.
  const requestExportThumbnail = (thumbnail: ThumbnailItem) => {
    if (isValidated) {
      setExportingThumbnail(thumbnail);
      return;
    }
    pendingExportRef.current = { kind: "single", thumbnail };
    openLicenseGate();
  };

  const requestExportThumbnails = (items: ThumbnailItem[]) => {
    if (isValidated) {
      setExportingThumbnails(items);
      return;
    }
    pendingExportRef.current = { kind: "multi", thumbnails: items };
    openLicenseGate();
  };

  const handleExportSelected = () => {
    const { selectedIds } = useSelectionStore.getState();
    const { thumbnails: allThumbnails } = useGalleryStore.getState();
    const selected = allThumbnails.filter((t) => selectedIds.has(t.id));
    if (selected.length === 1) {
      requestExportThumbnail(selected[0]);
    } else if (selected.length > 1) {
      requestExportThumbnails(selected);
    }
  };

  const handleEditThumbnail = (thumbnail: ThumbnailItem) => {
    openTab(thumbnail);
  };

  const handleOpenAiGenerate = () => {
    const { layers, canvasWidth, canvasHeight } = useEditorStore.getState();
    setAiEditorLayers(layers);
    setAiCanvasWidth(canvasWidth);
    setAiCanvasHeight(canvasHeight);
    setAiGenerateSource("editor");
    setEditorRightPanel("ai-generate");
  };

  const handleOpenAiGenerateFromGallery = () => {
    setAiEditorLayers(null);
    setRemixSourceUrl(null);
    setRemixTitle(null);
    setAiGenerateSource("gallery");
    openPageTab("ai-generate");
  };

  const handleRemix = (thumbnailUrl: string, title: string) => {
    setAiEditorLayers(null);
    setRemixSourceUrl(thumbnailUrl);
    setRemixTitle(title);
    setAiGenerateSource("remix");
    openPageTab("ai-generate");
  };

  const handleCloseAiGenerate = () => {
    setAiEditorLayers(null);
    if (aiGenerateSource === "editor") {
      setEditorRightPanel(null);
    } else if (aiGenerateSource === "remix") {
      setRemixSourceUrl(null);
      setRemixTitle(null);
      openPageTab("explore");
    } else {
      openPageTab("gallery");
    }
  };

  // Single entry point for "navigate to a page" used by the tab strip's + menu
  // and the command palette. Generate is special-cased so its source state is
  // primed before the page tab opens.
  const goToPage = (p: Page) => {
    if (p === "ai-generate") {
      handleOpenAiGenerateFromGallery();
    } else {
      openPageTab(p);
    }
  };

  const handleCreateProject = async (
    width: number,
    height: number,
    name: string
  ) => {
    const bgLayer: any = {
      id: crypto.randomUUID(),
      type: "shape",
      shapeType: "rect",
      name: "Background Layer",
      locked: true,
      visible: true,
      x: 0,
      y: 0,
      width,
      height,
      fill: "#ffffff",
      stroke: "",
      strokeWidth: 0,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      opacity: 1,
      cornerRadius: 0,
    };

    const previewDataUrl =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAAXNSR0IArs4c6QAAAA1JREFUGFdj+P///38ACfsD/QVkeKcAAAAASUVORK5CYII=";

    const id = await saveProject(
      null,
      name,
      previewDataUrl,
      [bgLayer],
      width,
      height
    );

    const newThumbnail = useGalleryStore
      .getState()
      .thumbnails.find((t) => t.id === id);
    if (newThumbnail) {
      handleEditThumbnail(newThumbnail);
    }
  };

  const handleSaveAiLayer = (dataUrl: string) => {
    const img = new window.Image();
    img.onload = () => {
      useEditorStore.getState().addImageLayer(dataUrl, img.width, img.height);
    };
    img.src = dataUrl;
  };

  const handleSaveAiImage = async (dataUrl: string) => {
    const { addThumbnail } = await import("@/stores/use-gallery-store").then(
      (m) => m.useGalleryStore.getState()
    );
    await addThumbnail(dataUrl, "AI Generated");
  };

  const contentClass =
    "mx-1 flex flex-1 flex-col overflow-hidden rounded-xl border-2 border-border bg-background";
  const contentClassWithBottom = `${contentClass} mb-1`;

  const editorThumbnail = editorTab
    ? thumbnails.find((t) => t.id === editorTab.thumbnailId)
    : null;

  const showGallery = page === "gallery" && !editorVisible;
  const isSettingsPage = page === "settings" && !editorVisible;

  return (
    <TooltipProvider>
      <div className="flex h-screen flex-col bg-muted">
        <TabBar onPageChange={goToPage} />

        <div className="flex min-h-0 flex-1 overflow-hidden">
          {/* Main content column — shrinks when the chat panel is open */}
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            {/* Gallery — always mounted so scroll/state survives navigation */}
            <div
              className={contentClass}
              style={{ display: showGallery ? "flex" : "none" }}
            >
              <Gallery
                onAddVideoClick={() => setShowExtractor(true)}
                onExportClick={requestExportThumbnail}
                onNewFolderClick={() => setNewFolderOpen(true)}
                onNewProjectClick={() => setNewProjectOpen(true)}
                onThumbnailClick={handleEditThumbnail}
                viewMode={viewMode}
              />
            </div>

            {/* Editor — stays mounted while a project tab exists; right panel for settings / AI */}
            {editorTab && editorThumbnail && (
              <div
                className="mx-1 mb-1 flex flex-1 overflow-hidden"
                style={{ display: editorVisible ? "flex" : "none" }}
              >
                <div className="flex flex-1 flex-col overflow-hidden rounded-xl border-2 border-border bg-background">
                  <ImageEditor
                    onAiGenerate={handleOpenAiGenerate}
                    onClose={() => openPageTab("gallery")}
                    onExport={() => requestExportThumbnail(editorThumbnail)}
                    onOpenSettings={() =>
                      setEditorRightPanel((panel) =>
                        panel === "settings" ? null : "settings"
                      )
                    }
                    snapshot={editorTab.snapshot}
                    tabId={editorTab.id}
                    thumbnail={editorThumbnail}
                  />
                </div>

                {editorRightPanel && (
                  <ResizablePanel
                    className="ml-1"
                    defaultWidth={600}
                    maxWidth={1100}
                    minWidth={400}
                    side="right"
                  >
                    {editorRightPanel === "settings" ? (
                      <SettingsPage onClose={() => setEditorRightPanel(null)} />
                    ) : (
                      <div className="flex h-full flex-col overflow-hidden rounded-xl border-2 border-border bg-background">
                        <GeminiImagePage
                          canvasHeight={aiCanvasHeight}
                          canvasWidth={aiCanvasWidth}
                          editorLayers={aiEditorLayers}
                          onClose={handleCloseAiGenerate}
                          onSaveAsImage={handleSaveAiImage}
                          onSaveAsLayer={handleSaveAiLayer}
                          onSettings={() => setEditorRightPanel("settings")}
                        />
                      </div>
                    )}
                  </ResizablePanel>
                )}
              </div>
            )}

            {/* AI Generate — full page from gallery or remix */}
            {page === "ai-generate" &&
              (aiGenerateSource === "gallery" ||
                aiGenerateSource === "remix") && (
                <GeminiImagePage
                  canvasHeight={aiCanvasHeight}
                  canvasWidth={aiCanvasWidth}
                  editorLayers={null}
                  fullPage
                  onClose={handleCloseAiGenerate}
                  onSaveAsImage={handleSaveAiImage}
                  onSaveAsLayer={undefined}
                  onSettings={() => openPageTab("settings")}
                  remixSourceUrl={remixSourceUrl ?? undefined}
                  remixTitle={remixTitle ?? undefined}
                />
              )}

            {/* AI Projects */}
            {page === "ai-projects" &&
              !editorVisible &&
              (openAiProjectId ? (
                <div className={contentClassWithBottom}>
                  <AiProjectPage
                    onClose={() => setOpenAiProjectId(null)}
                    onSettings={() => openPageTab("settings")}
                    projectId={openAiProjectId}
                  />
                </div>
              ) : (
                <div className={contentClassWithBottom}>
                  <AiProjectsGallery
                    onOpenProject={(id) => setOpenAiProjectId(id)}
                  />
                </div>
              ))}

            {/* Explore */}
            {page === "explore" && !editorVisible && (
              <ExplorePage
                onClose={() => openPageTab("gallery")}
                onRemix={handleRemix}
                onSettings={() => openPageTab("settings")}
              />
            )}

            {/* My Channel */}
            {page === "my-channel" && !editorVisible && (
              <MyChannelPage
                onClose={() => openPageTab("gallery")}
                onRemix={handleRemix}
                onSettings={() => openPageTab("settings")}
              />
            )}

            {/* Trash */}
            {page === "trash" && !editorVisible && (
              <TrashPage onClose={() => openPageTab("gallery")} />
            )}

            {/* Archive */}
            {page === "archive" && !editorVisible && (
              <ArchivePage onClose={() => openPageTab("gallery")} />
            )}

            {/* Settings */}
            {page === "settings" && !editorVisible && (
              <SettingsPage onClose={() => openPageTab("gallery")} />
            )}

            {showGallery && (
              <div className="mx-1 mb-1">
                <BottomToolbar
                  onAddVideoClick={() => setShowExtractor(true)}
                  onArchiveClick={() => openPageTab("archive")}
                  onExportSelected={handleExportSelected}
                  onNewFolderClick={() => setNewFolderOpen(true)}
                  onNewProjectClick={() => setNewProjectOpen(true)}
                  onSettingsClick={() => openPageTab("settings")}
                  onTrashClick={() => openPageTab("trash")}
                  onViewModeChange={setViewMode}
                  viewMode={viewMode}
                />
              </div>
            )}
          </div>

          {/* Global assistant chat — resizable right panel, like the editor's
              AI/settings panels */}
          {chatOpen && (
            <ResizablePanel
              className="mr-1 mb-1 ml-1"
              defaultWidth={460}
              maxWidth={900}
              minWidth={340}
              side="right"
            >
              <ChatPanel onClose={() => setChatOpen(false)} />
            </ResizablePanel>
          )}
        </div>

        {showExtractor && (
          <VideoExtractor onClose={() => setShowExtractor(false)} />
        )}
        {exportingThumbnail && (
          <ExportDialog
            onClose={() => setExportingThumbnail(null)}
            thumbnail={exportingThumbnail}
            useCurrentEditorState={editorVisible}
          />
        )}
        {exportingThumbnails.length > 0 && (
          <ExportDialog
            onClose={() => setExportingThumbnails([])}
            thumbnails={exportingThumbnails}
          />
        )}
        {licenseGateOpen && !isValidated && (
          <div className="fixed inset-0 z-[1100]">
            <LicenseActivation
              onBack={() => {
                pendingExportRef.current = null;
                closeLicenseGate();
              }}
            />
          </div>
        )}
        <NewProjectDialog
          onCreate={handleCreateProject}
          onOpenChange={setNewProjectOpen}
          open={newProjectOpen}
        />
        <Dialog
          onOpenChange={(open) => {
            open ? sounds.dialogOpen() : sounds.dialogClose();
            setNewFolderOpen(open);
            if (!open) {
              setNewFolderName("");
              setNewFolderColor(null);
            }
          }}
          open={newFolderOpen}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New Folder</DialogTitle>
            </DialogHeader>
            <Input
              autoFocus
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={async (e) => {
                if (e.key === "Enter" && newFolderName.trim()) {
                  await useFolderStore
                    .getState()
                    .createFolder(newFolderName.trim(), newFolderColor);
                  sileo.success({
                    title: `Folder "${newFolderName.trim()}" created`,
                  });
                  setNewFolderName("");
                  setNewFolderColor(null);
                  setNewFolderOpen(false);
                }
              }}
              placeholder="Folder name"
              value={newFolderName}
            />
            <FolderColorPicker
              onChange={setNewFolderColor}
              value={newFolderColor}
            />
            <DialogFooter>
              <DialogClose
                render={<Button onClick={sounds.click} variant="ghost" />}
              >
                Cancel
              </DialogClose>
              <Button
                disabled={!newFolderName.trim()}
                onClick={async () => {
                  if (!newFolderName.trim()) return;
                  sounds.success();
                  await useFolderStore
                    .getState()
                    .createFolder(newFolderName.trim(), newFolderColor);
                  sileo.success({
                    title: `Folder "${newFolderName.trim()}" created`,
                  });
                  setNewFolderName("");
                  setNewFolderColor(null);
                  setNewFolderOpen(false);
                }}
              >
                Create
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <CommandPalette
          onAddVideo={() => setShowExtractor(true)}
          onAiGenerate={handleOpenAiGenerateFromGallery}
          onNewFolder={() => setNewFolderOpen(true)}
          onNewProject={() => setNewProjectOpen(true)}
          onOpenChange={setCommandOpen}
          onPageChange={goToPage}
          open={commandOpen}
        />
        <Toaster />
        {/* Assistant launcher — gated behind experimental features, and hidden
            on the settings page and while the chat panel is open. Uses the
            default (primary) button variant. */}
        {experimentalFeaturesEnabled && !(isSettingsPage || chatOpen) && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                aria-label="Open assistant"
                className="fixed right-5 bottom-16 z-50 size-14 rounded-full shadow-lg transition-transform hover:scale-110"
                onClick={() => {
                  sounds.click();
                  setChatOpen(true);
                }}
                size="icon"
                type="button"
              >
                <MessageCircle className="size-6" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">Assistant</TooltipContent>
          </Tooltip>
        )}
        <BackgroundRemovalQueue />
        <AutoRenameQueue />
        <UpdateChecker />
        <VersionGateModal />
        <WindowBoundsManager />
      </div>
    </TooltipProvider>
  );
}
