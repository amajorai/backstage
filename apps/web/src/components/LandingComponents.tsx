"use client";

import { PolarEmbedCheckout } from "@polar-sh/checkout/embed";
import { Button } from "@repo/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/dialog";
import { Input } from "@repo/ui/input";
import { ArrowRight, GalleryThumbnails, Loader2 } from "lucide-react";
import { motion } from "motion/react";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import * as sounds from "@/lib/sounds";
import { cn } from "@/lib/utils";
import "@/styles/landing.css";

const BLUE = "var(--foreground)";
const CHECKOUT_URL =
  process.env.NEXT_PUBLIC_POLAR_CHECKOUT_URL ??
  "https://sandbox-api.polar.sh/v1/checkout-links/polar_cl_aGUui9yb3Gb4ebQMX2FFj13h4kBHGKrVW29fM0Nqp2m/redirect";
const GITHUB_URL = "https://github.com/amajorai/backstage";
const TRAILING_ZERO_RE = /\.0$/;

// ─── GitHub data hook ────────────────────────────────────────────────
function formatStars(n: number): string {
  if (n >= 1000) {
    return `${(n / 1000).toFixed(1).replace(TRAILING_ZERO_RE, "")}k`;
  }
  return String(n);
}

function useGitHubData() {
  const [stars, setStars] = useState<string>("—");

  useEffect(() => {
    fetch("https://api.github.com/repos/amajorai/backstage")
      .then((r) => r.json())
      .then((d) => {
        if (typeof d.stargazers_count === "number") {
          setStars(formatStars(d.stargazers_count));
        }
      })
      .catch(() => {
        // ignore fetch errors
      });
  }, []);

  return { stars };
}

// ─── Scroll reveal hook ──────────────────────────────────────────────
function useScrollReveal() {
  useEffect(() => {
    const reveals = document.querySelectorAll(".reveal");

    const inViewport = (el: Element) => {
      const r = el.getBoundingClientRect();
      return (
        r.top < (window.innerHeight || document.documentElement.clientHeight) &&
        r.bottom > 0
      );
    };

    for (const el of reveals) {
      if (inViewport(el)) {
        el.classList.add("is-in");
      }
    }

    if (!("IntersectionObserver" in window)) {
      for (const el of reveals) {
        el.classList.add("is-in");
      }
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add("is-in");
            io.unobserve(e.target);
          }
        }
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.05 }
    );

    for (const el of reveals) {
      if (!el.classList.contains("is-in")) {
        io.observe(el);
      }
    }

    const timer = setTimeout(() => {
      for (const el of document.querySelectorAll(".reveal:not(.is-in)")) {
        if (inViewport(el)) {
          el.classList.add("is-in");
        }
      }
    }, 600);

    return () => {
      io.disconnect();
      clearTimeout(timer);
    };
  }, []);
}

// ─── Shared UI ────────────────────────────────────────────────────────
function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-4 inline-flex items-center gap-2 font-medium text-[11px] text-muted-foreground uppercase tracking-[0.12em]">
      {children}
    </div>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-muted/60 px-2.5 py-1 font-medium text-[11px] text-muted-foreground">
      {children}
    </div>
  );
}

// ─── Nav ─────────────────────────────────────────────────────────────
function Nav({ stars }: { stars: string }) {
  const [scrolled, setScrolled] = useState(false);
  const [showDownload, setShowDownload] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const navLinks = [
    ["#compare", "Compare"],
    ["#pricing", "Pricing"],
    ["#faq", "FAQ"],
  ] as const;

  const githubIcon = (
    <svg
      aria-hidden="true"
      fill="currentColor"
      height="14"
      viewBox="0 0 24 24"
      width="14"
    >
      <path d="M12 .5A12 12 0 0 0 0 12.5a12 12 0 0 0 8.2 11.4c.6.1.8-.3.8-.6v-2.1c-3.3.7-4-1.6-4-1.6-.6-1.4-1.4-1.8-1.4-1.8-1.1-.8.1-.8.1-.8 1.3.1 1.9 1.3 1.9 1.3 1.1 1.9 2.9 1.4 3.7 1 .1-.8.4-1.4.7-1.7-2.7-.3-5.5-1.3-5.5-6 0-1.3.5-2.4 1.2-3.2-.1-.3-.5-1.5.1-3.2 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0c2.3-1.5 3.3-1.2 3.3-1.2.7 1.7.2 2.9.1 3.2.8.8 1.2 1.9 1.2 3.2 0 4.7-2.8 5.7-5.5 6 .4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A12 12 0 0 0 24 12.5 12 12 0 0 0 12 .5Z" />
    </svg>
  );

  return (
    <>
      {/* Desktop top nav */}
      <nav className="fixed top-0 right-0 left-0 z-50 hidden justify-center py-3.5 md:flex">
        <div
          className={cn(
            "flex items-center gap-3",
            scrolled
              ? "h-11 w-full max-w-[780px] rounded-full bg-background/80 px-4 [backdrop-filter:blur(20px)_saturate(140%)]"
              : "h-12 w-full max-w-[1200px] bg-transparent px-6"
          )}
          style={{
            transition:
              "max-width 300ms cubic-bezier(0.22, 1, 0.36, 1), height 300ms cubic-bezier(0.22, 1, 0.36, 1), padding 300ms cubic-bezier(0.22, 1, 0.36, 1), background-color 300ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 300ms cubic-bezier(0.22, 1, 0.36, 1), border-radius 300ms cubic-bezier(0.22, 1, 0.36, 1)",
            willChange: "max-width, height",
          }}
        >
          <a
            className="flex items-center gap-2 font-medium text-foreground text-sm no-underline"
            href="/"
          >
            <GalleryThumbnails
              aria-hidden="true"
              className="fill-foreground text-foreground"
              size={18}
              strokeWidth={3}
            />
            Backstage
          </a>
          <div className="ml-1 flex items-center gap-0.5">
            {navLinks.map(([href, label]) => (
              <a
                className="rounded-full px-3 py-1.5 text-muted-foreground text-sm no-underline transition-colors hover:text-foreground"
                href={href}
                key={href}
                onClick={sounds.click}
              >
                {label}
              </a>
            ))}
          </div>
          <div className="flex-1" />
          <a
            className="flex items-center gap-1.5 text-muted-foreground text-sm no-underline transition-colors hover:text-foreground"
            href={GITHUB_URL}
            onClick={sounds.click}
            rel="noopener"
            target="_blank"
          >
            {githubIcon}
            <span>{stars}</span>
          </a>
          <Button
            onClick={() => {
              sounds.download();
              setShowDownload(true);
            }}
            variant="contrast"
          >
            Download
          </Button>
        </div>
      </nav>

      <DownloadEmailDialog onOpenChange={setShowDownload} open={showDownload} />

      {/* Mobile bottom bar */}
      <nav
        className="fixed right-0 bottom-0 left-0 z-50 md:hidden"
        style={{
          background:
            "linear-gradient(to top, color-mix(in oklch, var(--background) 92%, transparent) 0%, color-mix(in oklch, var(--background) 60%, transparent) 70%, transparent 100%)",
          backdropFilter: "blur(16px) saturate(140%)",
          WebkitBackdropFilter: "blur(16px) saturate(140%)",
        }}
      >
        <div className="flex items-center justify-around px-2 pt-3 pb-5 pb-safe">
          <a
            className="flex flex-col items-center gap-1 text-muted-foreground no-underline transition-colors hover:text-foreground"
            href="#compare"
            onClick={sounds.click}
          >
            <span className="font-medium text-[10px] tracking-wide">
              Compare
            </span>
          </a>
          <a
            className="flex flex-col items-center gap-1 text-muted-foreground no-underline transition-colors hover:text-foreground"
            href="#faq"
            onClick={sounds.click}
          >
            <span className="font-medium text-[10px] tracking-wide">FAQ</span>
          </a>
          <a
            className="flex items-center gap-1.5 font-semibold text-foreground text-sm no-underline"
            href="/"
            onClick={sounds.click}
          >
            <GalleryThumbnails
              aria-hidden="true"
              className="fill-foreground text-foreground"
              size={20}
              strokeWidth={3}
            />
            <span>Backstage</span>
          </a>
          <a
            className="flex flex-col items-center gap-1 text-muted-foreground no-underline transition-colors hover:text-foreground"
            href="#pricing"
            onClick={sounds.click}
          >
            <span className="font-medium text-[10px] tracking-wide">
              Pricing
            </span>
          </a>
          <a
            className="flex flex-col items-center gap-1 text-muted-foreground no-underline transition-colors hover:text-foreground"
            href={GITHUB_URL}
            onClick={sounds.click}
            rel="noopener"
            target="_blank"
          >
            {githubIcon}
            <span className="font-medium text-[10px] tracking-wide">
              {stars}
            </span>
          </a>
        </div>
      </nav>
    </>
  );
}

// ─── Draggable Emoji ──────────────────────────────────────────────────
function DraggableEmoji({
  emoji,
  style,
}: {
  emoji: string;
  style: React.CSSProperties;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const stateRef = useRef({
    dragging: false,
    startX: 0,
    startY: 0,
    baseX: 0,
    baseY: 0,
  });

  const getOffset = useCallback(() => {
    const el = ref.current;
    if (!el) {
      return [0, 0];
    }
    return [
      Number.parseFloat(el.style.getPropertyValue("--user-tx")) || 0,
      Number.parseFloat(el.style.getPropertyValue("--user-ty")) || 0,
    ];
  }, []);

  const onDown = useCallback(
    (e: React.PointerEvent) => {
      const s = stateRef.current;
      s.dragging = true;
      ref.current?.classList.add("is-dragging");
      ref.current?.setPointerCapture(e.pointerId);
      s.startX = e.clientX;
      s.startY = e.clientY;
      [s.baseX, s.baseY] = getOffset();
      e.preventDefault();
    },
    [getOffset]
  );

  const onMove = useCallback((e: React.PointerEvent) => {
    const s = stateRef.current;
    if (!s.dragging) {
      return;
    }
    const el = ref.current;
    if (!el) {
      return;
    }
    el.style.setProperty("--user-tx", `${s.baseX + e.clientX - s.startX}px`);
    el.style.setProperty("--user-ty", `${s.baseY + e.clientY - s.startY}px`);
  }, []);

  const onUp = useCallback((e: React.PointerEvent) => {
    const s = stateRef.current;
    if (!s.dragging) {
      return;
    }
    s.dragging = false;
    ref.current?.classList.remove("is-dragging");
    try {
      ref.current?.releasePointerCapture(e.pointerId);
    } catch {
      // pointer capture not supported in all environments
    }
  }, []);

  return (
    <span
      className="emoji-draggable"
      onPointerCancel={onUp}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      ref={ref}
      style={style}
    >
      <span className="emoji-inner">{emoji}</span>
    </span>
  );
}

// ─── Animated success check ───────────────────────────────────────────
function SuccessCheck() {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const id = requestAnimationFrame(() => {
      el.dataset.state = "in";
    });
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <span
      aria-hidden="true"
      className="t-success-check"
      data-state="out"
      ref={ref}
    >
      <svg fill="none" height="48" viewBox="0 0 24 24" width="48">
        <circle cx="12" cy="12" fill="rgb(16 185 129 / 0.15)" r="12" />
        <path
          d="M 5 12 L 10 17 L 19 8"
          stroke="#34d399"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.5"
        />
      </svg>
    </span>
  );
}

// ─── Download email dialog ────────────────────────────────────────────
function DownloadEmailDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [submitState, setSubmitState] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const didMountRef = useRef(false);
  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }
    if (open) sounds.dialogOpen();
    else sounds.dialogClose();
  }, [open]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!(name.trim() && email.trim())) return;
      sounds.click();
      setSubmitState("loading");
      try {
        const res = await fetch("/api/send-download", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: name.trim(), email: email.trim() }),
        });
        if (res.ok) {
          setSubmitState("success");
          sounds.success();
        } else {
          const data = await res.json().catch(() => ({}));
          setErrorMsg(
            (data as { error?: string }).error ?? "Something went wrong"
          );
          setSubmitState("error");
          sounds.error();
        }
      } catch {
        setErrorMsg("Something went wrong. Try again.");
        setSubmitState("error");
        sounds.error();
      }
    },
    [name, email]
  );

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-w-sm">
        {submitState === "success" ? (
          <div className="flex flex-col items-center gap-4 py-4 text-center">
            <SuccessCheck />
            <div>
              <p className="font-medium text-foreground">Check your inbox</p>
              <p className="mt-1 text-muted-foreground text-sm">
                We sent your download link to {email}
              </p>
            </div>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="text-foreground">
                Get the download link
              </DialogTitle>
              <DialogDescription className="text-muted-foreground">
                Let us know where to send you the link.
              </DialogDescription>
            </DialogHeader>
            <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
              <Input
                autoFocus
                className="h-14 text-lg"
                disabled={submitState === "loading"}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                type="text"
                value={name}
              />
              <Input
                className="h-14 text-lg"
                disabled={submitState === "loading"}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                type="email"
                value={email}
              />
              {submitState === "error" && (
                <p className="text-destructive text-sm">{errorMsg}</p>
              )}
              <Button
                className="h-14 w-full text-lg"
                disabled={
                  !(name.trim() && email.trim()) || submitState === "loading"
                }
                size="lg"
                type="submit"
                variant="contrast"
              >
                {submitState === "loading" ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    Send
                    <ArrowRight className="ml-2 size-4" />
                  </>
                )}
              </Button>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Gradient Bars background ─────────────────────────────────────────
function GradientBars({
  bars = 20,
  colors = [BLUE, "transparent"],
}: {
  bars?: number;
  colors?: string[];
}) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 flex items-end overflow-hidden"
    >
      {Array.from({ length: bars }).map((_, i) => (
        <motion.div
          animate={{ scaleY: [0.2, 1, 0.2] }}
          key={i}
          style={{
            background: `linear-gradient(to top, ${colors[0]}, ${colors[1] ?? "transparent"})`,
            flex: 1,
            height: "70%",
            transformOrigin: "bottom",
          }}
          transition={{
            delay: (i / bars) * 2.6,
            duration: 2.5 + (i % 7) * 0.35,
            ease: "easeInOut",
            repeat: Number.POSITIVE_INFINITY,
          }}
        />
      ))}
    </div>
  );
}

// ─── Hero ─────────────────────────────────────────────────────────────
function Hero() {
  const [showDownload, setShowDownload] = useState(false);

  const emojis = [
    {
      emoji: "🎬",
      style: { top: "18%", left: "8%", "--r": "-8deg", "--delay": "0s" },
    },
    {
      emoji: "✨",
      style: { top: "12%", right: "10%", "--r": "12deg", "--delay": "1.2s" },
    },
    {
      emoji: "🎥",
      style: { top: "62%", left: "5%", "--r": "-14deg", "--delay": "2.4s" },
    },
    {
      emoji: "🖼️",
      style: { top: "70%", right: "7%", "--r": "8deg", "--delay": "3.6s" },
    },
    {
      emoji: "🔥",
      style: { top: "36%", left: "14%", "--r": "6deg", "--delay": "4.2s" },
    },
    {
      emoji: "🚀",
      style: { top: "50%", right: "14%", "--r": "-10deg", "--delay": "0.8s" },
    },
  ];

  return (
    <section className="relative flex min-h-svh flex-col justify-center overflow-hidden pt-36 pb-20 md:pt-44 md:pb-28">
      <GradientBars bars={24} colors={["#e60a64", "transparent"]} />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        {emojis.map((e) => (
          <DraggableEmoji
            emoji={e.emoji}
            key={e.emoji}
            style={e.style as React.CSSProperties}
          />
        ))}
      </div>
      <div className="relative z-10 mx-auto flex max-w-[1200px] flex-col items-center px-6 text-center">
        <h1
          className="reveal mb-5 max-w-[860px] text-balance font-heading font-medium text-4xl text-foreground leading-none tracking-tight md:text-6xl"
          data-delay="1"
        >
          Anyone can make great thumbnails that click in seconds
        </h1>
        <p
          className="reveal mb-8 max-w-[480px] text-lg text-muted-foreground md:text-xl"
          data-delay="2"
        >
          The 🥇 pro level thumbnail studio built for small creators. No Canva
          or Photoshop subscriptions.
        </p>
        <div
          className="reveal mb-6 flex flex-col items-center gap-3"
          data-delay="3"
        >
          <div className="flex flex-wrap justify-center gap-3">
            <Button
              onClick={() => {
                sounds.download();
                setShowDownload(true);
              }}
              variant="outline"
            >
              Download for free
            </Button>
            <div className="flex flex-col items-start gap-1">
              <Button
                nativeButton={false}
                onClick={sounds.click}
                render={
                  <a
                    data-polar-checkout
                    data-polar-checkout-theme="dark"
                    href={CHECKOUT_URL}
                  />
                }
                variant="contrast"
              >
                Lifetime Access $29
              </Button>
              <p className="text-muted-foreground text-xs">
                🔥 Limited deal until May 25
              </p>
            </div>
          </div>
        </div>
        <DownloadEmailDialog
          onOpenChange={setShowDownload}
          open={showDownload}
        />
        <div className="reveal w-full max-w-[900px]" data-delay="5">
          <div
            className="overflow-hidden rounded-2xl"
            style={{
              boxShadow:
                "0 0 0 1px oklch(1 0 0 / 0.05), 0 32px 80px oklch(0 0 0 / 0.6)",
            }}
          >
            <Image
              alt="Backstage editor with a layered thumbnail open"
              height={620}
              src="/landing/screenshot-editor.png"
              style={{ width: "100%", height: "auto", display: "block" }}
              width={1100}
            />
          </div>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-4 text-muted-foreground text-sm">
            <span>Available on</span>
            <span className="flex items-center gap-1.5">
              <svg
                aria-hidden="true"
                fill="currentColor"
                height="13"
                viewBox="0 0 24 24"
                width="13"
              >
                <path d="M0 0h11.377v11.372H0zm12.623 0H24v11.372H12.623zM0 12.623h11.377V24H0zm12.623 0H24V24H12.623z" />
              </svg>
              Windows
            </span>
            <span className="flex items-center gap-1.5">
              <svg
                aria-hidden="true"
                fill="currentColor"
                height="13"
                viewBox="0 0 24 24"
                width="13"
              >
                <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.054 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701" />
              </svg>
              macOS
            </span>
            <span className="flex items-center gap-1.5">
              <svg
                aria-hidden="true"
                fill="currentColor"
                height="13"
                viewBox="0 0 24 24"
                width="13"
              >
                <path d="M12.504 0c-.155 0-.315.008-.48.021-4.226.333-3.105 4.807-3.17 6.298-.076 1.092-.3 1.953-1.05 3.02-.885 1.051-2.127 2.75-2.716 4.521-.278.832-.41 1.684-.287 2.489a.424.424 0 00-.11.135c-.26.268-.45.6-.663.839-.199.199-.485.267-.797.4-.313.136-.658.269-.864.68-.09.189-.136.394-.132.602 0 .199.027.4.055.536.058.399.116.728.04.97-.249.68-.28 1.145-.106 1.484.174.334.535.47.94.601.81.2 1.91.135 2.774.6.926.466 1.866.67 2.616.47.526-.116.97-.464 1.208-.946.587-.003 1.23-.269 2.26-.334.699-.058 1.574.267 2.577.2.025.134.063.198.114.333l.003.003c.391.778 1.113 1.132 1.884 1.071.771-.06 1.592-.536 2.257-1.306.631-.765 1.683-1.084 2.378-1.503.348-.199.629-.469.649-.853.023-.4-.2-.811-.714-1.376v-.097l-.003-.003c-.17-.2-.25-.535-.338-.926-.085-.401-.182-.786-.492-1.046h-.003c-.059-.054-.123-.067-.188-.135a.357.357 0 00-.19-.064c.431-1.278.264-2.55-.173-3.694-.533-1.41-1.465-2.638-2.175-3.483-.796-1.005-1.576-1.957-1.56-3.368.026-2.152.236-6.133-3.544-6.139zm.529 3.405h.013c.213 0 .396.062.584.198.19.135.33.332.438.533.105.259.158.459.166.724 0-.02.006-.04.006-.06v.105a.086.086 0 01-.004-.021l-.004-.024a1.807 1.807 0 01-.15.706.953.953 0 01-.213.335.71.71 0 00-.088-.042c-.104-.045-.198-.064-.284-.133a1.312 1.312 0 00-.22-.066c.05-.06.146-.133.183-.198.053-.128.082-.264.088-.402v-.02a1.21 1.21 0 00-.061-.4c-.045-.134-.101-.2-.183-.333-.084-.066-.167-.132-.267-.132h-.016c-.093 0-.176.03-.262.132a.8.8 0 00-.205.334 1.18 1.18 0 00-.09.4v.019c.002.089.008.179.02.267-.193-.067-.438-.135-.607-.202a1.635 1.635 0 01-.018-.2v-.02a1.772 1.772 0 01.15-.768c.082-.22.232-.406.43-.533a.985.985 0 01.594-.2zm-2.962.059h.036c.142 0 .27.048.399.135.146.129.264.288.344.465.09.199.14.4.153.667v.004c.007.134.006.2-.002.266v.08c-.03.007-.056.018-.083.024-.152.055-.274.135-.393.2.012-.09.013-.18.003-.267v-.015c-.012-.133-.04-.2-.082-.333a.613.613 0 00-.166-.267.248.248 0 00-.183-.064h-.021c-.071.006-.13.04-.186.132a.552.552 0 00-.12.27.944.944 0 00-.023.33v.015c.012.135.037.2.08.334.046.134.098.2.166.268.01.009.02.018.034.024-.07.057-.117.07-.176.136a.304.304 0 01-.131.068 2.62 2.62 0 01-.275-.402 1.772 1.772 0 01-.155-.667 1.759 1.759 0 01.08-.668 1.43 1.43 0 01.283-.535c.128-.133.26-.2.418-.2zm1.37 1.706c.332 0 .733.065 1.216.399.293.2.523.269 1.052.468h.003c.255.136.405.266.478.399v-.131a.571.571 0 01.016.47c-.123.31-.516.643-1.063.842v.002c-.268.135-.501.333-.775.465-.276.135-.588.292-1.012.267a1.139 1.139 0 01-.448-.067 3.566 3.566 0 01-.322-.198c-.195-.135-.363-.332-.612-.465v-.005h-.005c-.4-.246-.616-.512-.686-.71-.07-.268-.005-.47.193-.6.224-.135.38-.271.483-.336.104-.074.143-.102.176-.131h.002v-.003c.169-.202.436-.47.839-.601.139-.036.294-.065.466-.065zm2.8 2.142c.358 1.417 1.196 3.475 1.735 4.473.286.534.855 1.659 1.102 3.024.156-.005.33.018.513.064.646-1.671-.546-3.467-1.089-3.966-.22-.2-.232-.335-.123-.335.59.534 1.365 1.572 1.646 2.757.13.535.16 1.104.021 1.67.067.028.135.06.205.067 1.032.534 1.413.938 1.23 1.537v-.043c-.06-.003-.12 0-.18 0h-.016c.151-.467-.182-.825-1.065-1.224-.915-.4-1.646-.336-1.77.465-.008.043-.013.066-.018.135-.068.023-.139.053-.209.064-.43.268-.662.669-.793 1.187-.13.533-.17 1.156-.205 1.869v.003c-.02.334-.17.838-.319 1.35-1.5 1.072-3.58 1.538-5.348.334a2.645 2.645 0 00-.402-.533 1.45 1.45 0 00-.275-.333c.182 0 .338-.03.465-.067a.615.615 0 00.314-.334c.108-.267 0-.697-.345-1.163-.345-.467-.931-.995-1.788-1.521-.63-.4-.986-.87-1.15-1.396-.165-.534-.143-1.085-.015-1.645.245-1.07.873-2.11 1.274-2.763.107-.065.037.135-.408.974-.396.751-1.14 2.497-.122 3.854a8.123 8.123 0 01.647-2.876c.564-1.278 1.743-3.504 1.836-5.268.048.036.217.135.289.202.218.133.38.333.59.465.21.201.477.335.876.335.039.003.075.006.11.006.412 0 .73-.134.997-.268.29-.134.52-.334.74-.4h.005c.467-.135.835-.402 1.044-.7zm2.185 8.958c.037.6.343 1.245.882 1.377.588.134 1.434-.333 1.791-.765l.211-.01c.315-.007.577.01.847.268l.003.003c.208.199.305.53.391.876.085.4.154.78.409 1.066.486.527.645.906.636 1.14l.003-.007v.018l-.003-.012c-.015.262-.185.396-.498.595-.63.401-1.746.712-2.457 1.57-.618.737-1.37 1.14-2.036 1.191-.664.053-1.237-.2-1.574-.898l-.005-.003c-.21-.4-.12-1.025.056-1.69.176-.668.428-1.344.463-1.897.037-.714.076-1.335.195-1.814.12-.465.308-.797.641-.984l.045-.022zm-10.814.049h.01c.053 0 .105.005.157.014.376.055.706.333 1.023.752l.91 1.664.003.003c.243.533.754 1.064 1.189 1.637.434.598.77 1.131.729 1.57v.006c-.057.744-.48 1.148-1.125 1.294-.645.135-1.52.002-2.395-.464-.968-.536-2.118-.469-2.857-.602-.369-.066-.61-.2-.723-.4-.11-.2-.113-.602.123-1.23v-.004l.002-.003c.117-.334.03-.752-.027-1.118-.055-.401-.083-.71.043-.94.16-.334.396-.4.69-.533.294-.135.64-.202.915-.47h.002v-.002c.256-.268.445-.601.668-.838.19-.201.38-.336.663-.336zm7.159-9.074c-.435.201-.945.535-1.488.535-.542 0-.97-.267-1.28-.466-.154-.134-.28-.268-.373-.335-.164-.134-.144-.333-.074-.333.109.016.129.134.199.2.096.066.215.2.36.333.292.2.68.467 1.167.467.485 0 1.053-.267 1.398-.466.195-.135.445-.334.648-.467.156-.136.149-.267.279-.267.128.016.034.134-.147.332a8.097 8.097 0 01-.69.468zm-1.082-1.583V5.64c-.006-.02.013-.042.029-.05.074-.043.18-.027.26.004.063 0 .16.067.15.135-.006.049-.085.066-.135.066-.055 0-.092-.043-.141-.068-.052-.018-.146-.008-.163-.065zm-.551 0c-.02.058-.113.049-.166.066-.047.025-.086.068-.14.068-.05 0-.13-.02-.136-.068-.01-.066.088-.133.15-.133.08-.031.184-.047.259-.005.019.009.036.03.03.05v.02h.003z" />
              </svg>
              Linux
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Stats ────────────────────────────────────────────────────────────
function Stats() {
  return (
    <section className="py-8" id="social-strip">
      <div className="mx-auto max-w-[1200px] px-6">
        <div className="reveal grid grid-cols-2 overflow-hidden rounded-2xl md:grid-cols-4">
          {(
            [
              { num: "100%", label: "Runs on your machine", blue: true },
              { num: "$29", label: "One-time. Forever.", blue: false },
              { num: "$0", label: "Monthly retainer", blue: false },
              { num: "7", label: "Export formats", blue: false },
            ] satisfies { num: string; label: string; blue: boolean }[]
          ).map((s) => (
            <div
              className="flex flex-col items-center bg-card/40 px-4 py-6"
              key={s.label}
            >
              <div
                className={cn(
                  "mb-1 font-bold text-3xl",
                  !s.blue && "text-foreground"
                )}
                style={s.blue ? { color: BLUE } : undefined}
              >
                {s.num}
              </div>
              <div className="text-center text-muted-foreground text-xs">
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Compare Slider ───────────────────────────────────────────────────
function CompareSlider() {
  const trackRef = useRef<HTMLDivElement>(null);
  const beforeClipRef = useRef<HTMLDivElement>(null);
  const dividerRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<HTMLButtonElement>(null);
  const dragging = useRef(false);

  const setPosition = useCallback((pct: number) => {
    const clamped = Math.max(0, Math.min(100, pct));
    if (beforeClipRef.current) {
      beforeClipRef.current.style.clipPath = `inset(0 ${100 - clamped}% 0 0)`;
    }
    if (dividerRef.current) {
      dividerRef.current.style.left = `${clamped}%`;
    }
    if (handleRef.current) {
      handleRef.current.style.left = `${clamped}%`;
    }
  }, []);

  useEffect(() => {
    setPosition(50);
  }, [setPosition]);

  const update = useCallback(
    (clientX: number) => {
      const r = trackRef.current?.getBoundingClientRect();
      if (!r) {
        return;
      }
      setPosition(((clientX - r.left) / r.width) * 100);
    },
    [setPosition]
  );

  const onHandleDown = useCallback((e: React.PointerEvent) => {
    dragging.current = true;
    handleRef.current?.classList.add("is-dragging");
    try {
      handleRef.current?.setPointerCapture(e.pointerId);
    } catch {
      // pointer capture not supported in all environments
    }
    e.preventDefault();
  }, []);

  const onHandleMove = useCallback(
    (e: React.PointerEvent) => {
      if (dragging.current) {
        update(e.clientX);
      }
    },
    [update]
  );

  const onHandleUp = useCallback((e: React.PointerEvent) => {
    if (!dragging.current) {
      return;
    }
    dragging.current = false;
    handleRef.current?.classList.remove("is-dragging");
    try {
      handleRef.current?.releasePointerCapture(e.pointerId);
    } catch {
      // pointer capture not supported in all environments
    }
  }, []);

  const onTrackDown = useCallback(
    (e: React.PointerEvent) => {
      if (
        e.target === handleRef.current ||
        handleRef.current?.contains(e.target as Node)
      ) {
        return;
      }
      update(e.clientX);
      dragging.current = true;
      handleRef.current?.classList.add("is-dragging");
    },
    [update]
  );

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (dragging.current) {
        update(e.clientX);
      }
    };
    const onUp = () => {
      dragging.current = false;
      handleRef.current?.classList.remove("is-dragging");
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [update]);

  const IMG =
    "https://images.unsplash.com/photo-1573497019418-b400bb3ab074?w=1400&q=85&auto=format&fit=crop";

  return (
    <div className="mx-auto w-full max-w-[800px] overflow-hidden rounded-xl">
      <div
        className="relative aspect-video cursor-crosshair select-none overflow-hidden"
        onPointerDown={onTrackDown}
        ref={trackRef}
      >
        <div
          className="absolute inset-0"
          style={{
            background:
              "repeating-conic-gradient(#2a2a2a 0% 25%, #333 0% 50%) 0 0 / 16px 16px",
          }}
        />
        {/* biome-ignore lint/performance/noImgElement lint/correctness/useImageSize: external Unsplash URL */}
        <img
          alt="Subject with background removed"
          className="absolute inset-0 h-full w-full object-cover"
          draggable={false}
          src={IMG}
        />
        <div className="absolute inset-0" ref={beforeClipRef}>
          {/* biome-ignore lint/performance/noImgElement lint/correctness/useImageSize: external Unsplash URL */}
          <img
            alt="Before background removal"
            className="absolute inset-0 h-full w-full object-cover"
            draggable={false}
            src={IMG}
          />
        </div>
        <div className="pointer-events-none absolute top-3 left-4 rounded bg-card/70 px-2 py-1 font-semibold text-foreground text-xs">
          Before
        </div>
        <div className="pointer-events-none absolute top-3 right-4 rounded bg-card/70 px-2 py-1 font-semibold text-foreground text-xs">
          After
        </div>
        <div
          className="pointer-events-none absolute top-0 bottom-0 w-px"
          ref={dividerRef}
          style={{
            background: "white",
            boxShadow: "0 0 8px oklch(0 0 0 / 0.5)",
          }}
        />
        <button
          aria-label="Drag to compare"
          className="compare-handle"
          onPointerCancel={onHandleUp}
          onPointerDown={onHandleDown}
          onPointerMove={onHandleMove}
          onPointerUp={onHandleUp}
          ref={handleRef}
          type="button"
        >
          <svg
            fill="none"
            height="16"
            stroke="white"
            strokeWidth="2"
            viewBox="0 0 24 24"
            width="16"
          >
            <path d="M18 8l4 4-4 4M6 8l-4 4 4 4" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// ─── Gemini Panel ─────────────────────────────────────────────────────
const PHOTO_SETS = [
  [
    "photo-1593359677879-a4bb92f829d1",
    "photo-1611162617474-5b21e879e113",
    "photo-1606761568499-6d2451b23c66",
    "photo-1517694712202-14dd9538aa97",
  ],
  [
    "photo-1485846234645-a62644f84728",
    "photo-1517604931442-7e0c8ed2963c",
    "photo-1478720568477-152d9b164e26",
    "photo-1517604931442-7e0c8ed2963c",
  ],
  [
    "photo-1517694712202-14dd9538aa97",
    "photo-1496181133206-80ce9b88a853",
    "photo-1454165804606-c3d57bc86b40",
    "photo-1531403009284-440f080d1e12",
  ],
  [
    "photo-1494790108377-be9c29b29330",
    "photo-1517841905240-472988babdf9",
    "photo-1539571696357-5a69c17a67c6",
    "photo-1573497019418-b400bb3ab074",
  ],
];

function GeminiPanel() {
  const [setIdx, setSetIdx] = useState(0);
  const [activeTile, setActiveTile] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [shimmer, setShimmer] = useState(false);
  const [meta, setMeta] = useState("4 imgs · ~$0.16");
  const [prompt, setPrompt] = useState(
    "A retro CRT television glowing on a dark workshop bench, dramatic rim light, 16:9"
  );

  const generate = useCallback(() => {
    if (generating) {
      return;
    }
    setGenerating(true);
    setShimmer(true);
    setMeta("Running gemini-2.5-flash-image...");
    setTimeout(() => {
      setSetIdx((i) => (i + 1) % PHOTO_SETS.length);
      setShimmer(false);
      setActiveTile(0);
      setGenerating(false);
      setMeta("4 imgs · ~$0.16");
    }, 1300);
  }, [generating]);

  const photos = PHOTO_SETS[setIdx];

  return (
    <div className="grid gap-0 overflow-hidden rounded-2xl bg-card md:grid-cols-2">
      <div className="flex flex-col gap-3 p-5">
        <div className="font-medium text-[11px] text-muted-foreground uppercase tracking-widest">
          Prompt
        </div>
        <textarea
          className="h-24 w-full resize-none rounded-lg border border bg-muted px-3 py-2.5 text-foreground text-sm outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-border"
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              generate();
            }
          }}
          placeholder="Describe the image you want to generate..."
          spellCheck={false}
          value={prompt}
        />
        <div className="flex gap-2">
          <select
            className="flex-1 rounded-lg border bg-muted px-3 py-2 text-muted-foreground text-xs outline-none"
            disabled
          >
            <option>gemini-2.5-flash-image</option>
          </select>
          <select
            className="rounded-lg border bg-muted px-3 py-2 text-muted-foreground text-xs outline-none"
            disabled
          >
            <option>4 images</option>
          </select>
        </div>
        <div className="mt-auto flex items-center gap-2">
          <span className="flex-1 text-muted-foreground text-xs">{meta}</span>
          <button
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 font-semibold text-background text-xs transition-all hover:opacity-90",
              generating && "cursor-not-allowed opacity-70"
            )}
            onClick={() => {
              sounds.click();
              generate();
            }}
            style={{ background: BLUE }}
            type="button"
          >
            <svg
              fill="none"
              height="13"
              stroke="currentColor"
              strokeWidth="2.5"
              viewBox="0 0 24 24"
              width="13"
            >
              <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3z" />
            </svg>
            {generating ? "Generating…" : "Generate"}
          </button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 p-5">
        {photos.map((id, i) => (
          <button
            className={cn(
              "relative aspect-square cursor-pointer overflow-hidden rounded-lg border bg-muted transition-all",
              activeTile === i
                ? "border-2"
                : "border hover:border-foreground/40",
              shimmer && "tile-shimmer"
            )}
            key={id}
            onClick={() => {
              sounds.click();
              setActiveTile(i);
            }}
            style={activeTile === i ? { borderColor: BLUE } : undefined}
            type="button"
          >
            {/* biome-ignore lint/performance/noImgElement lint/correctness/useImageSize: external Unsplash URL */}
            <img
              alt=""
              className="h-full w-full object-cover"
              loading="lazy"
              src={`https://images.unsplash.com/${id}?w=600&q=80&auto=format&fit=crop`}
            />
            <span
              className={cn(
                "absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full border",
                activeTile === i ? "border-transparent" : "border bg-card/80"
              )}
              style={activeTile === i ? { background: BLUE } : undefined}
            >
              {activeTile === i && (
                <svg
                  fill="none"
                  height="11"
                  stroke="currentColor"
                  strokeWidth="3"
                  viewBox="0 0 24 24"
                  width="11"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </span>
            <span className="absolute bottom-1 left-1.5 font-medium text-[10px] text-muted-foreground">
              v{i + 1}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Export Dialog ────────────────────────────────────────────────────
function ExportDialog() {
  const [activeFormat, setActiveFormat] = useState("png");
  const [quality, setQuality] = useState(90);
  const sliderRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const isAnimated = activeFormat === "gif" || activeFormat === "mp4";

  const updateQuality = useCallback((clientX: number) => {
    const r = sliderRef.current?.getBoundingClientRect();
    if (!r) {
      return;
    }
    const pct = Math.max(
      10,
      Math.min(100, ((clientX - r.left) / r.width) * 100)
    );
    setQuality(Math.round(pct));
  }, []);

  const formats: ({ key: string; label: string } | null)[] = [
    { key: "png", label: "PNG" },
    { key: "jpeg", label: "JPEG" },
    { key: "webp", label: "WebP" },
    null,
    { key: "gif", label: "GIF" },
    { key: "mp4", label: "MP4" },
  ];

  return (
    <div className="flex items-center justify-center py-6">
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-card shadow-2xl">
        <div className="flex items-center justify-between px-5 py-3.5">
          <h4 className="font-heading font-medium text-foreground text-sm">
            Export Image
          </h4>
          <button
            aria-label="Close"
            className="text-muted-foreground transition-colors hover:text-foreground"
            onClick={sounds.click}
            type="button"
          >
            <svg
              fill="none"
              height="16"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
              width="16"
            >
              <line x1="18" x2="6" y1="6" y2="18" />
              <line x1="6" x2="18" y1="6" y2="18" />
            </svg>
          </button>
        </div>
        <div className="flex flex-col gap-4 p-5">
          <div className="overflow-hidden rounded-lg bg-muted">
            <Image
              alt=""
              height={170}
              src="/landing/screenshot-editor.png"
              style={{ width: "100%", height: "auto", display: "block" }}
              width={460}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="font-medium text-muted-foreground text-xs">
              Format
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {formats.map((f, i) =>
                f === null ? (
                  // biome-ignore lint/suspicious/noArrayIndexKey: static list
                  <div className="h-5 w-px bg-border" key={`div-${i}`} />
                ) : (
                  <button
                    className={cn(
                      "rounded-lg border px-3 py-1.5 font-medium text-xs transition-all",
                      activeFormat === f.key
                        ? "border-transparent text-background"
                        : "border bg-transparent text-muted-foreground hover:border-foreground/40"
                    )}
                    key={f.key}
                    onClick={() => {
                      sounds.click();
                      setActiveFormat(f.key);
                    }}
                    style={
                      activeFormat === f.key ? { background: BLUE } : undefined
                    }
                    type="button"
                  >
                    {f.label}
                  </button>
                )
              )}
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="font-medium text-muted-foreground text-xs">
              Resolution
            </div>
            <div className="flex items-center justify-between rounded-lg border bg-muted px-3 py-2 text-foreground/80 text-sm">
              <span>1920 × 1080 (1080p)</span>
              <svg
                fill="none"
                height="14"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
                width="14"
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </div>
          </div>
          {!isAnimated && (
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between font-medium text-muted-foreground text-xs">
                <span>Quality</span>
                <span style={{ color: BLUE }}>{quality}%</span>
              </div>
              <div
                className="relative flex h-8 cursor-pointer items-center"
                onPointerDown={(e) => {
                  dragging.current = true;
                  updateQuality(e.clientX);
                  try {
                    sliderRef.current?.setPointerCapture(e.pointerId);
                  } catch {
                    // pointer capture not supported in all environments
                  }
                }}
                onPointerMove={(e) => {
                  if (dragging.current) {
                    updateQuality(e.clientX);
                  }
                }}
                onPointerUp={(e) => {
                  dragging.current = false;
                  try {
                    sliderRef.current?.releasePointerCapture(e.pointerId);
                  } catch {
                    // pointer capture not supported in all environments
                  }
                }}
                ref={sliderRef}
              >
                <div className="relative h-1 w-full overflow-hidden rounded-full bg-border">
                  <div
                    className="absolute inset-y-0 left-0 rounded-full"
                    style={{ width: `${quality}%`, background: BLUE }}
                  />
                </div>
                <button
                  aria-label="Quality"
                  className="export-thumb"
                  style={{ left: `${quality}%` }}
                  type="button"
                />
              </div>
            </div>
          )}
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-3.5">
          <button
            className="rounded-lg px-4 py-2 text-muted-foreground text-sm transition-colors hover:text-foreground"
            onClick={sounds.click}
            type="button"
          >
            Cancel
          </button>
          <button
            className="rounded-lg px-4 py-2 font-semibold text-background text-sm transition-all hover:opacity-90"
            onClick={sounds.click}
            style={{ background: BLUE }}
            type="button"
          >
            Export
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Video Scrubber ───────────────────────────────────────────────────
function VideoScrubber() {
  const timelineRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<HTMLButtonElement>(null);
  const dragging = useRef(false);

  const update = useCallback((clientX: number) => {
    const r = timelineRef.current?.getBoundingClientRect();
    if (!(r && handleRef.current)) {
      return;
    }
    const pct = Math.max(
      0,
      Math.min(100, ((clientX - r.left) / r.width) * 100)
    );
    handleRef.current.style.left = `${pct}%`;
  }, []);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (dragging.current) {
        update(e.clientX);
      }
    };
    const onUp = () => {
      dragging.current = false;
      handleRef.current?.classList.remove("is-dragging");
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [update]);

  return (
    <div className="w-full overflow-hidden rounded-xl bg-card">
      <div className="relative aspect-video">
        {/* biome-ignore lint/performance/noImgElement lint/correctness/useImageSize: external Unsplash URL */}
        <img
          alt=""
          className="h-full w-full object-cover"
          src="https://images.unsplash.com/photo-1485846234645-a62644f84728?w=900&q=80&auto=format&fit=crop"
        />
        <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-background/60 to-transparent p-3">
          <div className="flex items-center justify-between">
            <div className="inline-flex items-center gap-1.5 rounded bg-background/70 px-2 py-1 font-semibold text-[11px] text-foreground">
              <span
                className="h-1.5 w-1.5 rounded-full bg-red-500"
                style={{ boxShadow: "0 0 6px oklch(0.628 0.258 29.234)" }}
              />
              CAPTURED
            </div>
            <div className="rounded bg-background/70 px-2 py-1 text-[11px] text-foreground/80">
              00:02:14:08 · 3840×2160
            </div>
          </div>
        </div>
      </div>
      <div
        className="relative h-10 cursor-pointer bg-muted"
        onPointerDown={(e) => {
          if (e.target === handleRef.current) {
            return;
          }
          update(e.clientX);
          dragging.current = true;
          handleRef.current?.classList.add("is-dragging");
        }}
        ref={timelineRef}
      >
        <div className="absolute inset-0 grid grid-cols-10">
          {Array.from({ length: 10 }).map((_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static frames
            <div className="border border-r bg-muted last:border-r-0" key={i} />
          ))}
        </div>
        <button
          aria-label="Scrub timeline"
          className="scrub-handle"
          onPointerCancel={() => {
            dragging.current = false;
            handleRef.current?.classList.remove("is-dragging");
          }}
          onPointerDown={(e) => {
            dragging.current = true;
            handleRef.current?.classList.add("is-dragging");
            try {
              handleRef.current?.setPointerCapture(e.pointerId);
            } catch {
              // pointer capture not supported in all environments
            }
            e.preventDefault();
          }}
          onPointerMove={(e) => {
            if (dragging.current) {
              update(e.clientX);
            }
          }}
          onPointerUp={() => {
            dragging.current = false;
            handleRef.current?.classList.remove("is-dragging");
          }}
          ref={handleRef}
          type="button"
        />
      </div>
    </div>
  );
}

// ─── Layers Mock ──────────────────────────────────────────────────────
function LayersMock() {
  const [selectedRow, setSelectedRow] = useState("title");
  const [hiddenRows, setHiddenRows] = useState<Set<string>>(new Set());

  const toggleHidden = (id: string) => {
    setHiddenRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const layers = [
    {
      id: "title",
      thumb: { bg: "#2563eb22", color: "#2563eb", text: "T" },
      name: "Title text",
    },
    {
      id: "watch",
      thumb: { bg: "linear-gradient(135deg, white, #ddd)" },
      name: "Watch button",
    },
    {
      id: "headshot",
      thumb: {
        bg: "url('https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=80&q=70&auto=format&fit=crop') center/cover",
      },
      name: "Headshot",
    },
    {
      id: "glow",
      thumb: { bg: "radial-gradient(circle, #2563eb, transparent)" },
      name: "Glow",
    },
    {
      id: "bg",
      thumb: { bg: "linear-gradient(135deg, #475569, #1e293b)" },
      name: "Background",
    },
  ];

  const EyeOn = () => (
    <svg
      fill="none"
      height="12"
      stroke="currentColor"
      strokeWidth="2"
      viewBox="0 0 24 24"
      width="12"
    >
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );

  const EyeOff = () => (
    <svg
      fill="none"
      height="12"
      stroke="currentColor"
      strokeWidth="2"
      viewBox="0 0 24 24"
      width="12"
    >
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" x2="23" y1="1" y2="23" />
    </svg>
  );

  const LayerToolbar = () => (
    <div className="flex items-center gap-1 border-t px-3 py-2">
      {[
        {
          label: "Add layer",
          icon: (
            <svg
              fill="none"
              height="14"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
              width="14"
            >
              <line x1="12" x2="12" y1="5" y2="19" />
              <line x1="5" x2="19" y1="12" y2="12" />
            </svg>
          ),
        },
        {
          label: "Duplicate",
          icon: (
            <svg
              fill="none"
              height="14"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
              width="14"
            >
              <rect height="13" rx="2" width="13" x="9" y="9" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
          ),
        },
        {
          label: "Delete",
          icon: (
            <svg
              fill="none"
              height="14"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
              width="14"
            >
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6" />
            </svg>
          ),
        },
        {
          label: "Group",
          icon: (
            <svg
              fill="none"
              height="14"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
              width="14"
            >
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
              <line x1="12" x2="12" y1="11" y2="17" />
              <line x1="9" x2="15" y1="14" y2="14" />
            </svg>
          ),
        },
      ].map(({ label, icon }) => (
        <button
          aria-label={label}
          className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground transition-colors hover:text-foreground"
          key={label}
          onClick={sounds.click}
          type="button"
        >
          {icon}
        </button>
      ))}
      <button
        aria-label="AI rename"
        className="ml-auto flex h-7 w-7 items-center justify-center rounded transition-colors"
        onClick={sounds.click}
        style={{ color: BLUE }}
        type="button"
      >
        <svg
          fill="none"
          height="14"
          stroke="currentColor"
          strokeWidth="2"
          viewBox="0 0 24 24"
          width="14"
        >
          <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3z" />
        </svg>
      </button>
    </div>
  );

  return (
    <div className="w-full overflow-hidden rounded-xl bg-card">
      {layers.map((layer) => (
        <div
          className={cn(
            "flex cursor-pointer items-center gap-2 px-3 py-2 transition-colors",
            selectedRow === layer.id ? "bg-muted" : "hover:bg-muted/50",
            hiddenRows.has(layer.id) && "opacity-40"
          )}
          key={layer.id}
          onClick={() => {
            sounds.click();
            setSelectedRow(layer.id);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              sounds.click();
              setSelectedRow(layer.id);
            }
          }}
          role="button"
          tabIndex={0}
        >
          <button
            aria-label="Toggle visibility"
            className="flex h-5 w-5 flex-shrink-0 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
            onClick={(e) => {
              e.stopPropagation();
              sounds.click();
              toggleHidden(layer.id);
            }}
            type="button"
          >
            {hiddenRows.has(layer.id) ? <EyeOff /> : <EyeOn />}
          </button>
          <button
            aria-label="Lock"
            className="flex h-5 w-5 flex-shrink-0 items-center justify-center text-muted-foreground/60 transition-colors hover:text-muted-foreground"
            onClick={(e) => {
              e.stopPropagation();
              sounds.click();
            }}
            type="button"
          >
            <svg
              fill="none"
              height="12"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
              width="12"
            >
              <rect height="11" rx="2" width="18" x="3" y="11" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </button>
          <div
            className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded font-bold text-[11px]"
            style={{ background: layer.thumb.bg, color: layer.thumb.color }}
          >
            {layer.thumb.text}
          </div>
          <span className="truncate text-foreground/80 text-sm">
            {layer.name}
          </span>
        </div>
      ))}
      <LayerToolbar />
    </div>
  );
}

// ─── Bento ────────────────────────────────────────────────────────────
function Bento() {
  const galleryPhotos = [
    "photo-1593359677879-a4bb92f829d1",
    "photo-1494790108377-be9c29b29330",
    "photo-1485846234645-a62644f84728",
    "photo-1611162617474-5b21e879e113",
    "photo-1606761568499-6d2451b23c66",
    "photo-1517694712202-14dd9538aa97",
    "photo-1573497019418-b400bb3ab074",
    "photo-1517841905240-472988babdf9",
    "photo-1539571696357-5a69c17a67c6",
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="reveal flex flex-col gap-6 rounded-2xl bg-card p-6 md:col-span-2 md:flex-row">
        <div className="flex flex-shrink-0 flex-col gap-3 md:w-64">
          <Tag>
            <svg
              fill="none"
              height="12"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2.5"
              viewBox="0 0 24 24"
              width="12"
            >
              <polygon points="23 7 16 12 23 17 23 7" />
              <rect height="14" rx="2" ry="2" width="15" x="1" y="5" />
            </svg>
            Source material
          </Tag>
          <h3 className="font-heading font-medium text-foreground text-lg">
            Your designer pulls the perfect frame.
          </h3>
          <p className="text-muted-foreground text-sm">
            Drop in any MP4 or MOV. Scrub with arrow keys. Extract at source
            resolution with no screenshot workarounds.
          </p>
        </div>
        <div className="min-w-0 flex-1">
          <VideoScrubber />
        </div>
      </div>

      <div
        className="reveal flex flex-col gap-4 rounded-2xl bg-card p-6"
        data-delay="1"
      >
        <div className="flex flex-col gap-3">
          <Tag>
            <svg
              fill="none"
              height="12"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2.5"
              viewBox="0 0 24 24"
              width="12"
            >
              <path d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z" />
              <path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65" />
              <path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65" />
            </svg>
            Pro level editing
          </Tag>
          <h3 className="font-heading font-medium text-foreground text-lg">
            Pro level editing. Real layers, real control.
          </h3>
          <p className="text-muted-foreground text-sm">
            Toggle, lock, group, drag to reorder. A good designer doesn't cut
            corners. Neither does Backstage.
          </p>
        </div>
        <LayersMock />
      </div>

      <div
        className="reveal flex flex-col gap-4 rounded-2xl bg-card p-6"
        data-delay="2"
      >
        <div className="flex flex-col gap-3">
          <Tag>
            <svg
              fill="none"
              height="12"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2.5"
              viewBox="0 0 24 24"
              width="12"
            >
              <rect height="7" rx="1" width="7" x="3" y="3" />
              <rect height="7" rx="1" width="7" x="14" y="3" />
              <rect height="7" rx="1" width="7" x="3" y="14" />
              <rect height="7" rx="1" width="7" x="14" y="14" />
            </svg>
            Gallery
          </Tag>
          <h3 className="font-heading font-medium text-foreground text-lg">
            Your designer's studio. Every project in one place.
          </h3>
          <p className="text-muted-foreground text-sm">
            Search, sort, bulk export, 30-day trash. Built for creators who
            publish consistently.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-1.5 overflow-hidden rounded-lg">
          {galleryPhotos.map((id) => (
            // biome-ignore lint/performance/noImgElement lint/correctness/useImageSize: external Unsplash URL
            <img
              alt=""
              className="aspect-video w-full object-cover"
              key={id}
              src={`https://images.unsplash.com/${id}?w=300&q=70&auto=format&fit=crop`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── BYO Gemini Key ───────────────────────────────────────────────────
function ByoGemini() {
  const CheckIcon = () => (
    <svg
      fill="none"
      height="16"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2.5"
      viewBox="0 0 24 24"
      width="16"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );

  return (
    <section className="py-20 md:py-28" id="byok">
      <div className="mx-auto max-w-[1200px] px-6">
        <div className="reveal grid items-center gap-12 md:grid-cols-2">
          <div>
            <Eyebrow>Bring your own key</Eyebrow>
            <h2 className="mt-1 mb-4 font-heading font-medium text-3xl text-foreground tracking-tight md:text-4xl">
              Your designer's AI budget:
              <br />
              about $2 a month.
            </h2>
            <p className="mb-5 text-muted-foreground">
              Other tools bundle AI into a fat monthly fee and ration your
              usage. Your Backstage designer uses Google Gemini. Paste your free
              key once and pay Google directly at API rates. Most creators spend
              under <strong className="text-foreground">$2 a month</strong> even
              when generating dozens of variants per video.
            </p>
            <ul className="mb-6 flex flex-col gap-3">
              {[
                "Get a free key from aistudio.google.com in 30 seconds",
                "Key is stored encrypted in your OS keychain. Never leaves your machine.",
                "Swap to a different Gemini model anytime. You control the cost knob.",
                "No rate limits from us. No quota from us. We're not in the loop.",
              ].map((item) => (
                <li
                  className="flex items-start gap-2.5 text-foreground/80 text-sm"
                  key={item}
                >
                  <span
                    className="mt-0.5 flex-shrink-0"
                    style={{ color: BLUE }}
                  >
                    <CheckIcon />
                  </span>
                  {item}
                </li>
              ))}
            </ul>
            <div className="rounded-xl bg-card p-4 text-muted-foreground text-sm">
              <strong className="text-foreground">Real math:</strong> Generating
              30 thumbnail variations a month on Gemini 2.5 Flash Image costs
              about <strong className="text-foreground">$1.20</strong>. After 2
              months, Backstage&apos;s lifetime price plus your Gemini spend is
              still less than one month of Canva Pro.
            </div>
          </div>
          <div className="overflow-hidden rounded-2xl bg-card">
            <div className="px-4 py-3 font-semibold text-muted-foreground text-xs">
              Settings · AI
            </div>
            <div className="flex flex-col gap-3 p-4">
              <div className="flex flex-col gap-1.5">
                <div className="text-muted-foreground text-xs">
                  Google AI Studio API key
                </div>
                <div className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2">
                  <svg
                    className="text-muted-foreground"
                    fill="none"
                    height="12"
                    stroke="currentColor"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                    width="12"
                  >
                    <circle cx="12" cy="16" r="1" />
                    <rect height="11" rx="2" ry="2" width="18" x="3" y="11" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                  <span className="font-mono text-muted-foreground text-xs">
                    AIza••••••••••••••••••••••••••8gQ
                  </span>
                  <span
                    className="ml-auto rounded px-1.5 py-0.5 font-semibold text-[11px]"
                    style={{
                      color: BLUE,
                      background:
                        "color-mix(in oklch, var(--foreground) 12%, transparent)",
                    }}
                  >
                    saved
                  </span>
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <div className="text-muted-foreground text-xs">Model</div>
                <div className="flex items-center rounded-lg bg-muted px-3 py-2">
                  <span className="text-[13px] text-foreground">
                    gemini-2.5-flash-image
                  </span>
                  <span className="ml-auto text-muted-foreground">▾</span>
                </div>
              </div>
              <div className="flex flex-col gap-2 rounded-xl bg-muted p-3">
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground uppercase tracking-[0.08em]">
                  <svg
                    fill="none"
                    height="11"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    style={{ stroke: BLUE }}
                    viewBox="0 0 24 24"
                    width="11"
                  >
                    <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3z" />
                  </svg>
                  Generate
                </div>
                <p className="text-muted-foreground text-xs">
                  Cinematic shot of a retro CRT TV on a dark workshop bench,
                  glowing magenta from inside, 16:9.
                </p>
                <button
                  className="self-end rounded-full px-3 py-1.5 font-semibold text-background text-xs"
                  onClick={sounds.click}
                  style={{ background: BLUE }}
                  type="button"
                >
                  Generate · 4 imgs
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Privacy ──────────────────────────────────────────────────────────
function Privacy() {
  const cards = [
    {
      title: "Your designer never phones home",
      body: "Background removal runs in WebAssembly on-device. Video frame extraction never leaves your disk. Your unfinished thumbnails don't exist on anybody else's hard drive.",
      icon: (
        <svg
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
      title: "Your designer's files are yours",
      body: "Projects live on your filesystem as plain folders. Move them, sync them in Dropbox, version-control them in git. No proprietary cloud lock-in.",
      icon: (
        <svg
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
      body: "Your Gemini API key is stored using the native OS secure store: macOS Keychain, Windows Credential Manager, libsecret on Linux. Never plaintext on disk. Never seen by us.",
      icon: (
        <svg
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

  return (
    <section className="py-20 md:py-28" id="privacy">
      <div className="mx-auto max-w-[1200px] px-6">
        <div className="reveal mb-12">
          <Eyebrow>Local-first by default</Eyebrow>
          <h2 className="mt-1 mb-3 font-heading font-medium text-3xl text-foreground tracking-tight md:text-5xl">
            Your designer works only for you.
          </h2>
          <p className="max-w-[540px] text-base text-muted-foreground md:text-lg">
            Backstage is a native desktop app, not a web wrapper with your files
            on someone else&apos;s server. Your projects, your source files,
            your API keys. Your designer is loyal.
          </p>
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          {cards.map((c, i) => (
            <div
              className="reveal flex flex-col gap-4 rounded-2xl bg-card p-6"
              data-delay={i.toString()}
              key={c.title}
            >
              <div
                className="flex h-10 w-10 items-center justify-center rounded-xl"
                style={{
                  background:
                    "color-mix(in oklch, var(--foreground) 12%, transparent)",
                  color: BLUE,
                }}
              >
                {c.icon}
              </div>
              <h3 className="font-heading font-medium text-base text-foreground">
                {c.title}
              </h3>
              <p className="text-muted-foreground text-sm">{c.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Comparison Table ─────────────────────────────────────────────────
type CellData =
  | string
  | {
      yes?: boolean;
      no?: boolean;
      maybe?: boolean;
      blue?: boolean;
      text: string;
    };

function CellContent({ cell }: { cell: CellData }) {
  if (typeof cell === "string") {
    return <>{cell}</>;
  }
  if (cell.blue) {
    return <strong style={{ color: BLUE }}>{cell.text}</strong>;
  }
  if (cell.yes) {
    return (
      <>
        <span style={{ color: BLUE }}>●</span> {cell.text}
      </>
    );
  }
  if (cell.no) {
    return (
      <>
        <span className="text-muted-foreground/60">○</span> {cell.text}
      </>
    );
  }
  if (cell.maybe) {
    return (
      <>
        <span className="text-muted-foreground">◐</span> {cell.text}
      </>
    );
  }
  return <>{cell.text}</>;
}

function CompareTable() {
  const rows: { label: string; us: CellData; rest: CellData[] }[] = [
    {
      label: "Yearly cost",
      us: { blue: true, text: "$29 once" },
      rest: ["$262", "$120", "$144"],
    },
    {
      label: "Designed for YouTube thumbnails",
      us: { yes: true, text: "Yes, sole purpose" },
      rest: [
        { no: true, text: "General editor" },
        { maybe: true, text: "Template-based" },
        { no: true, text: "UI / design tool" },
      ],
    },
    {
      label: "Offline AI background removal",
      us: { yes: true, text: "WebAssembly" },
      rest: [
        { maybe: true, text: "Cloud feature" },
        { no: true, text: "Cloud only" },
        { no: true, text: "Plugin needed" },
      ],
    },
    {
      label: "AI image generation",
      us: { yes: true, text: "Your Gemini key" },
      rest: [
        { maybe: true, text: "Firefly (paid credits)" },
        { maybe: true, text: "Limited monthly" },
        { no: true, text: "Plugin needed" },
      ],
    },
    {
      label: "Video frame extraction",
      us: { yes: true, text: "Built-in scrubber" },
      rest: [
        { no: true, text: "Manual via PR" },
        { no: true, text: "No" },
        { no: true, text: "No" },
      ],
    },
    {
      label: "Works offline",
      us: { yes: true, text: "Yes" },
      rest: [
        { yes: true, text: "Yes" },
        { no: true, text: "No" },
        { no: true, text: "No" },
      ],
    },
    {
      label: "Source code open",
      us: { yes: true, text: "AGPL-3.0 on GitHub" },
      rest: [
        { no: true, text: "Proprietary" },
        { no: true, text: "Proprietary" },
        { no: true, text: "Proprietary" },
      ],
    },
    {
      label: "Stops working if you cancel",
      us: { yes: true, text: "Never. Yours forever." },
      rest: [
        { no: true, text: "Yes" },
        { no: true, text: "Yes" },
        { no: true, text: "Yes" },
      ],
    },
  ];

  return (
    <section className="py-20 md:py-28" id="compare">
      <div className="mx-auto max-w-[1200px] px-6">
        <div className="reveal mb-10">
          <Eyebrow>The honest comparison</Eyebrow>
          <h2 className="mt-1 mb-3 font-heading font-medium text-3xl text-foreground tracking-tight md:text-5xl">
            Your designer vs. the alternatives.
            <br />
            <span className="text-muted-foreground">
              It&apos;s not a close race.
            </span>
          </h2>
          <p className="max-w-[540px] text-base text-muted-foreground md:text-lg">
            What small creators are actually choosing between.
          </p>
        </div>
        <div className="reveal overflow-hidden rounded-2xl">
          <div
            className="grid font-semibold text-xs"
            style={{ gridTemplateColumns: "1.4fr 1fr 1fr 1fr 1fr" }}
          >
            <div className="px-5 py-3.5 text-muted-foreground" />
            <div
              className="px-5 py-3.5"
              style={{
                background:
                  "color-mix(in oklch, var(--foreground) 8%, transparent)",
                color: BLUE,
              }}
            >
              Backstage
            </div>
            {["Photoshop", "Canva Pro", "Figma"].map((b) => (
              <div className="px-5 py-3.5 text-muted-foreground" key={b}>
                {b}
              </div>
            ))}
          </div>
          {rows.map((row) => (
            <div
              className="grid border-border/50 border-b text-sm last:border-b-0"
              key={row.label}
              style={{ gridTemplateColumns: "1.4fr 1fr 1fr 1fr 1fr" }}
            >
              <div className="px-5 py-3.5 text-muted-foreground">
                {row.label}
              </div>
              <div
                className="px-5 py-3.5 font-medium text-foreground"
                style={{
                  background:
                    "color-mix(in oklch, var(--foreground) 5%, transparent)",
                }}
              >
                <CellContent cell={row.us} />
              </div>
              {row.rest.map((cell, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: stable order
                <div className="px-5 py-3.5 text-muted-foreground" key={i}>
                  <CellContent cell={cell} />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── OSS Callout ─────────────────────────────────────────────────────
function OssCallout() {
  const SmallCheck = () => (
    <svg
      fill="none"
      height="12"
      stroke="currentColor"
      strokeWidth="2.5"
      style={{ color: BLUE, flexShrink: 0 }}
      viewBox="0 0 24 24"
      width="12"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );

  const lines = [
    { label: "Source:", value: "github.com/amajorai/backstage" },
    { label: "License:", value: "AGPL-3.0 (BRIA model is non-commercial)" },
    { label: "Stack:", value: "Tauri, Rust, React, TypeScript" },
    { label: "Issues:", value: "# public, triaged weekly" },
    {
      label: "PRs welcome.",
      value: "// every feature on this page started as code",
    },
  ];

  return (
    <section className="py-20 md:py-28">
      <div className="mx-auto max-w-[1200px] px-6">
        <div className="reveal rounded-2xl bg-card p-8 md:p-12">
          <div className="grid items-center gap-10 md:grid-cols-2">
            <div>
              <Eyebrow>Open source</Eyebrow>
              <h2 className="mt-1 mb-4 font-heading font-medium text-2xl text-foreground tracking-tight md:text-3xl">
                Your designer's source code is public. Audit it yourself.
              </h2>
              <p className="mb-6 text-muted-foreground">
                Every line of Backstage is on GitHub: the desktop app, the pro
                level editing engine, and the AI integrations. The lifetime deal
                is for the prebuilt, signed, auto-updating binaries we ship and
                support. If you&apos;d rather compile it yourself, that&apos;s
                free.
              </p>
              <div className="flex flex-wrap gap-3">
                <a
                  className="inline-flex items-center gap-2 rounded-full bg-muted px-5 py-2.5 font-semibold text-foreground text-sm no-underline transition-colors hover:bg-muted/80"
                  href={GITHUB_URL}
                  onClick={sounds.click}
                  rel="noopener"
                  target="_blank"
                >
                  <svg
                    fill="currentColor"
                    height="16"
                    viewBox="0 0 24 24"
                    width="16"
                  >
                    <path d="M12 .5A12 12 0 0 0 0 12.5a12 12 0 0 0 8.2 11.4c.6.1.8-.3.8-.6v-2.1c-3.3.7-4-1.6-4-1.6-.6-1.4-1.4-1.8-1.4-1.8-1.1-.8.1-.8.1-.8 1.3.1 1.9 1.3 1.9 1.3 1.1 1.9 2.9 1.4 3.7 1 .1-.8.4-1.4.7-1.7-2.7-.3-5.5-1.3-5.5-6 0-1.3.5-2.4 1.2-3.2-.1-.3-.5-1.5.1-3.2 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0c2.3-1.5 3.3-1.2 3.3-1.2.7 1.7.2 2.9.1 3.2.8.8 1.2 1.9 1.2 3.2 0 4.7-2.8 5.7-5.5 6 .4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A12 12 0 0 0 24 12.5 12 12 0 0 0 12 .5Z" />
                  </svg>
                  Star on GitHub
                </a>
                <a
                  className="inline-flex items-center gap-2 rounded-full bg-muted/60 px-5 py-2.5 font-semibold text-foreground text-sm no-underline transition-colors hover:bg-muted"
                  href={`${GITHUB_URL}#getting-started`}
                  onClick={sounds.click}
                  rel="noopener"
                  target="_blank"
                >
                  Read the build docs
                </a>
              </div>
            </div>
            <div className="flex flex-col gap-3 rounded-xl bg-background p-5 font-mono">
              {lines.map((l) => (
                <div className="flex items-start gap-2.5 text-sm" key={l.label}>
                  <SmallCheck />
                  <span className="text-muted-foreground">
                    <strong className="text-foreground/80">{l.label}</strong>{" "}
                    {l.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Pricing ──────────────────────────────────────────────────────────
function Pricing() {
  const CheckIcon = () => (
    <svg
      fill="none"
      height="16"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2.5"
      style={{ color: BLUE, flexShrink: 0 }}
      viewBox="0 0 24 24"
      width="16"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );

  return (
    <section className="bg-background py-20 md:py-28" id="pricing">
      <div className="mx-auto max-w-[1200px] px-6">
        <div className="reveal mb-10 text-center">
          <Eyebrow>Pricing</Eyebrow>
          <h2 className="mt-1 mb-3 font-heading font-medium text-3xl text-foreground tracking-tight md:text-5xl">
            One hire. Lifetime contract.
            <br />
            <span className="text-muted-foreground">
              No salary. No &ldquo;AI credits&rdquo;. No B.S.
            </span>
          </h2>
          <p className="mx-auto max-w-[540px] text-base text-muted-foreground md:text-lg">
            Early bird pricing that locks in your rate forever. Price increases
            every 100 customers. Next increase: May 25.
          </p>
        </div>
        <div className="reveal mx-auto max-w-3xl">
          <div className="overflow-hidden rounded-2xl bg-card">
            <div className="grid md:grid-cols-[1fr_280px]">
              <div className="flex flex-col gap-5 p-8">
                <div className="flex items-center gap-2">
                  <span
                    className="rounded-full px-2.5 py-1 font-bold text-[11px] text-background"
                    style={{ background: BLUE }}
                  >
                    EARLY BIRD
                  </span>
                  <span className="text-muted-foreground text-sm">
                    Price goes up every 100 users
                  </span>
                </div>
                <div>
                  <h3 className="mb-1 font-heading font-medium text-foreground text-xl">
                    Backstage Lifetime
                  </h3>
                  <p className="text-muted-foreground text-sm">
                    One payment. Every feature. Every update. Every platform.
                    Forever.
                  </p>
                </div>
                <ul className="flex flex-col gap-2.5">
                  {[
                    "Layer editor, AI tools, video extractor, carousel",
                    "Mac, Windows, and Linux signed binaries",
                    "All future updates (template library, A/B analyzer, more)",
                    "Priority email support, direct from the dev",
                    "Use on every device you own",
                  ].map((item) => (
                    <li
                      className="flex items-start gap-2.5 text-foreground/80 text-sm"
                      key={item}
                    >
                      <CheckIcon />
                      {item}
                    </li>
                  ))}
                </ul>
                <div className="mt-2 flex items-center gap-3">
                  <svg
                    fill="none"
                    height="14"
                    stroke="currentColor"
                    strokeWidth="2"
                    style={{ stroke: BLUE }}
                    viewBox="0 0 24 24"
                    width="14"
                  >
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 7v5l3 2" />
                  </svg>
                  <span className="text-muted-foreground text-sm">
                    Limited time deal, expires May 25
                  </span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full"
                      style={{ width: "38.4%", background: BLUE }}
                    />
                  </div>
                  <span className="whitespace-nowrap text-muted-foreground text-sm">
                    384/1000 sold
                  </span>
                </div>
              </div>
              <div className="flex flex-col gap-4 p-8">
                <div className="font-semibold text-muted-foreground text-xs uppercase tracking-widest">
                  One-time payment
                </div>
                <div className="flex items-end gap-2">
                  <span className="font-bold text-5xl text-foreground">
                    $29
                  </span>
                  <span className="mb-1 text-muted-foreground/60 text-xl line-through">
                    $59
                  </span>
                </div>
                <div className="text-muted-foreground text-xs">
                  USD · Tax included
                </div>
                <p className="text-muted-foreground text-xs">
                  Billed once via Polar. No auto-renewal. No card on file.
                </p>
                <div className="flex items-center gap-1.5 rounded-md bg-amber-500/10 px-2.5 py-2 text-amber-400 text-xs">
                  <svg
                    fill="none"
                    height="12"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                    width="12"
                  >
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                    <line x1="12" x2="12" y1="9" y2="13" />
                    <line x1="12" x2="12.01" y1="17" y2="17" />
                  </svg>
                  <span>Goes to $35 on May 25. Lock in $29 now.</span>
                </div>
                <Button
                  className="mt-1 w-full"
                  nativeButton={false}
                  onClick={sounds.click}
                  render={
                    <a
                      data-polar-checkout
                      data-polar-checkout-theme="dark"
                      href={CHECKOUT_URL}
                    />
                  }
                  variant="contrast"
                >
                  Buy Backstage Lifetime
                  <svg
                    fill="none"
                    height="16"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2.5"
                    viewBox="0 0 24 24"
                    width="16"
                  >
                    <line x1="5" x2="19" y1="12" y2="12" />
                    <polyline points="12 5 19 12 12 19" />
                  </svg>
                </Button>
                <p className="text-center text-[11px] text-muted-foreground">
                  Secure checkout via Polar. Instant license delivery.
                </p>
                <div className="mt-1 flex items-center justify-center gap-2 text-muted-foreground/60 text-xs">
                  <span>macOS</span>
                  <span>·</span>
                  <span>Windows</span>
                  <span>·</span>
                  <span>Linux</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── FAQ ──────────────────────────────────────────────────────────────
function FAQ() {
  const items = [
    {
      q: 'What does "lifetime" actually mean?',
      a: 'You hire Backstage once for $29 and it works for you forever, on every machine you own. No subscription, no expiry, no "AI credit" meter. Every future version is included. If we shut down tomorrow, your designer keeps running because it lives on your machine, not ours.',
      open: true,
    },
    {
      q: 'What\'s "bring your own Gemini key" and why?',
      a: "AI image generation needs compute. Other tools bundle that cost into a fat monthly fee, then ration your usage. Backstage uses Google's Gemini API and you bring your own free key from aistudio.google.com, so the cost is whatever you actually generate. Most creators spend under $2 a month on Gemini. Your key is stored locally and encrypted in your OS keychain.",
    },
    {
      q: "Do I have to use AI?",
      a: "No. The layer editor, video extractor, gallery, and export pipeline all work without any AI features turned on. Background removal runs locally in WebAssembly with no API key needed. Gemini is only used if you choose to generate or edit images with it.",
    },
    {
      q: "What if the app shuts down?",
      a: "Backstage is open source under the AGPL-3.0 license. The full source is on GitHub. Your installed copy keeps running indefinitely. If we ever stop maintaining it, you can build the latest version yourself, fork it, or hire anyone to keep it running.",
    },
    {
      q: "Can I use it on multiple machines?",
      a: "Yes. Your license activates on every device you personally use: work laptop, home desktop, the M-series Mac you just got. We don't count seats. We trust you to be reasonable.",
    },
    {
      q: "Refunds?",
      a: "30-day no-questions money back. Reply to the receipt email or DM us on X and we refund you within 24 hours. We'd rather have happy non-customers than grumpy ones.",
    },
    {
      q: "What about commercial use of the BRIA model?",
      a: "The default Backstage build uses a WebAssembly background-removal model under a permissive license that's fine for commercial use. The optional open-source build includes BRIA RMBG-1.4, which has a non-commercial license: it's there for hobbyists who want the sharper cutouts. For monetized YouTube channels, the default model is all you need.",
    },
    {
      q: "Why is it so cheap compared to hiring an actual designer?",
      a: "A freelance thumbnail designer charges $50–200 per thumbnail or $300–800/month on retainer. Backstage does the same job for $29 once. It doesn't pay for your AI compute, doesn't run a SaaS backend, and has no sales team or investors to repay. Built by a small team that wants the tool to exist at a fair price.",
    },
  ];

  return (
    <section className="py-20 md:py-28" id="faq">
      <div className="mx-auto max-w-[1200px] px-6">
        <div className="reveal mb-10 text-center">
          <Eyebrow>FAQ</Eyebrow>
          <h2 className="mt-1 font-heading font-medium text-3xl text-foreground tracking-tight md:text-5xl">
            The honest answers.
          </h2>
        </div>
        <div className="reveal mx-auto flex max-w-2xl flex-col gap-0">
          {items.map((item) => (
            <details className="last:pb-0" key={item.q} open={item.open}>
              <summary
                className="flex cursor-pointer select-none list-none items-center justify-between gap-4 py-5 font-semibold text-base text-foreground transition-colors hover:text-foreground/80"
                onClick={sounds.click}
              >
                {item.q}
                <span className="faq-icon flex-shrink-0 text-muted-foreground transition-transform duration-200">
                  <svg
                    fill="none"
                    height="14"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    viewBox="0 0 24 24"
                    width="14"
                  >
                    <line x1="12" x2="12" y1="5" y2="19" />
                    <line x1="5" x2="19" y1="12" y2="12" />
                  </svg>
                </span>
              </summary>
              <div className="pb-5 text-muted-foreground text-sm leading-relaxed">
                {item.a}
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── CTA Strip ────────────────────────────────────────────────────────
function CtaStrip() {
  return (
    <section className="py-20 md:py-28">
      <div className="mx-auto max-w-[1200px] px-6">
        <div className="reveal flex flex-col items-center gap-5 text-center">
          <Eyebrow>Last call</Eyebrow>
          <h2 className="max-w-[560px] font-heading font-medium text-3xl text-foreground tracking-tight md:text-5xl">
            Hire your designer tonight.
          </h2>
          <p className="text-base text-muted-foreground md:text-lg">
            Pay $29 once. No monthly salary, no creative briefs, no Slack DMs.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <div className="flex flex-col items-start gap-1">
              <Button
                nativeButton={false}
                onClick={sounds.click}
                render={
                  <a
                    data-polar-checkout
                    data-polar-checkout-theme="dark"
                    href={CHECKOUT_URL}
                  />
                }
                variant="contrast"
              >
                Lifetime Access $29
              </Button>
              <p className="text-muted-foreground text-xs">
                🔥 Limited deal until May 25
              </p>
            </div>
            <Button
              nativeButton={false}
              onClick={sounds.click}
              render={<a href={GITHUB_URL} rel="noopener" target="_blank" />}
              variant="outline"
            >
              View source on GitHub
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Footer ───────────────────────────────────────────────────────────
function Footer() {
  return (
    <footer className="py-16">
      <div className="mx-auto max-w-[1200px] px-6">
        <div className="mb-12 grid gap-10 md:grid-cols-4">
          <div>
            <div className="mb-3 flex items-center gap-2 font-medium text-foreground text-sm">
              <GalleryThumbnails
                aria-hidden="true"
                className="fill-foreground text-foreground"
                size={18}
                strokeWidth={2.5}
              />
              Backstage
            </div>
            <p className="text-muted-foreground text-sm">
              The thumbnail editor for small creators who want to look like
              bigger ones. Built by{" "}
              <a
                className="text-foreground/80 no-underline transition-colors hover:text-foreground"
                href="https://amajor.ai"
                onClick={sounds.click}
              >
                A Major
              </a>
              .
            </p>
          </div>
          <div>
            <div className="mb-4 font-semibold text-muted-foreground text-xs uppercase tracking-widest">
              Product
            </div>
            {(
              [
                ["#features", "Features"],
                ["#how", "How it works"],
                ["#pricing", "Pricing"],
                ["#roadmap", "Roadmap"],
              ] as const
            ).map(([href, label]) => (
              <a
                className="mb-2 block text-muted-foreground text-sm no-underline transition-colors hover:text-foreground"
                href={href}
                key={href}
                onClick={sounds.click}
              >
                {label}
              </a>
            ))}
          </div>
          <div>
            <div className="mb-4 font-semibold text-muted-foreground text-xs uppercase tracking-widest">
              Open source
            </div>
            {[
              [GITHUB_URL, "GitHub"],
              [`${GITHUB_URL}/releases`, "Releases"],
              [`${GITHUB_URL}/issues`, "Issues"],
              [`${GITHUB_URL}/blob/master/LICENSE`, "License"],
            ].map(([href, label]) => (
              <a
                className="mb-2 block text-muted-foreground text-sm no-underline transition-colors hover:text-foreground"
                href={href}
                key={href}
                onClick={sounds.click}
                rel="noopener"
                target="_blank"
              >
                {label}
              </a>
            ))}
          </div>
          <div>
            <div className="mb-4 font-semibold text-muted-foreground text-xs uppercase tracking-widest">
              Company
            </div>
            <a
              className="mb-2 block text-muted-foreground text-sm no-underline transition-colors hover:text-foreground"
              href="https://amajor.ai"
              onClick={sounds.click}
              rel="noopener"
              target="_blank"
            >
              A Major
            </a>
            <a
              className="mb-2 block text-muted-foreground text-sm no-underline transition-colors hover:text-foreground"
              href="mailto:hello@amajor.ai"
              onClick={sounds.click}
            >
              Contact
            </a>
            <a
              className="mb-2 block text-muted-foreground text-sm no-underline transition-colors hover:text-foreground"
              href="https://twitter.com/amajor_ai"
              onClick={sounds.click}
              rel="noopener"
              target="_blank"
            >
              X / Twitter
            </a>
            <a
              className="mb-2 block text-muted-foreground text-sm no-underline transition-colors hover:text-foreground"
              href="#faq"
              onClick={sounds.click}
            >
              FAQ
            </a>
          </div>
        </div>
        <div className="flex items-center justify-between pt-6 text-muted-foreground/60 text-xs">
          <div>© 2026 A Major. All rights reserved.</div>
          <div>backstage.amajor.ai</div>
        </div>
      </div>
    </footer>
  );
}

// ─── Landing Page Root ────────────────────────────────────────────────
export default function LandingPage() {
  useScrollReveal();
  const { stars } = useGitHubData();

  useEffect(() => {
    PolarEmbedCheckout.init();
  }, []);

  return (
    <div className="dark min-h-screen overflow-x-hidden bg-background pb-20 font-sans text-foreground md:pb-0">
      <Nav stars={stars} />
      <Hero />
      <Stats />

      <ByoGemini />
      <Privacy />
      <CompareTable />
      <OssCallout />
      <Pricing />
      <FAQ />
      <CtaStrip />
      <Footer />
    </div>
  );
}
