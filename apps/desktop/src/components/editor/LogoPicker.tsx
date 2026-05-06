import { Loader2, Search } from "lucide-react";
import {
  forwardRef,
  type HTMLAttributes,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { VirtuosoGrid } from "react-virtuoso";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  addRecentLogo,
  getRecentLogos,
  type RecentLogo,
} from "@/lib/recently-used";
import {
  fetchAllLogos,
  getLogoRoute,
  type SvglLogo,
  searchLogos,
} from "@/lib/svgl";
import { useEditorStore } from "@/stores/use-editor-store";

interface LogoPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
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
  const [loadingLogoId, setLoadingLogoId] = useState<number | null>(null);
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
    async (logo: Pick<SvglLogo, "id" | "title" | "route">) => {
      setLoadingLogoId(logo.id);
      try {
        const url = getLogoRoute(logo as SvglLogo);
        const { width, height } = await loadImageDimensions(url);

        useEditorStore.getState().addImageLayer(url, width, height);
        const id = useEditorStore.getState().activeLayerIds[0];
        if (id) {
          useEditorStore.getState().updateLayer(id, { name: logo.title });
        }

        addRecentLogo({ id: logo.id, title: logo.title, route: logo.route });
        setRecentLogos(getRecentLogos());
        onOpenChange(false);
      } catch (e) {
        console.error("Failed to load logo", e);
      } finally {
        setLoadingLogoId(null);
      }
    },
    [onOpenChange]
  );

  const renderLogoButton = (logo: SvglLogo) => {
    const isLoading = loadingLogoId === logo.id;
    const url = getLogoRoute(logo);

    return (
      <Tooltip key={logo.id}>
        <TooltipTrigger asChild>
          <button
            className="flex items-center justify-center rounded border border-transparent p-2 transition-colors hover:border-border hover:bg-muted disabled:opacity-50"
            disabled={loadingLogoId !== null}
            onClick={() => handleSelect(logo)}
            type="button"
          >
            {isLoading ? (
              <Loader2 className="size-7 animate-spin" />
            ) : (
              <img
                alt={logo.title}
                className="size-7 object-contain"
                loading="lazy"
                src={url}
              />
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p>{logo.title}</p>
        </TooltipContent>
      </Tooltip>
    );
  };

  const renderRecentButton = (recent: RecentLogo) => {
    const isLoading = loadingLogoId === recent.id;
    const url =
      typeof recent.route === "string" ? recent.route : recent.route.light;

    return (
      <Tooltip key={`recent-${recent.id}`}>
        <TooltipTrigger asChild>
          <button
            className="flex items-center justify-center rounded border border-transparent p-2 transition-colors hover:border-border hover:bg-muted disabled:opacity-50"
            disabled={loadingLogoId !== null}
            onClick={() => handleSelect(recent)}
            type="button"
          >
            {isLoading ? (
              <Loader2 className="size-7 animate-spin" />
            ) : (
              <img
                alt={recent.title}
                className="size-7 object-contain"
                loading="lazy"
                src={url}
              />
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p>{recent.title}</p>
        </TooltipContent>
      </Tooltip>
    );
  };

  const displayList = searchResults ?? allLogos;

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="flex h-[80vh] max-w-3xl flex-col gap-3">
        <DialogHeader>
          <DialogTitle>Logo Picker</DialogTitle>
        </DialogHeader>

        {recentLogos.length > 0 && (
          <div>
            <p className="mb-1 text-muted-foreground text-xs">Recently Used</p>
            <div className="flex flex-wrap gap-1">
              {recentLogos.map(renderRecentButton)}
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
