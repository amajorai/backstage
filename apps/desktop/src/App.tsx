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
import { Toaster } from "@repo/ui/sonner";
import { useEffect, useState } from "react";
import { sileo } from "sileo";
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
import { NewProjectDialog } from "@/components/gallery/NewProjectDialog";
import { ImageEditor } from "@/components/ImageEditor";
import { LicenseActivation } from "@/components/LicenseActivation";
// biome-ignore lint/correctness/noUnusedImports: used in JSX below
import { OnboardingPage } from "@/components/OnboardingPage";
import { SettingsPage } from "@/components/SettingsPage";
import { TrashPage } from "@/components/TrashPage";
import { ResizablePanel } from "@/components/ui/resizable-panel";
import { VideoExtractor } from "@/components/VideoExtractor";
import { useAppUpdater } from "@/hooks/use-app-updater";
import { usePersistedViewMode } from "@/hooks/use-persisted-view-mode";
import { useWindowBounds } from "@/hooks/use-window-bounds";
import { setAxiomLoggingEnabled } from "@/lib/logger";
import { runMigrations } from "@/lib/migration";
import { initPostHog, trackPage } from "@/lib/posthog";
import { useAppSettingsStore } from "@/stores/use-app-settings-store";
import { type Layer, useEditorStore } from "@/stores/use-editor-store";
import { useFolderStore } from "@/stores/use-folder-store";
import {
  type ThumbnailItem,
  useGalleryStore,
} from "@/stores/use-gallery-store";
import { useLicenseStore } from "@/stores/use-license-store";
import { useSelectionStore } from "@/stores/use-selection-store";
import { useTabsStore } from "@/stores/use-tabs-store";

export type ViewMode = "3" | "4" | "5" | "row";
export type Page =
  | "gallery"
  | "ai-generate"
  | "trash"
  | "settings"
  | "explore"
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
  const [page, setPage] = useState<Page>("gallery");
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
  const [editorRightPanel, setEditorRightPanel] = useState<
    "settings" | "ai-generate" | null
  >(null);

  const saveProject = useGalleryStore((s) => s.saveProject);
  const thumbnails = useGalleryStore((s) => s.thumbnails);
  const isGalleryLoaded = useGalleryStore((s) => s.isLoaded);

  const tabs = useTabsStore((s) => s.tabs);
  const activeTabId = useTabsStore((s) => s.activeTabId);
  const editorVisible = useTabsStore((s) => s.editorVisible);
  const openTab = useTabsStore((s) => s.openTab);
  const setEditorVisible = useTabsStore((s) => s.setEditorVisible);

  const { isValidated, isValidating, loadStoredLicense } = useLicenseStore();
  const {
    loadSettings,
    isInitialLoadDone,
    analyticsEnabled,
    loggingEnabled,
    onboardingCompleted,
    setOnboardingCompleted,
  } = useAppSettingsStore();

  useEffect(() => {
    runMigrations();
    loadStoredLicense();
    loadSettings();
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
    if (!(isInitialLoadDone && isValidated && isGalleryLoaded)) return;
    void useTabsStore.getState().restorePersistedTabs();
  }, [isInitialLoadDone, isValidated, isGalleryLoaded]);

  if (!isInitialLoadDone || (isValidating && !isValidated)) {
    return (
      <div className="flex h-screen items-center justify-center bg-muted">
        <div className="flex flex-col items-center gap-4">
          <div className="size-8 animate-spin rounded-full border-4 border-foreground border-t-transparent" />
          <p className="text-muted-foreground text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  if (!onboardingCompleted) {
    return (
      <OnboardingPage
        isLicenseActive={isValidated}
        onComplete={() => setOnboardingCompleted(true)}
      />
    );
  }

  if (!isValidated) {
    return <LicenseActivation onBack={() => setOnboardingCompleted(false)} />;
  }

  const handleExportSelected = () => {
    const { selectedIds } = useSelectionStore.getState();
    const { thumbnails: allThumbnails } = useGalleryStore.getState();
    const selected = allThumbnails.filter((t) => selectedIds.has(t.id));
    if (selected.length === 1) {
      setExportingThumbnail(selected[0]);
    } else if (selected.length > 1) {
      setExportingThumbnails(selected);
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
    setPage("ai-generate");
  };

  const handleRemix = (thumbnailUrl: string, title: string) => {
    setAiEditorLayers(null);
    setRemixSourceUrl(thumbnailUrl);
    setRemixTitle(title);
    setAiGenerateSource("remix");
    setPage("ai-generate");
  };

  const handleCloseAiGenerate = () => {
    setAiEditorLayers(null);
    if (aiGenerateSource === "editor") {
      setEditorRightPanel(null);
    } else if (aiGenerateSource === "remix") {
      setRemixSourceUrl(null);
      setRemixTitle(null);
      setPage("explore");
    } else {
      setPage("gallery");
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

  const activeTab = tabs.find((t) => t.id === activeTabId);
  const activeThumbnail = activeTab
    ? thumbnails.find((t) => t.id === activeTab.thumbnailId)
    : null;

  const showGallery = page === "gallery" && !editorVisible;

  return (
    <div className="flex h-screen flex-col bg-muted">
      <TabBar
        activePage={editorVisible ? "gallery" : page}
        onPageChange={(p) => {
          setEditorVisible(false);
          if (p === "ai-generate") {
            handleOpenAiGenerateFromGallery();
          } else {
            setPage(p);
          }
        }}
      />

      {/* Gallery — always mounted so scroll/state survives navigation */}
      <div
        className={contentClass}
        style={{ display: showGallery ? "flex" : "none" }}
      >
        <Gallery
          onAddVideoClick={() => setShowExtractor(true)}
          onExportClick={setExportingThumbnail}
          onNewFolderClick={() => setNewFolderOpen(true)}
          onNewProjectClick={() => setNewProjectOpen(true)}
          onThumbnailClick={handleEditThumbnail}
          viewMode={viewMode}
        />
      </div>

      {/* Editor — stays mounted while tabs exist; right panel for settings / AI */}
      {activeTab && activeThumbnail && (
        <div
          className="mx-1 mb-1 flex flex-1 overflow-hidden"
          style={{ display: editorVisible ? "flex" : "none" }}
        >
          <div className="flex flex-1 flex-col overflow-hidden rounded-xl border-2 border-border bg-background">
            <ImageEditor
              onAiGenerate={handleOpenAiGenerate}
              onClose={() => setEditorVisible(false)}
              onExport={() => setExportingThumbnail(activeThumbnail)}
              onOpenSettings={() => setEditorRightPanel("settings")}
              snapshot={activeTab.snapshot}
              tabId={activeTabId!}
              thumbnail={activeThumbnail}
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
        (aiGenerateSource === "gallery" || aiGenerateSource === "remix") && (
          <GeminiImagePage
            canvasHeight={aiCanvasHeight}
            canvasWidth={aiCanvasWidth}
            editorLayers={null}
            fullPage
            onClose={handleCloseAiGenerate}
            onSaveAsImage={handleSaveAiImage}
            onSaveAsLayer={undefined}
            onSettings={() => setPage("settings")}
            remixSourceUrl={remixSourceUrl ?? undefined}
            remixTitle={remixTitle ?? undefined}
          />
        )}

      {/* Explore */}
      {page === "explore" && !editorVisible && (
        <ExplorePage
          onClose={() => setPage("gallery")}
          onRemix={handleRemix}
          onSettings={() => setPage("settings")}
        />
      )}

      {/* Trash */}
      {page === "trash" && !editorVisible && (
        <TrashPage onClose={() => setPage("gallery")} />
      )}

      {/* Archive */}
      {page === "archive" && !editorVisible && (
        <ArchivePage onClose={() => setPage("gallery")} />
      )}

      {/* Settings */}
      {page === "settings" && !editorVisible && (
        <SettingsPage onClose={() => setPage("gallery")} />
      )}

      {showGallery && (
        <div className="mx-1 mb-1">
          <BottomToolbar
            onAddVideoClick={() => setShowExtractor(true)}
            onArchiveClick={() => setPage("archive")}
            onExportSelected={handleExportSelected}
            onNewFolderClick={() => setNewFolderOpen(true)}
            onNewProjectClick={() => setNewProjectOpen(true)}
            onSettingsClick={() => setPage("settings")}
            onTrashClick={() => setPage("trash")}
            onViewModeChange={setViewMode}
            viewMode={viewMode}
          />
        </div>
      )}

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
      <NewProjectDialog
        onCreate={handleCreateProject}
        onOpenChange={setNewProjectOpen}
        open={newProjectOpen}
      />
      <Dialog
        onOpenChange={(open) => {
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
            <DialogClose render={<Button variant="ghost" />}>
              Cancel
            </DialogClose>
            <Button
              disabled={!newFolderName.trim()}
              onClick={async () => {
                if (!newFolderName.trim()) return;
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
        onPageChange={(p) => {
          setEditorVisible(false);
          setPage(p);
        }}
        open={commandOpen}
      />
      <Toaster />
      <BackgroundRemovalQueue />
      <AutoRenameQueue />
      <UpdateChecker />
      <WindowBoundsManager />
    </div>
  );
}
