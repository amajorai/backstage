"use client";

import { PolarEmbedCheckout } from "@polar-sh/checkout/embed";
import { Button } from "@repo/ui/button";
import { Input } from "@repo/ui/input";
import { Check, GalleryThumbnails, Loader2, X } from "lucide-react";
import { motion } from "motion/react";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import "@/styles/landing.css";

const BLUE = "oklch(0.685 0.169 237.323)";
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
    <div className="mb-4 inline-flex items-center gap-2 font-medium text-[11px] text-zinc-400 uppercase tracking-[0.12em]">
      <span
        className="h-1.5 w-1.5 flex-shrink-0 rounded-full"
        style={{ background: BLUE, boxShadow: `0 0 8px ${BLUE}` }}
      />
      {children}
    </div>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-zinc-800/60 px-2.5 py-1 font-medium text-[11px] text-zinc-400">
      {children}
    </div>
  );
}

// ─── Nav ─────────────────────────────────────────────────────────────
function Nav({ stars }: { stars: string }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const navLinks = [
    ["#features", "Features"],
    ["#how", "How it works"],
    ["#compare", "Compare"],
    ["#pricing", "Pricing"],
    ["#faq", "FAQ"],
  ] as const;

  return (
    <nav className="fixed top-0 right-0 left-0 z-50 flex justify-center py-3.5">
      <div
        className={cn(
          "flex items-center gap-3 transition-all duration-300",
          scrolled
            ? "h-11 rounded-full bg-zinc-950/80 px-4 shadow-[0_4px_24px_oklch(0_0_0/0.4)] [backdrop-filter:blur(20px)_saturate(140%)]"
            : "h-12 w-full max-w-[1200px] bg-transparent px-6"
        )}
      >
        <a
          className="flex items-center gap-2 font-semibold text-sm text-white no-underline"
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
        <div className="ml-1 hidden items-center gap-0.5 md:flex">
          {navLinks.map(([href, label]) => (
            <a
              className="rounded-full px-3 py-1.5 text-sm text-zinc-400 no-underline transition-colors hover:text-white"
              href={href}
              key={href}
            >
              {label}
            </a>
          ))}
        </div>
        <div className="flex-1" />
        <a
          className="hidden items-center gap-1.5 text-sm text-zinc-400 no-underline transition-colors hover:text-white md:flex"
          href={GITHUB_URL}
          rel="noopener"
          target="_blank"
        >
          <svg
            aria-hidden="true"
            fill="currentColor"
            height="14"
            viewBox="0 0 24 24"
            width="14"
          >
            <path d="M12 .5A12 12 0 0 0 0 12.5a12 12 0 0 0 8.2 11.4c.6.1.8-.3.8-.6v-2.1c-3.3.7-4-1.6-4-1.6-.6-1.4-1.4-1.8-1.4-1.8-1.1-.8.1-.8.1-.8 1.3.1 1.9 1.3 1.9 1.3 1.1 1.9 2.9 1.4 3.7 1 .1-.8.4-1.4.7-1.7-2.7-.3-5.5-1.3-5.5-6 0-1.3.5-2.4 1.2-3.2-.1-.3-.5-1.5.1-3.2 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0c2.3-1.5 3.3-1.2 3.3-1.2.7 1.7.2 2.9.1 3.2.8.8 1.2 1.9 1.2 3.2 0 4.7-2.8 5.7-5.5 6 .4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A12 12 0 0 0 24 12.5 12 12 0 0 0 12 .5Z" />
          </svg>
          <span>{stars}</span>
        </a>
      </div>
    </nav>
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

// ─── Download email dialog ────────────────────────────────────────────
function DownloadEmailDialog({ onClose }: { onClose: () => void }) {
  const [email, setEmail] = useState("");
  const [submitState, setSubmitState] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!email.trim()) return;
      setSubmitState("loading");
      try {
        const res = await fetch("/api/send-download", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: email.trim() }),
        });
        if (res.ok) {
          setSubmitState("success");
        } else {
          const data = await res.json().catch(() => ({}));
          setErrorMsg(
            (data as { error?: string }).error ?? "Something went wrong"
          );
          setSubmitState("error");
        }
      } catch {
        setErrorMsg("Something went wrong. Try again.");
        setSubmitState("error");
      }
    },
    [email]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      onKeyDown={handleKeyDown}
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-zinc-950/80 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-sm rounded-2xl bg-zinc-900 p-8 shadow-2xl">
        <button
          aria-label="Close"
          className="absolute top-4 right-4 text-zinc-500 transition-colors hover:text-white"
          onClick={onClose}
          type="button"
        >
          <X className="size-4" />
        </button>

        {submitState === "success" ? (
          <div className="flex flex-col items-center gap-4 py-4 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-emerald-500/20">
              <Check className="size-6 text-emerald-400" />
            </div>
            <div>
              <p className="font-medium text-white">Check your inbox</p>
              <p className="mt-1 text-sm text-zinc-400">
                We sent your download link to {email}
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="mb-6">
              <h2 className="font-heading font-medium text-white text-xl">
                Get the download link
              </h2>
              <p className="mt-1 text-sm text-zinc-400">
                Enter your email and we'll send it instantly.
              </p>
            </div>
            <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
              <Input
                autoFocus
                className="h-12 border-zinc-700 bg-zinc-800 text-white placeholder:text-zinc-500 focus-visible:ring-zinc-500"
                disabled={submitState === "loading"}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                type="email"
                value={email}
              />
              {submitState === "error" && (
                <p className="text-red-400 text-sm">{errorMsg}</p>
              )}
              <Button
                className="h-12 w-full"
                disabled={!email.trim() || submitState === "loading"}
                size="lg"
                type="submit"
              >
                {submitState === "loading" ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  "Send download link"
                )}
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
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
          className="reveal mb-5 max-w-[860px] text-balance font-heading font-medium text-4xl text-white leading-tight tracking-tight md:text-6xl"
          data-delay="1"
        >
          The 🥇 agentic thumbnail maker for YouTube creators
        </h1>
        <p
          className="reveal mb-8 max-w-[520px] text-lg text-zinc-400 md:text-xl"
          data-delay="2"
        >
          A Canva and Photoshop level editor with no subscriptions. All on your
          machine, pay once, own it forever
        </p>
        <div
          className="reveal mb-6 flex flex-wrap justify-center gap-3"
          data-delay="3"
        >
          <Button
            className="rounded-full px-7 py-3 text-base"
            render={
              <a
                data-polar-checkout
                data-polar-checkout-theme="dark"
                href={CHECKOUT_URL}
              />
            }
            size="lg"
          >
            Get lifetime · $29
          </Button>
          <Button
            className="rounded-full px-7 py-3 text-base"
            onClick={() => setShowDownload(true)}
            size="lg"
            variant="secondary"
          >
            Download free
          </Button>
        </div>
        {showDownload && (
          <DownloadEmailDialog onClose={() => setShowDownload(false)} />
        )}
        <div
          className="reveal mb-10 flex flex-wrap items-center justify-center gap-2 text-sm text-zinc-500"
          data-delay="4"
        >
          <span className="flex items-center gap-1.5 text-amber-400/80">
            Early bird
            <span className="text-zinc-600 line-through">$59</span>
            $29
          </span>
          <span>·</span>
          <span>Price increases every 100 users, lock in now</span>
          <span>·</span>
          <span>30-day refund</span>
        </div>
        <div className="reveal w-full max-w-[900px]" data-delay="5">
          <div
            className="overflow-hidden rounded-2xl"
            style={{
              boxShadow:
                "0 0 0 1px oklch(1 0 0 / 0.05), 0 32px 80px oklch(0 0 0 / 0.6), 0 0 100px oklch(0.685 0.169 237.323 / 0.10)",
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
          <div className="mt-5 flex flex-wrap items-center justify-center gap-4 text-sm text-zinc-500">
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
                <path d="M12.504 0c-.155 0-.315.008-.48.021-4.226.333-3.105 4.807-3.17 6.298-.076 1.092-.3 1.953-1.05 3.02-.885 1.051-2.127 2.75-2.716 4.521-.278.832-.41 1.684-.287 2.489a.424.424 0 00-.11.135c-.26.268-.45.6-.663.839-.199.199-.485.267-.797.4-.313.136-.658.269-.864.68-.09.189-.136.394-.132.602 0 .199.027.4.055.536.058.399.116.728.04.97-.249.68-.25 1.237-.152 1.614.1.377.325.65.652.805.326.155.73.195 1.032.17.3-.027.575-.091.887-.145.292-.054.641-.109 1.063-.099.416.009.944.118 1.618.415.604.247 1.44.634 2.2.834.773.2 1.562.271 2.278.133.71-.14 1.376-.49 1.828-1.123a4.52 4.52 0 00.56-1.22c.062-.24.09-.49.108-.73.018-.24.027-.48.027-.72s-.01-.48-.027-.72c-.018-.24-.046-.49-.108-.73a4.52 4.52 0 00-.56-1.22c-.452-.633-1.118-.983-1.828-1.123-.716-.138-1.505-.067-2.278.133-.76.2-1.596.587-2.2.834-.674.297-1.202.406-1.618.415-.422.01-.771-.045-1.063-.099-.312-.054-.587-.118-.887-.145-.302-.025-.706.015-1.032.17-.327.155-.552.428-.652.805-.098.377-.097.934.152 1.614.076.242.018.571-.04.97-.028.136-.055.337-.055.536 0 .208.042.413.132.602.206.411.55.544.864.68.312.133.598.201.797.4.213.239.403.571.663.839a.424.424 0 00.11.135c-.123.805.009 1.657.287 2.489.589 1.771 1.831 3.47 2.716 4.521.75 1.067.974 1.928 1.05 3.02.065 1.491-1.056 5.965 3.17 6.298.165.013.325.021.48.021 4.226-.333 3.105-4.807 3.17-6.298.076-1.092.3-1.953 1.05-3.02.885-1.051 2.127-2.75 2.716-4.521.278-.832.41-1.684.287-2.489a.424.424 0 00.11-.135c.26-.268.45-.6.663-.839.199-.199.485-.267.797-.4.313-.136.658-.269.864-.68.09-.189.136-.394.132-.602 0-.199-.027-.4-.055-.536-.058-.399-.116-.728-.04-.97.249-.68.25-1.237.152-1.614-.1-.377-.325-.65-.652-.805-.326-.155-.73-.195-1.032-.17-.3.027-.575.091-.887.145-.292.054-.641.109-1.063.099-.416-.009-.944-.118-1.618-.415-.604-.247-1.44-.634-2.2-.834-.773-.2-1.562-.271-2.278-.133-.71.14-1.376.49-1.828 1.123a4.52 4.52 0 00-.56 1.22c-.062.24-.09.49-.108.73-.018.24-.027.48-.027.72s.01.48.027.72c.018.24.046.49.108.73a4.52 4.52 0 00.56 1.22c.452.633 1.118.983 1.828 1.123.716.138 1.505.067 2.278-.133.76-.2 1.596-.587 2.2-.834.674-.297 1.202-.406 1.618-.415.422-.01.771.045 1.063.099.312.054.587.118.887.145z" />
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
              { num: "0", label: "Subscriptions", blue: false },
              { num: "7", label: "Export formats", blue: false },
            ] satisfies { num: string; label: string; blue: boolean }[]
          ).map((s) => (
            <div
              className="flex flex-col items-center bg-zinc-900/40 px-4 py-6"
              key={s.label}
            >
              <div
                className="mb-1 font-bold text-3xl"
                style={s.blue ? { color: BLUE } : { color: "white" }}
              >
                {s.num}
              </div>
              <div className="text-center text-xs text-zinc-500">{s.label}</div>
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
        <div className="pointer-events-none absolute top-3 left-4 rounded bg-zinc-900/70 px-2 py-1 font-semibold text-white text-xs">
          Before
        </div>
        <div className="pointer-events-none absolute top-3 right-4 rounded bg-zinc-900/70 px-2 py-1 font-semibold text-white text-xs">
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
    <div className="grid gap-0 overflow-hidden rounded-2xl bg-zinc-900 md:grid-cols-2">
      <div className="flex flex-col gap-3 p-5">
        <div className="font-medium text-[11px] text-zinc-500 uppercase tracking-widest">
          Prompt
        </div>
        <textarea
          className="h-24 w-full resize-none rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm text-white outline-none transition-colors placeholder:text-zinc-600 focus:border-zinc-500"
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
            className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-xs text-zinc-400 outline-none"
            disabled
          >
            <option>gemini-2.5-flash-image</option>
          </select>
          <select
            className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-xs text-zinc-400 outline-none"
            disabled
          >
            <option>4 images</option>
          </select>
        </div>
        <div className="mt-auto flex items-center gap-2">
          <span className="flex-1 text-xs text-zinc-500">{meta}</span>
          <button
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 font-semibold text-xs text-zinc-950 transition-all hover:opacity-90",
              generating && "cursor-not-allowed opacity-70"
            )}
            onClick={generate}
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
              "relative aspect-square cursor-pointer overflow-hidden rounded-lg border bg-zinc-800 transition-all",
              activeTile === i
                ? "border-2"
                : "border-zinc-700 hover:border-zinc-500",
              shimmer && "tile-shimmer"
            )}
            key={id}
            onClick={() => setActiveTile(i)}
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
                activeTile === i
                  ? "border-transparent"
                  : "border-zinc-600 bg-zinc-900/80"
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
            <span className="absolute bottom-1 left-1.5 font-medium text-[10px] text-zinc-400">
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
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-zinc-900 shadow-2xl">
        <div className="flex items-center justify-between px-5 py-3.5">
          <h4 className="font-heading font-medium text-sm text-white">
            Export Image
          </h4>
          <button
            aria-label="Close"
            className="text-zinc-500 transition-colors hover:text-white"
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
          <div className="overflow-hidden rounded-lg bg-zinc-800">
            <Image
              alt=""
              height={170}
              src="/landing/screenshot-editor.png"
              style={{ width: "100%", height: "auto", display: "block" }}
              width={460}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="font-medium text-xs text-zinc-400">Format</div>
            <div className="flex flex-wrap items-center gap-1.5">
              {formats.map((f, i) =>
                f === null ? (
                  // biome-ignore lint/suspicious/noArrayIndexKey: static list
                  <div className="h-5 w-px bg-zinc-700" key={`div-${i}`} />
                ) : (
                  <button
                    className={cn(
                      "rounded-lg border px-3 py-1.5 font-medium text-xs transition-all",
                      activeFormat === f.key
                        ? "border-transparent text-zinc-950"
                        : "border-zinc-700 bg-transparent text-zinc-400 hover:border-zinc-500"
                    )}
                    key={f.key}
                    onClick={() => setActiveFormat(f.key)}
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
            <div className="font-medium text-xs text-zinc-400">Resolution</div>
            <div className="flex items-center justify-between rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-300">
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
              <div className="flex items-center justify-between font-medium text-xs text-zinc-400">
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
                <div className="relative h-1 w-full overflow-hidden rounded-full bg-zinc-700">
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
            className="rounded-lg px-4 py-2 text-sm text-zinc-400 transition-colors hover:text-white"
            type="button"
          >
            Cancel
          </button>
          <button
            className="rounded-lg px-4 py-2 font-semibold text-sm text-zinc-950 transition-all hover:opacity-90"
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
    <div className="w-full overflow-hidden rounded-xl bg-zinc-900">
      <div className="relative aspect-video">
        {/* biome-ignore lint/performance/noImgElement lint/correctness/useImageSize: external Unsplash URL */}
        <img
          alt=""
          className="h-full w-full object-cover"
          src="https://images.unsplash.com/photo-1485846234645-a62644f84728?w=900&q=80&auto=format&fit=crop"
        />
        <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-zinc-950/60 to-transparent p-3">
          <div className="flex items-center justify-between">
            <div className="inline-flex items-center gap-1.5 rounded bg-zinc-950/70 px-2 py-1 font-semibold text-[11px] text-white">
              <span
                className="h-1.5 w-1.5 rounded-full bg-red-500"
                style={{ boxShadow: "0 0 6px oklch(0.628 0.258 29.234)" }}
              />
              CAPTURED
            </div>
            <div className="rounded bg-zinc-950/70 px-2 py-1 text-[11px] text-zinc-300">
              00:02:14:08 · 3840×2160
            </div>
          </div>
        </div>
      </div>
      <div
        className="relative h-10 cursor-pointer bg-zinc-800"
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
            <div
              className="border-zinc-700 border-r bg-zinc-800 last:border-r-0"
              key={i}
            />
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
    <div className="flex items-center gap-1 border-zinc-700 border-t px-3 py-2">
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
          className="flex h-7 w-7 items-center justify-center rounded text-zinc-500 transition-colors hover:text-white"
          key={label}
          type="button"
        >
          {icon}
        </button>
      ))}
      <button
        aria-label="AI rename"
        className="ml-auto flex h-7 w-7 items-center justify-center rounded transition-colors"
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
    <div className="w-full overflow-hidden rounded-xl bg-zinc-900">
      {layers.map((layer) => (
        <div
          className={cn(
            "flex cursor-pointer items-center gap-2 px-3 py-2 transition-colors",
            selectedRow === layer.id
              ? "bg-zinc-700/60"
              : "hover:bg-zinc-800/60",
            hiddenRows.has(layer.id) && "opacity-40"
          )}
          key={layer.id}
          onClick={() => setSelectedRow(layer.id)}
          onKeyDown={(e) => e.key === "Enter" && setSelectedRow(layer.id)}
          role="button"
          tabIndex={0}
        >
          <button
            aria-label="Toggle visibility"
            className="flex h-5 w-5 flex-shrink-0 items-center justify-center text-zinc-500 transition-colors hover:text-white"
            onClick={(e) => {
              e.stopPropagation();
              toggleHidden(layer.id);
            }}
            type="button"
          >
            {hiddenRows.has(layer.id) ? <EyeOff /> : <EyeOn />}
          </button>
          <button
            aria-label="Lock"
            className="flex h-5 w-5 flex-shrink-0 items-center justify-center text-zinc-600 transition-colors hover:text-zinc-400"
            onClick={(e) => e.stopPropagation()}
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
          <span className="truncate text-sm text-zinc-300">{layer.name}</span>
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
      <div className="reveal flex flex-col gap-6 rounded-2xl bg-zinc-900 p-6 md:col-span-2 md:flex-row">
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
            Video frame extraction
          </Tag>
          <h3 className="font-heading font-medium text-lg text-white">
            Pull a frame from any video.
          </h3>
          <p className="text-sm text-zinc-400">
            Drag any MP4 or MOV in. Scrub with arrow keys. Extract at source
            resolution.
          </p>
        </div>
        <div className="min-w-0 flex-1">
          <VideoScrubber />
        </div>
      </div>

      <div
        className="reveal flex flex-col gap-4 rounded-2xl bg-zinc-900 p-6"
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
            Real layers
          </Tag>
          <h3 className="font-heading font-medium text-lg text-white">
            Layer panel that actually works.
          </h3>
          <p className="text-sm text-zinc-400">
            Toggle, lock, group, drag to reorder. Like Photoshop. Native speed.
          </p>
        </div>
        <LayersMock />
      </div>

      <div
        className="reveal flex flex-col gap-4 rounded-2xl bg-zinc-900 p-6"
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
          <h3 className="font-heading font-medium text-lg text-white">
            100 thumbnails. One workspace.
          </h3>
          <p className="text-sm text-zinc-400">
            Search, sort, bulk export, 30-day trash. Built for people who ship
            daily.
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

// ─── How It Works ─────────────────────────────────────────────────────
function HowItWorks() {
  const steps = [
    {
      num: "01",
      title: "Drop in your source",
      body: "Drag any image, paste from clipboard, or drop a video and scrub for the frame. Nothing uploads anywhere.",
      icon: (
        <svg
          fill="none"
          height="20"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          viewBox="0 0 24 24"
          width="20"
        >
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" x2="12" y1="3" y2="15" />
        </svg>
      ),
    },
    {
      num: "02",
      title: "Compose with AI on tap",
      body: "Cut the background, generate a new one with your Gemini key, drop in text, glow, badges. Iterate in seconds.",
      icon: (
        <svg
          fill="none"
          height="20"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          viewBox="0 0 24 24"
          width="20"
        >
          <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3z" />
        </svg>
      ),
    },
    {
      num: "03",
      title: "Export to every platform",
      body: "Pick a preset, pick a format, ship. The same project gives you YouTube, Shorts, and X in one click.",
      icon: (
        <svg
          fill="none"
          height="20"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          viewBox="0 0 24 24"
          width="20"
        >
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" x2="12" y1="15" y2="3" />
        </svg>
      ),
    },
  ];

  return (
    <section className="py-20 md:py-28" id="how">
      <div className="mx-auto max-w-[1200px] px-6">
        <div className="reveal mb-12 text-center">
          <Eyebrow>How it works</Eyebrow>
          <h2 className="mt-1 font-heading font-medium text-3xl text-white tracking-tight md:text-5xl">
            From video to thumbnail in three steps.
          </h2>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {steps.map((s, i) => (
            <div
              className="reveal flex flex-col gap-4 rounded-2xl bg-zinc-900 p-6"
              data-delay={i.toString()}
              key={s.num}
            >
              <div
                className="font-bold text-xs tracking-[0.15em]"
                style={{ color: BLUE }}
              >
                {s.num}
              </div>
              <div
                className="flex h-10 w-10 items-center justify-center rounded-xl"
                style={{
                  background: "oklch(0.685 0.169 237.323 / 0.12)",
                  color: BLUE,
                }}
              >
                {s.icon}
              </div>
              <h3 className="font-heading font-medium text-base text-white">
                {s.title}
              </h3>
              <p className="text-sm text-zinc-400">{s.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
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
            <h2 className="mt-1 mb-4 font-heading font-medium text-3xl text-white tracking-tight md:text-4xl">
              Why pay $20 a month
              <br />
              for AI you barely use?
            </h2>
            <p className="mb-5 text-zinc-400">
              Most thumbnail tools bundle AI into a fat monthly fee. Backstage
              doesn&apos;t. Paste your Google AI Studio key once and you pay
              Google directly at API rates. Most creators spend under{" "}
              <strong className="text-white">$2 a month</strong> on Gemini even
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
                  className="flex items-start gap-2.5 text-sm text-zinc-300"
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
            <div className="rounded-xl bg-zinc-900 p-4 text-sm text-zinc-400">
              <strong className="text-white">Real math:</strong> Generating 30
              thumbnail variations a month on Gemini 2.5 Flash Image costs about{" "}
              <strong className="text-white">$1.20</strong>. After 2 months,
              Backstage&apos;s lifetime price plus your Gemini spend is still
              less than one month of Canva Pro.
            </div>
          </div>
          <div className="overflow-hidden rounded-2xl bg-zinc-900">
            <div className="px-4 py-3 font-semibold text-xs text-zinc-400">
              Settings · AI
            </div>
            <div className="flex flex-col gap-3 p-4">
              <div className="flex flex-col gap-1.5">
                <div className="text-xs text-zinc-500">
                  Google AI Studio API key
                </div>
                <div className="flex items-center gap-2 rounded-lg bg-zinc-800 px-3 py-2">
                  <svg
                    className="text-zinc-500"
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
                  <span className="font-mono text-xs text-zinc-400">
                    AIza••••••••••••••••••••••••••8gQ
                  </span>
                  <span
                    className="ml-auto rounded px-1.5 py-0.5 font-semibold text-[11px]"
                    style={{
                      color: BLUE,
                      background: "oklch(0.685 0.169 237.323 / 0.12)",
                    }}
                  >
                    saved
                  </span>
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <div className="text-xs text-zinc-500">Model</div>
                <div className="flex items-center rounded-lg bg-zinc-800 px-3 py-2">
                  <span className="text-[13px] text-white">
                    gemini-2.5-flash-image
                  </span>
                  <span className="ml-auto text-zinc-500">▾</span>
                </div>
              </div>
              <div className="flex flex-col gap-2 rounded-xl bg-zinc-800 p-3">
                <div className="flex items-center gap-1.5 text-[11px] text-zinc-500 uppercase tracking-[0.08em]">
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
                <p className="text-xs text-zinc-400">
                  Cinematic shot of a retro CRT TV on a dark workshop bench,
                  glowing magenta from inside, 16:9.
                </p>
                <button
                  className="self-end rounded-full px-3 py-1.5 font-semibold text-xs text-zinc-950"
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
      title: "No cloud round-trip",
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
      title: "Your files, your folder",
      body: "Projects live on your filesystem as plain folders. Move them, sync them in Dropbox, version-control them in git. We don't lock you into a proprietary cloud.",
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
          <h2 className="mt-1 mb-3 font-heading font-medium text-3xl text-white tracking-tight md:text-5xl">
            Your work stays on your machine.
          </h2>
          <p className="max-w-[540px] text-base text-zinc-400 md:text-lg">
            Backstage is a native desktop app, not a web wrapper. Your projects,
            your source files, your API keys. Never sent to a server we control.
          </p>
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          {cards.map((c, i) => (
            <div
              className="reveal flex flex-col gap-4 rounded-2xl bg-zinc-900 p-6"
              data-delay={i.toString()}
              key={c.title}
            >
              <div
                className="flex h-10 w-10 items-center justify-center rounded-xl"
                style={{
                  background: "oklch(0.685 0.169 237.323 / 0.12)",
                  color: BLUE,
                }}
              >
                {c.icon}
              </div>
              <h3 className="font-heading font-medium text-base text-white">
                {c.title}
              </h3>
              <p className="text-sm text-zinc-400">{c.body}</p>
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
        <span className="text-zinc-600">○</span> {cell.text}
      </>
    );
  }
  if (cell.maybe) {
    return (
      <>
        <span className="text-zinc-500">◐</span> {cell.text}
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
      us: { yes: true, text: "MIT on GitHub" },
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
          <h2 className="mt-1 mb-3 font-heading font-medium text-3xl text-white tracking-tight md:text-5xl">
            Built for thumbnails.
            <br />
            <span className="text-zinc-500">
              Everything else is for something else.
            </span>
          </h2>
          <p className="max-w-[540px] text-base text-zinc-400 md:text-lg">
            Real comparison of the tools creators actually evaluate.
          </p>
        </div>
        <div className="reveal overflow-hidden rounded-2xl">
          <div
            className="grid font-semibold text-xs"
            style={{ gridTemplateColumns: "1.4fr 1fr 1fr 1fr" }}
          >
            <div className="px-5 py-3.5 text-zinc-500" />
            <div
              className="px-5 py-3.5"
              style={{
                background: "oklch(0.685 0.169 237.323 / 0.08)",
                color: BLUE,
              }}
            >
              Backstage
            </div>
            {["Photoshop", "Canva Pro", "Figma"].map((b) => (
              <div className="px-5 py-3.5 text-zinc-400" key={b}>
                {b}
              </div>
            ))}
          </div>
          {rows.map((row) => (
            <div
              className="grid border-zinc-800/50 border-b text-sm last:border-b-0"
              key={row.label}
              style={{ gridTemplateColumns: "1.4fr 1fr 1fr 1fr" }}
            >
              <div className="px-5 py-3.5 text-zinc-400">{row.label}</div>
              <div
                className="px-5 py-3.5 font-medium text-white"
                style={{ background: "oklch(0.685 0.169 237.323 / 0.05)" }}
              >
                <CellContent cell={row.us} />
              </div>
              {row.rest.map((cell, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: stable order
                <div className="px-5 py-3.5 text-zinc-400" key={i}>
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

// ─── Testimonials ─────────────────────────────────────────────────────
function Testimonials() {
  const items = [
    {
      initials: "JM",
      name: "Jamie Morgan",
      handle: "@jamiebuilds · 240K subs",
      quote:
        "I went from spending 40 minutes on a thumbnail in Photoshop to 8 minutes in Backstage. The video-frame extractor alone is worth the price.",
    },
    {
      initials: "RK",
      name: "Ravi Krishnan",
      handle: "@ravicodes · 88K subs",
      quote:
        "BYO key is the killer feature. I was paying for Canva Pro and a separate Midjourney sub just for thumbnails. Now I pay Google $1.50 a month and that's it.",
    },
    {
      initials: "AT",
      name: "Alex Tan",
      handle: "@alextanvideo · 1.1M subs",
      quote:
        "Finally a tool that respects that I have my own workflow. It's not trying to be everything for everyone. Layers work like Photoshop. Export is fast. That's it.",
    },
    {
      initials: "SP",
      name: "Sara Park",
      handle: "@sara_dev · 56K subs",
      quote:
        "Native, dark, keyboard-first. It feels like a developer made it. Probably because one did.",
    },
    {
      initials: "DH",
      name: "Diego Hernandez",
      handle: "@diegoshipsit · 320K subs",
      quote:
        "The carousel generator changed my A/B testing workflow. I can run 4 variants of the same thumbnail concept and pick the winner in minutes.",
    },
    {
      initials: "MN",
      name: "Marcus Nguyen",
      handle: "@marcusbuilds · 178K subs",
      quote:
        "$29 lifetime in a world of $25 a month subscriptions feels almost suspicious. Then you realize it's open source and built by one person and it makes sense.",
    },
  ];

  return (
    <section className="py-20 md:py-28" id="testimonials">
      <div className="mx-auto max-w-[1200px] px-6">
        <div className="reveal mb-10 text-center">
          <Eyebrow>What creators are saying</Eyebrow>
          <h2 className="mt-1 font-heading font-medium text-3xl text-white tracking-tight md:text-5xl">
            Built in the open. Shipped to creators who notice.
          </h2>
        </div>
        <div className="reveal" style={{ columns: 3, columnGap: "1.25rem" }}>
          {items.map((t) => (
            <div
              className="mb-5 flex break-inside-avoid flex-col gap-4 rounded-2xl bg-zinc-900 p-5"
              key={t.name}
            >
              <p className="text-sm text-zinc-300 leading-relaxed">
                &ldquo;{t.quote}&rdquo;
              </p>
              <div className="flex items-center gap-3">
                <div
                  className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full font-bold text-xs text-zinc-950"
                  style={{ background: BLUE }}
                >
                  {t.initials}
                </div>
                <div>
                  <div className="font-semibold text-sm text-white">
                    {t.name}
                  </div>
                  <div className="text-xs text-zinc-500">{t.handle}</div>
                </div>
              </div>
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
    { label: "License:", value: "MIT (BRIA model is non-commercial)" },
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
        <div className="reveal rounded-2xl bg-zinc-900 p-8 md:p-12">
          <div className="grid items-center gap-10 md:grid-cols-2">
            <div>
              <Eyebrow>Open source</Eyebrow>
              <h2 className="mt-1 mb-4 font-heading font-medium text-2xl text-white tracking-tight md:text-3xl">
                MIT-licensed and audited by anyone who wants to.
              </h2>
              <p className="mb-6 text-zinc-400">
                Backstage&apos;s source is on GitHub. The desktop app, the
                editor, the AI integrations. Every line. The lifetime deal is
                for the prebuilt, signed, auto-updating binaries we ship and
                support. If you&apos;d rather compile it yourself, that&apos;s
                free.
              </p>
              <div className="flex flex-wrap gap-3">
                <a
                  className="inline-flex items-center gap-2 rounded-full bg-zinc-800 px-5 py-2.5 font-semibold text-sm text-white no-underline transition-colors hover:bg-zinc-700"
                  href={GITHUB_URL}
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
                  className="inline-flex items-center gap-2 rounded-full bg-zinc-800/60 px-5 py-2.5 font-semibold text-sm text-white no-underline transition-colors hover:bg-zinc-800"
                  href={`${GITHUB_URL}#getting-started`}
                  rel="noopener"
                  target="_blank"
                >
                  Read the build docs
                </a>
              </div>
            </div>
            <div className="flex flex-col gap-3 rounded-xl bg-zinc-950 p-5 font-mono">
              {lines.map((l) => (
                <div className="flex items-start gap-2.5 text-sm" key={l.label}>
                  <SmallCheck />
                  <span className="text-zinc-400">
                    <strong className="text-zinc-200">{l.label}</strong>{" "}
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

// ─── Roadmap item (module-level to avoid nested component lint) ───────
interface RoadmapItemData {
  name: string;
  done?: boolean;
  soon?: boolean;
  meta?: string;
}

function RoadmapItemRow({ item }: { item: RoadmapItemData }) {
  let itemColor = "text-zinc-500";
  if (item.done) {
    itemColor = "text-white";
  } else if (item.soon) {
    itemColor = "text-zinc-300";
  }

  let svgContent: React.ReactNode = <circle cx="12" cy="12" r="9" />;
  if (item.done) {
    svgContent = <polyline points="20 6 9 17 4 12" />;
  } else if (item.soon) {
    svgContent = (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    );
  }

  return (
    <div className={cn("flex items-center gap-2.5 py-1.5 text-sm", itemColor)}>
      <svg
        aria-hidden="true"
        fill="none"
        height="14"
        stroke="currentColor"
        strokeWidth={item.done ? 2.5 : 2}
        style={item.done ? { color: BLUE } : undefined}
        viewBox="0 0 24 24"
        width="14"
      >
        {svgContent}
      </svg>
      <span className="flex-1">{item.name}</span>
      {item.meta && (
        <span className="text-[11px] text-zinc-500">{item.meta}</span>
      )}
    </div>
  );
}

// ─── Roadmap ──────────────────────────────────────────────────────────
function Roadmap() {
  const cols = [
    {
      heading: "Shipped",
      pill: "v1.0 live",
      pillLive: true,
      items: [
        { name: "Layer editor and auto-save", done: true },
        { name: "Background removal (WASM + BRIA)", done: true },
        { name: "Gemini image generation", done: true },
        { name: "Video frame extraction", done: true },
        { name: "Carousel generator", done: true },
      ],
    },
    {
      heading: "Up next",
      pill: "In dev",
      pillLive: false,
      items: [
        { name: "Template library", soon: true, meta: "Q2" },
        { name: "A/B CTR analyzer", soon: true, meta: "Q2" },
        { name: "Anthropic Claude provider", soon: true, meta: "Q2" },
        { name: "Smart auto-crop for Shorts", soon: true, meta: "Q3" },
      ],
    },
    {
      heading: "Exploring",
      pill: "Backlog",
      pillLive: false,
      items: [
        { name: "YouTube channel sync" },
        { name: "Animated thumbnails (APNG)" },
        { name: "Plugin SDK" },
        { name: "Team workspaces" },
      ],
    },
  ];

  return (
    <section className="py-20 md:py-28" id="roadmap">
      <div className="mx-auto max-w-[1200px] px-6">
        <div className="reveal mb-10">
          <Eyebrow>Roadmap</Eyebrow>
          <h2 className="mt-1 mb-3 font-heading font-medium text-3xl text-white tracking-tight md:text-5xl">
            All updates included.
            <br />
            <span className="text-zinc-500">
              No &ldquo;Pro tier&rdquo; hiding behind a paywall.
            </span>
          </h2>
          <p className="max-w-[540px] text-base text-zinc-400 md:text-lg">
            Every feature below ships to your existing license at zero extra
            cost.
          </p>
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          {cols.map((col, ci) => (
            <div
              className="reveal flex flex-col gap-5 rounded-2xl bg-zinc-900 p-6"
              data-delay={ci.toString()}
              key={col.heading}
            >
              <div className="flex items-center justify-between">
                <div className="font-semibold text-base text-white">
                  {col.heading}
                </div>
                <div
                  className={cn(
                    "rounded-full px-2.5 py-1 font-semibold text-[11px]",
                    col.pillLive
                      ? "bg-emerald-400/10 text-emerald-400"
                      : "bg-zinc-800 text-zinc-500"
                  )}
                >
                  {col.pill}
                </div>
              </div>
              <div className="flex flex-col gap-2">
                {col.items.map((item) => (
                  <RoadmapItemRow item={item} key={item.name} />
                ))}
              </div>
            </div>
          ))}
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
    <section className="bg-[oklch(0.08_0_0)] py-20 md:py-28" id="pricing">
      <div className="mx-auto max-w-[1200px] px-6">
        <div className="reveal mb-10 text-center">
          <Eyebrow>Pricing</Eyebrow>
          <h2 className="mt-1 mb-3 font-heading font-medium text-3xl text-white tracking-tight md:text-5xl">
            Pay once. Use forever.
            <br />
            <span className="text-zinc-500">
              No subscriptions. No &ldquo;AI credits&rdquo;. No B.S.
            </span>
          </h2>
          <p className="mx-auto max-w-[540px] text-base text-zinc-400 md:text-lg">
            Early bird pricing — locks in your rate forever. Price increases
            every 100 customers. Next increase: May 25.
          </p>
        </div>
        <div className="reveal mx-auto max-w-3xl">
          <div className="overflow-hidden rounded-2xl bg-zinc-900">
            <div className="grid md:grid-cols-[1fr_280px]">
              <div className="flex flex-col gap-5 p-8">
                <div className="flex items-center gap-2">
                  <span
                    className="rounded-full px-2.5 py-1 font-bold text-[11px] text-zinc-950"
                    style={{ background: BLUE }}
                  >
                    EARLY BIRD
                  </span>
                  <span className="text-sm text-zinc-400">
                    Price goes up every 100 users
                  </span>
                </div>
                <div>
                  <h3 className="mb-1 font-heading font-medium text-white text-xl">
                    Backstage Lifetime
                  </h3>
                  <p className="text-sm text-zinc-400">
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
                    "30-day refund. No questions asked.",
                    "Use on every device you own",
                  ].map((item) => (
                    <li
                      className="flex items-start gap-2.5 text-sm text-zinc-300"
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
                  <span className="text-sm text-zinc-400">
                    Limited time deal — expires May 25
                  </span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-800">
                    <div
                      className="h-full rounded-full"
                      style={{ width: "38.4%", background: BLUE }}
                    />
                  </div>
                  <span className="whitespace-nowrap text-sm text-zinc-400">
                    384/1000 sold
                  </span>
                </div>
              </div>
              <div className="flex flex-col gap-4 p-8">
                <div className="font-semibold text-xs text-zinc-500 uppercase tracking-widest">
                  One-time payment
                </div>
                <div className="flex items-end gap-2">
                  <span className="font-bold text-5xl text-white">$29</span>
                  <span className="mb-1 text-xl text-zinc-600 line-through">
                    $59
                  </span>
                </div>
                <div className="text-xs text-zinc-500">USD · Tax included</div>
                <p className="text-xs text-zinc-500">
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
                  <span>Goes to $35 on May 25 — lock in $29 now</span>
                </div>
                <Button
                  className="mt-1 h-12 w-full rounded-xl text-sm"
                  render={
                    <a
                      data-polar-checkout
                      data-polar-checkout-theme="dark"
                      href={CHECKOUT_URL}
                    />
                  }
                  size="lg"
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
                <p className="text-center text-[11px] text-zinc-500">
                  Secure checkout via Polar. Instant license delivery.
                </p>
                <div className="mt-1 flex items-center justify-center gap-2 rounded-lg bg-zinc-800/50 px-3 py-2.5">
                  <svg
                    aria-hidden="true"
                    className="flex-shrink-0 text-emerald-400"
                    fill="none"
                    height="16"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                    width="16"
                  >
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    <polyline points="9 12 11 14 15 10" />
                  </svg>
                  <span className="font-medium text-xs text-zinc-300">
                    30-day money back guarantee
                  </span>
                </div>
                <div className="mt-1 flex items-center justify-center gap-2 text-xs text-zinc-600">
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
      a: 'Pay once and you own Backstage on every machine you use, forever. There is no subscription, no expiry, and no "AI credit" meter. Every future version is included. If the company shuts down tomorrow, the app keeps working because it runs on your machine.',
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
      a: "Backstage is open source under the MIT license. The full source is on GitHub. Your installed copy keeps running indefinitely. If we ever stop maintaining it, you can build the latest version yourself, fork it, or hire anyone to keep it running.",
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
      q: "Why is it so cheap?",
      a: "Because we don't pay for your AI compute, don't run a SaaS backend, don't have a sales team, and don't have investors to repay. Backstage is built by a small team that wants the tool to exist and to be sustainably profitable at a fair price.",
    },
  ];

  return (
    <section className="py-20 md:py-28" id="faq">
      <div className="mx-auto max-w-[1200px] px-6">
        <div className="reveal mb-10 text-center">
          <Eyebrow>FAQ</Eyebrow>
          <h2 className="mt-1 font-heading font-medium text-3xl text-white tracking-tight md:text-5xl">
            The honest answers.
          </h2>
        </div>
        <div className="reveal mx-auto flex max-w-2xl flex-col gap-0">
          {items.map((item) => (
            <details className="last:pb-0" key={item.q} open={item.open}>
              <summary className="flex cursor-pointer select-none list-none items-center justify-between gap-4 py-5 font-semibold text-base text-white transition-colors hover:text-zinc-200">
                {item.q}
                <span className="faq-icon flex-shrink-0 text-zinc-500 transition-transform duration-200">
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
              <div className="pb-5 text-sm text-zinc-400 leading-relaxed">
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
          <h2 className="max-w-[560px] font-heading font-medium text-3xl text-white tracking-tight md:text-5xl">
            Ship better thumbnails this weekend.
          </h2>
          <p className="text-base text-zinc-400 md:text-lg">
            Pay $29 once. Use it for the rest of your career.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Button
              className="rounded-full px-7 py-3 text-base"
              render={
                <a
                  data-polar-checkout
                  data-polar-checkout-theme="dark"
                  href={CHECKOUT_URL}
                />
              }
              size="lg"
            >
              Get lifetime · $29
            </Button>
            <Button
              className="rounded-full px-7 py-3 text-base"
              render={<a href={GITHUB_URL} rel="noopener" target="_blank" />}
              size="lg"
              variant="secondary"
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
            <div className="mb-3 flex items-center gap-2 font-semibold text-sm text-white">
              <GalleryThumbnails
                aria-hidden="true"
                size={18}
                strokeWidth={2.5}
              />
              Backstage
            </div>
            <p className="text-sm text-zinc-500">
              The agentic thumbnail maker for YouTube creators. Built by{" "}
              <a
                className="text-zinc-300 no-underline transition-colors hover:text-white"
                href="https://amajor.ai"
              >
                A Major
              </a>
              .
            </p>
          </div>
          <div>
            <div className="mb-4 font-semibold text-xs text-zinc-500 uppercase tracking-widest">
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
                className="mb-2 block text-sm text-zinc-400 no-underline transition-colors hover:text-white"
                href={href}
                key={href}
              >
                {label}
              </a>
            ))}
          </div>
          <div>
            <div className="mb-4 font-semibold text-xs text-zinc-500 uppercase tracking-widest">
              Open source
            </div>
            {[
              [GITHUB_URL, "GitHub"],
              [`${GITHUB_URL}/releases`, "Releases"],
              [`${GITHUB_URL}/issues`, "Issues"],
              [`${GITHUB_URL}/blob/master/LICENSE`, "License"],
            ].map(([href, label]) => (
              <a
                className="mb-2 block text-sm text-zinc-400 no-underline transition-colors hover:text-white"
                href={href}
                key={href}
                rel="noopener"
                target="_blank"
              >
                {label}
              </a>
            ))}
          </div>
          <div>
            <div className="mb-4 font-semibold text-xs text-zinc-500 uppercase tracking-widest">
              Company
            </div>
            <a
              className="mb-2 block text-sm text-zinc-400 no-underline transition-colors hover:text-white"
              href="https://amajor.ai"
              rel="noopener"
              target="_blank"
            >
              A Major
            </a>
            <a
              className="mb-2 block text-sm text-zinc-400 no-underline transition-colors hover:text-white"
              href="mailto:hello@amajor.ai"
            >
              Contact
            </a>
            <a
              className="mb-2 block text-sm text-zinc-400 no-underline transition-colors hover:text-white"
              href="https://twitter.com/amajor_ai"
              rel="noopener"
              target="_blank"
            >
              X / Twitter
            </a>
            <a
              className="mb-2 block text-sm text-zinc-400 no-underline transition-colors hover:text-white"
              href="#faq"
            >
              FAQ
            </a>
          </div>
        </div>
        <div className="flex items-center justify-between pt-6 text-xs text-zinc-600">
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
    <div className="dark min-h-screen overflow-x-hidden bg-zinc-950 font-sans text-white">
      <Nav stars={stars} />
      <Hero />
      <Stats />

      {/* Background removal */}
      <section className="py-20 md:py-28" id="features">
        <div className="mx-auto max-w-[1200px] px-6">
          <div className="reveal mb-10">
            <Eyebrow>Built for thumbnails</Eyebrow>
            <h2 className="mt-1 mb-3 font-heading font-medium text-3xl text-white tracking-tight md:text-5xl">
              Every tool you need.
              <br />
              <span className="text-zinc-500">Nothing you don&apos;t.</span>
            </h2>
            <p className="max-w-[540px] text-base text-zinc-400 md:text-lg">
              A purpose-built editor for YouTube thumbnails. Designed around how
              creators actually iterate on a hook.
            </p>
          </div>
          <div className="reveal flex flex-col gap-6 rounded-2xl bg-zinc-900 p-8">
            <div>
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
                  <path d="M15 4V2M15 16v-2M8 9h2M20 9h2M17.8 11.8 19 13M15 9h0M17.8 6.2 19 5m-16 16 9-9M12.2 6.2 11 5" />
                </svg>
                Background removal
              </Tag>
              <h3 className="mb-2 font-heading font-medium text-white text-xl">
                One tap. Background gone. Runs on your machine.
              </h3>
              <p className="max-w-[520px] text-sm text-zinc-400">
                Drag the handle to see it for yourself. WebAssembly inference on
                every machine, every OS. Nothing uploads anywhere.
              </p>
            </div>
            <CompareSlider />
            <ul className="grid gap-2 sm:grid-cols-2">
              {[
                "Runs offline in WebAssembly. No upload. No usage cap.",
                "Open-source build ships with BRIA RMBG-1.4 for sharper cutouts.",
                "Queue dozens at once from the gallery.",
                "Non-destructive. Your original layer is never touched.",
              ].map((item) => (
                <li
                  className="flex items-start gap-2 text-sm text-zinc-400"
                  key={item}
                >
                  <span
                    className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full"
                    style={{ background: BLUE }}
                  />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Gemini generation */}
      <section className="py-20 md:py-28">
        <div className="mx-auto max-w-[1200px] px-6">
          <div className="reveal flex flex-col gap-6 rounded-2xl bg-zinc-900 p-8">
            <div>
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
                  <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3z" />
                </svg>
                Gemini image gen
              </Tag>
              <h3 className="mb-2 font-heading font-medium text-white text-xl">
                AI at API rates. Not SaaS rates.
              </h3>
              <p className="max-w-[520px] text-sm text-zinc-400">
                Bring your own Google AI Studio key. Pay Google directly at{" "}
                <strong className="text-white">~$0.04 per image</strong>. No
                middle-man markup. Type a prompt below to see it in action.
              </p>
            </div>
            <GeminiPanel />
          </div>
        </div>
      </section>

      {/* Export dialog */}
      <section className="py-20 md:py-28">
        <div className="mx-auto max-w-[1200px] px-6">
          <div className="reveal flex flex-col gap-6 rounded-2xl bg-zinc-900 p-8">
            <div>
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
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" x2="12" y1="15" y2="3" />
                </svg>
                Export anywhere
              </Tag>
              <h3 className="mb-2 font-heading font-medium text-white text-xl">
                Every format. Every platform. One dialog.
              </h3>
              <p className="max-w-[520px] text-sm text-zinc-400">
                PNG, JPEG, WebP, animated GIF and MP4. YouTube, Shorts, X,
                custom sizes. Drag the quality slider below.
              </p>
            </div>
            <ExportDialog />
          </div>
        </div>
      </section>

      {/* Bento */}
      <section className="py-20 md:py-28">
        <div className="mx-auto max-w-[1200px] px-6">
          <Bento />
        </div>
      </section>

      <HowItWorks />
      <ByoGemini />
      <Privacy />
      <CompareTable />
      <Testimonials />
      <OssCallout />
      <Roadmap />
      <Pricing />
      <FAQ />
      <CtaStrip />
      <Footer />
    </div>
  );
}
