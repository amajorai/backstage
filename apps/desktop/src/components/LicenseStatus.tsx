import { Button } from "@repo/ui/button";
import { LogOut, ShieldCheck } from "lucide-react";
import { useCallback } from "react";
import { useLicenseStore } from "@/stores/use-license-store";

export function LicenseStatus() {
  const { validatedData, clearLicense } = useLicenseStore();

  const handleDeactivate = useCallback(async () => {
    await clearLicense();
  }, [clearLicense]);

  if (!validatedData) {
    return null;
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) {
      return "Never";
    }
    return new Date(dateStr).toLocaleDateString();
  };

  return (
    <div className="flex items-center justify-between rounded-md border border-border bg-muted/50 p-3">
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
            {validatedData.expiresAt &&
              ` · Expires ${formatDate(validatedData.expiresAt)}`}
          </span>
        </div>
      </div>
      <Button
        onClick={handleDeactivate}
        size="icon-sm"
        title="Deactivate license"
        variant="ghost"
      >
        <LogOut className="size-4 text-muted-foreground" />
      </Button>
    </div>
  );
}
