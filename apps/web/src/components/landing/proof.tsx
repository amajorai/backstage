"use client";

import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useEffect, useRef } from "react";
import * as sounds from "@/lib/sounds";
import { cn } from "@/lib/utils";
import {
  Counter,
  prefersReducedMotion,
  Reveal,
  TiltCard,
} from "./motion-primitives";
import { Eyebrow, GITHUB_URL, GitHubIcon, SectionTitle } from "./support";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

// ─── The math is rude ─────────────────────────────────────────────────
const PRICE_ROWS = [
  { name: "Photoshop", price: 262, cadence: "/yr", share: 0.78 },
  { name: "Figma", price: 144, cadence: "/yr", share: 0.43 },
  { name: "Canva Pro", price: 120, cadence: "/yr", share: 0.36 },
  { name: "Backstage", price: 29, cadence: "once", share: 0.09, hero: true },
];

export function Money() {
  const barsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = barsRef.current;
    if (!root || prefersReducedMotion()) {
      return;
    }
    const bars = root.querySelectorAll("[data-money-bar]");
    const tween = gsap.fromTo(
      bars,
      { scaleX: 0 },
      {
        scaleX: 1,
        duration: 1.4,
        ease: "power3.out",
        stagger: 0.12,
        scrollTrigger: { trigger: root, start: "top 80%", once: true },
      }
    );
    return () => {
      tween.scrollTrigger?.kill();
      tween.kill();
    };
  }, []);

  return (
    <section className="py-24 md:py-36">
      <div className="mx-auto max-w-[1280px] px-6">
        <Eyebrow>Annual cost of looking professional</Eyebrow>
        <SectionTitle>
          The math <span className="text-[var(--stage-red)]">is rude.</span>
        </SectionTitle>
        <Reveal className="mt-5 max-w-[520px]" delay={0.15}>
          <p className="text-base text-white/50 md:text-lg">
            Everyone else re-bills you every month for the same pixels.
            Backstage charges once, and your AI spend goes straight to Google at
            API rates — most creators pay under $2 a month.
          </p>
        </Reveal>

        <div className="mt-14 flex flex-col gap-6" ref={barsRef}>
          {PRICE_ROWS.map((row) => (
            <div className="flex items-center gap-4 md:gap-8" key={row.name}>
              <div
                className={cn(
                  "w-28 shrink-0 font-display text-base uppercase tracking-wide md:w-40 md:text-xl",
                  row.hero ? "text-[var(--stage-red)]" : "text-white/55"
                )}
              >
                {row.name}
              </div>
              <div className="relative h-12 flex-1 md:h-16">
                <div
                  className={cn(
                    "absolute inset-y-0 left-0 origin-left rounded-r-xl",
                    row.hero
                      ? "bg-gradient-to-r from-[var(--stage-red)] to-[#ff7a3d] shadow-[0_0_40px_rgb(255_51_88/0.35)]"
                      : "bg-white/10"
                  )}
                  data-money-bar
                  style={{ width: `${row.share * 100}%` }}
                />
                <div
                  className="absolute inset-y-0 flex items-center gap-1.5 pl-3"
                  style={{ left: `${row.share * 100}%` }}
                >
                  <Counter
                    className={cn(
                      "font-display text-2xl md:text-4xl",
                      row.hero ? "text-white" : "text-white/70"
                    )}
                    duration={1.8}
                    prefix="$"
                    to={row.price}
                  />
                  <span className="font-mono text-[11px] text-white/40 uppercase">
                    {row.cadence}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <Reveal className="mt-12" delay={0.1}>
          <div className="inline-block rounded-xl border border-white/10 bg-white/[0.03] p-5 text-sm text-white/50">
            <strong className="text-white">Real math:</strong> 30 Gemini
            thumbnail variations a month ≈ $1.20. After 2 months, Backstage plus
            your Gemini spend is still cheaper than one month of Canva Pro.
          </div>
        </Reveal>
      </div>
    </section>
  );
}

// ─── Privacy ──────────────────────────────────────────────────────────
const PRIVACY_CARDS = [
  {
    title: "Never phones home",
    body: "Background removal runs in WebAssembly on-device. Video frames never leave your disk. Your unfinished thumbnails don't exist on anybody else's hard drive.",
    icon: (
      <svg
        aria-hidden="true"
        fill="none"
        height="18"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        viewBox="0 0 24 24"
        width="18"
      >
        <rect height="11" rx="2" ry="2" width="18" x="3" y="11" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
    ),
  },
  {
    title: "Plain folders, your disk",
    body: "Projects live on your filesystem as plain folders. Move them, sync them in Dropbox, version-control them in git. No proprietary cloud lock-in.",
    icon: (
      <svg
        aria-hidden="true"
        fill="none"
        height="18"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        viewBox="0 0 24 24"
        width="18"
      >
        <path d="M21 8v8a2 2 0 0 1-1 1.73l-7 4a2 2 0 0 1-2 0l-7-4A2 2 0 0 1 3 16V8a2 2 0 0 1 1-1.73l7-4a2 2 0 0 1 2 0l7 4A2 2 0 0 1 21 8z" />
        <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
        <line x1="12" x2="12" y1="22.08" y2="12" />
      </svg>
    ),
  },
  {
    title: "Keys in your keychain",
    body: "Your Gemini key lives in the native OS secure store: macOS Keychain, Windows Credential Manager, libsecret. Never plaintext on disk. Never seen by us.",
    icon: (
      <svg
        aria-hidden="true"
        fill="none"
        height="18"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        viewBox="0 0 24 24"
        width="18"
      >
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
  },
];

export function Privacy() {
  return (
    <section className="border-white/5 border-t bg-[#08080a] py-24 md:py-36">
      <div className="mx-auto max-w-[1280px] px-6">
        <Eyebrow>Local-first by default</Eyebrow>
        <SectionTitle>
          Nothing leaves <span className="text-white/35">the building.</span>
        </SectionTitle>
        <Reveal className="mt-5 max-w-[520px]" delay={0.15}>
          <p className="text-base text-white/50 md:text-lg">
            Backstage is a native desktop app, not a web wrapper with your files
            on someone else&apos;s server. Your projects, your source files,
            your API keys.
          </p>
        </Reveal>
        <div className="mt-14 grid gap-5 md:grid-cols-3">
          {PRIVACY_CARDS.map((card, i) => (
            <Reveal delay={i * 0.12} key={card.title}>
              <TiltCard className="h-full overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-7">
                <div className="mb-5 flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--stage-red)]/12 text-[var(--stage-red)]">
                  {card.icon}
                </div>
                <h3 className="mb-2 font-display text-white text-xl uppercase tracking-wide">
                  {card.title}
                </h3>
                <p className="text-sm text-white/50 leading-relaxed">
                  {card.body}
                </p>
              </TiltCard>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Receipts (comparison) ────────────────────────────────────────────
interface Cell {
  mark: "yes" | "no" | "maybe" | "hero";
  text: string;
}

const COMPARE_ROWS: { label: string; us: Cell; rest: Cell[] }[] = [
  {
    label: "Yearly cost",
    us: { mark: "hero", text: "$29 once" },
    rest: [
      { mark: "no", text: "$262" },
      { mark: "no", text: "$120" },
      { mark: "no", text: "$144" },
    ],
  },
  {
    label: "Built for YouTube thumbnails",
    us: { mark: "yes", text: "Sole purpose" },
    rest: [
      { mark: "no", text: "General editor" },
      { mark: "maybe", text: "Template-based" },
      { mark: "no", text: "UI / design tool" },
    ],
  },
  {
    label: "Offline AI background removal",
    us: { mark: "yes", text: "WebAssembly" },
    rest: [
      { mark: "maybe", text: "Cloud feature" },
      { mark: "no", text: "Cloud only" },
      { mark: "no", text: "Plugin needed" },
    ],
  },
  {
    label: "AI image generation",
    us: { mark: "yes", text: "Your Gemini key" },
    rest: [
      { mark: "maybe", text: "Firefly credits" },
      { mark: "maybe", text: "Limited monthly" },
      { mark: "no", text: "Plugin needed" },
    ],
  },
  {
    label: "Video frame extraction",
    us: { mark: "yes", text: "Built-in scrubber" },
    rest: [
      { mark: "no", text: "Manual via PR" },
      { mark: "no", text: "No" },
      { mark: "no", text: "No" },
    ],
  },
  {
    label: "Works offline",
    us: { mark: "yes", text: "Yes" },
    rest: [
      { mark: "yes", text: "Yes" },
      { mark: "no", text: "No" },
      { mark: "no", text: "No" },
    ],
  },
  {
    label: "Source code open",
    us: { mark: "yes", text: "AGPL-3.0" },
    rest: [
      { mark: "no", text: "Proprietary" },
      { mark: "no", text: "Proprietary" },
      { mark: "no", text: "Proprietary" },
    ],
  },
  {
    label: "Stops working if you cancel",
    us: { mark: "hero", text: "Never. Yours." },
    rest: [
      { mark: "no", text: "Yes" },
      { mark: "no", text: "Yes" },
      { mark: "no", text: "Yes" },
    ],
  },
];

function CellMark({ cell, hero }: { cell: Cell; hero?: boolean }) {
  const dotClass = {
    yes: "text-[var(--stage-red)]",
    hero: "text-[var(--stage-red)]",
    maybe: "text-white/50",
    no: "text-white/25",
  }[cell.mark];
  const dot = { yes: "●", hero: "★", maybe: "◐", no: "○" }[cell.mark];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2",
        hero ? "font-medium text-white" : "text-white/45"
      )}
    >
      <span aria-hidden="true" className={dotClass}>
        {dot}
      </span>
      {cell.text}
    </span>
  );
}

export function CompareTable() {
  return (
    <section className="py-24 md:py-36" id="receipts">
      <div className="mx-auto max-w-[1280px] px-6">
        <Eyebrow>The honest comparison</Eyebrow>
        <SectionTitle>Receipts.</SectionTitle>
        <Reveal className="mt-12 overflow-x-auto" delay={0.1}>
          <div className="min-w-[760px] overflow-hidden rounded-2xl border border-white/10">
            <div
              className="grid bg-white/[0.02] font-mono text-[11px] uppercase tracking-[0.16em]"
              style={{ gridTemplateColumns: "1.4fr 1.1fr 1fr 1fr 1fr" }}
            >
              <div className="px-5 py-4 text-white/30" />
              <div className="bg-[var(--stage-red)]/10 px-5 py-4 text-[var(--stage-red)]">
                Backstage
              </div>
              {["Photoshop", "Canva Pro", "Figma"].map((b) => (
                <div className="px-5 py-4 text-white/30" key={b}>
                  {b}
                </div>
              ))}
            </div>
            {COMPARE_ROWS.map((row) => (
              <div
                className="grid border-white/5 border-t text-sm"
                key={row.label}
                style={{ gridTemplateColumns: "1.4fr 1.1fr 1fr 1fr 1fr" }}
              >
                <div className="px-5 py-4 text-white/55">{row.label}</div>
                <div className="bg-[var(--stage-red)]/[0.06] px-5 py-4">
                  <CellMark cell={row.us} hero />
                </div>
                {row.rest.map((cell, i) => (
                  <div
                    className="px-5 py-4"
                    key={`${row.label}-${cell.text}-${String(i)}`}
                  >
                    <CellMark cell={cell} />
                  </div>
                ))}
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

// ─── Open source ──────────────────────────────────────────────────────
const TERMINAL_LINES = [
  { label: "Source", value: "github.com/amajorai/backstage" },
  { label: "License", value: "AGPL-3.0 (BRIA model is non-commercial)" },
  { label: "Stack", value: "Tauri, Rust, React, TypeScript" },
  { label: "Issues", value: "public, triaged weekly" },
  { label: "PRs", value: "welcome — every feature here started as code" },
];

export function OpenSource() {
  return (
    <section className="border-white/5 border-t bg-[#08080a] py-24 md:py-36">
      <div className="mx-auto max-w-[1280px] px-6">
        <div className="grid items-center gap-12 md:grid-cols-2">
          <div>
            <Eyebrow>Open source</Eyebrow>
            <SectionTitle>
              Read the <span className="text-white/35">source.</span>
            </SectionTitle>
            <Reveal className="mt-5" delay={0.15}>
              <p className="mb-7 max-w-[480px] text-white/50">
                Every line of Backstage is on GitHub: the desktop app, the layer
                engine, the AI integrations. The one-time purchase is for the
                prebuilt, signed, auto-updating binaries — including 1 year of
                updates. Rather compile it yourself? That&apos;s free.
              </p>
              <div className="flex flex-wrap gap-3">
                <a
                  className="stage-button stage-button-ghost"
                  href={GITHUB_URL}
                  onClick={sounds.click}
                  rel="noopener"
                  target="_blank"
                >
                  <GitHubIcon size={15} />
                  Star on GitHub
                </a>
                <a
                  className="stage-button stage-button-text"
                  href={`${GITHUB_URL}#getting-started`}
                  onClick={sounds.click}
                  rel="noopener"
                  target="_blank"
                >
                  Read the build docs →
                </a>
              </div>
            </Reveal>
          </div>
          <Reveal delay={0.2}>
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0c0c0f]">
              <div className="flex items-center gap-1.5 border-white/5 border-b px-4 py-3">
                <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
                <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
                <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
                <span className="ml-3 font-mono text-[11px] text-white/30">
                  ~/backstage
                </span>
              </div>
              <div className="flex flex-col gap-3 p-5 font-mono text-sm">
                <div className="text-white/70">
                  <span className="text-[var(--stage-red)]">$</span> git clone{" "}
                  {GITHUB_URL.replace("https://", "")}
                </div>
                {TERMINAL_LINES.map((line) => (
                  <div className="text-white/45" key={line.label}>
                    <span className="text-[var(--stage-amber)]">
                      {line.label}:
                    </span>{" "}
                    {line.value}
                  </div>
                ))}
                <div className="text-white/70">
                  <span className="text-[var(--stage-red)]">$</span>{" "}
                  <span className="terminal-caret" />
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
