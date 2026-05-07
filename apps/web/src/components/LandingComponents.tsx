import {
  ArrowRight,
  Check,
  Download,
  Image as ImageIcon,
  Layers,
  Zap,
} from "lucide-react";
import Link from "next/link";

export function HeroSection() {
  return (
    <section className="relative flex min-h-[80vh] flex-col items-center justify-center overflow-hidden px-4 text-center">
      <div className="relative z-10 mx-auto max-w-4xl animate-fade-in-up space-y-8">
        <div className="flex items-center justify-center">
          <span className="rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-sm text-white/70 backdrop-blur-sm">
            v1.0 is now live
          </span>
        </div>
        <h1 className="font-bold text-5xl text-white tracking-tighter sm:text-7xl md:text-8xl">
          Thumbnails that <br />
          <span className="bg-gradient-to-r from-neutral-200 to-neutral-500 bg-clip-text text-transparent">
            actually click.
          </span>
        </h1>
        <p className="mx-auto max-w-2xl text-lg text-neutral-400 md:text-xl">
          The professional thumbnail editor designed for creators who care about
          aesthetics. No subscriptions. No AI slop. Just pure design power.
        </p>
        <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link
            className="group inline-flex h-12 items-center justify-center gap-2 rounded-full bg-white px-8 font-medium text-base text-black transition-all hover:scale-105 hover:bg-neutral-200"
            href="/dashboard"
          >
            Get Started{" "}
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Link>
          <Link
            className="inline-flex h-12 items-center justify-center rounded-full border border-white/10 px-8 font-medium text-base text-white transition-colors hover:bg-white/5"
            href="#pricing"
          >
            View Pricing
          </Link>
        </div>
      </div>

      {/* Background Gradients */}
      <div className="pointer-events-none absolute -top-40 left-1/2 h-[500px] w-[800px] -translate-x-1/2 bg-white/5 opacity-30 blur-[120px]" />
      <div className="pointer-events-none absolute bottom-0 left-0 h-[300px] w-[300px] bg-purple-500/10 opacity-20 blur-[100px]" />
      <div className="pointer-events-none absolute top-1/2 right-0 h-[300px] w-[300px] bg-blue-500/10 opacity-20 blur-[100px]" />
    </section>
  );
}

export function FeatureGrid() {
  const features = [
    {
      title: "Smart Layers",
      description: "Non-destructive editing with intuitive layer management.",
      icon: Layers,
    },
    {
      title: "Instant Export",
      description: "Optimized formats for YouTube, Twitter, and more.",
      icon: Download,
    },
    {
      title: "Fast Workflow",
      description: "Keyboard shortcuts and tools built for speed.",
      icon: Zap,
    },
    {
      title: "Asset Library",
      description: "Organize your assets and reuse them across projects.",
      icon: ImageIcon,
    },
  ];

  return (
    <section className="px-4 py-24">
      <div className="container mx-auto max-w-6xl">
        <div className="mb-16 md:text-center">
          <h2 className="font-bold text-3xl text-white tracking-tight sm:text-4xl">
            Everything you need.{" "}
            <span className="text-neutral-500">Nothing you don't.</span>
          </h2>
        </div>
        <ScrollFadeEffect
          className="md:overflow-x-visible md:[mask-image:none]"
          orientation="horizontal"
        >
          <div className="flex gap-8 md:grid md:grid-cols-2 lg:grid-cols-4">
            {features.map((feature) => (
              <div
                className="group relative w-72 shrink-0 overflow-hidden rounded-2xl border border-white/5 bg-white/[0.02] p-8 transition-colors hover:border-white/10 hover:bg-white/[0.04] md:w-auto md:shrink"
                key={feature.title}
              >
                <div className="mb-4 inline-flex items-center justify-center rounded-lg bg-white/5 p-3 text-white">
                  <feature.icon className="h-6 w-6" />
                </div>
                <h3 className="mb-2 font-semibold text-white text-xl">
                  {feature.title}
                </h3>
                <p className="text-neutral-400">{feature.description}</p>
              </div>
            ))}
          </div>
        </ScrollFadeEffect>
      </div>
    </section>
  );
}

export function AppShowcase() {
  return (
    <section className="overflow-hidden px-4 py-24">
      <div className="container mx-auto max-w-7xl">
        <div className="relative mx-auto rounded-xl border border-white/10 bg-neutral-900/50 p-2 shadow-2xl backdrop-blur-sm lg:rounded-2xl lg:p-4">
          <div className="relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-lg border border-white/5 bg-black/50">
            <div className="absolute inset-0 bg-gradient-to-br from-neutral-800/10 to-neutral-900/10" />
            <p className="font-mono text-neutral-600 text-sm">
              [ App Screenshot Placeholder ]
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

export function PricingCard() {
  return (
    <section className="px-4 py-24" id="pricing">
      <div className="container mx-auto max-w-4xl">
        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-neutral-900/30 p-8 backdrop-blur-sm md:p-16">
          <div className="grid gap-12 md:grid-cols-2 md:items-center">
            <div className="space-y-6">
              <h2 className="font-bold text-3xl text-white tracking-tight sm:text-4xl">
                Simple, transparent pricing
              </h2>
              <p className="text-lg text-neutral-400">
                Pay once, keep it forever. Includes all future updates and
                features.
              </p>
              <div className="space-y-4">
                {[
                  "Unlimited projects",
                  "All premium assets",
                  "Priority support",
                  "Lifetime updates",
                ].map((item) => (
                  <div className="flex items-center gap-3" key={item}>
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-black">
                      <Check className="h-3 w-3" />
                    </div>
                    <span className="text-neutral-300">{item}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="relative flex flex-col items-center justify-center rounded-2xl bg-white p-8 text-center text-black">
              <div className="mb-2 font-medium text-neutral-500 text-sm uppercase tracking-wide">
                One-time payment
              </div>
              <div className="mb-6 flex items-baseline justify-center gap-1">
                <span className="font-bold text-5xl tracking-tight">$10</span>
                <span className="text-neutral-500">USD</span>
              </div>
              <button className="w-full rounded-xl bg-black px-4 py-3 font-semibold text-base text-white transition-transform hover:scale-105 active:scale-95">
                Get Access Now
              </button>
              <p className="mt-4 text-neutral-500 text-xs">
                Secure payment via Stripe. 30-day money-back guarantee.
              </p>
            </div>
          </div>

          <div className="pointer-events-none absolute -top-40 -right-40 h-[500px] w-[500px] bg-white/5 opacity-20 blur-[100px]" />
        </div>
      </div>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="border-white/5 border-t px-4 py-12 text-center">
      <p className="text-neutral-500 text-sm">
        &copy; {new Date().getFullYear()} Backstage. All rights reserved.
      </p>
    </footer>
  );
}
