import { useEffect, useState } from "react";
import { AutoRenameQueue } from "@/components/AutoRenameQueue";
import { BackgroundRemovalQueue } from "@/components/BackgroundRemovalQueue";
import { BottomToolbar } from "@/components/BottomToolbar";
import { ExportDialog } from "@/components/ExportDialog";
import { TabBar } from "@/components/editor/TabBar";
import { Gallery } from "@/components/Gallery";
import { GeminiImagePage } from "@/components/GeminiImagePage";
import { NewProjectDialog } from "@/components/gallery/NewProjectDialog";
import { ImageEditor } from "@/components/ImageEditor";
import { LicenseActivation } from "@/components/LicenseActivation";
import { SettingsPage } from "@/components/SettingsPage";
import { TrashPage } from "@/components/TrashPage";
import { Toaster } from "@/components/ui/sonner";
import { VideoExtractor } from "@/components/VideoExtractor";
import { useAppUpdater } from "@/hooks/use-app-updater";
import { setAxiomLoggingEnabled } from "@/lib/logger";
import { runMigrations } from "@/lib/migration";
import { initPostHog, trackPage } from "@/lib/posthog";
import { useAppSettingsStore } from "@/stores/use-app-settings-store";
import { useEditorStore } from "@/stores/use-editor-store";
import {
  type ThumbnailItem,
  useGalleryStore,
} from "@/stores/use-gallery-store";
import { useLicenseStore } from "@/stores/use-license-store";
import { useSelectionStore } from "@/stores/use-selection-store";
import { useTabsStore } from "@/stores/use-tabs-store";

export type ViewMode = "3" | "4" | "5" | "row";
type Page = "gallery" | "ai-generate" | "trash" | "settings";

function UpdateChecker() {
  useAppUpdater();
  return null;
}

export default function App() {
  const [page, setPage] = useState<Page>("gallery");
  const [viewMode, setViewMode] = useState<ViewMode>("4");
  const [showExtractor, setShowExtractor] = useState(false);
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [exportingThumbnail, setExportingThumbnail] =
    useState<ThumbnailItem | null>(null);
  const [exportingThumbnails, setExportingThumbnails] = useState<
    ThumbnailItem[]
  >([]);
  const [aiInputImage, setAiInputImage] = useState<string | null>(null);
  const [aiGenerateSource, setAiGenerateSource] = useState<
    "editor" | "gallery"
  >("editor");

  const saveProject = useGalleryStore((s) => s.saveProject);
  const thumbnails = useGalleryStore((s) => s.thumbnails);
  const isGalleryLoaded = useGalleryStore((s) => s.isLoaded);

  const tabs = useTabsStore((s) => s.tabs);
  const activeTabId = useTabsStore((s) => s.activeTabId);
  const editorVisible = useTabsStore((s) => s.editorVisible);
  const openTab = useTabsStore((s) => s.openTab);
  const closeTab = useTabsStore((s) => s.closeTab);
  const setEditorVisible = useTabsStore((s) => s.setEditorVisible);

  const { isValidated, isValidating, loadStoredLicense } = useLicenseStore();
  const { loadSettings, isInitialLoadDone, analyticsEnabled, loggingEnabled } =
    useAppSettingsStore();

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

  if (isValidating && !isValidated) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="size-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-muted-foreground text-sm">Checking license...</p>
        </div>
      </div>
    );
  }

  if (!isValidated) {
    return <LicenseActivation />;
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

  const handleOpenAiGenerate = (imageDataUrl: string) => {
    setAiInputImage(imageDataUrl);
    setAiGenerateSource("editor");
    setPage("ai-generate");
  };

  const handleOpenAiGenerateFromGallery = () => {
    setAiInputImage(null);
    setAiGenerateSource("gallery");
    setPage("ai-generate");
  };

  const handleCloseAiGenerate = () => {
    setAiInputImage(null);
    setPage("gallery");
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
    "flex flex-1 flex-col overflow-hidden rounded-tl-xl rounded-tr-xl border-t border-neutral-800";

  // AI Generate page
  if (page === "ai-generate") {
    return (
      <div className="flex h-screen flex-col bg-neutral-950">
        {tabs.length > 0 && <TabBar activePage={page} />}
        <div className={contentClass}>
          <GeminiImagePage
            inputImageDataUrl={aiInputImage}
            onClose={handleCloseAiGenerate}
            onSaveAsImage={handleSaveAiImage}
            onSaveAsLayer={
              aiGenerateSource === "editor" ? handleSaveAiLayer : undefined
            }
          />
        </div>
        <Toaster />
      </div>
    );
  }

  // Trash page
  if (page === "trash") {
    return (
      <div className="flex h-screen flex-col bg-neutral-950">
        {tabs.length > 0 && <TabBar activePage={page} />}
        <div className={contentClass}>
          <TrashPage onClose={() => setPage("gallery")} />
        </div>
        <Toaster />
      </div>
    );
  }

  // Settings page
  if (page === "settings") {
    return (
      <div className="flex h-screen flex-col bg-neutral-950">
        {tabs.length > 0 && <TabBar activePage={page} />}
        <div className={contentClass}>
          <SettingsPage onClose={() => setPage("gallery")} />
        </div>
        <Toaster />
      </div>
    );
  }

  // Editor (tab open and editor visible)
  if (editorVisible && activeTabId && tabs.length > 0) {
    const activeTab = tabs.find((t) => t.id === activeTabId);
    const activeThumbnail = activeTab
      ? thumbnails.find((t) => t.id === activeTab.thumbnailId)
      : null;

    return (
      <div className="flex h-screen flex-col bg-neutral-950">
        <TabBar activePage="gallery" />
        <div className={contentClass}>
          {activeTab && activeThumbnail && (
            <ImageEditor
              key={activeTabId}
              onAiGenerate={handleOpenAiGenerate}
              onClose={() => setEditorVisible(false)}
              onExport={() => setExportingThumbnail(activeThumbnail)}
              snapshot={activeTab.snapshot}
              tabId={activeTabId}
              thumbnail={activeThumbnail}
            />
          )}
        </div>
        {exportingThumbnail && (
          <ExportDialog
            onClose={() => setExportingThumbnail(null)}
            thumbnail={exportingThumbnail}
            useCurrentEditorState
          />
        )}
        <Toaster />
      </div>
    );
  }

  // Gallery (default or when tabs exist but editor hidden)
  return (
    <div className="flex h-screen flex-col bg-neutral-950">
      {tabs.length > 0 && <TabBar activePage="gallery" />}
      <div className={contentClass}>
        <Gallery
          onAddVideoClick={() => setShowExtractor(true)}
          onExportClick={setExportingThumbnail}
          onNewProjectClick={() => setNewProjectOpen(true)}
          onThumbnailClick={handleEditThumbnail}
          viewMode={viewMode}
        />
        <BottomToolbar
          onAddVideoClick={() => setShowExtractor(true)}
          onAiGenerateClick={handleOpenAiGenerateFromGallery}
          onExportSelected={handleExportSelected}
          onNewProjectClick={() => setNewProjectOpen(true)}
          onSettingsClick={() => setPage("settings")}
          onTrashClick={() => setPage("trash")}
          onViewModeChange={setViewMode}
          viewMode={viewMode}
        />
      </div>
      {showExtractor && (
        <VideoExtractor onClose={() => setShowExtractor(false)} />
      )}
      {exportingThumbnail && (
        <ExportDialog
          onClose={() => setExportingThumbnail(null)}
          thumbnail={exportingThumbnail}
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
      <Toaster />
      <BackgroundRemovalQueue />
      <AutoRenameQueue />
      <UpdateChecker />
    </div>
  );
}
