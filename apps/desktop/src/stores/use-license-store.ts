import { load } from "@tauri-apps/plugin-store";
import { create } from "zustand";
import { logger } from "@/lib/logger";
import { POLAR_CONFIG } from "@/lib/polar-config";

const LICENSE_STORE_NAME = "license.json";
const LICENSE_KEY_FIELD = "license_key";
const ACTIVATION_ID_FIELD = "activation_id";

interface ValidatedLicenseData {
  id: string;
  key: string;
  displayKey: string;
  status: "granted" | "revoked" | "disabled";
  customerId: string;
  customerEmail?: string;
  customerName?: string;
  expiresAt: string | null;
  usage: number;
  limitUsage: number | null;
  activationId: string;
  validatedAt: number;
}

interface LicenseState {
  isValidated: boolean;
  isValidating: boolean;
  licenseKey: string | null;
  validatedData: ValidatedLicenseData | null;
  error: string | null;

  // Actions
  validateLicense: (key: string) => Promise<boolean>;
  loadStoredLicense: () => Promise<void>;
  clearLicense: () => Promise<void>;
}

/**
 * ACTIVATE - Called when user first enters their license key
 * Creates a device activation and returns an activation_id
 */
async function activateLicenseKey(
  key: string
): Promise<ValidatedLicenseData | null> {
  const deviceLabel = `Desktop-${Date.now()}`;

  const response = await fetch(
    `${POLAR_CONFIG.apiUrl}/v1/customer-portal/license-keys/activate`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        key,
        organization_id: POLAR_CONFIG.organizationId,
        label: deviceLabel,
      }),
    }
  );

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error("License key not found");
    }
    if (response.status === 403) {
      throw new Error(
        "This license is already activated on another device. Deactivate it from your account portal first, then try again."
      );
    }
    if (response.status === 422) {
      const errorData = await response.json();
      throw new Error(errorData.detail?.[0]?.msg || "Invalid license key");
    }
    throw new Error(`Activation failed: ${response.statusText}`);
  }

  const data = await response.json();

  if (data.license_key?.status !== "granted") {
    throw new Error(`License is ${data.license_key?.status || "invalid"}`);
  }

  if (data.license_key?.expires_at) {
    const expiresAt = new Date(data.license_key.expires_at);
    if (expiresAt < new Date()) {
      throw new Error("License has expired");
    }
  }

  return {
    id: data.license_key.id,
    key: data.license_key.key,
    displayKey: data.license_key.display_key,
    status: data.license_key.status,
    customerId: data.license_key.customer_id,
    customerEmail: data.license_key.customer?.email,
    customerName: data.license_key.customer?.name,
    expiresAt: data.license_key.expires_at,
    usage: data.license_key.usage,
    limitUsage: data.license_key.limit_usage,
    activationId: data.id,
    validatedAt: Date.now(),
  };
}

/**
 * VALIDATE - Called on subsequent app launches to verify stored activation
 */
async function validateLicenseKey(
  key: string,
  activationId: string
): Promise<ValidatedLicenseData | null> {
  const response = await fetch(
    `${POLAR_CONFIG.apiUrl}/v1/customer-portal/license-keys/validate`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        key,
        organization_id: POLAR_CONFIG.organizationId,
        activation_id: activationId,
      }),
    }
  );

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error("License key not found");
    }
    if (response.status === 422) {
      const errorData = await response.json();
      throw new Error(errorData.detail?.[0]?.msg || "Invalid license key");
    }
    throw new Error(`Validation failed: ${response.statusText}`);
  }

  const data = await response.json();

  if (data.status !== "granted") {
    throw new Error(`License is ${data.status}`);
  }

  if (data.expires_at) {
    const expiresAt = new Date(data.expires_at);
    if (expiresAt < new Date()) {
      throw new Error("License has expired");
    }
  }

  return {
    id: data.id,
    key: data.key,
    displayKey: data.display_key,
    status: data.status,
    customerId: data.customer_id,
    customerEmail: data.customer?.email,
    customerName: data.customer?.name,
    expiresAt: data.expires_at,
    usage: data.usage,
    limitUsage: data.limit_usage,
    activationId,
    validatedAt: Date.now(),
  };
}

/**
 * DEACTIVATE - Called when user wants to remove license from this device
 */
async function deactivateLicenseKey(
  key: string,
  activationId: string
): Promise<void> {
  const response = await fetch(
    `${POLAR_CONFIG.apiUrl}/v1/customer-portal/license-keys/deactivate`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
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

export const useLicenseStore = create<LicenseState>()((set, get) => ({
  isValidated: false,
  isValidating: false,
  licenseKey: null,
  validatedData: null,
  error: null,

  // Initial activation - uses ACTIVATE endpoint
  validateLicense: async (key: string): Promise<boolean> => {
    set({ isValidating: true, error: null });

    try {
      logger.info("[License] Activating license key...");
      const validatedData = await activateLicenseKey(key);

      if (!validatedData) {
        throw new Error("Activation returned no data");
      }

      const store = await load(LICENSE_STORE_NAME, {
        autoSave: true,
        defaults: {},
      });
      await store.set(LICENSE_KEY_FIELD, key);
      await store.set(ACTIVATION_ID_FIELD, validatedData.activationId);
      await store.save();

      set({
        isValidated: true,
        isValidating: false,
        licenseKey: key,
        validatedData,
        error: null,
      });

      logger.info(
        { customerId: validatedData.customerId },
        "[License] License activated successfully"
      );
      return true;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";
      logger.error({ err: error }, "[License] Activation failed");

      set({
        isValidated: false,
        isValidating: false,
        error: errorMessage,
      });
      return false;
    }
  },

  // Subsequent launches - uses VALIDATE endpoint
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
        set({ isValidating: false });
        return;
      }

      const validatedData = await validateLicenseKey(
        storedKey,
        storedActivationId
      );

      if (!validatedData) {
        throw new Error("Stored license validation failed");
      }

      set({
        isValidated: true,
        isValidating: false,
        licenseKey: storedKey,
        validatedData,
        error: null,
      });

      logger.info("[License] Stored license validated successfully");
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";
      logger.warn({ err: error }, "[License] Stored license invalid, clearing");

      try {
        const store = await load(LICENSE_STORE_NAME, {
          autoSave: true,
          defaults: {},
        });
        await store.delete(LICENSE_KEY_FIELD);
        await store.delete(ACTIVATION_ID_FIELD);
        await store.save();
      } catch {
        // Ignore cleanup errors
      }

      set({
        isValidated: false,
        isValidating: false,
        licenseKey: null,
        validatedData: null,
        error: errorMessage,
      });
    }
  },

  // Deactivate - uses DEACTIVATE endpoint
  clearLicense: async (): Promise<void> => {
    const { licenseKey, validatedData } = get();
    logger.info("[License] Deactivating license...");

    if (licenseKey && validatedData?.activationId) {
      try {
        await deactivateLicenseKey(licenseKey, validatedData.activationId);
        logger.info("[License] License deactivated via API");
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
      await store.save();
    } catch (error) {
      logger.error({ err: error }, "[License] Failed to clear stored license");
    }

    set({
      isValidated: false,
      isValidating: false,
      licenseKey: null,
      validatedData: null,
      error: null,
    });
  },
}));
