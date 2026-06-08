import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/dialog";
import { Input } from "@repo/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@repo/ui/tooltip";
import { invoke } from "@tauri-apps/api/core";
import { Loader2, Moon, Search, Sun, Type } from "lucide-react";
import {
  forwardRef,
  type HTMLAttributes,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { VirtuosoGrid } from "react-virtuoso";
import {
  addRecentLogo,
  getRecentLogos,
  type RecentLogo,
} from "@/lib/recently-used";
import {
  dialogClose as playDialogClose,
  dialogOpen as playDialogOpen,
  select as playSelect,
} from "@/lib/sounds";
import {
  fetchAllLogos,
  parseSvgDimensions,
  type SvglLogo,
  searchLogos,
  type ThemeOptions,
} from "@/lib/svgl";
import { useEditorStore } from "@/stores/use-editor-store";

interface LogoPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface DisplayLogo {
  id: number;
  title: string;
  resolvedRoute: string;
  variantKey: string;
  variant?: "light" | "dark";
  kind: "icon" | "wordmark";
  originalRoute: string | ThemeOptions;
}

const LogoGridList = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ children, style, ...props }, ref) => (
    <div
      ref={ref}
      style={style}
      {...props}
      className="grid grid-cols-6 gap-2 p-2"
    >
      {children}
    </div>
  )
);
LogoGridList.displayName = "LogoGridList";

const LogoGridItem = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ children, ...props }, ref) => (
    <div ref={ref} {...props}>
      {children}
    </div>
  )
);
LogoGridItem.displayName = "LogoGridItem";

const logoGridComponents = { List: LogoGridList, Item: LogoGridItem };

function flattenLogoAsset(
  id: number,
  title: string,
  route: string | ThemeOptions | undefined,
  kind: DisplayLogo["kind"],
  keyPrefix: string
): DisplayLogo[] {
  if (!route) {
    return [];
  }

  if (typeof route === "string") {
    return [
      {
        id,
        title,
        resolvedRoute: route,
        variantKey: `${keyPrefix}-${kind}`,
        kind,
        originalRoute: route,
      },
    ];
  }

  return [
    {
      id,
      title,
      resolvedRoute: route.light,
      variantKey: `${keyPrefix}-${kind}-light`,
      variant: "light" as const,
      kind,
      originalRoute: route,
    },
    {
      id,
      title,
      resolvedRoute: route.dark,
      variantKey: `${keyPrefix}-${kind}-dark`,
      variant: "dark" as const,
      kind,
      originalRoute: route,
    },
  ];
}

function flattenLogos(logos: SvglLogo[]): DisplayLogo[] {
  return logos.flatMap((logo): DisplayLogo[] => [
    ...flattenLogoAsset(logo.id, logo.title, logo.route, "icon", `${logo.id}`),
    ...flattenLogoAsset(
      logo.id,
      logo.title,
      logo.wordmark,
      "wordmark",
      `${logo.id}`
    ),
  ]);
}

function flattenRecentLogos(logos: RecentLogo[]): DisplayLogo[] {
  return logos.flatMap((logo): DisplayLogo[] =>
    flattenLogoAsset(
      logo.id,
      logo.title,
      logo.route,
      logo.kind ?? "icon",
      `recent-${logo.id}`
    )
  );
}

function loadImageDimensions(
  src: string
): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const img = new window.Image();
    img.onload = () =>
      resolve({
        width: img.naturalWidth || 128,
        height: img.naturalHeight || 128,
      });
    img.onerror = () => resolve({ width: 128, height: 128 });
    img.src = src;
  });
}

export function LogoPicker({ open, onOpenChange }: LogoPickerProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [allLogos, setAllLogos] = useState<SvglLogo[]>([]);
  const [searchResults, setSearchResults] = useState<SvglLogo[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [recentLogos, setRecentLogos] = useState<RecentLogo[]>([]);
  const searchTimeout = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (!open) {
      return;
    }
    setRecentLogos(getRecentLogos());
    if (allLogos.length > 0) {
      return;
    }
    setLoading(true);
    fetchAllLogos()
      .then(setAllLogos)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [open, allLogos.length]);

  useEffect(() => {
    clearTimeout(searchTimeout.current);
    if (!searchTerm.trim()) {
      setSearchResults(null);
      return;
    }
    searchTimeout.current = setTimeout(async () => {
      setSearching(true);
      try {
        const results = await searchLogos(searchTerm.trim());
        setSearchResults(results);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
  }, [searchTerm]);

  const handleSelect = useCallback(
    async (entry: DisplayLogo) => {
      playSelect();
      setLoadingKey(entry.variantKey);
      try {
        const url = entry.resolvedRoute;

        const b64 = await invoke<string>("fetch_as_base64", { url });
        const isSvg = url.toLowerCase().endsWith(".svg");

        if (isSvg) {
          const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
          const svgString = new TextDecoder("utf-8").decode(bytes);
          const { width: svgWidth, height: svgHeight } =
            parseSvgDimensions(svgString);
          const maxSide = entry.kind === "wordmark" ? 240 : 128;
          const scale = maxSide / Math.max(svgWidth, svgHeight);
          useEditorStore
            .getState()
            .addSvgLayer(svgString, svgWidth * scale, svgHeight * scale);
        } else {
          const dataUrl = `data:image/png;base64,${b64}`;
          const { width, height } = await loadImageDimensions(dataUrl);
          useEditorStore.getState().addImageLayer(dataUrl, width, height);
        }
        const id = useEditorStore.getState().activeLayerIds[0];
        if (id) {
          const parts = [
            entry.title,
            entry.kind === "wordmark" ? "Wordmark" : null,
            entry.variant === "light" ? "Light" : null,
            entry.variant === "dark" ? "Dark" : null,
          ].filter(Boolean);
          const name = parts.join(" ");
          useEditorStore.getState().updateLayer(id, { name });
        }

        addRecentLogo({
          id: entry.id,
          title: entry.title,
          kind: entry.kind,
          route: entry.originalRoute,
        });
        setRecentLogos(getRecentLogos());
        onOpenChange(false);
      } catch (e) {
        console.error("Failed to load logo", e);
      } finally {
        setLoadingKey(null);
      }
    },
    [onOpenChange]
  );

  const renderLogoButton = (entry: DisplayLogo) => {
    const isLoading = loadingKey === entry.variantKey;
    const details = [
      entry.kind === "wordmark" ? "Wordmark" : null,
      entry.variant === "light" ? "Light" : null,
      entry.variant === "dark" ? "Dark" : null,
    ].filter(Boolean);
    const tooltipLabel =
      details.length > 0
        ? `${entry.title} (${details.join(", ")})`
        : entry.title;

    return (
      <Tooltip key={entry.variantKey}>
        <TooltipTrigger asChild>
          <button
            aria-label={tooltipLabel}
            className="relative flex h-14 w-full items-center justify-center rounded border border-transparent p-2 transition-colors hover:border-border hover:bg-muted disabled:opacity-50"
            disabled={loadingKey !== null}
            onClick={() => handleSelect(entry)}
            type="button"
          >
            {isLoading ? (
              <Loader2 className="size-7 animate-spin" />
            ) : (
              <>
                {/* biome-ignore lint/performance/noImgElement: The desktop Vite app previews remote SVGL assets directly. */}
                <img
                  alt={tooltipLabel}
                  className="max-h-9 max-w-full object-contain"
                  height={36}
                  loading="lazy"
                  src={entry.resolvedRoute}
                  width={144}
                />
                {entry.kind === "wordmark" && (
                  <span className="absolute bottom-0.5 left-0.5 text-muted-foreground">
                    <Type className="size-2.5" />
                  </span>
                )}
                {entry.variant && (
                  <span className="absolute right-0.5 bottom-0.5 text-muted-foreground">
                    {entry.variant === "light" ? (
                      <Sun className="size-2.5" />
                    ) : (
                      <Moon className="size-2.5" />
                    )}
                  </span>
                )}
              </>
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p>{tooltipLabel}</p>
        </TooltipContent>
      </Tooltip>
    );
  };

  const rawDisplayList = searchResults ?? allLogos;
  const displayList = useMemo(
    () => flattenLogos(rawDisplayList),
    [rawDisplayList]
  );
  const flatRecentLogos = useMemo(
    () => flattenRecentLogos(recentLogos),
    [recentLogos]
  );

  const logoListContent = (() => {
    if (loading || searching) {
      return (
        <div className="flex h-full items-center justify-center">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      );
    }

    if (displayList.length === 0) {
      return (
        <div className="flex h-full items-center justify-center text-muted-foreground">
          {searchTerm ? "No logos found" : "No logos available"}
        </div>
      );
    }

    return (
      <VirtuosoGrid
        components={logoGridComponents}
        itemContent={(index) => renderLogoButton(displayList[index])}
        overscan={200}
        style={{ height: "100%", width: "100%" }}
        totalCount={displayList.length}
      />
    );
  })();

  return (
    <Dialog
      onOpenChange={(isOpen) => {
        isOpen ? playDialogOpen() : playDialogClose();
        onOpenChange(isOpen);
      }}
      open={open}
    >
      <DialogContent className="flex h-[80vh] max-w-5xl flex-col gap-3">
        <DialogHeader>
          <DialogTitle>Logo Picker</DialogTitle>
        </DialogHeader>

        {flatRecentLogos.length > 0 && (
          <div>
            <p className="mb-1 text-muted-foreground text-xs">Recently Used</p>
            <div className="grid grid-cols-6 gap-2">
              {flatRecentLogos.map(renderLogoButton)}
            </div>
          </div>
        )}

        <div className="flex items-center space-x-2">
          <Search className="size-4 shrink-0 text-muted-foreground" />
          <Input
            className="flex-1"
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search logos..."
            value={searchTerm}
          />
        </div>

        <div className="min-h-0 flex-1">{logoListContent}</div>
      </DialogContent>
    </Dialog>
  );
}
