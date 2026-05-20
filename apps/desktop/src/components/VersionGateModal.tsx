import { Button } from "@repo/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/dialog";
import { openUrl } from "@tauri-apps/plugin-opener";
import { RefreshCw, ShieldAlert } from "lucide-react";
import { useState } from "react";
import { sileo } from "sileo";
import {
  checkVersionGate,
  resetUpdateSession,
  useVersionGateStore,
} from "@/hooks/use-app-updater";
import { releaseTagUrl } from "@/lib/github-releases";
import { useLicenseStore } from "@/stores/use-license-store";

export function VersionGateModal() {
  const { blocked, runningVersion, entitledVersion, clearGate } =
    useVersionGateStore();
  const loadStoredLicense = useLicenseStore((s) => s.loadStoredLicense);
  const [refreshing, setRefreshing] = useState(false);

  if (!blocked) return null;

  const releaseUrl = releaseTagUrl(entitledVersion);

  const handleCheckRenewal = async () => {
    setRefreshing(true);
    try {
      // Pull fresh license state from Polar to see if the user just renewed.
      await loadStoredLicense();

      // If the validation fell back to disk cache (server unreachable), we
      // genuinely don't know whether the renewal landed — show that honestly
      // instead of clearing the gate based on stale data.
      const { usingCachedValidation } = useLicenseStore.getState();
      if (usingCachedValidation) {
        sileo.error({
          title: "Couldn't reach license server",
          description:
            "Check your internet connection and try again. We can't verify a renewal while offline.",
        });
        return;
      }

      resetUpdateSession();
      // Clear first so a successful renewal lets the modal close immediately;
      // checkVersionGate will re-engage the gate if the user is still outside
      // their entitlement window.
      clearGate();
      await checkVersionGate();
      const stillBlocked = useVersionGateStore.getState().blocked;
      if (stillBlocked) {
        sileo.info({
          title: "Still outside entitlement",
          description:
            "Your renewal may not have processed yet. Try again in a minute.",
        });
      } else {
        sileo.success({
          title: "License refreshed",
          description: "Your update window has been extended.",
        });
      }
    } catch {
      sileo.error({
        title: "Couldn't refresh license",
        description: "Check your internet connection and try again.",
      });
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <Dialog open>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="mb-2 flex size-10 items-center justify-center rounded-full bg-destructive/10">
            <ShieldAlert className="size-5 text-destructive" />
          </div>
          <DialogTitle>Version not covered by your license</DialogTitle>
          <DialogDescription className="space-y-2">
            <span className="block">
              You are running{" "}
              <strong className="text-foreground">v{runningVersion}</strong>,
              which was released after your update window closed. Your license
              covers updates up to{" "}
              <strong className="text-foreground">v{entitledVersion}</strong>.
            </span>
            <span className="block text-muted-foreground">
              Your app and all your projects are safe — you just need to
              reinstall the version your license includes, or renew to unlock
              the latest.
            </span>
          </DialogDescription>
        </DialogHeader>
        <div className="mt-4 flex flex-col gap-2">
          <Button
            className="w-full"
            onClick={() => openUrl(releaseUrl)}
            variant="default"
          >
            Download v{entitledVersion}
          </Button>
          <Button
            className="w-full"
            onClick={() => openUrl("https://backstage.amajorai.com/#pricing")}
            variant="outline"
          >
            Renew updates — get the latest version
          </Button>
          <Button
            className="w-full gap-2"
            disabled={refreshing}
            onClick={handleCheckRenewal}
            size="sm"
            variant="ghost"
          >
            <RefreshCw
              className={`size-3 ${refreshing ? "animate-spin" : ""}`}
            />
            I've already renewed — refresh license
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
