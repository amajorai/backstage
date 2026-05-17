"use client";

import { GalleryThumbnails } from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import "@/styles/landing.css";

const CHECKOUT_URL =
  "https://buy.polar.sh/polar_cl_vRZFdcYZgPt95VtQARtoA90NQrmEiWBdKlqxK2rHnjA";
const GITHUB_URL = "https://github.com/amajorai/backstage";

// ─── GitHub data hook ────────────────────────────────────────────────
function formatStars(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  return String(n);
}

function useGitHubData() {
  const [stars, setStars] = useState<string>("—");
  const [version, setVersion] = useState<string>("v1.0");

  useEffect(() => {
    fetch("https://api.github.com/repos/amajorai/backstage")
      .then((r) => r.json())
      .then((d) => {
        if (typeof d.stargazers_count === "number")
          setStars(formatStars(d.stargazers_count));
      })
      .catch(() => {});

    fetch("https://api.github.com/repos/amajorai/backstage/releases/latest")
      .then((r) => r.json())
      .then((d) => {
        if (typeof d.tag_name === "string") setVersion(d.tag_name);
      })
      .catch(() => {});
  }, []);

  return { stars, version };
}

// ─── Scroll reveal hook ───────────────────────────────────────────────
function useScrollReveal() {
  useEffect(() => {
    const reveals = document.querySelectorAll(".lp-reveal");

    const inViewport = (el: Element) => {
      const r = el.getBoundingClientRect();
      return (
        r.top < (window.innerHeight || document.documentElement.clientHeight) &&
        r.bottom > 0
      );
    };

    for (const el of reveals) {
      if (inViewport(el)) el.classList.add("is-in");
    }

    if (!("IntersectionObserver" in window)) {
      for (const el of reveals) el.classList.add("is-in");
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
      if (!el.classList.contains("is-in")) io.observe(el);
    }

    const timer = setTimeout(() => {
      document.querySelectorAll(".lp-reveal:not(.is-in)").forEach((el) => {
        if (inViewport(el)) el.classList.add("is-in");
      });
    }, 600);

    return () => {
      io.disconnect();
      clearTimeout(timer);
    };
  }, []);
}

// ─── Nav ─────────────────────────────────────────────────────────────
function Nav({ stars }: { stars: string }) {
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const onScroll = () => {
      if (window.scrollY > 24) nav.classList.add("is-scrolled");
      else nav.classList.remove("is-scrolled");
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav className="lp-nav" ref={navRef}>
      <div className="lp-nav__inner">
        <a className="lp-nav__brand" href="#">
          <GalleryThumbnails aria-hidden="true" size={18} strokeWidth={2.5} />
          Backstage
        </a>
        <div className="lp-nav__links">
          {(
            [
              ["#features", "Features"],
              ["#how", "How it works"],
              ["#compare", "Compare"],
              ["#pricing", "Pricing"],
              ["#faq", "FAQ"],
            ] as const
          ).map(([href, label]) => (
            <a className="lp-nav__link" href={href} key={href}>
              {label}
            </a>
          ))}
        </div>
        <div className="lp-nav__spacer" />
        <a
          className="lp-nav__github"
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
        <a className="lp-btn lp-btn--cyan" href="#pricing">
          Get lifetime · $20
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
    if (!el) return [0, 0];
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
    if (!s.dragging) return;
    const el = ref.current;
    if (!el) return;
    el.style.setProperty("--user-tx", `${s.baseX + e.clientX - s.startX}px`);
    el.style.setProperty("--user-ty", `${s.baseY + e.clientY - s.startY}px`);
  }, []);

  const onUp = useCallback((e: React.PointerEvent) => {
    const s = stateRef.current;
    if (!s.dragging) return;
    s.dragging = false;
    ref.current?.classList.remove("is-dragging");
    try {
      ref.current?.releasePointerCapture(e.pointerId);
    } catch (_) {}
  }, []);

  return (
    <span
      className="lp-emoji"
      onPointerCancel={onUp}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      ref={ref}
      style={style}
    >
      <span className="lp-emoji__inner">{emoji}</span>
    </span>
  );
}

// ─── Hero ─────────────────────────────────────────────────────────────
function Hero({ version }: { version: string }) {
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
    <section className="lp-hero">
      <div className="lp-hero__glow" />
      <div aria-hidden="true" className="lp-hero__emojis">
        {emojis.map((e) => (
          <DraggableEmoji
            emoji={e.emoji}
            key={e.emoji}
            style={e.style as React.CSSProperties}
          />
        ))}
      </div>
      <div className="lp-hero__inner">
        <a
          className="lp-hero__badge lp-reveal"
          data-delay="0"
          href={`${GITHUB_URL}/releases/latest`}
          rel="noopener"
          target="_blank"
        >
          <span className="lp-hero__badge-pill">{version}</span>
          <span>Latest Release</span>
        </a>
        <h1 className="lp-hero__title lp-reveal" data-delay="1">
          The 🥇 thumbnail maker for YouTube creators
        </h1>
        <p className="lp-hero__sub lp-reveal" data-delay="2">
          A Canva and Photoshop level editor with no subscriptions. All on your
          machine, pay once, own it forever
        </p>
        <div className="lp-hero__ctas lp-reveal" data-delay="3">
          <a className="lp-btn lp-btn--cyan lp-btn--xl" href={CHECKOUT_URL}>
            Get lifetime · $20
          </a>
          <a
            className="lp-btn lp-btn--ghost lp-btn--xl"
            href={`${GITHUB_URL}/releases/latest`}
            rel="noopener"
            target="_blank"
          >
            Download free
          </a>
        </div>
        <div className="lp-hero__meta lp-reveal" data-delay="4">
          <span>
            <span className="lp-green-dot" /> Mac · Windows · Linux
          </span>
          <span>·</span>
          <span>30-day refund</span>
          <span>·</span>
          <span>Open source on GitHub</span>
        </div>
        <div className="lp-shot-wrap lp-reveal" data-delay="5">
          <div className="lp-shot">
            <Image
              alt="Backstage editor with a layered thumbnail open"
              height={620}
              src="/landing/screenshot-editor.png"
              style={{ width: "100%", height: "auto" }}
              width={1100}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Stats ────────────────────────────────────────────────────────────
function Stats() {
  return (
    <section id="social-strip">
      <div className="lp-container">
        <div className="lp-stats lp-reveal">
          {(
            [
              { num: "100%", label: "Runs on your machine", blue: true },
              { num: "$20", label: "One-time. Forever.", blue: false },
              { num: "0", label: "Subscriptions", blue: false },
              { num: "7", label: "Export formats", blue: false },
            ] satisfies { num: string; label: string; blue: boolean }[]
          ).map((s) => (
            <div className="lp-stats__cell" key={s.label}>
              <div className="lp-stats__num" data-blue={s.blue}>
                {s.num}
              </div>
              <div className="lp-stats__label">{s.label}</div>
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
    if (beforeClipRef.current)
      beforeClipRef.current.style.clipPath = `inset(0 ${100 - clamped}% 0 0)`;
    if (dividerRef.current) dividerRef.current.style.left = `${clamped}%`;
    if (handleRef.current) handleRef.current.style.left = `${clamped}%`;
  }, []);

  useEffect(() => {
    setPosition(50);
  }, [setPosition]);

  const update = useCallback(
    (clientX: number) => {
      const r = trackRef.current?.getBoundingClientRect();
      if (!r) return;
      setPosition(((clientX - r.left) / r.width) * 100);
    },
    [setPosition]
  );

  const onHandleDown = useCallback((e: React.PointerEvent) => {
    dragging.current = true;
    handleRef.current?.classList.add("is-dragging");
    try {
      handleRef.current?.setPointerCapture(e.pointerId);
    } catch (_) {}
    e.preventDefault();
  }, []);

  const onHandleMove = useCallback(
    (e: React.PointerEvent) => {
      if (dragging.current) update(e.clientX);
    },
    [update]
  );

  const onHandleUp = useCallback((e: React.PointerEvent) => {
    if (!dragging.current) return;
    dragging.current = false;
    handleRef.current?.classList.remove("is-dragging");
    try {
      handleRef.current?.releasePointerCapture(e.pointerId);
    } catch (_) {}
  }, []);

  const onTrackDown = useCallback(
    (e: React.PointerEvent) => {
      if (
        e.target === handleRef.current ||
        handleRef.current?.contains(e.target as Node)
      )
        return;
      update(e.clientX);
      dragging.current = true;
      handleRef.current?.classList.add("is-dragging");
    },
    [update]
  );

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (dragging.current) update(e.clientX);
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
    <div className="lp-compare-slider">
      <div
        className="lp-compare-slider__track"
        onPointerDown={onTrackDown}
        ref={trackRef}
      >
        <div className="lp-compare-slider__after-bg" />
        {/* biome-ignore lint/performance/noImgElement: external Unsplash URL */}
        <img
          alt="Subject with background removed"
          className="lp-compare-slider__after-img"
          draggable={false}
          src={IMG}
        />
        <div className="lp-compare-slider__before-clip" ref={beforeClipRef}>
          {/* biome-ignore lint/performance/noImgElement: external Unsplash URL */}
          <img
            alt="Original photo"
            className="lp-compare-slider__before-img"
            draggable={false}
            src={IMG}
          />
        </div>
        <div className="lp-compare-slider__label lp-compare-slider__label--left">
          Before
        </div>
        <div className="lp-compare-slider__label lp-compare-slider__label--right">
          After
        </div>
        <div className="lp-compare-slider__divider" ref={dividerRef}>
          <button
            aria-label="Drag to compare"
            className="lp-compare-slider__handle"
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
    if (generating) return;
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
    <div className="lp-gemini-panel">
      <div className="lp-gemini-panel__col">
        <div className="lp-gemini-panel__label">Prompt</div>
        <textarea
          className="lp-gemini-panel__textarea"
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
        <div className="lp-gemini-panel__row">
          <select className="lp-gemini-panel__select" disabled>
            <option>gemini-2.5-flash-image</option>
          </select>
          <select className="lp-gemini-panel__select" disabled>
            <option>4 images</option>
          </select>
        </div>
        <div className="lp-gemini-panel__row">
          <span className="lp-gemini-panel__meta">{meta}</span>
          <button
            className={`lp-gemini-panel__cta${generating ? "is-generating" : ""}`}
            onClick={generate}
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
      <div className="lp-gemini-panel__grid">
        {photos.map((id, i) => (
          <button
            className={`lp-gemini-tile${activeTile === i ? "is-viewing" : ""}${shimmer ? "is-shimmer" : ""}`}
            key={id}
            onClick={() => setActiveTile(i)}
            type="button"
          >
            {/* biome-ignore lint/performance/noImgElement: external Unsplash URL */}
            <img
              alt=""
              loading="lazy"
              src={`https://images.unsplash.com/${id}?w=600&q=80&auto=format&fit=crop`}
            />
            <span
              className={`lp-gemini-tile__check${activeTile === i ? "is-selected" : ""}`}
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
            <span className="lp-gemini-tile__num">v{i + 1}</span>
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
    if (!r) return;
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
    <div className="lp-export-stage">
      <div className="lp-export-dialog">
        <div className="lp-export-dialog__header">
          <h4>Export Image</h4>
          <button
            aria-label="Close"
            className="lp-export-dialog__close"
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
        <div className="lp-export-dialog__body">
          <div className="lp-export-dialog__preview">
            <Image
              alt=""
              height={170}
              src="/landing/screenshot-editor.png"
              width={460}
            />
          </div>
          <div className="lp-export-dialog__field">
            <div className="lp-export-dialog__label">Format</div>
            <div className="lp-export-dialog__btn-row">
              {formats.map((f, i) =>
                f === null ? (
                  <div className="lp-export-divider" key={`div-${i}`} />
                ) : (
                  <button
                    className={`lp-export-btn${activeFormat === f.key ? "is-active" : ""}`}
                    key={f.key}
                    onClick={() => setActiveFormat(f.key)}
                    type="button"
                  >
                    {f.label}
                  </button>
                )
              )}
            </div>
          </div>
          <div className="lp-export-dialog__field">
            <div className="lp-export-dialog__label">Resolution</div>
            <div className="lp-export-select">
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
            <div className="lp-export-dialog__field">
              <div className="lp-export-dialog__label">
                <span>Quality</span>
                <span className="lp-export-quality-val">{quality}%</span>
              </div>
              <div
                className="lp-export-slider"
                onPointerDown={(e) => {
                  dragging.current = true;
                  updateQuality(e.clientX);
                  try {
                    sliderRef.current?.setPointerCapture(e.pointerId);
                  } catch (_) {}
                }}
                onPointerMove={(e) => {
                  if (dragging.current) updateQuality(e.clientX);
                }}
                onPointerUp={(e) => {
                  dragging.current = false;
                  try {
                    sliderRef.current?.releasePointerCapture(e.pointerId);
                  } catch (_) {}
                }}
                ref={sliderRef}
              >
                <div className="lp-export-slider__track">
                  <div
                    className="lp-export-slider__fill"
                    style={{ width: `${quality}%` }}
                  />
                </div>
                <button
                  aria-label="Quality"
                  className="lp-export-slider__thumb"
                  style={{ left: `${quality}%` }}
                  type="button"
                />
              </div>
            </div>
          )}
        </div>
        <div className="lp-export-dialog__footer">
          <button className="lp-export-dialog__ghost" type="button">
            Cancel
          </button>
          <button className="lp-export-dialog__primary" type="button">
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
    if (!(r && handleRef.current)) return;
    const pct = Math.max(
      0,
      Math.min(100, ((clientX - r.left) / r.width) * 100)
    );
    handleRef.current.style.left = `${pct}%`;
  }, []);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (dragging.current) update(e.clientX);
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
    <div className="lp-video-mock">
      <div className="lp-video-mock__player">
        {/* biome-ignore lint/performance/noImgElement: external Unsplash URL */}
        <img
          alt=""
          src="https://images.unsplash.com/photo-1485846234645-a62644f84728?w=900&q=80&auto=format&fit=crop"
        />
        <div className="lp-video-mock__overlay">
          <div className="lp-video-mock__badge">
            <span className="lp-video-mock__dot" />
            CAPTURED
          </div>
          <div className="lp-video-mock__time">00:02:14:08 · 3840×2160</div>
        </div>
      </div>
      <div
        className="lp-video-mock__timeline"
        onPointerDown={(e) => {
          if (e.target === handleRef.current) return;
          update(e.clientX);
          dragging.current = true;
          handleRef.current?.classList.add("is-dragging");
        }}
        ref={timelineRef}
      >
        <div className="lp-video-mock__frames">
          {Array.from({ length: 10 }).map((_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static frames
            <div className="lp-video-mock__frame" key={i} />
          ))}
        </div>
        <button
          aria-label="Scrub timeline"
          className="lp-video-mock__scrubber"
          onPointerCancel={() => {
            dragging.current = false;
            handleRef.current?.classList.remove("is-dragging");
          }}
          onPointerDown={(e) => {
            dragging.current = true;
            handleRef.current?.classList.add("is-dragging");
            try {
              handleRef.current?.setPointerCapture(e.pointerId);
            } catch (_) {}
            e.preventDefault();
          }}
          onPointerMove={(e) => {
            if (dragging.current) update(e.clientX);
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
      if (next.has(id)) next.delete(id);
      else next.add(id);
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
    <div className="lp-layers-mock__toolbar">
      <button aria-label="Add layer" type="button">
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
      </button>
      <button aria-label="Duplicate" type="button">
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
      </button>
      <button aria-label="Delete" type="button">
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
      </button>
      <button aria-label="Group" type="button">
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
      </button>
      <button
        aria-label="AI rename"
        style={{ marginLeft: "auto", color: "#2563eb" }}
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
    <div className="lp-layers-mock">
      {layers.map((layer) => (
        <div
          className={`lp-layers-mock__row${selectedRow === layer.id ? "is-selected" : ""}${hiddenRows.has(layer.id) ? "is-hidden" : ""}`}
          key={layer.id}
          onClick={() => setSelectedRow(layer.id)}
          onKeyDown={(e) => e.key === "Enter" && setSelectedRow(layer.id)}
          role="button"
          tabIndex={0}
        >
          <button
            aria-label="Toggle visibility"
            className="lp-layers-mock__eye"
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
            className="lp-layers-mock__lock"
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
            className="lp-layers-mock__thumb"
            style={{
              background: layer.thumb.bg,
              color: layer.thumb.color,
            }}
          >
            {layer.thumb.text}
          </div>
          <span className="lp-layers-mock__name">{layer.name}</span>
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
    <div className="lp-bento">
      <div className="lp-bento__card lp-bento__card--wide lp-reveal">
        <div className="lp-bento__copy">
          <div className="lp-tag">
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
          </div>
          <h3 className="lp-bento__title">Pull a frame from any video.</h3>
          <p className="lp-bento__body">
            Drag any MP4 or MOV in. Scrub with arrow keys. Extract at source
            resolution.
          </p>
        </div>
        <div className="lp-bento__visual">
          <VideoScrubber />
        </div>
      </div>

      <div className="lp-bento__card lp-reveal" data-delay="1">
        <div className="lp-bento__copy">
          <div className="lp-tag">
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
          </div>
          <h3 className="lp-bento__title">Layer panel that actually works.</h3>
          <p className="lp-bento__body">
            Toggle, lock, group, drag to reorder. Like Photoshop. Native speed.
          </p>
        </div>
        <div className="lp-bento__visual">
          <LayersMock />
        </div>
      </div>

      <div className="lp-bento__card lp-reveal" data-delay="2">
        <div className="lp-bento__copy">
          <div className="lp-tag">
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
          </div>
          <h3 className="lp-bento__title">100 thumbnails. One workspace.</h3>
          <p className="lp-bento__body">
            Search, sort, bulk export, 30-day trash. Built for people who ship
            daily.
          </p>
        </div>
        <div className="lp-bento__visual">
          <div className="lp-gallery-mock">
            {galleryPhotos.map((id) => (
              // biome-ignore lint/performance/noImgElement: external Unsplash URL
              <img
                alt=""
                key={id}
                src={`https://images.unsplash.com/${id}?w=300&q=70&auto=format&fit=crop`}
              />
            ))}
          </div>
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
    <section className="lp-section" id="how">
      <div className="lp-container">
        <div className="lp-features-intro lp-reveal">
          <div className="lp-eyebrow">
            <span className="lp-eyebrow__dot" /> How it works
          </div>
          <h2 className="lp-section-title">
            From video to thumbnail in three steps.
          </h2>
        </div>
        <div className="lp-steps">
          {steps.map((s, i) => (
            <div
              className="lp-step lp-reveal"
              data-delay={i.toString()}
              key={s.num}
            >
              <div className="lp-step__num">{s.num}</div>
              <div className="lp-step__icon">{s.icon}</div>
              <h3 className="lp-step__title">{s.title}</h3>
              <p className="lp-step__body">{s.body}</p>
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
    <section className="lp-section" id="byok">
      <div className="lp-container">
        <div className="lp-byok lp-reveal">
          <div>
            <div className="lp-eyebrow">
              <span className="lp-eyebrow__dot" /> Bring your own key
            </div>
            <h2 className="lp-byok__title">
              Why pay $20 a month
              <br />
              for AI you barely use?
            </h2>
            <p className="lp-byok__body">
              Most thumbnail tools bundle AI into a fat monthly fee. Backstage
              doesn&apos;t. Paste your Google AI Studio key once and you pay
              Google directly at API rates. Most creators spend under{" "}
              <strong style={{ color: "var(--lp-fg)" }}>$2 a month</strong> on
              Gemini even when generating dozens of variants per video.
            </p>
            <ul className="lp-byok__list">
              {[
                "Get a free key from aistudio.google.com in 30 seconds",
                "Key is stored encrypted in your OS keychain. Never leaves your machine.",
                "Swap to a different Gemini model anytime. You control the cost knob.",
                "No rate limits from us. No quota from us. We're not in the loop.",
              ].map((item) => (
                <li key={item}>
                  <CheckIcon />
                  {item}
                </li>
              ))}
            </ul>
            <div className="lp-byok__cost">
              <strong>Real math:</strong> Generating 30 thumbnail variations a
              month on Gemini 2.5 Flash Image costs about <strong>$1.20</strong>
              . After 2 months, Backstage&apos;s lifetime price plus your Gemini
              spend is still less than one month of Canva Pro.
            </div>
          </div>
          <div className="lp-byok__panel">
            <div className="lp-byok__panel-head">Settings · AI</div>
            <div className="lp-byok__field">
              <label>Google AI Studio API key</label>
              <div className="lp-byok__field-input">
                <svg
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
                <span className="lp-key">
                  AIza••••••••••••••••••••••••••8gQ
                </span>
                <span className="lp-saved">saved</span>
              </div>
            </div>
            <div className="lp-byok__field">
              <label>Model</label>
              <div className="lp-byok__field-input">
                <span style={{ color: "var(--lp-fg)", fontSize: 13 }}>
                  gemini-2.5-flash-image
                </span>
                <span style={{ marginLeft: "auto", color: "var(--lp-muted)" }}>
                  ▾
                </span>
              </div>
            </div>
            <div className="lp-byok__prompt">
              <div
                style={{
                  display: "flex",
                  gap: 6,
                  alignItems: "center",
                  marginBottom: 6,
                  fontSize: 11,
                  color: "var(--lp-muted)",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                }}
              >
                <svg
                  fill="none"
                  height="11"
                  stroke="var(--lp-blue)"
                  strokeWidth="2.5"
                  viewBox="0 0 24 24"
                  width="11"
                >
                  <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3z" />
                </svg>
                Generate
              </div>
              Cinematic shot of a retro CRT TV on a dark workshop bench, glowing
              magenta from inside, 16:9.
              <div className="lp-byok__gen-btn">Generate · 4 imgs</div>
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
    <section className="lp-section" id="privacy">
      <div className="lp-container">
        <div className="lp-reveal">
          <div className="lp-eyebrow">
            <span className="lp-eyebrow__dot" /> Local-first by default
          </div>
          <h2 className="lp-section-title">Your work stays on your machine.</h2>
          <p className="lp-section-sub">
            Backstage is a native desktop app, not a web wrapper. Your projects,
            your source files, your API keys. Never sent to a server we control.
          </p>
        </div>
        <div className="lp-privacy">
          {cards.map((c, i) => (
            <div
              className="lp-privacy__card lp-reveal"
              data-delay={i.toString()}
              key={c.title}
            >
              <div className="lp-privacy__icon">{c.icon}</div>
              <h3 className="lp-privacy__title">{c.title}</h3>
              <p className="lp-privacy__body">{c.body}</p>
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
  if (typeof cell === "string") return <>{cell}</>;
  if (cell.blue)
    return <strong style={{ color: "var(--lp-blue)" }}>{cell.text}</strong>;
  if (cell.yes)
    return (
      <>
        <span className="lp-compare-yes">●</span> {cell.text}
      </>
    );
  if (cell.no)
    return (
      <>
        <span className="lp-compare-no">○</span> {cell.text}
      </>
    );
  if (cell.maybe)
    return (
      <>
        <span className="lp-compare-maybe">◐</span> {cell.text}
      </>
    );
  return <>{cell.text}</>;
}

function CompareTable() {
  const rows: { label: string; us: CellData; rest: CellData[] }[] = [
    {
      label: "Yearly cost",
      us: { blue: true, text: "$20 once" },
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
    <section className="lp-section" id="compare">
      <div className="lp-container">
        <div className="lp-reveal">
          <div className="lp-eyebrow">
            <span className="lp-eyebrow__dot" /> The honest comparison
          </div>
          <h2 className="lp-section-title">
            Built for thumbnails.
            <br />
            <span className="lp-muted">
              Everything else is for something else.
            </span>
          </h2>
          <p className="lp-section-sub">
            Real comparison of the tools creators actually evaluate.
          </p>
        </div>
        <div className="lp-compare-table lp-reveal">
          <div className="lp-compare-table__row lp-compare-table__row--head">
            <div className="lp-compare-table__cell">&nbsp;</div>
            <div className="lp-compare-table__cell lp-compare-table__cell--us">
              <span className="lp-compare-brand lp-compare-brand--us">
                Backstage
              </span>
            </div>
            {["Photoshop", "Canva Pro", "Figma"].map((b) => (
              <div className="lp-compare-table__cell" key={b}>
                <span className="lp-compare-brand">{b}</span>
              </div>
            ))}
          </div>
          {rows.map((row) => (
            <div className="lp-compare-table__row" key={row.label}>
              <div className="lp-compare-table__cell lp-compare-table__cell--label">
                {row.label}
              </div>
              <div className="lp-compare-table__cell lp-compare-table__cell--us">
                <CellContent cell={row.us} />
              </div>
              {row.rest.map((cell, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: stable order
                <div className="lp-compare-table__cell" key={i}>
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
        "$20 lifetime in a world of $25 a month subscriptions feels almost suspicious. Then you realize it's open source and built by one person and it makes sense.",
    },
  ];

  return (
    <section className="lp-section" id="testimonials">
      <div className="lp-container">
        <div className="lp-features-intro lp-reveal">
          <div className="lp-eyebrow">
            <span className="lp-eyebrow__dot" /> What creators are saying
          </div>
          <h2 className="lp-section-title">
            Built in the open. Shipped to creators who notice.
          </h2>
        </div>
        <div className="lp-testimonials lp-reveal">
          {items.map((t) => (
            <div className="lp-testimonial" key={t.name}>
              <p className="lp-testimonial__quote">&ldquo;{t.quote}&rdquo;</p>
              <div className="lp-testimonial__author">
                <div className="lp-testimonial__avatar">{t.initials}</div>
                <div>
                  <div className="lp-testimonial__name">{t.name}</div>
                  <div className="lp-testimonial__handle">{t.handle}</div>
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
    <section className="lp-section">
      <div className="lp-container">
        <div className="lp-oss lp-reveal">
          <div className="lp-oss__inner">
            <div>
              <div className="lp-eyebrow">
                <span className="lp-eyebrow__dot" /> Open source
              </div>
              <h2 className="lp-oss__title">
                MIT-licensed and audited by anyone who wants to.
              </h2>
              <p className="lp-oss__body">
                Backstage&apos;s source is on GitHub. The desktop app, the
                editor, the AI integrations. Every line. The lifetime deal is
                for the prebuilt, signed, auto-updating binaries we ship and
                support. If you&apos;d rather compile it yourself, that&apos;s
                free.
              </p>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <a
                  className="lp-btn lp-btn--primary lp-btn--lg"
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
                  className="lp-btn lp-btn--ghost lp-btn--lg"
                  href={`${GITHUB_URL}#getting-started`}
                  rel="noopener"
                  target="_blank"
                >
                  Read the build docs
                </a>
              </div>
            </div>
            <div className="lp-oss__panel">
              {lines.map((l) => (
                <div className="lp-oss__panel-line" key={l.label}>
                  <SmallCheck />
                  <span>
                    <strong>{l.label}</strong> {l.value}
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

// ─── Roadmap ──────────────────────────────────────────────────────────
function Roadmap() {
  const cols = [
    {
      heading: "Shipped",
      pill: "v1.0 live",
      pillClass: "lp-roadmap__pill--live",
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
      pillClass: "lp-roadmap__pill--soon",
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
      pillClass: "",
      items: [
        { name: "YouTube channel sync" },
        { name: "Animated thumbnails (APNG)" },
        { name: "Plugin SDK" },
        { name: "Team workspaces" },
      ],
    },
  ];

  return (
    <section className="lp-section" id="roadmap">
      <div className="lp-container">
        <div className="lp-reveal">
          <div className="lp-eyebrow">
            <span className="lp-eyebrow__dot" /> Roadmap
          </div>
          <h2 className="lp-section-title">
            All updates included.
            <br />
            <span className="lp-muted">
              No &ldquo;Pro tier&rdquo; hiding behind a paywall.
            </span>
          </h2>
          <p className="lp-section-sub">
            Every feature below ships to your existing license at zero extra
            cost.
          </p>
        </div>
        <div className="lp-roadmap">
          {cols.map((col, ci) => (
            <div
              className="lp-roadmap__col lp-reveal"
              data-delay={ci.toString()}
              key={col.heading}
            >
              <div className="lp-roadmap__head">
                <div className="lp-roadmap__heading">{col.heading}</div>
                <div className={`lp-roadmap__pill ${col.pillClass}`}>
                  {col.pill}
                </div>
              </div>
              <div className="lp-roadmap__items">
                {col.items.map(
                  (item: {
                    name: string;
                    done?: boolean;
                    soon?: boolean;
                    meta?: string;
                  }) => (
                    <div
                      className={`lp-roadmap__item${item.done ? "lp-roadmap__item--live" : item.soon ? "lp-roadmap__item--soon" : ""}`}
                      key={item.name}
                    >
                      <svg
                        fill="none"
                        height="14"
                        stroke="currentColor"
                        strokeWidth={item.done ? 2.5 : 2}
                        viewBox="0 0 24 24"
                        width="14"
                      >
                        {item.done ? (
                          <polyline points="20 6 9 17 4 12" />
                        ) : item.soon ? (
                          <>
                            <circle cx="12" cy="12" r="9" />
                            <path d="M12 7v5l3 2" />
                          </>
                        ) : (
                          <circle cx="12" cy="12" r="9" />
                        )}
                      </svg>
                      <span className="lp-roadmap__item-name">{item.name}</span>
                      {item.meta && (
                        <span className="lp-roadmap__item-meta">
                          {item.meta}
                        </span>
                      )}
                    </div>
                  )
                )}
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
      viewBox="0 0 24 24"
      width="16"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );

  return (
    <section className="lp-section lp-section--spotlight" id="pricing">
      <div className="lp-container">
        <div className="lp-reveal">
          <div className="lp-eyebrow">
            <span className="lp-eyebrow__dot" /> Pricing
          </div>
          <h2 className="lp-section-title">
            Pay once. Use forever.
            <br />
            <span className="lp-muted">
              No subscriptions. No &ldquo;AI credits&rdquo;. No B.S.
            </span>
          </h2>
          <p className="lp-section-sub">
            A founders-week lifetime deal while we hit 1,000 customers.
            Locked-in pricing. Every future update is included.
          </p>
        </div>
        <div className="lp-pricing-wrap lp-reveal">
          <div className="lp-pricing">
            <div className="lp-pricing__copy">
              <div className="lp-pricing__deal">
                <span className="lp-pricing__deal-pill">FOUNDERS</span>
                <span>First 1,000 customers only</span>
              </div>
              <h3 className="lp-pricing__title">Backstage Lifetime</h3>
              <p className="lp-pricing__sub">
                One payment. Every feature. Every update. Every platform.
                Forever.
              </p>
              <ul className="lp-pricing__includes">
                {[
                  "Layer editor, AI tools, video extractor, carousel",
                  "Mac, Windows, and Linux signed binaries",
                  "All future updates (template library, A/B analyzer, more)",
                  "Priority email support, direct from the dev",
                  "30-day refund. No questions asked.",
                  "Use on every device you own",
                ].map((item) => (
                  <li key={item}>
                    <CheckIcon />
                    {item}
                  </li>
                ))}
              </ul>
              <div className="lp-scarcity">
                <svg
                  fill="none"
                  height="14"
                  stroke="var(--lp-blue)"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                  width="14"
                >
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 7v5l3 2" />
                </svg>
                <span>Founders-week pricing</span>
                <div className="lp-scarcity__bar">
                  <div className="lp-scarcity__bar-fill" />
                </div>
                <span className="lp-scarcity__count">384/1000 sold</span>
              </div>
            </div>
            <div className="lp-pricing__card">
              <div className="lp-pricing__card-label">One-time payment</div>
              <div className="lp-pricing__price">
                <span className="lp-pricing__price-amount">$20</span>
                <span className="lp-pricing__price-anchor">$99</span>
              </div>
              <div className="lp-pricing__price-unit">USD · Tax included</div>
              <p className="lp-pricing__terms">
                Billed once via Polar. No auto-renewal. No card on file.
              </p>
              <a className="lp-pricing__cta" href={CHECKOUT_URL}>
                Buy Backstage Lifetime
                <svg
                  fill="none"
                  height="18"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2.5"
                  viewBox="0 0 24 24"
                  width="18"
                >
                  <line x1="5" x2="19" y1="12" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </a>
              <p className="lp-pricing__fine">
                Secure checkout via Polar. Instant license delivery.
              </p>
              <div className="lp-pricing__platforms">
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

  const PlusIcon = () => (
    <span className="lp-faq__q-icon">
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
  );

  return (
    <section className="lp-section" id="faq">
      <div className="lp-container">
        <div className="lp-features-intro lp-reveal">
          <div className="lp-eyebrow">
            <span className="lp-eyebrow__dot" /> FAQ
          </div>
          <h2 className="lp-section-title">The honest answers.</h2>
        </div>
        <div className="lp-faq lp-reveal">
          {items.map((item) => (
            <details className="lp-faq__item" key={item.q} open={item.open}>
              <summary className="lp-faq__q">
                {item.q}
                <PlusIcon />
              </summary>
              <div className="lp-faq__a">{item.a}</div>
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
    <section className="lp-section">
      <div className="lp-container">
        <div className="lp-cta-strip lp-reveal">
          <div
            className="lp-eyebrow"
            style={{ justifyContent: "center", display: "inline-flex" }}
          >
            <span className="lp-eyebrow__dot" /> Last call
          </div>
          <h2 className="lp-cta-strip__title">
            Ship better thumbnails this weekend.
          </h2>
          <p className="lp-cta-strip__sub">
            Pay $20 once. Use it for the rest of your career.
          </p>
          <div className="lp-cta-strip__ctas">
            <a className="lp-btn lp-btn--cyan lp-btn--xl" href={CHECKOUT_URL}>
              Get lifetime · $20
            </a>
            <a
              className="lp-btn lp-btn--ghost lp-btn--xl"
              href={GITHUB_URL}
              rel="noopener"
              target="_blank"
            >
              View source on GitHub
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Footer ───────────────────────────────────────────────────────────
function Footer() {
  return (
    <footer className="lp-footer">
      <div className="lp-container">
        <div className="lp-footer__grid">
          <div>
            <div className="lp-footer__brand">
              <GalleryThumbnails
                aria-hidden="true"
                size={18}
                strokeWidth={2.5}
              />
              Backstage
            </div>
            <p className="lp-footer__tag">
              The open-source YouTube thumbnail studio. Built by{" "}
              <a href="https://amajor.ai" style={{ color: "var(--lp-fg)" }}>
                A Major
              </a>
              .
            </p>
          </div>
          <div>
            <div className="lp-footer__col-head">Product</div>
            {(
              [
                ["#features", "Features"],
                ["#how", "How it works"],
                ["#pricing", "Pricing"],
                ["#roadmap", "Roadmap"],
              ] as const
            ).map(([href, label]) => (
              <a className="lp-footer__link" href={href} key={href}>
                {label}
              </a>
            ))}
          </div>
          <div>
            <div className="lp-footer__col-head">Open source</div>
            {[
              [GITHUB_URL, "GitHub"],
              [`${GITHUB_URL}/releases`, "Releases"],
              [`${GITHUB_URL}/issues`, "Issues"],
              [`${GITHUB_URL}/blob/master/LICENSE`, "License"],
            ].map(([href, label]) => (
              <a
                className="lp-footer__link"
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
            <div className="lp-footer__col-head">Company</div>
            <a
              className="lp-footer__link"
              href="https://amajor.ai"
              rel="noopener"
              target="_blank"
            >
              A Major
            </a>
            <a className="lp-footer__link" href="mailto:hello@amajor.ai">
              Contact
            </a>
            <a
              className="lp-footer__link"
              href="https://twitter.com/amajor_ai"
              rel="noopener"
              target="_blank"
            >
              X / Twitter
            </a>
            <a className="lp-footer__link" href="#faq">
              FAQ
            </a>
          </div>
        </div>
        <div className="lp-footer__bottom">
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
  const { stars, version } = useGitHubData();

  return (
    <div className="lp">
      <Nav stars={stars} />
      <Hero version={version} />
      <Stats />

      {/* Background removal */}
      <section className="lp-section" id="features">
        <div className="lp-container">
          <div className="lp-features-intro lp-reveal">
            <div className="lp-eyebrow">
              <span className="lp-eyebrow__dot" /> Built for thumbnails
            </div>
            <h2 className="lp-section-title">
              Every tool you need.
              <br />
              <span className="lp-muted">Nothing you don&apos;t.</span>
            </h2>
            <p className="lp-section-sub">
              A purpose-built editor for YouTube thumbnails. Designed around how
              creators actually iterate on a hook.
            </p>
          </div>
          <div className="lp-feature-showcase lp-reveal">
            <div className="lp-feature-showcase__header">
              <div className="lp-tag">
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
              </div>
              <h3 className="lp-feature-showcase__title">
                One tap. Background gone. Runs on your machine.
              </h3>
              <p className="lp-feature-showcase__body">
                Drag the handle to see it for yourself. WebAssembly inference on
                every machine, every OS. Nothing uploads anywhere.
              </p>
            </div>
            <CompareSlider />
            <ul className="lp-feature-showcase__list">
              {[
                "Runs offline in WebAssembly. No upload. No usage cap.",
                "Open-source build ships with BRIA RMBG-1.4 for sharper cutouts.",
                "Queue dozens at once from the gallery.",
                "Non-destructive. Your original layer is never touched.",
              ].map((item) => (
                <li key={item}>
                  <span className="lp-dot" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Gemini generation */}
      <section className="lp-section">
        <div className="lp-container">
          <div className="lp-feature-showcase lp-reveal">
            <div className="lp-feature-showcase__header">
              <div className="lp-tag">
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
              </div>
              <h3 className="lp-feature-showcase__title">
                AI at API rates. Not SaaS rates.
              </h3>
              <p className="lp-feature-showcase__body">
                Bring your own Google AI Studio key. Pay Google directly at{" "}
                <strong>~$0.04 per image</strong>. No middle-man markup. Type a
                prompt below to see it in action.
              </p>
            </div>
            <GeminiPanel />
          </div>
        </div>
      </section>

      {/* Export dialog */}
      <section className="lp-section">
        <div className="lp-container">
          <div className="lp-feature-showcase lp-reveal">
            <div className="lp-feature-showcase__header">
              <div className="lp-tag">
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
              </div>
              <h3 className="lp-feature-showcase__title">
                Every format. Every platform. One dialog.
              </h3>
              <p className="lp-feature-showcase__body">
                PNG, JPEG, WebP, animated GIF and MP4. YouTube, Shorts, X,
                custom sizes. Drag the quality slider below.
              </p>
            </div>
            <ExportDialog />
          </div>
        </div>
      </section>

      {/* Bento */}
      <section className="lp-section">
        <div className="lp-container">
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
