import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/dialog";
import { Input } from "@repo/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@repo/ui/tooltip";
import { invoke } from "@tauri-apps/api/core";
import { Loader2, Moon, Search, Sun } from "lucide-react";
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
import { fetchAllLogos, type SvglLogo, searchLogos } from "@/lib/svgl";
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
  originalRoute: string | { dark: string; light: string };
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

function flattenLogos(logos: SvglLogo[]): DisplayLogo[] {
  return logos.flatMap((logo): DisplayLogo[] => {
    if (typeof logo.route === "string") {
      return [
        {
          id: logo.id,
          title: logo.title,
          resolvedRoute: logo.route,
          variantKey: `${logo.id}`,
          originalRoute: logo.route,
        },
      ];
    }
    return [
      {
        id: logo.id,
        title: logo.title,
        resolvedRoute: logo.route.light,
        variantKey: `${logo.id}-light`,
        variant: "light" as const,
        originalRoute: logo.route,
      },
      {
        id: logo.id,
        title: logo.title,
        resolvedRoute: logo.route.dark,
        variantKey: `${logo.id}-dark`,
        variant: "dark" as const,
        originalRoute: logo.route,
      },
    ];
  });
}

function flattenRecentLogos(logos: RecentLogo[]): DisplayLogo[] {
  return logos.flatMap((logo): DisplayLogo[] => {
    if (typeof logo.route === "string") {
      return [
        {
          id: logo.id,
          title: logo.title,
          resolvedRoute: logo.route,
          variantKey: `recent-${logo.id}`,
          originalRoute: logo.route,
        },
      ];
    }
    return [
      {
        id: logo.id,
        title: logo.title,
        resolvedRoute: logo.route.light,
        variantKey: `recent-${logo.id}-light`,
        variant: "light" as const,
        originalRoute: logo.route,
      },
      {
        id: logo.id,
        title: logo.title,
        resolvedRoute: logo.route.dark,
        variantKey: `recent-${logo.id}-dark`,
        variant: "dark" as const,
        originalRoute: logo.route,
      },
    ];
  });
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
    if (!open) return;
    setRecentLogos(getRecentLogos());
    if (allLogos.length > 0) return;
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
      setLoadingKey(entry.variantKey);
      try {
        const url = entry.resolvedRoute;

        const b64 = await invoke<string>("fetch_as_base64", { url });
        const isSvg = url.toLowerCase().endsWith(".svg");

        if (isSvg) {
          const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
          const svgString = new TextDecoder("utf-8").decode(bytes);
          useEditorStore.getState().addSvgLayer(svgString, 128, 128);
        } else {
          const dataUrl = `data:image/png;base64,${b64}`;
          const { width, height } = await loadImageDimensions(dataUrl);
          useEditorStore.getState().addImageLayer(dataUrl, width, height);
        }
        const id = useEditorStore.getState().activeLayerIds[0];
        if (id) {
          const name = entry.variant
            ? `${entry.title} (${entry.variant === "light" ? "Light" : "Dark"})`
            : entry.title;
          useEditorStore.getState().updateLayer(id, { name });
        }

        addRecentLogo({
          id: entry.id,
          title: entry.title,
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
    const tooltipLabel = entry.variant
      ? `${entry.title} (${entry.variant === "light" ? "Light" : "Dark"})`
      : entry.title;

    return (
      <Tooltip key={entry.variantKey}>
        <TooltipTrigger asChild>
          <button
            className="relative flex items-center justify-center rounded border border-transparent p-2 transition-colors hover:border-border hover:bg-muted disabled:opacity-50"
            disabled={loadingKey !== null}
            onClick={() => handleSelect(entry)}
            type="button"
          >
            {isLoading ? (
              <Loader2 className="size-7 animate-spin" />
            ) : (
              <>
                <img
                  alt={tooltipLabel}
                  className="size-7 object-contain"
                  loading="lazy"
                  src={entry.resolvedRoute}
                />
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

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="flex h-[80vh] max-w-5xl flex-col gap-3">
        <DialogHeader>
          <DialogTitle>Logo Picker</DialogTitle>
        </DialogHeader>

        {flatRecentLogos.length > 0 && (
          <div>
            <p className="mb-1 text-muted-foreground text-xs">Recently Used</p>
            <div className="flex flex-wrap gap-1">
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

        <div className="min-h-0 flex-1">
          {loading || searching ? (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : displayList.length === 0 ? (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              {searchTerm ? "No logos found" : "No logos available"}
            </div>
          ) : (
            <VirtuosoGrid
              components={logoGridComponents}
              itemContent={(index) => renderLogoButton(displayList[index])}
              overscan={200}
              style={{ height: "100%", width: "100%" }}
              totalCount={displayList.length}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
