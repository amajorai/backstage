import {
  Archive,
  Compass,
  GalleryHorizontal,
  GalleryThumbnails,
  Search,
  Settings,
  Sparkles,
  Tag,
  Trash2,
} from "lucide-react";

const projects = [
  {
    bg: "radial-gradient(ellipse at 20% 80%, #7c3aed 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, #2563eb 0%, transparent 55%), #0d0a1e",
    title: "Summer Campaign",
  },
  {
    bg: "radial-gradient(ellipse at 80% 80%, #0891b2 0%, transparent 55%), radial-gradient(ellipse at 20% 20%, #059669 0%, transparent 60%), #001a12",
    title: "Product Launch",
  },
  {
    bg: "radial-gradient(ellipse at 10% 90%, #dc2626 0%, transparent 55%), radial-gradient(ellipse at 90% 10%, #ea580c 0%, transparent 60%), #1a0a00",
    title: "Brand Kit",
  },
  {
    bg: "radial-gradient(ellipse at 0% 100%, #9333ea 0%, transparent 60%), radial-gradient(ellipse at 100% 0%, #ec4899 0%, transparent 55%), #1a0018",
    title: "Story Template",
  },
  {
    bg: "radial-gradient(ellipse at 30% 70%, #1d4ed8 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, #7c3aed 0%, transparent 55%), #08051a",
    title: "Event Flyer",
  },
  {
    bg: "radial-gradient(ellipse at 70% 80%, #047857 0%, transparent 55%), radial-gradient(ellipse at 20% 10%, #0891b2 0%, transparent 60%), #001510",
    title: "Social Post",
  },
  {
    bg: "radial-gradient(ellipse at 10% 80%, #b45309 0%, transparent 55%), radial-gradient(ellipse at 80% 20%, #dc2626 0%, transparent 60%), #180a00",
    title: "Cover Art",
  },
  {
    bg: "radial-gradient(ellipse at 90% 90%, #be185d 0%, transparent 55%), radial-gradient(ellipse at 10% 10%, #7c3aed 0%, transparent 60%), #150010",
    title: "Pitch Deck",
  },
];

const folders = ["All", "Work", "Personal", "Social"];

export function GalleryMockup() {
  return (
    <div className="pointer-events-none flex h-full w-full flex-col overflow-hidden rounded-xl border border-border/50 bg-muted text-[9px] shadow-2xl">
      {/* TabBar — h-10 bg-muted */}
      <div className="flex h-8 shrink-0 items-center gap-1.5 bg-muted px-2">
        <GalleryThumbnails
          className="shrink-0 text-foreground/60"
          size={11}
          strokeWidth={3}
        />
        {/* Page dropdown */}
        <div className="flex h-6 items-center gap-1 rounded-md bg-background px-2 text-foreground shadow-sm">
          <GalleryHorizontal className="size-2.5 shrink-0" />
          <span className="font-medium">Home</span>
        </div>
        {/* Divider */}
        <div className="mx-0.5 h-3.5 w-px bg-border" />
        {/* Open tab */}
        <div className="flex h-6 items-center gap-1 rounded-md bg-background px-2 text-foreground shadow-sm">
          <div className="size-2 rounded-sm bg-muted-foreground/30" />
          <span className="font-medium">Summer Campaign</span>
        </div>
      </div>

      {/* Content card */}
      <div className="mx-1 flex flex-1 flex-col overflow-hidden rounded-lg border border-border/60 bg-background">
        {/* Folder chips */}
        <div className="flex shrink-0 items-center gap-1 px-4 py-2">
          {folders.map((f, i) => (
            <div
              className={`flex items-center gap-1 rounded-md px-2 py-0.5 font-medium ${
                i === 0
                  ? "bg-foreground text-background"
                  : "text-muted-foreground"
              }`}
              key={f}
            >
              {f}
              {i === 0 && (
                <span className="rounded bg-background/20 px-0.5 tabular-nums">
                  {projects.length}
                </span>
              )}
            </div>
          ))}
        </div>

        {/* Grid */}
        <div className="grid flex-1 grid-cols-4 gap-2 overflow-hidden px-4 pb-2">
          {projects.map((p) => (
            <div className="flex flex-col gap-0.5" key={p.title}>
              <div
                className="aspect-video w-full rounded-md"
                style={{ background: p.bg }}
              />
              <span className="truncate text-muted-foreground">{p.title}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom toolbar — h-12 bg-muted */}
      <div className="flex h-9 shrink-0 items-center justify-between px-4">
        {/* Left: view mode */}
        <div className="flex items-center gap-1">
          <div className="flex size-5 items-center justify-center rounded text-muted-foreground">
            <div className="grid grid-cols-2 gap-0.5">
              {[0, 1, 2, 3].map((i) => (
                <div className="size-1 rounded-sm bg-current" key={i} />
              ))}
            </div>
          </div>
          <div className="flex size-5 items-center justify-center rounded text-muted-foreground">
            <Tag className="size-3" />
          </div>
        </div>

        {/* Center: search */}
        <div className="flex h-6 w-52 items-center gap-1.5 rounded-md bg-background px-2">
          <Search className="size-3 text-muted-foreground/50" />
          <span className="text-muted-foreground/50">Search projects</span>
        </div>

        {/* Right: icons */}
        <div className="flex items-center gap-1 text-muted-foreground">
          <Sparkles className="size-3.5" />
          <Archive className="size-3.5" />
          <Compass className="size-3.5" />
          <Trash2 className="size-3.5" />
          <Settings className="size-3.5" />
        </div>
      </div>
    </div>
  );
}
