import { GalleryThumbnails, Sparkles } from "lucide-react";

const tiles = [
  {
    from: "#7c3aed",
    mid: "#2563eb",
    base: "#0d0a1e",
    delay: "0s",
  },
  {
    from: "#059669",
    mid: "#0891b2",
    base: "#001a12",
    delay: "2.5s",
  },
  {
    from: "#dc2626",
    mid: "#9333ea",
    base: "#150010",
    delay: "5s",
  },
  {
    from: "#b45309",
    mid: "#dc2626",
    base: "#180a00",
    delay: "7.5s",
  },
];

export function AiMockup() {
  return (
    <div className="pointer-events-none flex h-full w-full flex-col overflow-hidden rounded-xl border border-border/50 bg-muted text-[9px] shadow-2xl">
      <style>{`
        @keyframes ai-gradient {
          0%   { background-position: 0% 50%; }
          50%  { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes ai-cursor {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0; }
        }
        @keyframes ai-tile-in {
          from { opacity: 0; transform: scale(0.92); }
          to   { opacity: 1; transform: scale(1); }
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
          <Sparkles className="size-2.5 shrink-0" />
          <span className="font-medium">Generate</span>
        </div>
      </div>

      {/* Content card */}
      <div className="mx-1 flex flex-1 flex-col overflow-hidden rounded-lg border border-border/60 bg-background">
        {/* Prompt bar */}
        <div className="flex h-8 shrink-0 items-center gap-1.5 border-border/60 border-b px-3">
          <Sparkles className="size-2.5 shrink-0 text-muted-foreground/60" />
          <span className="text-muted-foreground/50">
            A vibrant summer campaign with bold typography
          </span>
          <span
            className="ml-0.5 inline-block h-2.5 w-px bg-foreground/60"
            style={{ animation: "ai-cursor 1s step-start infinite" }}
          />
        </div>

        {/* Image grid */}
        <div className="grid flex-1 grid-cols-2 gap-2 p-3">
          {tiles.map((t, i) => (
            <div
              className="relative overflow-hidden rounded-md"
              // biome-ignore lint/suspicious/noArrayIndexKey: static list
              key={i}
              style={{
                background: `radial-gradient(ellipse at 20% 80%, ${t.from} 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, ${t.mid} 0%, transparent 55%), ${t.base}`,
                backgroundSize: "300% 300%",
                animation: `ai-gradient 10s ease-in-out ${t.delay} infinite, ai-tile-in 0.4s ease-out ${Number.parseFloat(t.delay) * 0.1 + i * 0.15}s both`,
              }}
            >
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="size-6 rounded-full bg-white/10" />
              </div>
              {i === 0 && (
                <div className="absolute right-1 bottom-1 flex items-center gap-1 rounded bg-black/40 px-1.5 py-0.5">
                  <div className="h-1.5 w-8 rounded-full bg-white/60" />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Bottom toolbar */}
      <div className="flex h-8 shrink-0 items-center justify-between px-4">
        <div className="h-2 w-16 rounded-full bg-foreground/15" />
        <div className="text-muted-foreground">4×</div>
      </div>
    </div>
  );
}
