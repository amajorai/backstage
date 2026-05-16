"use client";

import { Download, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

const EXPORT_KEYS = ["analytics-enabled", "perf-monitoring-enabled"] as const;

type ExportData = {
  version: 1;
  exportedAt: string;
  preferences: Record<string, string>;
};

function collectData(): ExportData {
  const preferences: Record<string, string> = {};
  for (const key of EXPORT_KEYS) {
    const val = localStorage.getItem(key);
    if (val !== null) {
      preferences[key] = val;
    }
  }
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    preferences,
  };
}

function applyData(data: ExportData): void {
  for (const [key, val] of Object.entries(data.preferences)) {
    if ((EXPORT_KEYS as readonly string[]).includes(key)) {
      localStorage.setItem(key, val);
    }
  }
}

export function DataTransferTab() {
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleExport() {
    const data = collectData();
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `backstage-settings-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Settings exported");
  }

  function handleImportClick() {
    fileInputRef.current?.click();
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    try {
      const text = await file.text();
      const raw: unknown = JSON.parse(text);

      if (
        typeof raw !== "object" ||
        raw === null ||
        (raw as ExportData).version !== 1 ||
        typeof (raw as ExportData).preferences !== "object"
      ) {
        toast.error("Invalid settings file");
        return;
      }

      applyData(raw as ExportData);
      toast.success("Settings imported — reload to apply all changes");
    } catch {
      toast.error("Failed to read file");
    } finally {
      setImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-semibold text-lg">Data Transfer</h2>
        <p className="mt-1 text-muted-foreground text-sm">
          Export your settings to transfer to another device, or import a
          previously exported file.
        </p>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between rounded-lg border p-4">
          <div className="space-y-0.5">
            <p className="font-medium text-base">Export Settings</p>
            <p className="text-muted-foreground text-sm">
              Download your preferences as a JSON file.
            </p>
          </div>
          <Button onClick={handleExport} variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        </div>

        <div className="flex items-center justify-between rounded-lg border p-4">
          <div className="space-y-0.5">
            <p className="font-medium text-base">Import Settings</p>
            <p className="text-muted-foreground text-sm">
              Restore preferences from an exported file.
            </p>
          </div>
          <Button
            disabled={importing}
            onClick={handleImportClick}
            variant="outline"
          >
            <Upload className="mr-2 h-4 w-4" />
            {importing ? "Importing…" : "Import"}
          </Button>
        </div>
      </div>

      <input
        accept=".json"
        className="hidden"
        onChange={handleFileChange}
        ref={fileInputRef}
        type="file"
      />
    </div>
  );
}
