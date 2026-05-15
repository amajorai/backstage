import { openUrl } from "@tauri-apps/plugin-opener";
import { DoorOpen, Key, Loader2 } from "lucide-react";
import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { POLAR_CONFIG } from "@/lib/polar-config";
import { useLicenseStore } from "@/stores/use-license-store";

export function LicenseActivation() {
  const [licenseKey, setLicenseKey] = useState("");
  const { isValidating, error, validateLicense } = useLicenseStore();

  const handleActivate = useCallback(async () => {
    if (!licenseKey.trim()) {
      return;
    }
    await validateLicense(licenseKey.trim());
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
    <div className="flex h-screen flex-col items-center justify-center bg-background p-8">
      <div className="flex w-full max-w-md flex-col items-center gap-8">
        {/* Icon */}
        <div className="flex size-20 w-full items-center justify-start">
          <DoorOpen className="size-10 text-foreground" />
        </div>

        {/* Header */}
        <div className="flex w-full flex-col">
          <h1 className="font-medium text-xl">Activate Your License</h1>
          <p className="font-medium text-muted-foreground text-xl">
            Enter your license key to start
          </p>
        </div>

        {/* Input */}
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

          {/* Error message */}
          {error && (
            <div className="text-center text-destructive text-sm">
              <p>{error}</p>
              {error.includes("already activated") && (
                <button
                  className="mt-1 cursor-pointer bg-transparent p-0 text-destructive underline hover:opacity-80"
                  onClick={() => openUrl(POLAR_CONFIG.customerPortalUrl)}
                  type="button"
                >
                  Go to your account portal →
                </button>
              )}
            </div>
          )}

          {/* Activate button */}
          <Button
            className="h-14 w-full"
            disabled={!licenseKey.trim() || isValidating}
            onClick={handleActivate}
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

        {/* Links */}
        <div className="flex w-full flex-col items-center gap-3">
          <p className="text-muted-foreground text-sm">
            Don't have a license?{" "}
            <button
              className="cursor-pointer bg-transparent p-0 text-foreground hover:underline"
              onClick={() => openUrl(POLAR_CONFIG.purchaseUrl)}
              type="button"
            >
              Purchase one
            </button>
          </p>
          <div className="flex w-full items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-muted-foreground text-xs">or</span>
            <div className="h-px flex-1 bg-border" />
          </div>
          <p className="text-muted-foreground text-sm">
            Already have a key?{" "}
            <button
              className="cursor-pointer bg-transparent p-0 text-foreground hover:underline"
              onClick={() => openUrl(POLAR_CONFIG.customerPortalUrl)}
              type="button"
            >
              Retrieve it from your account
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
