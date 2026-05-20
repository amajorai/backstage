import { Button } from "@repo/ui/button";
import { openUrl } from "@tauri-apps/plugin-opener";
import { LogOut, RefreshCw, ShieldCheck, WifiOff } from "lucide-react";
import { useCallback } from "react";
import * as sounds from "@/lib/sounds";
import {
  isUpdateWindowExpired,
  useLicenseStore,
} from "@/stores/use-license-store";

export function LicenseStatus() {
  const { validatedData, clearLicense, usingCachedValidation } =
    useLicenseStore();

  const handleDeactivate = useCallback(async () => {
    await clearLicense();
  }, [clearLicense]);

  if (!validatedData) return null;

  const windowExpired = isUpdateWindowExpired(validatedData);

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });

  let updateLabel = "Updates included";
  if (validatedData.expiresAt) {
    const dateStr = formatDate(validatedData.expiresAt);
    updateLabel = windowExpired
      ? `Updates expired ${dateStr}`
      : `Updates until ${dateStr}`;
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border border-border bg-muted/50 p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-8 items-center justify-center rounded-full bg-green-500/10">
            <ShieldCheck className="size-4 text-green-500" />
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="font-medium text-sm">Licensed</span>
            <span className="text-muted-foreground text-xs">
              {validatedData.customerEmail ||
                validatedData.customerName ||
                "Active"}
            </span>
          </div>
        </div>
        <Button
          onClick={() => {
            sounds.delete_();
            handleDeactivate();
          }}
          size="icon-sm"
          title="Deactivate license"
          variant="ghost"
        >
          <LogOut className="size-4 text-muted-foreground" />
        </Button>
      </div>

      <div className="flex items-center justify-between border-border border-t pt-2">
        <span
          className={`text-xs ${windowExpired ? "text-amber-500" : "text-muted-foreground"}`}
        >
          {updateLabel}
        </span>
        {windowExpired && (
          <Button
            className="h-6 gap-1 px-2 text-xs"
            onClick={() => openUrl("https://backstage.amajorai.com/#pricing")}
            size="sm"
            variant="outline"
          >
            <RefreshCw className="size-3" />
            Renew
          </Button>
        )}
      </div>

      {usingCachedValidation && (
        <div className="flex items-center gap-1.5 text-amber-500 text-xs">
          <WifiOff className="size-3" />
          <span>Offline — license verified from cache</span>
        </div>
      )}
    </div>
  );
}
