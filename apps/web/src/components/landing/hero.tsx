"use client";

import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import * as sounds from "@/lib/sounds";
import {
  Magnetic,
  Marquee,
  prefersReducedMotion,
  Reveal,
  SplitReveal,
} from "./motion-primitives";
import { CHECKOUT_URL, DownloadEmailDialog } from "./support";
import { HeroStage } from "./three-stage";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

// ─── Stage intro curtain ──────────────────────────────────────────────
export function StageIntro() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) {
      return;
    }
    if (prefersReducedMotion()) {
      el.style.display = "none";
      return;
    }
    const word = el.querySelector("[data-intro-word]");
    const tl = gsap.timeline({
      onComplete: () => {
        el.style.display = "none";
      },
    });
    tl.fromTo(
      word,
      { autoAlpha: 0, letterSpacing: "0.6em" },
      {
        autoAlpha: 1,
        letterSpacing: "0.18em",
        duration: 0.7,
        ease: "power3.out",
      }
    )
      .to(word, { autoAlpha: 0, duration: 0.3, ease: "power2.in" }, "+=0.25")
      .to(el, { yPercent: -100, duration: 0.7, ease: "power4.inOut" }, "-=0.1");
    return () => {
      tl.kill();
    };
  }, []);

  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 z-[90] flex items-center justify-center bg-[#050505]"
      ref={ref}
    >
      <span
        className="font-mono text-[11px] text-white/70 uppercase"
        data-intro-word
      >
        Backstage
      </span>
    </div>
  );
}

// ─── Hero ─────────────────────────────────────────────────────────────
export function Hero() {
  const [showDownload, setShowDownload] = useState(false);
  const shotWrapRef = useRef<HTMLDivElement>(null);
  const shotRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const wrap = shotWrapRef.current;
    const shot = shotRef.current;
    if (!(wrap && shot) || prefersReducedMotion()) {
      return;
    }
    const tween = gsap.fromTo(
      shot,
      { rotateX: 32, scale: 0.92, y: 50 },
      {
        rotateX: 0,
        scale: 1,
        y: 0,
        ease: "none",
        scrollTrigger: {
          trigger: wrap,
          start: "top 92%",
          end: "top 30%",
          scrub: 0.6,
        },
      }
    );
    return () => {
      tween.scrollTrigger?.kill();
      tween.kill();
    };
  }, []);

  const introDelay = 1.5;

  return (
    <section className="relative flex min-h-svh flex-col justify-center overflow-hidden pt-28 pb-10 md:pt-32">
      <HeroStage />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-[#050505] to-transparent"
      />

      <div className="relative z-10 mx-auto flex w-full max-w-[1280px] flex-col items-center px-6 text-center">
        <Reveal delay={introDelay} trigger="load">
          <p className="mb-6 font-mono text-[11px] text-white/45 uppercase tracking-[0.32em]">
            Open-source thumbnail studio · Mac / Windows / Linux
          </p>
        </Reveal>

        <h1 className="font-display text-[clamp(3.2rem,10vw,8.25rem)] text-white uppercase leading-[0.86] tracking-tight">
          <SplitReveal
            as="span"
            className="block"
            delay={introDelay}
            mode="chars"
            stagger={0.028}
            trigger="load"
          >
            Thumbnails
          </SplitReveal>
          <SplitReveal
            as="span"
            className="block"
            delay={introDelay + 0.22}
            mode="chars"
            stagger={0.028}
            trigger="load"
          >
            that{" "}
            <em className="font-serif-accent text-[var(--stage-red)] normal-case italic">
              earn
            </em>
          </SplitReveal>
          <SplitReveal
            as="span"
            className="block"
            delay={introDelay + 0.44}
            mode="chars"
            stagger={0.028}
            trigger="load"
          >
            the click.
          </SplitReveal>
        </h1>

        <Reveal delay={introDelay + 0.7} trigger="load">
          <p className="mx-auto mt-6 max-w-[560px] text-balance text-base text-white/55 md:text-lg">
            Backstage is the pro-grade desktop studio for YouTube creators. Real
            layers, AI generation on your own Gemini key, frame-perfect video
            stills — all running 100% on your machine.
          </p>
        </Reveal>

        <Reveal className="mt-8" delay={introDelay + 0.85} trigger="load">
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Magnetic>
              <a
                className="stage-button stage-button-primary"
                data-polar-checkout
                data-polar-checkout-theme="dark"
                href={CHECKOUT_URL}
                onClick={sounds.click}
              >
                Get lifetime access · $29
              </a>
            </Magnetic>
            <Magnetic>
              <button
                className="stage-button stage-button-ghost"
                onClick={() => {
                  sounds.download();
                  setShowDownload(true);
                }}
                type="button"
              >
                Download free
              </button>
            </Magnetic>
          </div>
          <p className="mt-4 font-mono text-[11px] text-white/35 uppercase tracking-[0.2em]">
            🔥 $29 until May 25 — then $35
          </p>
        </Reveal>

        <DownloadEmailDialog
          onOpenChange={setShowDownload}
          open={showDownload}
        />

        <div
          className="mt-16 w-full max-w-[960px]"
          ref={shotWrapRef}
          style={{ perspective: "1200px" }}
        >
          <div
            className="overflow-hidden rounded-2xl border border-white/10"
            ref={shotRef}
            style={{
              boxShadow:
                "0 0 80px rgb(230 10 100 / 0.12), 0 40px 90px rgb(0 0 0 / 0.7)",
              transformOrigin: "center top",
            }}
          >
            <Image
              alt="Backstage editor with a layered thumbnail open"
              height={620}
              priority
              src="/landing/screenshot-editor.png"
              style={{ width: "100%", height: "auto", display: "block" }}
              width={1100}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Marquee band ─────────────────────────────────────────────────────
const MARQUEE_TOP = [
  "Real layers",
  "No subscription",
  "BYO Gemini key",
  "100% local",
  "Open source",
  "Frame-perfect stills",
  "$29 once",
  "WASM background removal",
];

const MARQUEE_BOTTOM = [
  "Photoshop is $262/yr",
  "You are not a renter",
  "Cancel nothing",
  "Own your tools",
  "Works offline",
  "Yours forever",
  "AGPL-3.0",
  "No AI credits",
];

function MarqueeRow({ items, accent }: { items: string[]; accent?: boolean }) {
  return (
    <>
      {items.map((item) => (
        <span className="flex items-center" key={item}>
          <span
            className={
              accent
                ? "px-6 font-display text-[var(--stage-red)] text-xl uppercase tracking-wide md:text-2xl"
                : "px-6 font-display text-white/85 text-xl uppercase tracking-wide md:text-2xl"
            }
          >
            {item}
          </span>
          <span aria-hidden="true" className="text-[var(--stage-amber)]">
            ✦
          </span>
        </span>
      ))}
    </>
  );
}

export function MarqueeBand() {
  return (
    <section className="relative border-white/5 border-y bg-[#0a0a0c] py-6">
      <Marquee duration={30}>
        <MarqueeRow items={MARQUEE_TOP} />
      </Marquee>
      <div className="h-4" />
      <Marquee duration={36} reverse>
        <MarqueeRow accent items={MARQUEE_BOTTOM} />
      </Marquee>
    </section>
  );
}
