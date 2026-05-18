import { openUrl } from "@tauri-apps/plugin-opener";
import { Command } from "cmdk";
import {
  ArchiveIcon,
  FileImageIcon,
  FolderIcon,
  FolderPlusIcon,
  GalleryThumbnailsIcon,
  Loader2Icon,
  MonitorIcon,
  MoonIcon,
  PlusIcon,
  SearchIcon,
  SettingsIcon,
  SparklesIcon,
  SunIcon,
  TrashIcon,
  TvIcon,
  VideoIcon,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { sileo } from "sileo";
import { searchVideos, type YoutubeVideo } from "@/lib/youtube-api";
import { getYoutubeApiKey } from "@/lib/youtube-store";
import { useAppSettingsStore } from "@/stores/use-app-settings-store";
import {
  type ThumbnailItem,
  useGalleryStore,
} from "@/stores/use-gallery-store";
import { useTabsStore } from "@/stores/use-tabs-store";

type Page =
  | "gallery"
  | "ai-generate"
  | "trash"
  | "settings"
  | "explore"
  | "archive";

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPageChange: (page: Page) => void;
  onNewProject: () => void;
  onNewFolder: () => void;
  onAddVideo: () => void;
  onAiGenerate: () => void;
}

export function CommandPalette({
  open,
  onOpenChange,
  onPageChange,
  onNewProject,
  onNewFolder,
  onAddVideo,
  onAiGenerate,
}: CommandPaletteProps) {
  const thumbnails = useGalleryStore((s) => s.thumbnails);
  const setTheme = useAppSettingsStore((s) => s.setTheme);
  const openTab = useTabsStore((s) => s.openTab);
  const setEditorVisible = useTabsStore((s) => s.setEditorVisible);

  const [search, setSearch] = useState("");
  const [ytApiKey, setYtApiKey] = useState<string | null>(null);
  const [ytResults, setYtResults] = useState<YoutubeVideo[]>([]);
  const [ytLoading, setYtLoading] = useState(false);

  useEffect(() => {
    getYoutubeApiKey()
      .then(setYtApiKey)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!open) {
      setSearch("");
      setYtResults([]);
    }
  }, [open]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [open, onOpenChange]);

  useEffect(() => {
    if (!ytApiKey || search.trim().length < 2) {
      setYtResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setYtLoading(true);
      try {
        const { videos } = await searchVideos(ytApiKey, search.trim(), 6);
        setYtResults(videos);
      } catch {
        setYtResults([]);
      } finally {
        setYtLoading(false);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [search, ytApiKey]);

  const commandFilter = useCallback(
    (value: string, q: string, keywords?: string[]) => {
      if (!q) return 1;
      if (value.startsWith("yt-video-")) return 1;
      const needle = q.toLowerCase();
      if (value.toLowerCase().includes(needle)) return 1;
      if (keywords?.some((k) => k.toLowerCase().includes(needle))) return 1;
      return 0;
    },
    []
  );

  const run = (fn: () => void) => {
    onOpenChange(false);
    fn();
  };

  const openProject = (thumbnail: ThumbnailItem) => {
    run(() => {
      openTab(thumbnail);
      setEditorVisible(true);
    });
  };

  const openYouTubeVideo = (video: YoutubeVideo) => {
    run(() => {
      openUrl(`https://www.youtube.com/watch?v=${video.id}`).catch(() => {});
    });
  };

  const switchTheme = async (theme: "light" | "dark" | "system") => {
    await setTheme(theme);
    sileo.success({ title: `Theme: ${theme}` });
    onOpenChange(false);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-start justify-center pt-[15vh]">
      {/* backdrop — click closes */}
      <div
        className="absolute inset-0 bg-black/50"
        onMouseDown={() => onOpenChange(false)}
      />

      {/* palette */}
      <div className="relative z-10 w-full max-w-[560px] overflow-hidden rounded-xl border border-border bg-popover shadow-2xl">
        <Command
          className="flex flex-col"
          filter={commandFilter}
          onKeyDown={(e) => {
            if (e.key === "Escape") onOpenChange(false);
          }}
        >
          {/* input */}
          <div className="flex items-center gap-2 border-border border-b px-3">
            <SearchIcon className="size-4 shrink-0 text-muted-foreground" />
            <Command.Input
              autoFocus
              className="h-11 w-full bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
              onValueChange={setSearch}
              placeholder="Search commands, projects, YouTube..."
              value={search}
            />
          </div>

          {/* list */}
          <Command.List className="max-h-[420px] overflow-y-auto overflow-x-hidden p-1">
            <Command.Empty className="py-8 text-center text-muted-foreground text-sm">
              No results found.
            </Command.Empty>

            {/* Navigation */}
            <Group heading="Go to">
              <Item
                icon={<GalleryThumbnailsIcon />}
                keywords={["home", "projects", "gallery"]}
                onSelect={() => run(() => onPageChange("gallery"))}
                shortcut="Home"
                value="go-gallery"
              >
                Gallery
              </Item>
              <Item
                icon={<TvIcon />}
                keywords={[
                  "explore",
                  "youtube",
                  "community",
                  "remix",
                  "browse",
                  "videos",
                ]}
                onSelect={() => run(() => onPageChange("explore"))}
                value="go-explore"
              >
                Explore YouTube
              </Item>
              <Item
                icon={<SparklesIcon />}
                keywords={["ai", "generate", "gemini", "image"]}
                onSelect={() => run(() => onPageChange("ai-generate"))}
                value="go-ai-generate"
              >
                AI Generate
              </Item>
              <Item
                icon={<TrashIcon />}
                keywords={["trash", "deleted", "recycle"]}
                onSelect={() => run(() => onPageChange("trash"))}
                value="go-trash"
              >
                Trash
              </Item>
              <Item
                icon={<ArchiveIcon />}
                keywords={["archive", "archived"]}
                onSelect={() => run(() => onPageChange("archive"))}
                value="go-archive"
              >
                Archive
              </Item>
              <Item
                icon={<SettingsIcon />}
                keywords={["settings", "preferences", "config"]}
                onSelect={() => run(() => onPageChange("settings"))}
                value="go-settings"
              >
                Settings
              </Item>
            </Group>

            <Separator />

            {/* Actions */}
            <Group heading="Actions">
              <Item
                icon={<PlusIcon />}
                keywords={["new", "create", "project", "canvas", "design"]}
                onSelect={() => run(onNewProject)}
                value="new-project"
              >
                New Project
              </Item>
              <Item
                icon={<FolderPlusIcon />}
                keywords={["new", "create", "folder", "organize"]}
                onSelect={() => run(onNewFolder)}
                value="new-folder"
              >
                New Folder
              </Item>
              <Item
                icon={<SparklesIcon />}
                keywords={["ai", "generate", "image", "gemini", "create"]}
                onSelect={() => run(onAiGenerate)}
                value="ai-generate-action"
              >
                Generate with AI
              </Item>
              <Item
                icon={<VideoIcon />}
                keywords={["video", "extract", "frames", "import"]}
                onSelect={() => run(onAddVideo)}
                value="add-video"
              >
                Extract Video Frames
              </Item>
            </Group>

            <Separator />

            {/* Theme */}
            <Group heading="Theme">
              <Item
                icon={<SunIcon />}
                keywords={["light", "theme", "appearance", "white", "bright"]}
                onSelect={() => switchTheme("light")}
                value="theme-light"
              >
                Light Mode
              </Item>
              <Item
                icon={<MoonIcon />}
                keywords={["dark", "theme", "appearance", "black", "night"]}
                onSelect={() => switchTheme("dark")}
                value="theme-dark"
              >
                Dark Mode
              </Item>
              <Item
                icon={<MonitorIcon />}
                keywords={["system", "theme", "appearance", "auto", "os"]}
                onSelect={() => switchTheme("system")}
                value="theme-system"
              >
                System Theme
              </Item>
            </Group>

            {/* Projects */}
            {thumbnails.length > 0 && (
              <>
                <Separator />
                <Group heading="Projects">
                  {thumbnails.slice(0, 50).map((t) => (
                    <Item
                      icon={<FileImageIcon />}
                      key={t.id}
                      keywords={["open", "edit", "project"]}
                      onSelect={() => openProject(t)}
                      suffix={
                        t.folderId ? (
                          <FolderIcon className="size-3 text-muted-foreground" />
                        ) : undefined
                      }
                      value={`project-${t.id}-${t.name}`}
                    >
                      {t.name}
                    </Item>
                  ))}
                </Group>
              </>
            )}

            {/* YouTube */}
            {ytApiKey && (ytLoading || ytResults.length > 0) && (
              <>
                <Separator />
                <Group heading="YouTube">
                  {ytLoading ? (
                    <Command.Item
                      className="flex cursor-default items-center gap-2 rounded-lg px-2 py-1.5 text-muted-foreground text-sm"
                      disabled
                      value="yt-loading"
                    >
                      <Loader2Icon className="size-4 animate-spin" />
                      Searching YouTube...
                    </Command.Item>
                  ) : (
                    ytResults.map((video) => (
                      <Item
                        icon={<SearchIcon />}
                        key={video.id}
                        keywords={["youtube", "video", "watch"]}
                        onSelect={() => openYouTubeVideo(video)}
                        suffix={
                          <span className="shrink-0 text-muted-foreground text-xs">
                            {video.channelTitle}
                          </span>
                        }
                        value={`yt-video-${video.id}`}
                      >
                        {video.title}
                      </Item>
                    ))
                  )}
                </Group>
              </>
            )}
          </Command.List>
        </Command>
      </div>
    </div>
  );
}

function Group({
  heading,
  children,
}: {
  heading: string;
  children: React.ReactNode;
}) {
  return (
    <Command.Group
      className="[&_[cmdk-group-heading]]:mb-0.5 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group-heading]]:text-xs"
      heading={heading}
    >
      {children}
    </Command.Group>
  );
}

function Separator() {
  return <Command.Separator className="my-1 h-px bg-border" />;
}

function Item({
  value,
  keywords,
  onSelect,
  icon,
  children,
  shortcut,
  suffix,
}: {
  value: string;
  keywords?: string[];
  onSelect: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
  shortcut?: string;
  suffix?: React.ReactNode;
}) {
  return (
    <Command.Item
      className="flex cursor-default select-none items-center gap-2 rounded-lg px-2 py-1.5 text-sm outline-none data-[disabled=true]:pointer-events-none data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground data-[disabled=true]:opacity-40 [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted-foreground data-[selected=true]:[&_svg]:text-accent-foreground"
      keywords={keywords}
      onSelect={onSelect}
      value={value}
    >
      {icon}
      <span className="flex-1 truncate">{children}</span>
      {suffix}
      {shortcut && (
        <span className="ml-auto text-muted-foreground text-xs">
          {shortcut}
        </span>
      )}
    </Command.Item>
  );
}
