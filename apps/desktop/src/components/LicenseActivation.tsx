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
          <DoorOpen className="size-10 text-primary" />
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
            <p className="text-center text-destructive text-sm">{error}</p>
          )}

          {/* Activate button */}
          <Button
            className="h-14 w-full"
            disabled={!licenseKey.trim() || isValidating}
            onClick={handleActivate}
            size="lg"
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

        {/* Purchase link */}
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex flex-col items-center">
            <p className="text-muted-foreground text-sm">
              Don't have a license key?
            </p>
            <button
              className="inline-flex cursor-pointer items-center gap-1 bg-transparent p-0 text-primary text-sm hover:underline"
              onClick={() => openUrl(POLAR_CONFIG.purchaseUrl)}
              type="button"
            >
              Purchase a license
            </button>
          </div>
          <div className="flex flex-col items-center">
            <p className="text-muted-foreground text-sm">Already have a key?</p>
            <button
              className="inline-flex cursor-pointer items-center gap-1 bg-transparent p-0 text-primary text-sm hover:underline"
              onClick={() => openUrl(POLAR_CONFIG.customerPortalUrl)}
              type="button"
            >
              Retrieve it from your account
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
