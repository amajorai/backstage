"use client";

import { useEffect, useState } from "react";
import { getPerfMonitoringEnabled } from "@/lib/analytics-prefs";
import { WebVitals } from "@/lib/axiom";

export function AxiomWebVitals() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    setEnabled(getPerfMonitoringEnabled());
  }, []);

  if (!(enabled && WebVitals)) return null;

  return <WebVitals />;
}
