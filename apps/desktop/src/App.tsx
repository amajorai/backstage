import { useEffect, useState } from "react";
import { AutoRenameQueue } from "@/components/AutoRenameQueue";
import { BackgroundRemovalQueue } from "@/components/BackgroundRemovalQueue";
import { BottomToolbar } from "@/components/BottomToolbar";
import { ExportDialog } from "@/components/ExportDialog";
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
import { useAppSettingsStore } from "@/stores/use-app-settings-store";
import { useEditorStore } from "@/stores/use-editor-store";
import {
  type ThumbnailItem,
  useGalleryStore,
} from "@/stores/use-gallery-store";
import { useLicenseStore } from "@/stores/use-license-store";
import { useSelectionStore } from "@/stores/use-selection-store";

export type ViewMode = "3" | "4" | "5" | "row";
type Page = "gallery" | "editor" | "ai-generate" | "trash" | "settings";

// Component to initialize the updater (runs once on gallery page mount)
function UpdateChecker() {
  useAppUpdater();
  return null;
}

export default function App() {
  const [page, setPage] = useState<Page>("gallery");
  const [viewMode, setViewMode] = useState<ViewMode>("4");
  const [showExtractor, setShowExtractor] = useState(false);
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [editingThumbnail, setEditingThumbnail] =
    useState<ThumbnailItem | null>(null);
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

  // License validation
  const { isValidated, isValidating, loadStoredLicense } = useLicenseStore();

  const loadSettings = useAppSettingsStore((s) => s.loadSettings);

  useEffect(() => {
    loadStoredLicense();
    loadSettings();
  }, [loadStoredLicense, loadSettings]);

  // Show loading during initial license check
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

  // Show license activation page if not licensed
  if (!isValidated) {
    return <LicenseActivation />;
  }

  const handleExportSelected = () => {
    const { selectedIds } = useSelectionStore.getState();
    const { thumbnails } = useGalleryStore.getState();
    const selected = thumbnails.filter((t) => selectedIds.has(t.id));
    if (selected.length === 1) {
      setExportingThumbnail(selected[0]);
    } else if (selected.length > 1) {
      setExportingThumbnails(selected);
    }
  };

  const handleEditThumbnail = (thumbnail: ThumbnailItem) => {
    setEditingThumbnail(thumbnail);
    setPage("editor");
  };

  const handleCloseEditor = () => {
    setEditingThumbnail(null);
    setPage("gallery");
  };

  const handleStartFromTemplate = async (template: ThumbnailItem) => {
    // Duplicate template as a new project
    const loadLayerDataForId = useGalleryStore.getState().loadLayerDataForId;
    const layers = await loadLayerDataForId(template.id);

    // Check if it's multi-page (Page[]) or single page (Layer[])
    const pages =
      layers && layers.length > 0 && "layers" in layers[0] ? layers : null;
    const layerList = pages ? pages[0].layers : layers || [];

    const newId = await saveProject(
      null,
      `${template.name} (Copy)`,
      template.previewUrl || "",
      layerList,
      template.canvasWidth || 1080,
      template.canvasHeight || 1080,
      { pages: pages || undefined }
    );

    const newThumbnail = useGalleryStore
      .getState()
      .thumbnails.find((t) => t.id === newId);
    if (newThumbnail) {
      handleEditThumbnail(newThumbnail);
    }
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
    setPage(aiGenerateSource);
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

    // White 1x1 pixel base64 placeholder
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

    // Find and edit
    // Small delay to ensure store update if needed, though usually synchronous in Zustand if not async
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

  // AI Generate page
  if (page === "ai-generate") {
    return (
      <div className="flex h-screen flex-col bg-background">
        <GeminiImagePage
          inputImageDataUrl={aiInputImage}
          onClose={handleCloseAiGenerate}
          onSaveAsImage={handleSaveAiImage}
          onSaveAsLayer={
            aiGenerateSource === "editor" ? handleSaveAiLayer : undefined
          }
        />
        <Toaster />
      </div>
    );
  }

  // Editor page
  if (page === "editor" && editingThumbnail) {
    return (
      <div className="flex h-screen flex-col bg-background">
        <ImageEditor
          onAiGenerate={handleOpenAiGenerate}
          onClose={handleCloseEditor}
          onExport={() => setExportingThumbnail(editingThumbnail)}
          thumbnail={editingThumbnail}
        />
        {exportingThumbnail && (
          <ExportDialog
            onClose={() => setExportingThumbnail(null)}
            thumbnail={exportingThumbnail}
          />
        )}
        <Toaster />
      </div>
    );
  }

  // Trash page
  if (page === "trash") {
    return (
      <div className="flex h-screen flex-col bg-background">
        <TrashPage onClose={() => setPage("gallery")} />
        <Toaster />
      </div>
    );
  }

  // Settings page
  if (page === "settings") {
    return (
      <div className="flex h-screen flex-col bg-background">
        <SettingsPage onClose={() => setPage("gallery")} />
        <Toaster />
      </div>
    );
  }

  // Gallery page (default)
  return (
    <div className="flex h-screen flex-col bg-background">
      <Gallery
        onAddVideoClick={() => setShowExtractor(true)}
        onExportClick={setExportingThumbnail}
        onNewProjectClick={() => setNewProjectOpen(true)}
        onTemplateClick={handleStartFromTemplate}
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
