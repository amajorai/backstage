import { Button } from "@repo/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/dialog";
import { Input } from "@repo/ui/input";
import { openUrl } from "@tauri-apps/plugin-opener";
import {
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Mail,
  Monitor,
  RefreshCw,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { POLAR_CONFIG } from "@/lib/polar-config";
import * as sounds from "@/lib/sounds";
import { useLicenseStore } from "@/stores/use-license-store";

// ─── Types ───────────────────────────────────────────────────────────────────

type Step =
  | "email" // enter email to look up account
  | "loading" // fetching session + keys from server
  | "keys" // show list of license keys
  | "activating" // activating selected key
  | "conflict" // key already in use on another device
  | "transferring" // server is deactivating old activations
  | "guide"; // manual fallback: step-by-step portal guide

interface PortalKey {
  id: string;
  key: string;
  displayKey: string;
  status: "granted" | "revoked" | "disabled";
  usage: number;
  limitActivations: number | null;
}

interface CustomerPortalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** "retrieve": user wants to look up their key. "conflict": key was entered but already activated. */
  mode?: "retrieve" | "conflict";
  /** The key that failed activation (conflict mode). */
  prefilledKey?: string;
}

const SERVER_URL = import.meta.env.VITE_POLAR_SERVER_URL as string | undefined;

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function createCustomerSession(
  email: string
): Promise<{ token: string; customerPortalUrl: string }> {
  if (!SERVER_URL) throw new Error("VITE_POLAR_SERVER_URL is not configured");
  const res = await fetch(`${SERVER_URL}/api/polar/customer-session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  const data = (await res.json()) as {
    error?: string;
    token?: string;
    customerPortalUrl?: string;
  };
  if (!res.ok) throw new Error(data.error ?? "Failed to sign in");
  return { token: data.token!, customerPortalUrl: data.customerPortalUrl! };
}

async function fetchCustomerKeys(sessionToken: string): Promise<PortalKey[]> {
  const res = await fetch(
    `${POLAR_CONFIG.apiUrl}/v1/customer-portal/license-keys/?limit=100`,
    {
      headers: { Authorization: `Bearer ${sessionToken}` },
    }
  );
  if (!res.ok) throw new Error("Failed to fetch license keys");
  const data = (await res.json()) as {
    items: Array<{
      id: string;
      key: string;
      display_key: string;
      status: "granted" | "revoked" | "disabled";
      usage: number;
      limit_activations: number | null;
    }>;
  };
  return data.items.map((k) => ({
    id: k.id,
    key: k.key,
    displayKey: k.display_key,
    status: k.status,
    usage: k.usage,
    limitActivations: k.limit_activations,
  }));
}

async function transferLicense(params: {
  licenseKey: string;
  organizationId: string;
  sessionToken?: string;
  email?: string;
}): Promise<void> {
  if (!SERVER_URL) throw new Error("VITE_POLAR_SERVER_URL is not configured");
  const res = await fetch(`${SERVER_URL}/api/polar/transfer`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      licenseKey: params.licenseKey,
      organizationId: params.organizationId,
      sessionToken: params.sessionToken,
      email: params.email,
    }),
  });
  const data = (await res.json()) as { error?: string };
  if (!res.ok) throw new Error(data.error ?? "Transfer failed");
}

// ─── Component ────────────────────────────────────────────────────────────────

export function CustomerPortalDialog({
  open,
  onOpenChange,
  mode = "retrieve",
  prefilledKey = "",
}: CustomerPortalDialogProps) {
  const [step, setStep] = useState<Step>(
    mode === "conflict" ? "conflict" : "email"
  );
  const [email, setEmail] = useState("");
  const [sessionToken, setSessionToken] = useState("");
  const [keys, setKeys] = useState<PortalKey[]>([]);
  const [selectedKey, setSelectedKey] = useState("");
  const [error, setError] = useState("");
  const emailRef = useRef<HTMLInputElement>(null);
  const { validateLicense } = useLicenseStore();

  // The license key being worked on: comes from the keys list (retrieve) or prefilled (conflict)
  const activeKey = mode === "conflict" ? prefilledKey : selectedKey;

  useEffect(() => {
    if (open) {
      setStep(mode === "conflict" ? "conflict" : "email");
      setEmail("");
      setSessionToken("");
      setKeys([]);
      setSelectedKey("");
      setError("");
    }
  }, [open, mode]);

  useEffect(() => {
    if (step === "email") setTimeout(() => emailRef.current?.focus(), 50);
  }, [step]);

  // ── Sign in ──

  const handleSignIn = useCallback(async () => {
    if (!email.trim()) return;
    setError("");
    setStep("loading");
    try {
      const { token } = await createCustomerSession(email.trim());
      const fetchedKeys = await fetchCustomerKeys(token);
      setSessionToken(token);
      setKeys(fetchedKeys);
      setStep("keys");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setStep("email");
    }
  }, [email]);

  // ── Activate selected key ──

  const handleActivate = useCallback(
    async (key: string) => {
      setSelectedKey(key);
      setStep("activating");
      const success = await validateLicense(key);
      const { error: licenseError } = useLicenseStore.getState();
      if (success) {
        onOpenChange(false);
      } else if (licenseError?.includes("already activated")) {
        setStep("conflict");
      } else {
        setError(licenseError ?? "Activation failed");
        setStep("keys");
      }
    },
    [validateLicense, onOpenChange]
  );

  // ── Auto-transfer: deactivate old activations, then re-activate ──

  const handleTransfer = useCallback(async () => {
    setError("");
    setStep("transferring");
    try {
      await transferLicense({
        licenseKey: activeKey,
        organizationId: POLAR_CONFIG.organizationId,
        sessionToken: sessionToken || undefined,
        email: sessionToken ? undefined : email,
      });
      // All old activations removed — activate on this device
      const success = await validateLicense(activeKey);
      if (success) {
        onOpenChange(false);
      } else {
        const { error: licenseError } = useLicenseStore.getState();
        setError(licenseError ?? "Activation failed after transfer");
        setStep("conflict");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Transfer failed");
      setStep("conflict");
    }
  }, [activeKey, sessionToken, email, validateLicense, onOpenChange]);

  const openPortal = useCallback(
    () => openUrl(POLAR_CONFIG.customerPortalUrl),
    []
  );

  const handleEmailKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") handleSignIn();
    },
    [handleSignIn]
  );

  // ── Render ──

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-md">
        {step === "email" && (
          <>
            <DialogHeader>
              <DialogTitle>Sign in to your account</DialogTitle>
              <DialogDescription>
                Enter the email you used to purchase, and we'll retrieve your
                license keys.
              </DialogDescription>
            </DialogHeader>

            <div className="py-2">
              <div className="relative">
                <Mail className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  autoFocus
                  className="pl-10"
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={handleEmailKeyDown}
                  placeholder="you@example.com"
                  ref={emailRef}
                  type="email"
                  value={email}
                />
              </div>
              {error && (
                <p className="mt-2 text-destructive text-sm">{error}</p>
              )}
            </div>

            <DialogFooter className="flex-col gap-2 sm:flex-col">
              <Button
                className="w-full"
                disabled={!email.trim()}
                onClick={() => {
                  sounds.click();
                  handleSignIn();
                }}
                variant="contrast"
              >
                Continue
                <ArrowRight className="ml-2 size-4" />
              </Button>
              <Button
                className="w-full"
                onClick={() => {
                  sounds.click();
                  onOpenChange(false);
                }}
                variant="ghost"
              >
                Cancel
              </Button>
            </DialogFooter>
          </>
        )}

        {step === "loading" && (
          <div className="flex flex-col items-center gap-3 py-8">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
            <p className="text-muted-foreground text-sm">
              Fetching your license keys…
            </p>
          </div>
        )}

        {step === "keys" && (
          <>
            <DialogHeader>
              <DialogTitle>Choose a license key</DialogTitle>
              <DialogDescription>
                Select the key you want to activate on this device.
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-2 py-2">
              {error && <p className="text-destructive text-sm">{error}</p>}
              {keys.length === 0 && (
                <p className="text-center text-muted-foreground text-sm">
                  No license keys found on this account.
                </p>
              )}
              {keys.map((k) => (
                <button
                  className="flex w-full items-center justify-between rounded-lg border border-border px-4 py-3 text-left transition-colors hover:bg-muted disabled:opacity-50"
                  disabled={k.status !== "granted"}
                  key={k.id}
                  onClick={() => {
                    sounds.click();
                    handleActivate(k.key);
                  }}
                  type="button"
                >
                  <div>
                    <p className="font-mono text-sm">{k.displayKey}</p>
                    <p className="mt-0.5 text-muted-foreground text-xs capitalize">
                      {k.status}
                      {k.limitActivations != null &&
                        ` · ${k.usage}/${k.limitActivations} activations used`}
                    </p>
                  </div>
                  <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
                </button>
              ))}
            </div>

            <DialogFooter>
              <button
                className="cursor-pointer bg-transparent p-0 text-muted-foreground text-sm hover:text-foreground"
                onClick={() => {
                  sounds.click();
                  setStep("email");
                }}
                type="button"
              >
                ← Use a different account
              </button>
            </DialogFooter>
          </>
        )}

        {step === "activating" && (
          <div className="flex flex-col items-center gap-3 py-8">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
            <p className="text-muted-foreground text-sm">Activating license…</p>
          </div>
        )}

        {step === "conflict" && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Monitor className="size-5 text-amber-500" />
                Already active on another device
              </DialogTitle>
              <DialogDescription>
                This license key is currently in use on another device. You can
                transfer it here automatically, or manage it manually in the
                Customer Portal.
              </DialogDescription>
            </DialogHeader>

            {activeKey && (
              <div className="rounded-lg bg-muted px-4 py-3">
                <p className="font-mono text-muted-foreground text-xs">
                  {activeKey}
                </p>
              </div>
            )}

            {error && <p className="text-destructive text-sm">{error}</p>}

            <DialogFooter className="flex-col gap-2 sm:flex-col">
              {SERVER_URL ? (
                <Button
                  className="w-full"
                  onClick={
                    sessionToken || email
                      ? () => {
                          sounds.click();
                          handleTransfer();
                        }
                      : () => {
                          sounds.click();
                          setStep("email");
                        }
                  }
                  variant="contrast"
                >
                  Transfer to this device
                </Button>
              ) : null}
              <Button
                className="w-full"
                onClick={() => {
                  sounds.click();
                  openPortal();
                  setStep("guide");
                }}
                variant={SERVER_URL ? "ghost" : "contrast"}
              >
                <ExternalLink className="mr-2 size-4" />
                Manage in Customer Portal
              </Button>
              <Button
                className="w-full"
                onClick={() => {
                  sounds.click();
                  onOpenChange(false);
                }}
                variant="ghost"
              >
                Cancel
              </Button>
            </DialogFooter>
          </>
        )}

        {step === "transferring" && (
          <div className="flex flex-col items-center gap-3 py-8">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
            <p className="text-sm">Transferring activation…</p>
            <p className="text-center text-muted-foreground text-xs">
              Removing old device activation and activating here.
            </p>
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
                className="w-full"
                onClick={async () => {
                  sounds.click();
                  setStep("activating");
                  const success = await validateLicense(activeKey);
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
                variant="contrast"
              >
                <RefreshCw className="mr-2 size-4" />
                Retry Activation
              </Button>
              <Button
                className="w-full"
                onClick={() => {
                  sounds.click();
                  openPortal();
                }}
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
