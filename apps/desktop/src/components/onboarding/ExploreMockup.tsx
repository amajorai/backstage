import { Compass, GalleryThumbnails, Search, Settings } from "lucide-react";

const row1 = [
  {
    bg: "radial-gradient(ellipse at 30% 70%, #1e40af 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, #7c3aed 0%, transparent 55%), #08051a",
  },
  {
    bg: "radial-gradient(ellipse at 80% 80%, #065f46 0%, transparent 55%), radial-gradient(ellipse at 20% 10%, #0891b2 0%, transparent 60%), #001510",
  },
  {
    bg: "radial-gradient(ellipse at 10% 90%, #7c2d12 0%, transparent 55%), radial-gradient(ellipse at 90% 10%, #be185d 0%, transparent 60%), #150010",
  },
  {
    bg: "radial-gradient(ellipse at 20% 80%, #1e3a5f 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, #0f766e 0%, transparent 55%), #001215",
  },
  {
    bg: "radial-gradient(ellipse at 0% 100%, #3b0764 0%, transparent 60%), radial-gradient(ellipse at 100% 0%, #1e40af 0%, transparent 55%), #08051a",
  },
  {
    bg: "radial-gradient(ellipse at 10% 80%, #451a03 0%, transparent 55%), radial-gradient(ellipse at 90% 20%, #854d0e 0%, transparent 60%), #180a00",
  },
];

const row2 = [
  {
    bg: "radial-gradient(ellipse at 60% 30%, #be185d 0%, transparent 55%), radial-gradient(ellipse at 20% 80%, #7c3aed 0%, transparent 60%), #1a0018",
  },
  {
    bg: "radial-gradient(ellipse at 80% 60%, #065f46 0%, transparent 55%), radial-gradient(ellipse at 10% 20%, #1e40af 0%, transparent 60%), #001510",
  },
  {
    bg: "radial-gradient(ellipse at 30% 50%, #dc2626 0%, transparent 55%), radial-gradient(ellipse at 80% 10%, #ea580c 0%, transparent 60%), #1a0800",
  },
  {
    bg: "radial-gradient(ellipse at 70% 80%, #0891b2 0%, transparent 55%), radial-gradient(ellipse at 20% 20%, #0f766e 0%, transparent 60%), #001215",
  },
  {
    bg: "radial-gradient(ellipse at 50% 50%, #9333ea 0%, transparent 55%), radial-gradient(ellipse at 90% 90%, #ec4899 0%, transparent 60%), #1a0018",
  },
  {
    bg: "radial-gradient(ellipse at 10% 70%, #854d0e 0%, transparent 55%), radial-gradient(ellipse at 80% 30%, #b45309 0%, transparent 60%), #180a00",
  },
];

const row3 = [
  {
    bg: "radial-gradient(ellipse at 40% 60%, #2563eb 0%, transparent 55%), radial-gradient(ellipse at 90% 10%, #4f46e5 0%, transparent 60%), #08051a",
  },
  {
    bg: "radial-gradient(ellipse at 20% 90%, #059669 0%, transparent 55%), radial-gradient(ellipse at 70% 20%, #0891b2 0%, transparent 60%), #001a12",
  },
  {
    bg: "radial-gradient(ellipse at 80% 70%, #dc2626 0%, transparent 55%), radial-gradient(ellipse at 10% 10%, #9333ea 0%, transparent 60%), #150010",
  },
  {
    bg: "radial-gradient(ellipse at 30% 40%, #0f766e 0%, transparent 55%), radial-gradient(ellipse at 80% 80%, #1e40af 0%, transparent 60%), #001215",
  },
  {
    bg: "radial-gradient(ellipse at 60% 20%, #ec4899 0%, transparent 55%), radial-gradient(ellipse at 10% 80%, #7c3aed 0%, transparent 60%), #1a0018",
  },
  {
    bg: "radial-gradient(ellipse at 50% 90%, #b45309 0%, transparent 55%), radial-gradient(ellipse at 80% 10%, #dc2626 0%, transparent 60%), #180a00",
  },
];

function Strip({
  items,
  duration,
  direction,
}: {
  items: { bg: string }[];
  duration: string;
  direction: "left" | "right";
}) {
  const doubled = [...items, ...items];
  const anim =
    direction === "left"
      ? `marquee-left ${duration} linear infinite`
      : `marquee-right ${duration} linear infinite`;

  return (
    <div className="relative overflow-hidden">
      <div className="flex gap-1.5" style={{ animation: anim, width: "200%" }}>
        {doubled.map((item, i) => (
          <div
            className="relative aspect-video shrink-0 overflow-hidden rounded-md"
            // biome-ignore lint/suspicious/noArrayIndexKey: duplicated static list
            key={i}
            style={{ background: item.bg, width: "calc(100% / 12 - 6px)" }}
          >
            <div className="absolute right-1 bottom-1 rounded bg-black/60 px-0.5 text-[7px] text-white">
              3:42
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ExploreMockup() {
  return (
    <div className="pointer-events-none flex h-full w-full flex-col overflow-hidden rounded-xl border border-border/50 bg-muted text-[9px] shadow-2xl">
      <style>{`
        @keyframes marquee-left {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
        @keyframes marquee-right {
          from { transform: translateX(-50%); }
          to   { transform: translateX(0); }
        }
      `}</style>

      {/* TabBar */}
      <div className="flex h-8 shrink-0 items-center gap-1.5 bg-muted px-2">
        <GalleryThumbnails
          className="shrink-0 text-foreground/60"
          size={11}
          strokeWidth={3}
        />
        <div className="flex h-6 items-center gap-1 rounded-md bg-background px-2 text-foreground shadow-sm">
          <Compass className="size-2.5 shrink-0" />
          <span className="font-medium">Explore</span>
        </div>
      </div>

      {/* Content card */}
      <div className="mx-1 flex flex-1 flex-col overflow-hidden rounded-lg border border-border/60 bg-background">
        {/* Category tabs */}
        <div className="flex shrink-0 items-center gap-1 overflow-hidden px-4 py-2">
          {["Trending", "Saved", "Music", "Gaming", "Sports"].map((cat, i) => (
            <div
              className={`shrink-0 rounded-md px-2 py-0.5 font-medium ${
                i === 0
                  ? "bg-foreground text-background"
                  : "text-muted-foreground"
              }`}
              key={cat}
            >
              {cat}
            </div>
          ))}
        </div>

        {/* Marquee rows */}
        <div className="relative flex flex-1 flex-col justify-center gap-2 overflow-hidden px-2 pb-2">
          <Strip direction="left" duration="22s" items={row1} />
          <Strip direction="right" duration="18s" items={row2} />
          <Strip direction="left" duration="26s" items={row3} />

          {/* Edge fade masks */}
          <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-12 bg-gradient-to-r from-background to-transparent" />
          <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-12 bg-gradient-to-l from-background to-transparent" />
        </div>
      </div>

      {/* Bottom toolbar */}
      <div className="flex h-8 shrink-0 items-center justify-between px-4">
        <div className="flex items-center gap-1 text-muted-foreground">
          <div className="h-2 w-8 rounded-full bg-foreground/15" />
        </div>
        <div className="flex h-5 w-40 items-center gap-1 rounded-md bg-background px-2">
          <Search className="size-2.5 text-muted-foreground/50" />
          <span className="text-muted-foreground/50">Search YouTube</span>
        </div>
        <Settings className="size-3 text-muted-foreground" />
      </div>
    </div>
  );
}
