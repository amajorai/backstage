import {
  CheckSquare,
  GalleryThumbnails,
  Grid2X2,
  ImagePlus,
  Loader2,
  MonitorPlay,
  Plus,
  Search,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { VirtuosoGrid } from "react-virtuoso";
import { toast } from "sonner";
import type { ViewMode } from "@/App";
import { EmptyState } from "@/components/gallery/EmptyState";
import { gridComponents } from "@/components/gallery/VirtuosoGridComponents";
import { ThumbnailGridItem } from "@/components/ThumbnailGridItem";
import { TitleBar } from "@/components/TitleBar";
import { AddMenu } from "@/components/toolbar/add-menu";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { VideoExtractor } from "@/components/VideoExtractor";
import { useDragSelection } from "@/hooks/use-drag-selection";
import { openAndLoadImages } from "@/lib/image-file-utils";
import { useAutoRenameQueue } from "@/stores/use-auto-rename-queue";
import {
  type ThumbnailItem,
  useGalleryStore,
} from "@/stores/use-gallery-store";
import { useGalleryUIStore } from "@/stores/use-gallery-ui-store";
import { useSelectionStore } from "@/stores/use-selection-store";

interface GalleryProps {
  viewMode: ViewMode;
  onThumbnailClick: (thumbnail: ThumbnailItem) => void;
  onTemplateClick?: (thumbnail: ThumbnailItem) => void;
  onExportClick: (thumbnail: ThumbnailItem) => void;
  onAddVideoClick: () => void;
  onNewProjectClick: () => void;
}

export function Gallery({
  viewMode,
  onThumbnailClick,
  onTemplateClick,
  onExportClick,
  onAddVideoClick,
  onNewProjectClick,
}: GalleryProps) {
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [showVideoExtractor, setShowVideoExtractor] = useState(false);
  const [selectedThumbnail, setSelectedThumbnail] =
    useState<ThumbnailItem | null>(null);
  const [newName, setNewName] = useState("");
  const addToRenameQueue = useAutoRenameQueue((s) => s.addToQueue);
  const addThumbnail = useGalleryStore((s) => s.addThumbnail);
  const deleteThumbnail = useGalleryStore((s) => s.deleteThumbnail);
  const updateThumbnailName = useGalleryStore((s) => s.updateThumbnailName); // used by rename dialog
  const sortField = useGalleryStore((s) => s.sortField);
  const sortOrder = useGalleryStore((s) => s.sortOrder);
  const rawThumbnails = useGalleryStore((s) => s.thumbnails);
  const isLoaded = useGalleryStore((s) => s.isLoaded);

  const [activeTab, setActiveTab] = useState("projects");
  const [searchQuery, setSearchQuery] = useState("");

  const isSelectionMode = useSelectionStore((s) => s.isSelectionMode);
  const selectAll = useSelectionStore((s) => s.selectAll);
  const toggleSelectionMode = useSelectionStore((s) => s.toggleSelectionMode);
  const exitSelectionMode = useSelectionStore((s) => s.exitSelectionMode);

  const lastClickedIndex = useGalleryUIStore((s) => s.lastClickedIndex);
  const setLastClickedIndex = useGalleryUIStore((s) => s.setLastClickedIndex);

  const filteredThumbnails = useMemo(() => {
    let filtered = rawThumbnails;
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter((t) => t.name.toLowerCase().includes(query));
    }
    return [...filtered].sort((a, b) => {
      let cmp = 0;
      if (sortField === "name") {
        cmp = a.name.localeCompare(b.name);
      } else {
        cmp = (a[sortField] || 0) - (b[sortField] || 0);
      }
      return sortOrder === "desc" ? -cmp : cmp;
    });
  }, [rawThumbnails, sortField, sortOrder, searchQuery]);

  const projects = useMemo(
    () => filteredThumbnails.filter((t) => !t.isTemplate),
    [filteredThumbnails]
  );
  const templates = useMemo(
    () => filteredThumbnails.filter((t) => t.isTemplate),
    [filteredThumbnails]
  );

  const gridColClass = useMemo(() => {
    const gridClasses: Record<ViewMode, string> = {
      "3": "grid-cols-3",
      "4": "grid-cols-4",
      "5": "grid-cols-5",
      row: "grid-cols-1",
    };
    return gridClasses[viewMode];
  }, [viewMode]);

  // Drag selection hook
  const { selectionBox, containerRef, scrollerRef, handleMouseDown } =
    useDragSelection({
      dataAttribute: "data-thumbnail-id",
      isSelectionMode,
      onEnableSelectionMode: toggleSelectionMode,
      onSelectionChange: (ids) => useSelectionStore.getState().selectAll(ids),
      onClearSelection: () => useSelectionStore.getState().clearSelection(),
    });

  const handleAddImage = useCallback(async () => {
    const images = await openAndLoadImages();
    for (const { dataUrl, fileName } of images) {
      addThumbnail(dataUrl, fileName);
    }
  }, [addThumbnail]);

  const loadFullImageForId = useGalleryStore((s) => s.loadFullImageForId);

  const handleRemoveBackground = useCallback(
    async (e: React.MouseEvent, thumbnail: ThumbnailItem) => {
      e.stopPropagation();
      setProcessingId(thumbnail.id);
      try {
        const fullImageUrl = await loadFullImageForId(thumbnail.id);
        if (!fullImageUrl) {
          console.error("Failed to load image for background removal");
          return;
        }
        const { removeBackgroundAsync } = await import(
          "@/lib/background-removal"
        );
        const resultDataUrl = await removeBackgroundAsync(fullImageUrl);
        addThumbnail(resultDataUrl, `${thumbnail.name} (no bg)`);
      } catch (error) {
        console.error("Background removal failed:", error);
      } finally {
        setProcessingId(null);
      }
    },
    [addThumbnail, loadFullImageForId]
  );

  const handleAutoRename = useCallback(
    async (thumbnail: ThumbnailItem) => {
      addToRenameQueue([{ thumbnailId: thumbnail.id, name: thumbnail.name }]);
    },
    [addToRenameQueue]
  );

  const handleRename = useCallback((thumbnail: ThumbnailItem) => {
    setSelectedThumbnail(thumbnail);
    setNewName(thumbnail.name);
    setRenameDialogOpen(true);
  }, []);

  const handleDelete = useCallback((thumbnail: ThumbnailItem) => {
    setSelectedThumbnail(thumbnail);
    setDeleteDialogOpen(true);
  }, []);

  const itemContent = useCallback(
    (index: number, mode: "projects" | "templates") => {
      if (mode === "projects") {
        const thumbnail = projects[index];
        if (!thumbnail) return null;
        return (
          <ThumbnailGridItem
            isProcessing={processingId === thumbnail.id}
            onAutoRename={handleAutoRename}
            onDelete={handleDelete}
            onExportClick={onExportClick}
            onRemoveBackground={handleRemoveBackground}
            onRename={handleRename}
            onThumbnailClick={(t) => {
              setLastClickedIndex(index);
              onThumbnailClick(t);
            }}
            thumbnail={thumbnail}
          />
        );
      }
      const thumbnail = templates[index];
      if (!thumbnail) return null;
      return (
        <ThumbnailGridItem
          isProcessing={processingId === thumbnail.id}
          onAutoRename={handleAutoRename}
          onDelete={handleDelete}
          onExportClick={onExportClick}
          onRemoveBackground={handleRemoveBackground}
          onRename={handleRename}
          onThumbnailClick={(t) => {
            setLastClickedIndex(index);
            if (onTemplateClick) {
              onTemplateClick(t);
            } else {
              onThumbnailClick(t);
            }
          }}
          thumbnail={thumbnail}
        />
      );
    },
    [
      projects,
      templates,
      processingId,
      handleAutoRename,
      handleDelete,
      onExportClick,
      handleRemoveBackground,
      handleRename,
      setLastClickedIndex,
      onThumbnailClick,
      onAddVideoClick,
      onNewProjectClick,
    ]
  );

  if (!isLoaded) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4">
        <Loader2 className="size-10 animate-spin text-muted-foreground" />
        <p className="text-muted-foreground text-sm">Loading thumbnails...</p>
      </div>
    );
  }

  // Generic empty state logic replaced by tab-specific

  return (
    <div className="relative flex flex-1 select-none flex-col">
      <Tabs
        className="flex flex-1 flex-col"
        onValueChange={(val) => {
          setActiveTab(val);
          useSelectionStore.getState().clearSelection();
        }}
        value={activeTab}
      >
        <TitleBar
          center={
            <div className="relative z-[50]">
              <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground/50" />
              <Input
                className="h-8 w-64 border-none bg-muted/30 pr-8 pl-9 transition-all focus-visible:w-96 focus-visible:ring-1 focus-visible:ring-primary/20"
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search projects..."
                type="text"
                value={searchQuery}
              />
              {(activeTab === "templates"
                ? templates.length
                : projects.length) > 0 && (
                <Badge
                  className="absolute top-1/2 right-2 h-5 -translate-y-1/2 border-none bg-primary/10 px-1.5 font-bold text-[10px] text-primary"
                  variant="outline"
                >
                  {activeTab === "templates"
                    ? templates.length
                    : projects.length}
                </Badge>
              )}
            </div>
          }
          title={
            <TabsList className="relative z-[50] h-8 gap-1 border-none bg-transparent p-0">
              <TabsTrigger
                className="h-8 rounded-md border-none px-4 font-semibold transition-all data-[state=active]:border-none data-[state=active]:bg-muted data-[state=active]:shadow-none"
                value="projects"
              >
                Projects
              </TabsTrigger>
              <TabsTrigger
                className="h-8 rounded-md border-none px-4 font-semibold transition-all data-[state=active]:border-none data-[state=active]:bg-muted data-[state=active]:shadow-none"
                value="templates"
              >
                Templates
              </TabsTrigger>
            </TabsList>
          }
        />

        <div className="relative flex-1 select-none overflow-hidden">
          <ContextMenu>
            <ContextMenuTrigger className="h-full">
              <div
                className="h-full w-full overflow-hidden"
                onClick={(e) => {
                  if (
                    isSelectionMode &&
                    !(e.target as HTMLElement).closest("[data-thumbnail-id]")
                  ) {
                    exitSelectionMode();
                  }
                }}
                onMouseDown={handleMouseDown}
                ref={containerRef}
              >
                {selectionBox && (
                  <div
                    className="pointer-events-none absolute z-50 border border-primary/50 bg-primary/20"
                    style={{
                      left: selectionBox.x,
                      top: selectionBox.y,
                      width: selectionBox.width,
                      height: selectionBox.height,
                    }}
                  />
                )}

                <TabsContent className="mt-0 h-full" value="projects">
                  {projects.length === 0 && searchQuery.trim() ? (
                    <div className="flex h-full flex-col items-center justify-center gap-4">
                      <Search className="size-10 text-muted-foreground opacity-40" />
                      <div className="text-center">
                        <p className="font-medium">No results found</p>
                        <p className="mt-1 text-muted-foreground text-sm">
                          Try a different search term
                        </p>
                      </div>
                      <Button
                        onClick={() => setSearchQuery("")}
                        variant="ghost"
                      >
                        Clear Search
                      </Button>
                    </div>
                  ) : projects.length === 0 && !searchQuery.trim() ? (
                    <EmptyState
                      action={
                        <AddMenu
                          onAddVideoClick={() => setShowVideoExtractor(true)}
                          onNewProjectClick={onNewProjectClick}
                          trigger={
                            <Button className="gap-2" variant="ghost">
                              <Plus className="size-4" />
                              Create
                            </Button>
                          }
                        />
                      }
                      description="Start by adding images or extracting frames from videos"
                      icon={
                        <GalleryThumbnails className="size-10 fill-muted-foreground" />
                      }
                      title="No projects yet"
                    />
                  ) : (
                    <VirtuosoGrid
                      components={gridComponents}
                      initialTopMostItemIndex={lastClickedIndex ?? 0}
                      itemContent={(index) => itemContent(index, "projects")}
                      listClassName={gridColClass}
                      overscan={600}
                      scrollerRef={(ref) => {
                        scrollerRef.current = ref as HTMLDivElement;
                      }}
                      style={{ height: "100%", width: "100%" }}
                      totalCount={projects.length}
                    />
                  )}
                </TabsContent>

                <TabsContent className="mt-0 h-full" value="templates">
                  {templates.length === 0 ? (
                    <EmptyState
                      description="Save a project as a template to see it here"
                      icon={
                        <GalleryThumbnails className="size-10 fill-muted-foreground" />
                      }
                      title="No templates yet"
                    />
                  ) : (
                    <VirtuosoGrid
                      components={gridComponents}
                      itemContent={(index) => itemContent(index, "templates")}
                      listClassName={gridColClass}
                      scrollerRef={(evt) =>
                        (scrollerRef.current = evt as HTMLDivElement)
                      }
                      style={{ height: "100%", width: "100%" }}
                      totalCount={templates.length}
                    />
                  )}
                </TabsContent>
              </div>
            </ContextMenuTrigger>
            <ContextMenuContent>
              <ContextMenuItem onClick={handleAddImage}>
                <ImagePlus className="mr-2 size-4" />
                Upload Photo
              </ContextMenuItem>
              <ContextMenuItem onClick={() => setShowVideoExtractor(true)}>
                <MonitorPlay className="mr-2 size-4" />
                Upload Video
              </ContextMenuItem>
              <ContextMenuSeparator />
              <ContextMenuItem
                onClick={() => {
                  toggleSelectionMode();
                  const list = activeTab === "projects" ? projects : templates;
                  selectAll(list.map((t) => t.id));
                }}
              >
                <CheckSquare className="mr-2 size-4" />
                Select All
              </ContextMenuItem>
              <ContextMenuItem
                onClick={() => {
                  if (isSelectionMode) {
                    exitSelectionMode();
                  } else {
                    toggleSelectionMode();
                  }
                }}
              >
                <Grid2X2 className="mr-2 size-4" />
                {isSelectionMode
                  ? "Exit Selection Mode"
                  : "Enter Selection Mode"}
              </ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>
        </div>
      </Tabs>
      {showVideoExtractor && (
        <VideoExtractor onClose={() => setShowVideoExtractor(false)} />
      )}

      {/* Rename Dialog */}
      <Dialog onOpenChange={setRenameDialogOpen} open={renameDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Thumbnail</DialogTitle>
          </DialogHeader>
          <Input
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && selectedThumbnail && newName.trim()) {
                updateThumbnailName(selectedThumbnail.id, newName.trim());
                toast.success("Thumbnail renamed");
                setRenameDialogOpen(false);
              }
            }}
            placeholder="Enter new name"
            value={newName}
          />
          <DialogFooter>
            <DialogClose render={<Button variant="ghost" />}>
              Cancel
            </DialogClose>
            <Button
              onClick={() => {
                if (selectedThumbnail && newName.trim()) {
                  updateThumbnailName(selectedThumbnail.id, newName.trim());
                  toast.success("Thumbnail renamed");
                  setRenameDialogOpen(false);
                }
              }}
            >
              Rename
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog onOpenChange={setDeleteDialogOpen} open={deleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Move to Trash?</AlertDialogTitle>
            <AlertDialogDescription>
              "{selectedThumbnail?.name}" will be moved to trash. You can
              restore it within 30 days.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (selectedThumbnail) {
                  await deleteThumbnail(selectedThumbnail.id);
                  toast.info("Moved to trash");
                  setDeleteDialogOpen(false);
                }
              }}
              variant="destructive"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
