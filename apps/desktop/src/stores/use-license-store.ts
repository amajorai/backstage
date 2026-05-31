import { load } from "@tauri-apps/plugin-store";
import { create } from "zustand";
import { logger } from "@/lib/logger";
import { POLAR_CONFIG } from "@/lib/polar-config";

const LICENSE_STORE_NAME = "license.json";
const LICENSE_KEY_FIELD = "license_key";
const ACTIVATION_ID_FIELD = "activation_id";
const VALIDATED_DATA_FIELD = "validated_data_cache";
/** Maximum age of cached validation data we'll accept when offline. 30 days. */
const CACHE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export interface ValidatedLicenseData {
  id: string;
  key: string;
  displayKey: string;
  status: "granted" | "revoked" | "disabled";
  customerId: string;
  customerEmail?: string;
  customerName?: string;
  /**
   * End of the updates entitlement window. The app works forever after this
   * date, but the update checker will only offer versions released before it.
   * null means the license has no update window restriction (legacy lifetime).
   */
  expiresAt: string | null;
  usage: number;
  limitUsage: number | null;
  activationId: string;
  validatedAt: number;
}

interface LicenseState {
  isValidated: boolean;
  isValidating: boolean;
  /**
   * True when `validatedData` came from disk cache rather than a fresh server
   * validation (i.e. we're running in offline mode). Lets UI surface a banner,
   * and lets the renewal flow detect "we don't actually know if the renewal
   * landed because we couldn't reach the server".
   */
  usingCachedValidation: boolean;
  licenseKey: string | null;
  validatedData: ValidatedLicenseData | null;
  error: string | null;
  /**
   * Whether the license activation page is currently shown as an overlay. The
   * app is fully usable without a license; activation is surfaced at the point
   * of conversion (export) and from the settings billing section.
   */
  gateOpen: boolean;

  validateLicense: (key: string) => Promise<boolean>;
  loadStoredLicense: () => Promise<void>;
  clearLicense: () => Promise<void>;
  openLicenseGate: () => void;
  closeLicenseGate: () => void;
}

/** Returns true when the update window is set and has passed. */
export function isUpdateWindowExpired(data: ValidatedLicenseData): boolean {
  if (!data.expiresAt) return false;
  return new Date(data.expiresAt) < new Date();
}

async function activateLicenseKey(
  key: string
): Promise<ValidatedLicenseData | null> {
  const deviceLabel = `Desktop-${Date.now()}`;

  const response = await fetch(
    `${POLAR_CONFIG.apiUrl}/v1/customer-portal/license-keys/activate`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        key,
        organization_id: POLAR_CONFIG.organizationId,
        label: deviceLabel,
      }),
    }
  );

  if (!response.ok) {
    if (response.status === 404) throw new Error("License key not found");
    if (response.status === 403)
      throw new Error(
        "This license is already activated on another device. Deactivate it from your account portal first, then try again."
      );
    if (response.status === 422) {
      const errorData = await response.json();
      throw new Error(errorData.detail?.[0]?.msg || "Invalid license key");
    }
    throw new Error(`Activation failed: ${response.statusText}`);
  }

  const data = await response.json();

  if (data.license_key?.status !== "granted")
    throw new Error(`License is ${data.license_key?.status || "invalid"}`);

  return {
    id: data.license_key.id,
    key: data.license_key.key,
    displayKey: data.license_key.display_key,
    status: data.license_key.status,
    customerId: data.license_key.customer_id,
    customerEmail: data.license_key.customer?.email,
    customerName: data.license_key.customer?.name,
    expiresAt: data.license_key.expires_at ?? null,
    usage: data.license_key.usage,
    limitUsage: data.license_key.limit_usage,
    activationId: data.id,
    validatedAt: Date.now(),
  };
}

/**
 * Error thrown when the license is *definitively* invalid (revoked, missing,
 * deactivated). Callers should clear stored credentials.
 * Distinguished from transient network / server errors which should NOT nuke
 * a valid stored license.
 */
export class LicenseAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LicenseAuthError";
  }
}

async function validateLicenseKey(
  key: string,
  activationId: string
): Promise<ValidatedLicenseData | null> {
  const response = await fetch(
    `${POLAR_CONFIG.apiUrl}/v1/customer-portal/license-keys/validate`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        key,
        organization_id: POLAR_CONFIG.organizationId,
        activation_id: activationId,
      }),
    }
  );

  if (!response.ok) {
    // 4xx → definitive auth failure (revoked / not found / bad request)
    if (response.status === 404)
      throw new LicenseAuthError("License key not found");
    if (response.status === 422) {
      const errorData = await response.json();
      throw new LicenseAuthError(
        errorData.detail?.[0]?.msg || "Invalid license key"
      );
    }
    if (response.status >= 400 && response.status < 500) {
      throw new LicenseAuthError(
        `License validation rejected: ${response.statusText}`
      );
    }
    // 5xx / network → transient, don't nuke credentials
    throw new Error(`Validation failed (transient): ${response.statusText}`);
  }

  const data = await response.json();

  // Revoked / disabled is a definitive auth failure
  if (data.status !== "granted")
    throw new LicenseAuthError(`License is ${data.status}`);

  // Revoked / disabled status is still a hard block.
  // An expired expiresAt is intentionally NOT a hard block here —
  // it only restricts which app versions can be installed (handled in
  // use-app-updater). The app itself keeps working.

  return {
    id: data.id,
    key: data.key,
    displayKey: data.display_key,
    status: data.status,
    customerId: data.customer_id,
    customerEmail: data.customer?.email,
    customerName: data.customer?.name,
    expiresAt: data.expires_at ?? null,
    usage: data.usage,
    limitUsage: data.limit_usage,
    activationId,
    validatedAt: Date.now(),
  };
}

async function deactivateLicenseKey(
  key: string,
  activationId: string
): Promise<void> {
  const response = await fetch(
    `${POLAR_CONFIG.apiUrl}/v1/customer-portal/license-keys/deactivate`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        key,
        organization_id: POLAR_CONFIG.organizationId,
        activation_id: activationId,
      }),
    }
  );

  if (!response.ok && response.status !== 404) {
    logger.warn(
      { status: response.status },
      "[License] Deactivation API returned non-success"
    );
  }
}

/**
 * Reset state used by both "no license stored" and "no usable cache after
 * transient failure" paths. Spread into a `set({...UNLICENSED_STATE, error})`
 * call so every field is explicit and no Zustand partial-merge leaks remain.
 */
const UNLICENSED_STATE: Omit<
  LicenseState,
  | "validateLicense"
  | "loadStoredLicense"
  | "clearLicense"
  | "openLicenseGate"
  | "closeLicenseGate"
  | "gateOpen"
> = {
  isValidated: false,
  isValidating: false,
  usingCachedValidation: false,
  licenseKey: null,
  validatedData: null,
  error: null,
};

export const useLicenseStore = create<LicenseState>()((set, get) => ({
  ...UNLICENSED_STATE,
  gateOpen: false,

  openLicenseGate: () => set({ gateOpen: true }),
  closeLicenseGate: () => set({ gateOpen: false }),

  validateLicense: async (key: string): Promise<boolean> => {
    set({ isValidating: true, error: null });
    try {
      logger.info("[License] Activating license key...");
      const validatedData = await activateLicenseKey(key);
      if (!validatedData) throw new Error("Activation returned no data");

      const store = await load(LICENSE_STORE_NAME, {
        autoSave: true,
        defaults: {},
      });
      await store.set(LICENSE_KEY_FIELD, key);
      await store.set(ACTIVATION_ID_FIELD, validatedData.activationId);
      await store.set(VALIDATED_DATA_FIELD, validatedData);
      await store.save();

      set({
        isValidated: true,
        isValidating: false,
        usingCachedValidation: false,
        licenseKey: key,
        validatedData,
        error: null,
      });
      logger.info(
        { customerId: validatedData.customerId },
        "[License] Activated"
      );
      return true;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      logger.error({ err: error }, "[License] Activation failed");
      set({ ...UNLICENSED_STATE, error: errorMessage });
      return false;
    }
  },

  loadStoredLicense: async (): Promise<void> => {
    set({ isValidating: true, error: null });
    try {
      logger.info("[License] Loading stored license...");
      const store = await load(LICENSE_STORE_NAME, {
        autoSave: false,
        defaults: {},
      });
      const storedKey = await store.get<string>(LICENSE_KEY_FIELD);
      const storedActivationId = await store.get<string>(ACTIVATION_ID_FIELD);

      if (!(storedKey && storedActivationId)) {
        logger.info("[License] No stored license found");
        set({ ...UNLICENSED_STATE });
        return;
      }

      const validatedData = await validateLicenseKey(
        storedKey,
        storedActivationId
      );
      if (!validatedData) throw new Error("Stored license validation failed");

      // Refresh the cache with the latest validated data
      const writeStore = await load(LICENSE_STORE_NAME, {
        autoSave: true,
        defaults: {},
      });
      await writeStore.set(VALIDATED_DATA_FIELD, validatedData);
      await writeStore.save();

      set({
        isValidated: true,
        isValidating: false,
        usingCachedValidation: false,
        licenseKey: storedKey,
        validatedData,
        error: null,
      });
      logger.info("[License] Stored license validated");
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      if (error instanceof LicenseAuthError) {
        // Definitive auth failure → clear stored credentials AND cache
        logger.warn(
          { err: error },
          "[License] Stored license rejected by server, clearing"
        );
        try {
          const store = await load(LICENSE_STORE_NAME, {
            autoSave: true,
            defaults: {},
          });
          await store.delete(LICENSE_KEY_FIELD);
          await store.delete(ACTIVATION_ID_FIELD);
          await store.delete(VALIDATED_DATA_FIELD);
          await store.save();
        } catch {
          // ignore cleanup errors
        }
        set({ ...UNLICENSED_STATE, error: errorMessage });
        return;
      }

      // Transient error (network / 5xx) — fall back to cached validatedData
      // so the user can keep using the app offline. The cache is refreshed on
      // every successful validation, so it should usually be current.
      try {
        const store = await load(LICENSE_STORE_NAME, {
          autoSave: false,
          defaults: {},
        });
        const storedKey = await store.get<string>(LICENSE_KEY_FIELD);
        const cachedData =
          await store.get<ValidatedLicenseData>(VALIDATED_DATA_FIELD);
        if (
          cachedData &&
          storedKey &&
          Date.now() - cachedData.validatedAt < CACHE_MAX_AGE_MS
        ) {
          logger.warn(
            { err: error, cachedAgeMs: Date.now() - cachedData.validatedAt },
            "[License] Transient validation error, using cached license data"
          );
          set({
            isValidated: true,
            isValidating: false,
            usingCachedValidation: true,
            licenseKey: storedKey,
            validatedData: cachedData,
            error: null,
          });
          return;
        }
      } catch {
        // fall through to plain error state
      }

      logger.warn(
        { err: error },
        "[License] Transient validation error, no usable cache"
      );
      // No cache to fall back on — fully reset to unlicensed state. Avoids a
      // stale in-memory `validatedData` being misread as a valid license by
      // downstream callers (e.g. the renewal refresh flow).
      set({ ...UNLICENSED_STATE, error: errorMessage });
    }
  },

  clearLicense: async (): Promise<void> => {
    const { licenseKey, validatedData } = get();
    logger.info("[License] Deactivating license...");

    if (licenseKey && validatedData?.activationId) {
      try {
        await deactivateLicenseKey(licenseKey, validatedData.activationId);
        logger.info("[License] Deactivated via API");
      } catch (error) {
        logger.error({ err: error }, "[License] Failed to deactivate via API");
      }
    }

    try {
      const store = await load(LICENSE_STORE_NAME, {
        autoSave: true,
        defaults: {},
      });
      await store.delete(LICENSE_KEY_FIELD);
      await store.delete(ACTIVATION_ID_FIELD);
      await store.delete(VALIDATED_DATA_FIELD);
      await store.save();
    } catch (error) {
      logger.error({ err: error }, "[License] Failed to clear stored license");
    }

    set({ ...UNLICENSED_STATE });
  },
}));
