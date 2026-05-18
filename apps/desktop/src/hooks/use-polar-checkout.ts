import { PolarEmbedCheckout } from "@polar-sh/checkout/embed";
import { useCallback, useEffect, useRef } from "react";
import { POLAR_CONFIG } from "@/lib/polar-config";

export const POLAR_EMBED_CHECKOUT_URL = POLAR_CONFIG.embedCheckoutUrl;

export function usePolarCheckout() {
  const anchorRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    PolarEmbedCheckout.init();
  }, []);

  const openCheckout = useCallback(() => {
    anchorRef.current?.click();
  }, []);

  return { openCheckout, anchorRef };
}
