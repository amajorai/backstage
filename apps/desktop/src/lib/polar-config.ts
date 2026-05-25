type PolarEnv = "production" | "sandbox";

const polarEnv = (import.meta.env.VITE_POLAR_ENV ?? "production") as PolarEnv;
const orgSlug = import.meta.env.VITE_POLAR_ORG_SLUG || "your-org-slug";

const API_URLS: Record<PolarEnv, string> = {
  production: "https://api.polar.sh",
  sandbox: "https://sandbox-api.polar.sh",
};

const WEB_URLS: Record<PolarEnv, string> = {
  production: "https://polar.sh",
  sandbox: "https://sandbox.polar.sh",
};

export const POLAR_CONFIG = {
  server: polarEnv,
  organizationId:
    import.meta.env.VITE_POLAR_ORGANIZATION_ID || "YOUR_ORGANIZATION_ID",
  apiUrl: API_URLS[polarEnv],
  purchaseUrl: import.meta.env.VITE_POLAR_PURCHASE_URL || WEB_URLS[polarEnv],
  checkoutUrl: `${import.meta.env.VITE_POLAR_PURCHASE_URL || WEB_URLS[polarEnv]}${(import.meta.env.VITE_POLAR_PURCHASE_URL || WEB_URLS[polarEnv]).includes("?") ? "&" : "?"}discount_code=OTLFLX8T`,
  embedCheckoutUrl:
    import.meta.env.VITE_POLAR_EMBED_CHECKOUT_URL ||
    import.meta.env.VITE_POLAR_PURCHASE_URL ||
    WEB_URLS[polarEnv],
  orgSlug,
  customerPortalUrl:
    import.meta.env.VITE_POLAR_CUSTOMER_PORTAL_URL ||
    `${WEB_URLS[polarEnv]}/${orgSlug}/portal`,
} as const;
