import { Button } from "@repo/ui/button";
import { Input } from "@repo/ui/input";
import { Toaster } from "@repo/ui/sonner";
import { openUrl } from "@tauri-apps/plugin-opener";
import {
  ArrowLeft,
  Check,
  DoorOpen,
  GalleryThumbnails,
  Key,
  Loader2,
  TrendingUp,
} from "lucide-react";
import { useCallback, useState } from "react";
import { sileo } from "sileo";
import { CustomerPortalDialog } from "@/components/CustomerPortalDialog";
import {
  POLAR_EMBED_CHECKOUT_URL,
  usePolarCheckout,
} from "@/hooks/use-polar-checkout";
import { POLAR_CONFIG } from "@/lib/polar-config";
import * as sounds from "@/lib/sounds";
import { useLicenseStore } from "@/stores/use-license-store";

const BENEFITS = [
  {
    title: "One-time payment",
    desc: "No subscription. Pay once, own it forever.",
  },
  {
    title: "1 year of updates included",
    desc: "Every new feature and improvement for a full year.",
  },
  {
    title: "30-day money back guarantee",
    desc: "Not happy? Get a full refund, no questions asked.",
  },
];

export function LicenseActivation({ onBack }: { onBack?: () => void }) {
  const [view, setView] = useState<"pricing" | "activation">("pricing");
  const [licenseKey, setLicenseKey] = useState("");
  const [conflictDialogOpen, setConflictDialogOpen] = useState(false);
  const [conflictKey, setConflictKey] = useState("");
  const { isValidating, validateLicense } = useLicenseStore();
  const { openCheckout, anchorRef } = usePolarCheckout();

  const handleActivate = useCallback(async () => {
    if (!licenseKey.trim()) return;
    await validateLicense(licenseKey.trim());
    const { error } = useLicenseStore.getState();
    if (error) {
      if (error.includes("already activated")) {
        setConflictKey(licenseKey.trim());
        setConflictDialogOpen(true);
      } else {
        sileo.error({ title: error });
      }
    }
  }, [licenseKey, validateLicense]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !isValidating && licenseKey.trim()) {
        handleActivate();
      }
    },
    [handleActivate, isValidating, licenseKey]
  );

  return (
    <div className="flex h-screen flex-col bg-muted">
      <Toaster />

      {/* Hidden Polar embed checkout anchor */}
      <a
        className="hidden"
        data-polar-checkout=""
        data-polar-checkout-theme="dark"
        href={POLAR_EMBED_CHECKOUT_URL}
        ref={anchorRef}
      />

      {/* Titlebar drag region */}
      <div
        className="relative flex h-10 shrink-0 items-center pr-[148px] pl-4"
        data-tauri-drag-region=""
      >
        <GalleryThumbnails
          className="fill-foreground text-foreground"
          size={16}
          strokeWidth={3}
        />
      </div>

      {/* Content card */}
      <div className="mx-1 flex flex-1 flex-col overflow-hidden rounded-xl border-2 border-border bg-background">
        <div className="flex flex-1 items-center justify-center overflow-y-auto p-8">
          {view === "pricing" ? (
            <div className="flex w-full max-w-md flex-col gap-6">
              <div>
                <h1 className="font-medium text-xl">
                  Make thumbnails that click
                </h1>
                <p className="font-medium text-muted-foreground text-xl">
                  One-time payment. Yours forever.
                </p>
              </div>

              {/* Price */}
              <style>{`
                @keyframes slash-draw {
                  from { transform: rotate(-12deg) scaleX(0); }
                  to   { transform: rotate(-12deg) scaleX(1); }
                }
                @keyframes price-pop {
                  0%   { opacity: 0; transform: scale(0.6); }
                  60%  { opacity: 1; transform: scale(1.08); }
                  80%  { transform: scale(0.97); }
                  100% { opacity: 1; transform: scale(1); }
                }
                @keyframes item-fade-up {
                  from { opacity: 0; transform: translateY(5px); }
                  to   { opacity: 1; transform: translateY(0); }
                }
              `}</style>
              <div className="flex flex-col gap-1">
                <div className="flex items-baseline gap-3">
                  <span
                    className="font-bold text-4xl"
                    style={{
                      animation:
                        "price-pop 0.55s cubic-bezier(0.34, 1.56, 0.64, 1) 0.75s both",
                    }}
                  >
                    $29
                  </span>
                  <span className="relative inline-block w-fit font-medium text-4xl text-muted-foreground">
                    $59
                    <span className="absolute inset-0 flex items-center">
                      <span
                        className="block h-[3px] w-full bg-muted-foreground/70"
                        style={{
                          transformOrigin: "left center",
                          animation: "slash-draw 0.4s ease-out 0.2s both",
                        }}
                      />
                    </span>
                  </span>
                  <span
                    className="rounded-md bg-foreground px-2 py-0.5 font-medium text-background text-xs"
                    style={{ animation: "item-fade-up 0.3s ease 1.1s both" }}
                  >
                    Launch price
                  </span>
                </div>
                <p
                  className="flex items-center gap-1.5 text-muted-foreground text-sm"
                  style={{ animation: "item-fade-up 0.35s ease 1.4s both" }}
                >
                  <TrendingUp className="size-3.5 shrink-0" />
                  Price increases with demand. Lock in now.
                </p>
              </div>

              {/* Benefits */}
              <div className="flex flex-col gap-2">
                {BENEFITS.map((b) => (
                  <div
                    className="flex items-center gap-4 rounded-xl bg-muted/40 px-5 py-4"
                    key={b.title}
                  >
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-foreground">
                      <Check className="size-4 text-background" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{b.title}</p>
                      <p className="mt-0.5 text-muted-foreground text-xs">
                        {b.desc}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* CTAs */}
              <div className="flex flex-col items-center gap-3">
                <Button
                  className="h-14 w-full"
                  onClick={() => {
                    sounds.click();
                    openCheckout();
                  }}
                  size="lg"
                  variant="contrast"
                >
                  Buy Now
                </Button>
                <button
                  className="cursor-pointer bg-transparent p-0 text-muted-foreground text-sm transition-colors hover:text-foreground"
                  onClick={() => {
                    sounds.click();
                    setView("activation");
                  }}
                  type="button"
                >
                  I already have a key →
                </button>
              </div>
            </div>
          ) : (
            <div className="flex w-full max-w-md flex-col gap-6">
              <div className="flex w-full items-start">
                <DoorOpen className="size-10 text-foreground" />
              </div>

              <div>
                <h1 className="font-medium text-xl">Activate Backstage</h1>
                <p className="font-medium text-muted-foreground text-xl">
                  Enter your license key to get started
                </p>
              </div>

              <div className="flex w-full flex-col gap-4">
                <div className="relative">
                  <Key className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    autoFocus
                    className="h-14 pl-10 text-lg"
                    disabled={isValidating}
                    onChange={(e) => setLicenseKey(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder=""
                    value={licenseKey}
                  />
                </div>

                <Button
                  className="h-14 w-full"
                  disabled={!licenseKey.trim() || isValidating}
                  onClick={() => {
                    sounds.click();
                    handleActivate();
                  }}
                  size="lg"
                  variant="contrast"
                >
                  {isValidating ? (
                    <>
                      <Loader2 className="mr-2 size-4 animate-spin" />
                      Validating...
                    </>
                  ) : (
                    "Activate"
                  )}
                </Button>
              </div>

              <div className="flex w-full flex-col items-center gap-3">
                <p className="text-muted-foreground text-sm">
                  Don't have your key?{" "}
                  <button
                    className="cursor-pointer bg-transparent p-0 text-foreground hover:underline"
                    onClick={() => {
                      sounds.click();
                      openUrl(POLAR_CONFIG.customerPortalUrl);
                    }}
                    type="button"
                  >
                    Retrieve it from your account
                  </button>
                </p>

                <div className="flex w-full items-center gap-3">
                  <div className="h-px flex-1 bg-border" />
                  <span className="text-muted-foreground text-xs">or</span>
                  <div className="h-px flex-1 bg-border" />
                </div>

                <Button
                  className="h-14 w-full"
                  onClick={() => {
                    sounds.click();
                    openCheckout();
                  }}
                  size="lg"
                  variant="secondary"
                >
                  Buy Now
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom bar */}
      <div className="mx-1 mb-1">
        <div className="relative flex h-12 items-center bg-muted px-4">
          <button
            className="flex items-center gap-1 rounded-md px-3 py-1.5 text-muted-foreground text-sm transition-colors hover:text-foreground"
            onClick={
              view === "activation"
                ? () => {
                    sounds.click();
                    setView("pricing");
                  }
                : () => {
                    sounds.click();
                    onBack?.();
                  }
            }
            type="button"
          >
            <ArrowLeft className="size-4" />
            Back
          </button>

          <div className="absolute left-1/2 -translate-x-1/2">
            <GalleryThumbnails
              className="fill-foreground/40 text-foreground/40"
              size={14}
              strokeWidth={3}
            />
          </div>
        </div>
      </div>

      {/* Already-activated conflict dialog */}
      <CustomerPortalDialog
        mode="conflict"
        onOpenChange={setConflictDialogOpen}
        open={conflictDialogOpen}
        prefilledKey={conflictKey}
      />
    </div>
  );
}
