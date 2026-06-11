"use client";

import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Image from "next/image";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { Eyebrow, SectionTitle } from "./support";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

// ─── Act media mocks ──────────────────────────────────────────────────
function FramePullMock() {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0c0c0f]">
      <div className="relative aspect-video">
        <Image
          alt="Scrubbing a video for the perfect frame"
          fill
          sizes="(min-width: 768px) 560px, 100vw"
          src="/landing/screenshot-home.png"
          style={{ objectFit: "cover" }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
        <div className="absolute top-3 left-3 inline-flex items-center gap-1.5 rounded bg-black/70 px-2 py-1 font-mono font-semibold text-[11px] text-white">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--stage-red)]" />
          CAPTURED
        </div>
        <div className="absolute right-3 bottom-3 rounded bg-black/70 px-2 py-1 font-mono text-[11px] text-white/80">
          00:02:14:08 · 3840×2160
        </div>
      </div>
      <div className="relative h-12 border-white/10 border-t bg-[#101014]">
        <div className="absolute inset-0 grid grid-cols-12">
          {[
            "f1",
            "f2",
            "f3",
            "f4",
            "f5",
            "f6",
            "f7",
            "f8",
            "f9",
            "f10",
            "f11",
            "f12",
          ].map((id, i) => (
            <div
              className="border-white/5 border-r last:border-r-0"
              key={id}
              style={{
                background: `linear-gradient(135deg, hsl(${340 - i * 8} 45% ${10 + (i % 3) * 4}%), hsl(${260 + i * 5} 40% ${8 + (i % 4) * 3}%))`,
              }}
            />
          ))}
        </div>
        <div className="scene-playhead" />
      </div>
    </div>
  );
}

const LAYER_ROWS = [
  { name: "Title text", swatch: "linear-gradient(135deg, #ff3358, #ff7a3d)" },
  { name: "Watch button", swatch: "linear-gradient(135deg, #fff, #cbd5e1)" },
  {
    name: "Headshot — cutout",
    swatch: "linear-gradient(135deg, #f5c6a0, #b88860)",
    active: true,
  },
  { name: "Glow", swatch: "radial-gradient(circle, #7c3aed, transparent)" },
  { name: "Background", swatch: "linear-gradient(135deg, #475569, #1e293b)" },
];

function LayersStackMock() {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0c0c0f] p-3">
      <div className="mb-2 flex items-center justify-between px-2 pt-1">
        <span className="font-mono text-[11px] text-white/40 uppercase tracking-[0.2em]">
          Layers
        </span>
        <span className="font-mono text-[11px] text-white/40">5</span>
      </div>
      <div className="flex flex-col gap-1.5">
        {LAYER_ROWS.map((row) => (
          <div
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5",
              row.active
                ? "bg-[var(--stage-red)]/12 ring-1 ring-[var(--stage-red)]/50"
                : "bg-white/[0.03]"
            )}
            key={row.name}
          >
            <span
              className="h-7 w-10 shrink-0 rounded"
              style={{ background: row.swatch }}
            />
            <span
              className={cn(
                "flex-1 text-sm",
                row.active ? "font-medium text-white" : "text-white/60"
              )}
            >
              {row.name}
            </span>
            {row.active && (
              <span className="rounded bg-[var(--stage-red)]/20 px-1.5 py-0.5 font-mono text-[10px] text-[var(--stage-red)]">
                WASM CUTOUT
              </span>
            )}
            <svg
              aria-hidden="true"
              className="text-white/40"
              fill="none"
              height="13"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
              width="13"
            >
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </div>
        ))}
      </div>
    </div>
  );
}

const GEN_TILES = [
  { id: "v1", from: "#2b0a14", to: "#ff3358" },
  { id: "v2", from: "#1a0b2b", to: "#7c3aed" },
  { id: "v3", from: "#2b1606", to: "#ff9a3d" },
  { id: "v4", from: "#06222b", to: "#2dd4bf" },
];

function GenerateMock() {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0c0c0f] p-4">
      <div className="mb-3 rounded-xl bg-white/[0.04] p-3.5">
        <div className="mb-1.5 font-mono text-[10px] text-white/35 uppercase tracking-[0.2em]">
          Prompt
        </div>
        <p className="text-sm text-white/75 leading-relaxed">
          A retro CRT television glowing on a dark workshop bench, dramatic rim
          light, 16:9
        </p>
        <div className="mt-3 flex items-center justify-between">
          <span className="font-mono text-[11px] text-white/35">
            gemini-2.5-flash-image · 4 imgs · ~$0.16
          </span>
          <span className="rounded-full bg-[var(--stage-red)] px-3 py-1.5 font-semibold text-white text-xs">
            ✦ Generate
          </span>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {GEN_TILES.map((tile, i) => (
          <div
            className="scene-gen-tile relative aspect-video overflow-hidden rounded-lg"
            key={tile.id}
            style={{
              animationDelay: `${i * 0.35}s`,
              background: `radial-gradient(120% 120% at 70% 30%, ${tile.to}55, ${tile.from})`,
            }}
          >
            <span className="absolute bottom-1.5 left-2 font-mono text-[10px] text-white/60">
              {tile.id}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Acts data ────────────────────────────────────────────────────────
const ACTS = [
  {
    number: "01",
    title: "Pull the frame",
    body: "Drop in any MP4 or MOV. Scrub frame by frame with arrow keys and extract stills at full source resolution — no screenshot workarounds, no quality loss.",
    media: <FramePullMock />,
  },
  {
    number: "02",
    title: "Stack the layers",
    body: "A real layer engine: toggle, lock, group, reorder. Background removal runs on-device in WebAssembly, so your subject pops in one click — even on a plane.",
    media: <LayersStackMock />,
  },
  {
    number: "03",
    title: "Summon the shot",
    body: "Describe the backdrop you wish you'd shot. Gemini paints it in 16:9 on your own API key — four variants for about sixteen cents, no credits, no quota.",
    media: <GenerateMock />,
  },
];

// ─── Scenes (pinned scroll story on desktop, stacked on mobile) ──────
export function Scenes() {
  const stageRef = useRef<HTMLDivElement>(null);
  const listRefs = useRef<(HTMLDivElement | null)[]>([]);
  const panelRefs = useRef<(HTMLDivElement | null)[]>([]);
  const progressRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) {
      return;
    }
    const mm = gsap.matchMedia();

    mm.add(
      "(min-width: 768px) and (prefers-reduced-motion: no-preference)",
      () => {
        const items = listRefs.current.filter(Boolean) as HTMLDivElement[];
        const panels = panelRefs.current.filter(Boolean) as HTMLDivElement[];
        if (items.length < 3 || panels.length < 3) {
          return;
        }

        gsap.set(panels[1], { autoAlpha: 0, y: 70 });
        gsap.set(panels[2], { autoAlpha: 0, y: 70 });
        gsap.set(items[1], { opacity: 0.3 });
        gsap.set(items[2], { opacity: 0.3 });

        const tl = gsap.timeline({
          defaults: { ease: "power2.inOut" },
          scrollTrigger: {
            trigger: stage,
            start: "top top",
            end: "+=2200",
            pin: true,
            scrub: 0.7,
          },
        });

        const swap = (from: number, to: number) => {
          tl.to(panels[from], { autoAlpha: 0, y: -70, duration: 1 })
            .to(items[from], { opacity: 0.3, duration: 1 }, "<")
            .fromTo(
              panels[to],
              { autoAlpha: 0, y: 70 },
              { autoAlpha: 1, y: 0, duration: 1 },
              "<0.15"
            )
            .to(items[to], { opacity: 1, duration: 1 }, "<");
        };

        tl.to({}, { duration: 0.6 });
        swap(0, 1);
        tl.to({}, { duration: 0.6 });
        swap(1, 2);
        tl.to({}, { duration: 0.6 });

        if (progressRef.current) {
          gsap.fromTo(
            progressRef.current,
            { scaleX: 0 },
            {
              scaleX: 1,
              ease: "none",
              scrollTrigger: {
                trigger: stage,
                start: "top top",
                end: "+=2200",
                scrub: true,
              },
            }
          );
        }
      }
    );

    return () => mm.revert();
  }, []);

  return (
    <section className="relative" id="acts">
      <div className="mx-auto max-w-[1280px] px-6 pt-24 md:pt-36">
        <Eyebrow>What it does</Eyebrow>
        <SectionTitle>
          One studio. <span className="text-white/35">Three acts.</span>
        </SectionTitle>
      </div>

      <div
        className="mx-auto max-w-[1280px] px-6 md:flex md:h-svh md:items-center"
        ref={stageRef}
      >
        <div className="grid w-full gap-12 py-16 md:grid-cols-[1fr_1.1fr] md:items-center md:gap-16 md:py-0">
          <div className="flex flex-col gap-10 md:gap-12">
            {ACTS.map((act, i) => (
              <div className="md:transition-none" key={act.number}>
                <div
                  ref={(el) => {
                    listRefs.current[i] = el;
                  }}
                >
                  <div className="flex items-baseline gap-5">
                    <span className="scene-number font-display text-5xl md:text-6xl">
                      {act.number}
                    </span>
                    <h3 className="font-display text-3xl text-white uppercase tracking-tight md:text-4xl">
                      {act.title}
                    </h3>
                  </div>
                  <p className="mt-3 max-w-[440px] text-sm text-white/50 leading-relaxed md:pl-[5.5rem] md:text-base">
                    {act.body}
                  </p>
                </div>
                {/* mobile: media follows its act inline */}
                <div className="mt-6 md:hidden">{act.media}</div>
              </div>
            ))}
            <div className="hidden h-px w-full max-w-[440px] overflow-hidden rounded bg-white/10 md:block">
              <div
                className="h-full w-full origin-left bg-[var(--stage-red)]"
                ref={progressRef}
                style={{ transform: "scaleX(0)" }}
              />
            </div>
          </div>

          {/* desktop: stacked swap panels */}
          <div className="relative hidden min-h-[420px] md:block">
            {ACTS.map((act, i) => (
              <div
                className="absolute inset-0 flex items-center"
                key={act.number}
                ref={(el) => {
                  panelRefs.current[i] = el;
                }}
              >
                <div className="w-full">{act.media}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
