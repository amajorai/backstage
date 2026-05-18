/**
 * Polar License Key Configuration
 *
 * This configuration is used for license key validation via the Polar
 * customer portal endpoint, which doesn't require authentication and
 * is safe to use in desktop applications.
 */

export const POLAR_CONFIG = {
  /**
   * Your Polar Organization ID
   * Set via VITE_POLAR_ORGANIZATION_ID environment variable
   * Find this in your Polar dashboard at https://polar.sh
   */
  organizationId:
    import.meta.env.VITE_POLAR_ORGANIZATION_ID || "YOUR_ORGANIZATION_ID",

  /**
   * API endpoint for license validation
   * Set via VITE_POLAR_API_URL for sandbox (https://sandbox-api.polar.sh)
   * Defaults to production API
   */
  apiUrl: import.meta.env.VITE_POLAR_API_URL || "https://api.polar.sh",

  /**
   * Purchase URL for license key
   * Set via VITE_POLAR_PURCHASE_URL environment variable
   */
  purchaseUrl: import.meta.env.VITE_POLAR_PURCHASE_URL || "https://polar.sh",

  /**
   * Checkout URL with launch discount pre-applied
   */
  checkoutUrl: `${import.meta.env.VITE_POLAR_PURCHASE_URL || "https://polar.sh"}${(import.meta.env.VITE_POLAR_PURCHASE_URL || "https://polar.sh").includes("?") ? "&" : "?"}discount_code=OTLFLX8T`,

  /**
   * Polar embed checkout URL (buy.polar.sh format for the in-app overlay)
   * Set via VITE_POLAR_EMBED_CHECKOUT_URL
   */
  embedCheckoutUrl:
    import.meta.env.VITE_POLAR_EMBED_CHECKOUT_URL ||
    import.meta.env.VITE_POLAR_PURCHASE_URL ||
    "https://polar.sh",

  /**
   * Organization slug for customer portal
   * Set via VITE_POLAR_ORG_SLUG environment variable
   */
  orgSlug: import.meta.env.VITE_POLAR_ORG_SLUG || "your-org-slug",

  /**
   * Customer portal URL
   * Set via VITE_POLAR_CUSTOMER_PORTAL_URL (use https://sandbox.polar.sh/{org}/portal for sandbox)
   * Defaults to production portal
   */
  customerPortalUrl:
    import.meta.env.VITE_POLAR_CUSTOMER_PORTAL_URL ||
    `https://polar.sh/${import.meta.env.VITE_POLAR_ORG_SLUG || "your-org-slug"}/portal`,
} as const;
