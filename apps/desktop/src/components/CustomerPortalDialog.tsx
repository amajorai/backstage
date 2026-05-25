import { Button } from "@repo/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/dialog";
import { openUrl } from "@tauri-apps/plugin-opener";
import {
  CheckCircle2,
  ExternalLink,
  Loader2,
  Monitor,
  RefreshCw,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { POLAR_CONFIG } from "@/lib/polar-config";
import * as sounds from "@/lib/sounds";
import { useLicenseStore } from "@/stores/use-license-store";

// ─── Types ───────────────────────────────────────────────────────────────────

type ConflictStep = "conflict" | "activating" | "guide";

interface CustomerPortalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** "retrieve": user wants to find their key. "conflict": key was entered but already activated. */
  mode?: "retrieve" | "conflict";
  /** The key that failed activation (conflict mode). */
  prefilledKey?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function CustomerPortalDialog({
  open,
  onOpenChange,
  mode = "retrieve",
  prefilledKey = "",
}: CustomerPortalDialogProps) {
  const [step, setStep] = useState<ConflictStep>("conflict");
  const [error, setError] = useState("");
  const { validateLicense } = useLicenseStore();

  useEffect(() => {
    if (open) {
      setStep("conflict");
      setError("");
    }
  }, [open]);

  const openPortal = useCallback(
    () => openUrl(POLAR_CONFIG.customerPortalUrl),
    []
  );

  // ── Retrieve mode: portal link only ──

  if (mode === "retrieve") {
    return (
      <Dialog onOpenChange={onOpenChange} open={open}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Find your license key</DialogTitle>
            <DialogDescription>
              Open the customer portal to view your license keys, then copy and
              paste it into the activation field.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button
              className="h-14 w-full"
              onClick={() => {
                sounds.click();
                openPortal();
                onOpenChange(false);
              }}
              size="lg"
              variant="contrast"
            >
              <ExternalLink className="mr-2 size-4" />
              Open Customer Portal
            </Button>
            <Button
              className="h-14 w-full"
              onClick={() => {
                sounds.click();
                onOpenChange(false);
              }}
              size="lg"
              variant="ghost"
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // ── Conflict mode: guide through manual deactivation ──

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-md">
        {step === "conflict" && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Monitor className="size-5 text-amber-500" />
                Already active on another device
              </DialogTitle>
              <DialogDescription>
                This license key is currently in use on another device. Open the
                Customer Portal to deactivate the old device, then retry here.
              </DialogDescription>
            </DialogHeader>

            {prefilledKey && (
              <div className="rounded-lg bg-muted px-4 py-3">
                <p className="font-mono text-muted-foreground text-xs">
                  {prefilledKey}
                </p>
              </div>
            )}

            {error && <p className="text-destructive text-sm">{error}</p>}

            <DialogFooter className="flex-col gap-2 sm:flex-col">
              <Button
                className="h-14 w-full"
                onClick={() => {
                  sounds.click();
                  openPortal();
                  setStep("guide");
                }}
                size="lg"
                variant="contrast"
              >
                <ExternalLink className="mr-2 size-4" />
                Open Customer Portal
              </Button>
              <Button
                className="h-14 w-full"
                onClick={() => {
                  sounds.click();
                  onOpenChange(false);
                }}
                size="lg"
                variant="ghost"
              >
                Cancel
              </Button>
            </DialogFooter>
          </>
        )}

        {step === "activating" && (
          <div className="flex flex-col items-center gap-3 py-8">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
            <p className="text-muted-foreground text-sm">Activating license…</p>
          </div>
        )}

        {step === "guide" && (
          <>
            <DialogHeader>
              <DialogTitle>Deactivate your old device</DialogTitle>
              <DialogDescription>
                In the Customer Portal, deactivate the old device then come back
                and retry.
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-3 py-2">
              <GuideStep done label="Open the Customer Portal" number={1} />
              <GuideStep
                done={false}
                label='Find your license under "Benefits"'
                number={2}
              />
              <GuideStep
                done={false}
                label="Click Deactivate next to the old device"
                number={3}
              />
              <GuideStep done={false} label='Click "Retry" below' number={4} />
            </div>

            <DialogFooter className="flex-col gap-2 sm:flex-col">
              <Button
                className="h-14 w-full"
                onClick={async () => {
                  sounds.click();
                  setError("");
                  setStep("activating");
                  const success = await validateLicense(prefilledKey);
                  if (success) {
                    onOpenChange(false);
                  } else {
                    const { error: licenseError } = useLicenseStore.getState();
                    setError(
                      licenseError ??
                        "Still in use — deactivate the old device first"
                    );
                    setStep("guide");
                  }
                }}
                size="lg"
                variant="contrast"
              >
                <RefreshCw className="mr-2 size-4" />
                Retry Activation
              </Button>
              <Button
                className="h-14 w-full"
                onClick={() => {
                  sounds.click();
                  openPortal();
                }}
                size="lg"
                variant="ghost"
              >
                <ExternalLink className="mr-2 size-4" />
                Re-open Customer Portal
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function GuideStep({
  number,
  label,
  done,
}: {
  number: number;
  label: string;
  done: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <div
        className={`flex size-6 shrink-0 items-center justify-center rounded-full text-xs ${
          done
            ? "bg-foreground text-background"
            : "border border-border text-muted-foreground"
        }`}
      >
        {done ? <CheckCircle2 className="size-3.5" /> : number}
      </div>
      <span
        className={`text-sm ${done ? "text-muted-foreground line-through" : ""}`}
      >
        {label}
      </span>
    </div>
  );
}
