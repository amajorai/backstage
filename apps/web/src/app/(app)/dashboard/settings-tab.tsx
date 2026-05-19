"use client";

import { Label } from "@repo/ui/label";
import { Switch } from "@repo/ui/switch";
import posthog from "posthog-js";
import { useEffect, useState } from "react";
import { sileo } from "sileo";
import {
  getAnalyticsEnabled,
  getPerfMonitoringEnabled,
  setAnalyticsEnabled,
  setPerfMonitoringEnabled,
} from "@/lib/analytics-prefs";

export function SettingsTab() {
  const [analytics, setAnalytics] = useState(true);
  const [perf, setPerf] = useState(true);

  useEffect(() => {
    setAnalytics(getAnalyticsEnabled());
    setPerf(getPerfMonitoringEnabled());
  }, []);

  function handleAnalyticsChange(enabled: boolean) {
    setAnalytics(enabled);
    setAnalyticsEnabled(enabled);
    if (enabled) {
      posthog.opt_in_capturing();
    } else {
      posthog.opt_out_capturing();
    }
    sileo.success({
      title: enabled
        ? "Product Analytics enabled"
        : "Product Analytics disabled",
    });
  }

  function handlePerfChange(enabled: boolean) {
    setPerf(enabled);
    setPerfMonitoringEnabled(enabled);
    sileo.success({
      title: enabled
        ? "Performance Monitoring enabled"
        : "Performance Monitoring disabled",
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-semibold text-lg">Analytics &amp; Telemetry</h2>
        <p className="mt-1 text-muted-foreground text-sm">
          Control what data is collected about your usage.
        </p>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between rounded-lg border p-4">
          <div className="space-y-0.5">
            <Label className="text-base" htmlFor="analytics-toggle">
              Product Analytics
            </Label>
            <p className="text-muted-foreground text-sm">
              Helps us understand how you use the product so we can improve it.
            </p>
          </div>
          <Switch
            checked={analytics}
            id="analytics-toggle"
            onCheckedChange={handleAnalyticsChange}
          />
        </div>

        <div className="flex items-center justify-between rounded-lg border p-4">
          <div className="space-y-0.5">
            <Label className="text-base" htmlFor="perf-toggle">
              Performance Monitoring
            </Label>
            <p className="text-muted-foreground text-sm">
              Collects Core Web Vitals to help diagnose performance issues.
            </p>
          </div>
          <Switch
            checked={perf}
            id="perf-toggle"
            onCheckedChange={handlePerfChange}
          />
        </div>
      </div>
    </div>
  );
}
