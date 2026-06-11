"use client";

import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import * as sounds from "@/lib/sounds";
import { cn } from "@/lib/utils";
import { Counter, Magnetic, Reveal, SplitReveal } from "./motion-primitives";
import { CHECKOUT_URL, Eyebrow, GITHUB_URL, SectionTitle } from "./support";
import { EmberField } from "./three-stage";

// ─── Pricing ──────────────────────────────────────────────────────────
const PRICING_FEATURES = [
  "Layer editor, AI tools, video extractor, carousel",
  "Mac, Windows, and Linux signed binaries",
  "1 year of updates (template library, A/B analyzer, more)",
  "Priority email support, direct from the dev",
  "Use on every device you own",
];

function CheckIcon() {
  return (
    <svg
      aria-hidden="true"
      className="mt-0.5 shrink-0 text-[var(--stage-red)]"
      fill="none"
      height="15"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2.5"
      viewBox="0 0 24 24"
      width="15"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

export function Pricing() {
  return (
    <section className="py-24 md:py-36" id="pricing">
      <div className="mx-auto max-w-[1280px] px-6">
        <div className="text-center">
          <div className="flex justify-center">
            <Eyebrow>One-time payment</Eyebrow>
          </div>
          <SectionTitle className="text-center">
            One ticket. Every show.{" "}
            <span className="text-[var(--stage-red)]">Forever.</span>
          </SectionTitle>
          <Reveal className="mx-auto mt-5 max-w-[520px]" delay={0.15}>
            <p className="text-base text-white/50 md:text-lg">
              Early bird pricing locks in your rate forever. The price goes up
              every 100 customers — next stop $35 on May 25.
            </p>
          </Reveal>
        </div>

        <Reveal className="mx-auto mt-14 max-w-3xl" delay={0.1}>
          <div className="stage-glow-border rounded-3xl p-px">
            <div className="grid overflow-hidden rounded-[calc(1.5rem-1px)] bg-[#0b0b0e] md:grid-cols-[1fr_300px]">
              <div className="flex flex-col gap-5 p-8">
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-[var(--stage-red)] px-2.5 py-1 font-bold text-[11px] text-white">
                    EARLY BIRD
                  </span>
                  <span className="text-sm text-white/45">
                    Price goes up every 100 users
                  </span>
                </div>
                <div>
                  <h3 className="mb-1 font-display text-2xl text-white uppercase tracking-wide">
                    Backstage Lifetime
                  </h3>
                  <p className="text-sm text-white/45">
                    One payment. Every feature. Every platform. Yours forever,
                    with 1 year of updates included.
                  </p>
                </div>
                <ul className="flex flex-col gap-2.5">
                  {PRICING_FEATURES.map((item) => (
                    <li
                      className="flex items-start gap-2.5 text-sm text-white/70"
                      key={item}
                    >
                      <CheckIcon />
                      {item}
                    </li>
                  ))}
                </ul>
                <div className="mt-2 flex items-center gap-3">
                  <span className="whitespace-nowrap font-mono text-[11px] text-white/40 uppercase tracking-wide">
                    384/1000 sold
                  </span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[var(--stage-red)] to-[#ff7a3d]"
                      style={{ width: "38.4%" }}
                    />
                  </div>
                  <span className="whitespace-nowrap font-mono text-[11px] text-white/40 uppercase tracking-wide">
                    expires May 25
                  </span>
                </div>
              </div>
              <div className="flex flex-col gap-4 border-white/5 bg-white/[0.02] p-8 md:border-l">
                <div className="font-mono text-[11px] text-white/35 uppercase tracking-[0.24em]">
                  Pay once
                </div>
                <div className="flex items-end gap-2.5">
                  <Counter
                    className="font-display text-7xl text-white"
                    duration={1.2}
                    from={262}
                    prefix="$"
                    to={29}
                  />
                  <span className="mb-2 text-white/30 text-xl line-through">
                    $59
                  </span>
                </div>
                <p className="text-white/40 text-xs">
                  USD, tax included. Billed once via Polar. No auto-renewal. No
                  card on file.
                </p>
                <a
                  className="stage-button stage-button-primary w-full justify-center"
                  data-polar-checkout
                  data-polar-checkout-theme="dark"
                  href={CHECKOUT_URL}
                  onClick={sounds.click}
                >
                  Buy Backstage Lifetime
                </a>
                <p className="text-center text-[11px] text-white/35">
                  Secure checkout via Polar. Instant license delivery.
                  <br />
                  30-day no-questions refunds.
                </p>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

// ─── FAQ ──────────────────────────────────────────────────────────────
const FAQ_ITEMS = [
  {
    q: 'What does "lifetime" actually mean?',
    a: 'You hire Backstage once for $29 and it works on your machine forever — no subscription, no expiry, no "AI credit" meter. Your purchase includes 1 year of updates from the day you buy. After that year, your app keeps running exactly as it was; you just won\'t receive new versions unless you renew. If we shut down tomorrow, your designer keeps working because it lives on your machine, not ours.',
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

export function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section
      className="border-white/5 border-t bg-[#08080a] py-24 md:py-36"
      id="faq"
    >
      <div className="mx-auto max-w-[1280px] px-6">
        <div className="grid gap-12 md:grid-cols-[1fr_1.4fr]">
          <div>
            <Eyebrow>FAQ</Eyebrow>
            <SectionTitle>
              Straight <span className="text-white/35">answers.</span>
            </SectionTitle>
          </div>
          <Reveal delay={0.1}>
            <div className="flex flex-col">
              {FAQ_ITEMS.map((item, i) => {
                const open = openIndex === i;
                return (
                  <div
                    className="border-white/8 border-b first:border-t"
                    key={item.q}
                  >
                    <button
                      aria-expanded={open}
                      className="flex w-full cursor-pointer items-center justify-between gap-4 py-5 text-left"
                      onClick={() => {
                        sounds.click();
                        setOpenIndex(open ? null : i);
                      }}
                      type="button"
                    >
                      <span
                        className={cn(
                          "font-medium text-base transition-colors",
                          open ? "text-white" : "text-white/65"
                        )}
                      >
                        {item.q}
                      </span>
                      <motion.span
                        animate={{ rotate: open ? 45 : 0 }}
                        className={cn(
                          "shrink-0 text-lg",
                          open ? "text-[var(--stage-red)]" : "text-white/40"
                        )}
                        transition={{ duration: 0.25 }}
                      >
                        +
                      </motion.span>
                    </button>
                    <AnimatePresence initial={false}>
                      {open && (
                        <motion.div
                          animate={{ height: "auto", opacity: 1 }}
                          className="overflow-hidden"
                          exit={{ height: 0, opacity: 0 }}
                          initial={{ height: 0, opacity: 0 }}
                          transition={{
                            duration: 0.35,
                            ease: [0.22, 1, 0.36, 1],
                          }}
                        >
                          <p className="pb-5 text-sm text-white/50 leading-relaxed">
                            {item.a}
                          </p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

// ─── Final CTA ────────────────────────────────────────────────────────
export function FinalCta() {
  return (
    <section className="relative overflow-hidden py-32 md:py-44">
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(60% 70% at 50% 100%, rgb(255 51 88 / 0.16), transparent 70%)",
        }}
      />
      <EmberField />
      <div className="relative z-10 mx-auto flex max-w-[1280px] flex-col items-center px-6 text-center">
        <p className="mb-6 font-mono text-[11px] text-white/40 uppercase tracking-[0.32em]">
          Last call
        </p>
        <SplitReveal
          as="h2"
          className="font-display text-[clamp(3rem,9vw,7.5rem)] text-white uppercase leading-[0.88] tracking-tight"
          mode="chars"
          stagger={0.02}
        >
          Hire your designer{" "}
          <em className="font-serif-accent text-[var(--stage-red)] normal-case italic">
            tonight.
          </em>
        </SplitReveal>
        <Reveal className="mt-6" delay={0.3}>
          <p className="text-base text-white/50 md:text-lg">
            Pay $29 once. No monthly salary, no creative briefs, no Slack DMs.
          </p>
        </Reveal>
        <Reveal className="mt-9" delay={0.45}>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Magnetic>
              <a
                className="stage-button stage-button-primary stage-button-lg"
                data-polar-checkout
                data-polar-checkout-theme="dark"
                href={CHECKOUT_URL}
                onClick={sounds.click}
              >
                Get lifetime access · $29
              </a>
            </Magnetic>
            <Magnetic>
              <a
                className="stage-button stage-button-ghost"
                href={GITHUB_URL}
                onClick={sounds.click}
                rel="noopener"
                target="_blank"
              >
                View source on GitHub
              </a>
            </Magnetic>
          </div>
          <p className="mt-4 font-mono text-[11px] text-white/35 uppercase tracking-[0.2em]">
            30-day refunds · No card on file · Yours forever
          </p>
        </Reveal>
      </div>
    </section>
  );
}
