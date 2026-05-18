import {
  Compass,
  File,
  GalleryHorizontal,
  GalleryThumbnails,
  Sparkles,
} from "lucide-react";

const layers = [
  { label: "Headline Text", color: "#7c3aed", type: "T" },
  { label: "Product Image", color: "#2563eb", type: "I" },
  { label: "Logo SVG", color: "#059669", type: "S" },
  { label: "Background", color: "#ea580c", type: "R" },
];

const props = [
  { label: "Font", value: "Inter" },
  { label: "Size", value: "32" },
  { label: "Color", value: "#fff" },
  { label: "Opacity", value: "100%" },
];

export function EditorMockup() {
  return (
    <div className="pointer-events-none flex h-full w-full flex-col overflow-hidden rounded-xl border border-border/50 bg-muted text-[9px] shadow-2xl">
      {/* TabBar */}
      <div className="flex h-8 shrink-0 items-center gap-1.5 bg-muted px-2">
        <GalleryThumbnails
          className="shrink-0 text-foreground/60"
          size={11}
          strokeWidth={3}
        />
        {/* Page dropdown — editor mode so muted */}
        <div className="flex h-6 items-center gap-1 rounded-md px-2 text-muted-foreground">
          <GalleryHorizontal className="size-2.5 shrink-0" />
          <span>Home</span>
        </div>
        <div className="mx-0.5 h-3.5 w-px bg-border" />
        {/* Active editor tab */}
        <div className="flex h-6 items-center gap-1 rounded-md bg-background px-2 text-foreground shadow-sm">
          <File className="size-2.5 shrink-0 text-muted-foreground" />
          <span className="font-medium">Summer Campaign</span>
          <div className="ml-1 size-1.5 rounded-full bg-amber-400" />
        </div>
        <div className="flex h-6 items-center gap-1 rounded-md px-2 text-muted-foreground">
          <File className="size-2.5 shrink-0" />
          <span>Brand Kit</span>
        </div>
      </div>

      {/* Content card */}
      <div className="mx-1 flex flex-1 flex-col overflow-hidden rounded-lg border border-border/60 bg-background">
        {/* Editor header */}
        <div className="flex h-8 shrink-0 items-center justify-between border-border/60 border-b px-3">
          <span className="font-medium text-foreground/80">
            Summer Campaign
          </span>
          <div className="flex items-center gap-1.5">
            <div className="h-4 w-6 rounded-sm bg-muted-foreground/20" />
            <div className="h-4 w-6 rounded-sm bg-muted-foreground/20" />
            <div className="h-4 w-12 rounded bg-foreground/80" />
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Layers panel */}
          <div className="flex w-28 shrink-0 flex-col border-border/60 border-r">
            <div className="border-border/60 border-b px-2 py-1.5 font-medium text-muted-foreground">
              Layers
            </div>
            <div className="flex flex-col gap-0.5 p-1.5">
              {layers.map((layer, i) => (
                <div
                  className={`flex items-center gap-1.5 rounded px-1.5 py-1 ${i === 0 ? "bg-muted" : ""}`}
                  key={layer.label}
                >
                  <div
                    className="flex size-4 shrink-0 items-center justify-center rounded font-bold text-[7px] text-white"
                    style={{ background: layer.color }}
                  >
                    {layer.type}
                  </div>
                  <span className="truncate text-foreground/70">
                    {layer.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Canvas */}
          <div className="flex flex-1 items-center justify-center bg-muted/30 p-3">
            <div
              className="relative aspect-video w-full max-w-[160px] overflow-hidden rounded-md shadow-lg"
              style={{
                background:
                  "radial-gradient(ellipse at 20% 80%, #4c1d95 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, #1e40af 0%, transparent 55%), #0d0a1e",
              }}
            >
              <div
                className="absolute top-0 right-0 h-14 w-14 rounded-bl-full opacity-20"
                style={{ background: "#a78bfa" }}
              />
              <div
                className="absolute top-3 left-3 flex h-8 w-8 items-center justify-center rounded-md opacity-90"
                style={{
                  background:
                    "radial-gradient(ellipse at 30% 70%, #3b82f6 0%, transparent 70%), radial-gradient(ellipse at 80% 20%, #8b5cf6 0%, transparent 65%), #1e1b4b",
                }}
              >
                <div className="h-3 w-3 rounded-sm bg-white/70" />
              </div>
              <div className="absolute right-3 bottom-3 left-3">
                <div className="mb-1.5 h-2 w-16 rounded-full bg-white" />
                <div className="h-1.5 w-10 rounded-full bg-white/40" />
              </div>
            </div>
          </div>

          {/* Properties panel */}
          <div className="flex w-24 shrink-0 flex-col gap-2 border-border/60 border-l p-2">
            <div className="font-medium text-muted-foreground">Properties</div>
            {props.map((p) => (
              <div className="flex flex-col gap-0.5" key={p.label}>
                <span className="text-muted-foreground/60">{p.label}</span>
                <div className="flex h-4 items-center gap-1 rounded border border-border/50 bg-muted/30 px-1.5">
                  {p.label === "Color" && (
                    <div className="size-2 rounded-sm bg-white ring-1 ring-border/50" />
                  )}
                  <span className="text-foreground/80">{p.value}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex h-6 shrink-0 items-center justify-between border-border/60 border-t bg-muted/30 px-3">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <div className="h-2 w-4 rounded-sm bg-foreground/20" />
            <div className="h-2 w-4 rounded-sm bg-foreground/20" />
            <div className="h-2 w-4 rounded-sm bg-foreground/20" />
          </div>
          <span className="text-muted-foreground">100%</span>
        </div>
      </div>

      {/* BottomToolbar */}
      <div className="flex h-8 shrink-0 items-center justify-between px-4">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Sparkles className="size-3" />
          <Compass className="size-3" />
        </div>
        <div className="text-muted-foreground">Page 1 / 3</div>
      </div>
    </div>
  );
}
