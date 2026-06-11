"use client";

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
import { useCallback, useEffect, useRef, useState } from "react";
import * as sounds from "@/lib/sounds";
import { cn } from "@/lib/utils";
import { SplitReveal } from "./motion-primitives";

export const CHECKOUT_URL =
  process.env.NEXT_PUBLIC_POLAR_CHECKOUT_URL ??
  "https://sandbox-api.polar.sh/v1/checkout-links/polar_cl_aGUui9yb3Gb4ebQMX2FFj13h4kBHGKrVW29fM0Nqp2m/redirect";
export const GITHUB_URL = "https://github.com/amajorai/backstage";

const TRAILING_ZERO_RE = /\.0$/;

function formatStars(n: number): string {
  if (n >= 1000) {
    return `${(n / 1000).toFixed(1).replace(TRAILING_ZERO_RE, "")}k`;
  }
  return String(n);
}

export function useGitHubData() {
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

export function GitHubIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      aria-hidden="true"
      fill="currentColor"
      height={size}
      viewBox="0 0 24 24"
      width={size}
    >
      <path d="M12 .5A12 12 0 0 0 0 12.5a12 12 0 0 0 8.2 11.4c.6.1.8-.3.8-.6v-2.1c-3.3.7-4-1.6-4-1.6-.6-1.4-1.4-1.8-1.4-1.8-1.1-.8.1-.8.1-.8 1.3.1 1.9 1.3 1.9 1.3 1.1 1.9 2.9 1.4 3.7 1 .1-.8.4-1.4.7-1.7-2.7-.3-5.5-1.3-5.5-6 0-1.3.5-2.4 1.2-3.2-.1-.3-.5-1.5.1-3.2 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0c2.3-1.5 3.3-1.2 3.3-1.2.7 1.7.2 2.9.1 3.2.8.8 1.2 1.9 1.2 3.2 0 4.7-2.8 5.7-5.5 6 .4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A12 12 0 0 0 24 12.5 12 12 0 0 0 12 .5Z" />
    </svg>
  );
}

// ─── Film grain overlay ───────────────────────────────────────────────
export function Grain() {
  return <div aria-hidden="true" className="stage-grain" />;
}

// ─── Section heading kit ──────────────────────────────────────────────
export function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-5 flex items-center gap-3 font-mono text-[11px] text-white/40 uppercase tracking-[0.28em]">
      <span className="inline-block h-px w-8 bg-[var(--stage-red)]" />
      {children}
    </div>
  );
}

export function SectionTitle({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <SplitReveal
      as="h2"
      className={cn(
        "font-display text-[clamp(2.6rem,7vw,5.5rem)] text-white uppercase leading-[0.92] tracking-tight",
        className
      )}
      mode="words"
    >
      {children}
    </SplitReveal>
  );
}

// ─── Animated success check (ported) ─────────────────────────────────
function SuccessCheck() {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) {
      return;
    }
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
      <svg
        aria-hidden="true"
        fill="none"
        height="48"
        viewBox="0 0 24 24"
        width="48"
      >
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

// ─── Download email dialog (ported) ──────────────────────────────────
export function DownloadEmailDialog({
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
    if (open) {
      sounds.dialogOpen();
    } else {
      sounds.dialogClose();
    }
  }, [open]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!(name.trim() && email.trim())) {
        return;
      }
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

// ─── Nav ──────────────────────────────────────────────────────────────
export function Nav({ stars }: { stars: string }) {
  const [scrolled, setScrolled] = useState(false);
  const [showDownload, setShowDownload] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const navLinks = [
    ["#acts", "The studio"],
    ["#receipts", "Receipts"],
    ["#pricing", "Pricing"],
    ["#faq", "FAQ"],
  ] as const;

  return (
    <>
      <nav className="fixed top-0 right-0 left-0 z-50 hidden justify-center py-3.5 md:flex">
        <div
          className={cn(
            "flex items-center gap-3 transition-all duration-300",
            scrolled
              ? "h-11 w-full max-w-[820px] rounded-full border border-white/10 bg-black/60 px-4 [backdrop-filter:blur(20px)_saturate(140%)]"
              : "h-12 w-full max-w-[1280px] bg-transparent px-6"
          )}
        >
          <a
            className="flex items-center gap-2 font-medium text-sm text-white no-underline"
            href="/"
          >
            <GalleryThumbnails
              aria-hidden="true"
              className="fill-white text-white"
              size={18}
              strokeWidth={3}
            />
            Backstage
          </a>
          <div className="ml-1 flex items-center gap-0.5">
            {navLinks.map(([href, label]) => (
              <a
                className="rounded-full px-3 py-1.5 text-sm text-white/50 no-underline transition-colors hover:text-white"
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
            className="flex items-center gap-1.5 text-sm text-white/50 no-underline transition-colors hover:text-white"
            href={GITHUB_URL}
            onClick={sounds.click}
            rel="noopener"
            target="_blank"
          >
            <GitHubIcon />
            <span>{stars}</span>
          </a>
          <button
            className="stage-button stage-button-sm"
            onClick={() => {
              sounds.download();
              setShowDownload(true);
            }}
            type="button"
          >
            Download
          </button>
        </div>
      </nav>

      <DownloadEmailDialog onOpenChange={setShowDownload} open={showDownload} />

      <nav
        className="fixed right-0 bottom-0 left-0 z-50 md:hidden"
        style={{
          background:
            "linear-gradient(to top, rgb(5 5 5 / 0.95) 0%, rgb(5 5 5 / 0.6) 70%, transparent 100%)",
          backdropFilter: "blur(16px) saturate(140%)",
          WebkitBackdropFilter: "blur(16px) saturate(140%)",
        }}
      >
        <div className="flex items-center justify-around px-2 pt-3 pb-5">
          <a
            className="font-medium text-[10px] text-white/60 tracking-wide no-underline"
            href="#acts"
            onClick={sounds.click}
          >
            Studio
          </a>
          <a
            className="font-medium text-[10px] text-white/60 tracking-wide no-underline"
            href="#receipts"
            onClick={sounds.click}
          >
            Receipts
          </a>
          <a
            className="flex items-center gap-1.5 font-semibold text-sm text-white no-underline"
            href="/"
            onClick={sounds.click}
          >
            <GalleryThumbnails
              aria-hidden="true"
              className="fill-white text-white"
              size={20}
              strokeWidth={3}
            />
            <span>Backstage</span>
          </a>
          <a
            className="font-medium text-[10px] text-white/60 tracking-wide no-underline"
            href="#pricing"
            onClick={sounds.click}
          >
            Pricing
          </a>
          <a
            className="flex items-center gap-1 font-medium text-[10px] text-white/60 tracking-wide no-underline"
            href={GITHUB_URL}
            onClick={sounds.click}
            rel="noopener"
            target="_blank"
          >
            <GitHubIcon size={12} />
            {stars}
          </a>
        </div>
      </nav>
    </>
  );
}

// ─── Footer ───────────────────────────────────────────────────────────
export function Footer() {
  const productLinks = [
    ["#acts", "The studio"],
    ["#receipts", "Receipts"],
    ["#pricing", "Pricing"],
    ["#faq", "FAQ"],
  ] as const;
  const ossLinks = [
    [GITHUB_URL, "GitHub"],
    [`${GITHUB_URL}/releases`, "Releases"],
    [`${GITHUB_URL}/issues`, "Issues"],
    [`${GITHUB_URL}/blob/master/LICENSE`, "License"],
  ] as const;

  return (
    <footer className="border-white/5 border-t py-16">
      <div className="mx-auto max-w-[1280px] px-6">
        <div className="mb-12 grid gap-10 md:grid-cols-4">
          <div>
            <div className="mb-3 flex items-center gap-2 font-medium text-sm text-white">
              <GalleryThumbnails
                aria-hidden="true"
                className="fill-white text-white"
                size={18}
                strokeWidth={2.5}
              />
              Backstage
            </div>
            <p className="text-sm text-white/40">
              The thumbnail studio for small creators who want to look like
              bigger ones. Built by{" "}
              <a
                className="text-white/70 no-underline transition-colors hover:text-white"
                href="https://amajor.ai"
                onClick={sounds.click}
              >
                A Major
              </a>
              .
            </p>
          </div>
          <div>
            <div className="mb-4 font-mono text-[11px] text-white/30 uppercase tracking-[0.24em]">
              Product
            </div>
            {productLinks.map(([href, label]) => (
              <a
                className="mb-2 block text-sm text-white/40 no-underline transition-colors hover:text-white"
                href={href}
                key={href}
                onClick={sounds.click}
              >
                {label}
              </a>
            ))}
          </div>
          <div>
            <div className="mb-4 font-mono text-[11px] text-white/30 uppercase tracking-[0.24em]">
              Open source
            </div>
            {ossLinks.map(([href, label]) => (
              <a
                className="mb-2 block text-sm text-white/40 no-underline transition-colors hover:text-white"
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
            <div className="mb-4 font-mono text-[11px] text-white/30 uppercase tracking-[0.24em]">
              Company
            </div>
            <a
              className="mb-2 block text-sm text-white/40 no-underline transition-colors hover:text-white"
              href="https://amajor.ai"
              onClick={sounds.click}
              rel="noopener"
              target="_blank"
            >
              A Major
            </a>
            <a
              className="mb-2 block text-sm text-white/40 no-underline transition-colors hover:text-white"
              href="mailto:hello@amajor.ai"
              onClick={sounds.click}
            >
              Contact
            </a>
            <a
              className="mb-2 block text-sm text-white/40 no-underline transition-colors hover:text-white"
              href="https://twitter.com/amajor_ai"
              onClick={sounds.click}
              rel="noopener"
              target="_blank"
            >
              X / Twitter
            </a>
          </div>
        </div>
        <div className="flex items-center justify-between pt-6 font-mono text-[11px] text-white/25">
          <div>© 2026 A Major. All rights reserved.</div>
          <div>backstage.amajor.ai</div>
        </div>
      </div>
    </footer>
  );
}
