"use client";

import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import {
  motion,
  useMotionTemplate,
  useMotionValue,
  useSpring,
} from "motion/react";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger, SplitText);
}

export const EASE_OUT = "power4.out";

export function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

// ─── SplitReveal ──────────────────────────────────────────────────────
// Masked line/word/char reveal for headlines. Splits after fonts load so
// line breaks are computed against the real display face.
interface SplitRevealProps {
  children: React.ReactNode;
  as?: "h1" | "h2" | "h3" | "p" | "div" | "span";
  className?: string;
  mode?: "chars" | "words" | "lines";
  /** "load" animates immediately, "scroll" waits for viewport entry */
  trigger?: "load" | "scroll";
  delay?: number;
  stagger?: number;
}

export function SplitReveal({
  children,
  as: Tag = "div",
  className,
  mode = "words",
  trigger = "scroll",
  delay = 0,
  stagger = 0.05,
}: SplitRevealProps) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) {
      return;
    }
    if (prefersReducedMotion()) {
      el.style.visibility = "visible";
      return;
    }

    let split: SplitText | null = null;
    let tween: gsap.core.Tween | null = null;
    let cancelled = false;

    document.fonts.ready.then(() => {
      if (cancelled) {
        return;
      }
      split = SplitText.create(el, {
        type: "lines,words,chars",
        mask: "lines",
        linesClass: "split-line",
      });
      let targets: Element[] = split.words;
      if (mode === "chars") {
        targets = split.chars;
      } else if (mode === "lines") {
        targets = split.lines;
      }
      el.style.visibility = "visible";
      tween = gsap.from(targets, {
        yPercent: 130,
        rotate: mode === "chars" ? 4 : 0,
        duration: 1.2,
        ease: EASE_OUT,
        stagger,
        delay,
        scrollTrigger:
          trigger === "scroll"
            ? { trigger: el, start: "top 85%", once: true }
            : undefined,
      });
    });

    return () => {
      cancelled = true;
      tween?.scrollTrigger?.kill();
      tween?.kill();
      split?.revert();
    };
  }, [mode, trigger, delay, stagger]);

  return (
    <Tag
      className={className}
      ref={ref as React.Ref<never>}
      style={{ visibility: "hidden" }}
    >
      {children}
    </Tag>
  );
}

// ─── Reveal ───────────────────────────────────────────────────────────
export function Reveal({
  children,
  className,
  delay = 0,
  y = 42,
  trigger = "scroll",
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  y?: number;
  /** "load" animates immediately, "scroll" waits for viewport entry */
  trigger?: "load" | "scroll";
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion()) {
      return;
    }
    const tween = gsap.fromTo(
      el,
      { autoAlpha: 0, y },
      {
        autoAlpha: 1,
        y: 0,
        duration: 1.1,
        ease: EASE_OUT,
        delay,
        scrollTrigger:
          trigger === "scroll"
            ? { trigger: el, start: "top 88%", once: true }
            : undefined,
      }
    );
    return () => {
      tween.scrollTrigger?.kill();
      tween.kill();
    };
  }, [delay, y, trigger]);

  return (
    <div className={className} ref={ref}>
      {children}
    </div>
  );
}

// ─── Magnetic ─────────────────────────────────────────────────────────
// Wrapper that pulls toward the cursor like a stage magnet.
export function Magnetic({
  children,
  className,
  strength = 0.32,
}: {
  children: React.ReactNode;
  className?: string;
  strength?: number;
}) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 160, damping: 14, mass: 0.2 });
  const sy = useSpring(y, { stiffness: 160, damping: 14, mass: 0.2 });

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (prefersReducedMotion()) {
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    x.set((e.clientX - (rect.left + rect.width / 2)) * strength);
    y.set((e.clientY - (rect.top + rect.height / 2)) * strength);
  };

  const onPointerLeave = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <motion.div
      className={cn("inline-block", className)}
      onPointerLeave={onPointerLeave}
      onPointerMove={onPointerMove}
      style={{ x: sx, y: sy }}
    >
      {children}
    </motion.div>
  );
}

// ─── TiltCard ─────────────────────────────────────────────────────────
// 3D hover tilt with a cursor-tracked glare sheen.
export function TiltCard({
  children,
  className,
  max = 7,
}: {
  children: React.ReactNode;
  className?: string;
  max?: number;
}) {
  const rx = useMotionValue(0);
  const ry = useMotionValue(0);
  const gx = useMotionValue(50);
  const gy = useMotionValue(50);
  const srx = useSpring(rx, { stiffness: 220, damping: 18 });
  const sry = useSpring(ry, { stiffness: 220, damping: 18 });
  const glare = useMotionTemplate`radial-gradient(440px circle at ${gx}% ${gy}%, rgb(255 255 255 / 0.07), transparent 60%)`;

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (prefersReducedMotion()) {
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    ry.set(px * max);
    rx.set(-py * max);
    gx.set(px * 100 + 50);
    gy.set(py * 100 + 50);
  };

  const onPointerLeave = () => {
    rx.set(0);
    ry.set(0);
  };

  return (
    <motion.div
      className={cn("relative", className)}
      onPointerLeave={onPointerLeave}
      onPointerMove={onPointerMove}
      style={{
        rotateX: srx,
        rotateY: sry,
        transformPerspective: 900,
        transformStyle: "preserve-3d",
      }}
    >
      {children}
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-[inherit]"
        style={{ background: glare }}
      />
    </motion.div>
  );
}

// ─── Marquee ──────────────────────────────────────────────────────────
// Infinite band whose speed surges with scroll velocity.
export function Marquee({
  children,
  className,
  duration = 28,
  reverse = false,
}: {
  children: React.ReactNode;
  className?: string;
  duration?: number;
  reverse?: boolean;
}) {
  const innerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const inner = innerRef.current;
    if (!inner || prefersReducedMotion()) {
      return;
    }
    const from = reverse ? -50 : 0;
    const to = reverse ? 0 : -50;
    const tween = gsap.fromTo(
      inner,
      { xPercent: from },
      { xPercent: to, duration, ease: "none", repeat: -1 }
    );

    let boost = 0;
    const trigger = ScrollTrigger.create({
      onUpdate: (self) => {
        boost = Math.min(Math.abs(self.getVelocity()) / 900, 4);
      },
    });
    const tick = () => {
      boost *= 0.94;
      tween.timeScale(1 + boost);
    };
    gsap.ticker.add(tick);

    return () => {
      gsap.ticker.remove(tick);
      trigger.kill();
      tween.kill();
    };
  }, [duration, reverse]);

  return (
    <div className={cn("overflow-hidden", className)}>
      <div className="flex w-max" ref={innerRef}>
        <div className="flex shrink-0 items-center">{children}</div>
        <div aria-hidden="true" className="flex shrink-0 items-center">
          {children}
        </div>
      </div>
    </div>
  );
}

// ─── Counter ──────────────────────────────────────────────────────────
export function Counter({
  to,
  from = 0,
  prefix = "",
  suffix = "",
  duration = 1.6,
  className,
}: {
  to: number;
  from?: number;
  prefix?: string;
  suffix?: string;
  duration?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) {
      return;
    }
    const render = (v: number) => {
      el.textContent = `${prefix}${Math.round(v).toLocaleString()}${suffix}`;
    };
    if (prefersReducedMotion()) {
      render(to);
      return;
    }
    render(from);
    const proxy = { value: from };
    const tween = gsap.to(proxy, {
      value: to,
      duration,
      ease: "power2.out",
      onUpdate: () => render(proxy.value),
      scrollTrigger: { trigger: el, start: "top 90%", once: true },
    });
    return () => {
      tween.scrollTrigger?.kill();
      tween.kill();
    };
  }, [to, from, prefix, suffix, duration]);

  return <span className={className} ref={ref} />;
}
