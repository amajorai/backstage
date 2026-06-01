import { openUrl } from "@tauri-apps/plugin-opener";
import { Command } from "cmdk";
import {
  ArchiveIcon,
  BellIcon,
  ChevronDownIcon,
  DownloadIcon,
  FileImageIcon,
  FlaskConicalIcon,
  FolderIcon,
  FolderPlusIcon,
  GalleryThumbnailsIcon,
  HistoryIcon,
  Loader2Icon,
  MonitorIcon,
  MoonIcon,
  PlusIcon,
  RefreshCwIcon,
  RotateCcwIcon,
  SearchIcon,
  SettingsIcon,
  SparklesIcon,
  SunIcon,
  TrashIcon,
  TvIcon,
  UploadIcon,
  VideoIcon,
  Volume2Icon,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { sileo } from "sileo";
import { checkForUpdate, useUpdateStore } from "@/hooks/use-app-updater";
import * as sounds from "@/lib/sounds";
import { searchVideos, type YoutubeVideo } from "@/lib/youtube-api";
import { getYoutubeApiKey } from "@/lib/youtube-store";
import { useAppSettingsStore } from "@/stores/use-app-settings-store";
import {
  type ThumbnailItem,
  useGalleryStore,
} from "@/stores/use-gallery-store";
import { useTabsStore } from "@/stores/use-tabs-store";

const PROJECTS_PAGE_SIZE = 8;

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
  const autoCheckForUpdates = useAppSettingsStore((s) => s.autoCheckForUpdates);
  const setAutoCheckForUpdates = useAppSettingsStore(
    (s) => s.setAutoCheckForUpdates
  );
  const saveSearchHistory = useAppSettingsStore((s) => s.saveSearchHistory);
  const setSaveSearchHistory = useAppSettingsStore(
    (s) => s.setSaveSearchHistory
  );
  const experimentalFeaturesEnabled = useAppSettingsStore(
    (s) => s.experimentalFeaturesEnabled
  );
  const setExperimentalFeaturesEnabled = useAppSettingsStore(
    (s) => s.setExperimentalFeaturesEnabled
  );
  const soundsEnabled = useAppSettingsStore((s) => s.soundsEnabled);
  const setSoundsEnabled = useAppSettingsStore((s) => s.setSoundsEnabled);
  const setOnboardingCompleted = useAppSettingsStore(
    (s) => s.setOnboardingCompleted
  );
  const openTab = useTabsStore((s) => s.openTab);
  const checking = useUpdateStore((s) => s.checking);

  const [search, setSearch] = useState("");
  const [ytApiKey, setYtApiKey] = useState<string | null>(null);
  const [ytResults, setYtResults] = useState<YoutubeVideo[]>([]);
  const [ytLoading, setYtLoading] = useState(false);
  const [projectPage, setProjectPage] = useState(1);

  useEffect(() => {
    getYoutubeApiKey()
      .then(setYtApiKey)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!open) {
      setSearch("");
      setYtResults([]);
      setProjectPage(1);
    }
  }, [open]);

  useEffect(() => {
    setProjectPage(1);
  }, [search]);

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
      // Match every word in the query against the combined value + keywords
      // (which include the item's visible label), so multi-word queries like
      // "check for updates" match even though no single token holds the phrase.
      const haystack = `${value} ${(keywords ?? []).join(" ")}`.toLowerCase();
      const tokens = q.toLowerCase().split(/\s+/).filter(Boolean);
      return tokens.every((t) => haystack.includes(t)) ? 1 : 0;
    },
    []
  );

  const run = (fn: () => void) => {
    sounds.click();
    onOpenChange(false);
    fn();
  };

  const openProject = (thumbnail: ThumbnailItem) => {
    run(() => {
      openTab(thumbnail);
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

  const handleCheckForUpdates = () => {
    sounds.click();
    onOpenChange(false);
    checkForUpdate();
  };

  const handleToggle = (
    current: boolean,
    setter: (v: boolean) => Promise<void>,
    label: string
  ) => {
    sounds.click();
    onOpenChange(false);
    setter(!current).then(() => {
      sileo.success({ title: `${label}: ${current ? "Off" : "On"}` });
    });
  };

  const handleResetOnboarding = () => {
    sounds.click();
    onOpenChange(false);
    setOnboardingCompleted(false).then(() => {
      sileo.success({ title: "Onboarding reset" });
    });
  };

  const isSearching = search.trim().length > 0;
  const visibleThumbnails = isSearching
    ? thumbnails
    : thumbnails.slice(0, projectPage * PROJECTS_PAGE_SIZE);
  const remainingProjects =
    thumbnails.length - projectPage * PROJECTS_PAGE_SIZE;
  const hasMoreProjects = !isSearching && remainingProjects > 0;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-start justify-center pt-[15vh]">
      {/* backdrop — click closes */}
      <div
        className="absolute inset-0 bg-black/50"
        onMouseDown={() => onOpenChange(false)}
      />

      {/* palette */}
      <div className="relative z-10 w-full max-w-[580px] overflow-hidden rounded-xl border border-border bg-popover shadow-2xl">
        <Command
          className="flex flex-col"
          filter={commandFilter}
          onKeyDown={(e) => {
            if (e.key === "Escape") onOpenChange(false);
          }}
        >
          {/* input */}
          <div className="flex items-center gap-3 border-border border-b px-4">
            <SearchIcon className="size-5 shrink-0 text-muted-foreground" />
            <Command.Input
              autoFocus
              className="h-14 w-full bg-transparent py-3 text-base outline-none placeholder:text-muted-foreground"
              onValueChange={setSearch}
              placeholder="Search commands, projects, YouTube..."
              value={search}
            />
          </div>

          {/* list */}
          <Command.List className="max-h-[500px] overflow-y-auto overflow-x-hidden p-1.5">
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

            <Separator />

            {/* System */}
            <Group heading="System">
              <Item
                icon={
                  checking ? (
                    <Loader2Icon className="animate-spin" />
                  ) : (
                    <RefreshCwIcon />
                  )
                }
                keywords={[
                  "check",
                  "update",
                  "version",
                  "upgrade",
                  "new version",
                ]}
                onSelect={handleCheckForUpdates}
                value="check-updates"
              >
                Check for Updates
              </Item>
              <Item
                icon={<BellIcon />}
                keywords={["auto", "automatic", "updates", "notify"]}
                onSelect={() =>
                  handleToggle(
                    autoCheckForUpdates,
                    setAutoCheckForUpdates,
                    "Auto Updates"
                  )
                }
                suffix={<StateBadge enabled={autoCheckForUpdates} />}
                value="toggle-auto-updates"
              >
                Auto Updates
              </Item>
              <Item
                icon={<FlaskConicalIcon />}
                keywords={[
                  "experimental",
                  "beta",
                  "features",
                  "labs",
                  "preview",
                ]}
                onSelect={() =>
                  handleToggle(
                    experimentalFeaturesEnabled,
                    setExperimentalFeaturesEnabled,
                    "Experimental Features"
                  )
                }
                suffix={<StateBadge enabled={experimentalFeaturesEnabled} />}
                value="toggle-experimental"
              >
                Experimental Features
              </Item>
              <Item
                icon={<HistoryIcon />}
                keywords={["search", "history", "save", "privacy"]}
                onSelect={() =>
                  handleToggle(
                    saveSearchHistory,
                    setSaveSearchHistory,
                    "Search History"
                  )
                }
                suffix={<StateBadge enabled={saveSearchHistory} />}
                value="toggle-search-history"
              >
                Search History
              </Item>
              <Item
                icon={<Volume2Icon />}
                keywords={["sound", "audio", "effects", "mute", "sfx"]}
                onSelect={() =>
                  handleToggle(soundsEnabled, setSoundsEnabled, "Sound Effects")
                }
                suffix={<StateBadge enabled={soundsEnabled} />}
                value="toggle-sounds"
              >
                Sound Effects
              </Item>
              <Item
                icon={<RotateCcwIcon />}
                keywords={[
                  "reset",
                  "onboarding",
                  "tutorial",
                  "restart",
                  "walkthrough",
                ]}
                onSelect={handleResetOnboarding}
                value="reset-onboarding"
              >
                Reset Onboarding
              </Item>
              <Item
                icon={<DownloadIcon />}
                keywords={["export", "backup", "save", "zip", "storage"]}
                onSelect={() => run(() => onPageChange("settings"))}
                suffix={
                  <span className="shrink-0 text-muted-foreground text-xs">
                    Settings → Storage
                  </span>
                }
                value="export-backup"
              >
                Export Backup
              </Item>
              <Item
                icon={<UploadIcon />}
                keywords={["import", "backup", "restore", "zip", "storage"]}
                onSelect={() => run(() => onPageChange("settings"))}
                suffix={
                  <span className="shrink-0 text-muted-foreground text-xs">
                    Settings → Storage
                  </span>
                }
                value="import-backup"
              >
                Import Backup
              </Item>
            </Group>

            {/* Projects */}
            {thumbnails.length > 0 && (
              <>
                <Separator />
                <Group heading="Projects">
                  {visibleThumbnails.map((t) => (
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
                  {hasMoreProjects && (
                    <Command.Item
                      className="mt-0.5 flex cursor-default select-none items-center gap-2 rounded-lg px-2 py-2.5 text-muted-foreground text-sm outline-none data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground"
                      onSelect={() => setProjectPage((p) => p + 1)}
                      value="load-more-projects"
                    >
                      <ChevronDownIcon className="size-4 shrink-0" />
                      <span>
                        Show {Math.min(PROJECTS_PAGE_SIZE, remainingProjects)}{" "}
                        more projects
                      </span>
                      <span className="ml-auto text-xs">
                        {projectPage * PROJECTS_PAGE_SIZE} of{" "}
                        {thumbnails.length}
                      </span>
                    </Command.Item>
                  )}
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
                      className="flex cursor-default items-center gap-2 rounded-lg px-2 py-2.5 text-muted-foreground text-sm"
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

function StateBadge({ enabled }: { enabled: boolean }) {
  return (
    <span
      className={`shrink-0 rounded-full px-1.5 py-0.5 font-medium text-xs ${
        enabled
          ? "bg-green-500/15 text-green-500"
          : "bg-muted text-muted-foreground"
      }`}
    >
      {enabled ? "On" : "Off"}
    </span>
  );
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
  // Include the visible label in the searchable keywords so the filter can
  // match what the user actually reads (e.g. "Check for Updates").
  const labelKeyword = typeof children === "string" ? [children] : [];
  const searchKeywords = keywords
    ? [...keywords, ...labelKeyword]
    : labelKeyword;

  return (
    <Command.Item
      className="flex cursor-default select-none items-center gap-2.5 rounded-lg px-2 py-2.5 text-sm outline-none data-[disabled=true]:pointer-events-none data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground data-[disabled=true]:opacity-40 [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted-foreground data-[selected=true]:[&_svg]:text-accent-foreground"
      keywords={searchKeywords.length > 0 ? searchKeywords : undefined}
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
