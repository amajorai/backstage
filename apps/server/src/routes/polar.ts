import { env } from "@backstage/env/server";
import { Hono } from "hono";

const POLAR_BASE =
  (process.env.POLAR_API_URL as string | undefined) ?? "https://api.polar.sh";

export const polarRouter = new Hono();

/**
 * POST /api/polar/customer-session
 * Looks up a customer by email and creates a Polar customer portal session.
 * Returns the session token the client can use to call Polar portal endpoints directly.
 */
polarRouter.post("/customer-session", async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON" }, 400);
  }

  const email =
    typeof (body as Record<string, unknown>).email === "string"
      ? ((body as Record<string, unknown>).email as string).trim().toLowerCase()
      : null;

  if (!email) return c.json({ error: "email is required" }, 400);

  const customersRes = await fetch(
    `${POLAR_BASE}/v1/customers/?email=${encodeURIComponent(email)}&limit=1`,
    { headers: { Authorization: `Bearer ${env.POLAR_ACCESS_TOKEN}` } }
  );
  if (!customersRes.ok) return c.json({ error: "Failed to reach Polar" }, 502);

  const customers = (await customersRes.json()) as {
    items: Array<{ id: string }>;
  };

  const customer = customers.items?.[0];
  if (!customer) {
    return c.json({ error: "No account found for this email address" }, 404);
  }

  const sessionRes = await fetch(`${POLAR_BASE}/v1/customer-sessions/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.POLAR_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ customer_id: customer.id }),
  });
  if (!sessionRes.ok) return c.json({ error: "Failed to create session" }, 502);

  const session = (await sessionRes.json()) as {
    token: string;
    customer_portal_url: string;
  };

  return c.json({
    token: session.token,
    customerPortalUrl: session.customer_portal_url,
  });
});

/**
 * POST /api/polar/transfer
 * Finds a license key under a customer account and deactivates all existing activations
 * so the client can re-activate on the current device.
 *
 * Accepts either a sessionToken (already have one from /customer-session) or an email
 * (will create a new session internally).
 */
polarRouter.post("/transfer", async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON" }, 400);
  }

  const b = body as Record<string, string>;
  const licenseKey = b.licenseKey?.trim();
  const organizationId = b.organizationId?.trim();
  const email = b.email?.trim().toLowerCase();
  const sessionToken = b.sessionToken?.trim();

  if (!(licenseKey && organizationId)) {
    return c.json({ error: "licenseKey and organizationId are required" }, 400);
  }
  if (!(email || sessionToken)) {
    return c.json({ error: "email or sessionToken is required" }, 400);
  }

  let token = sessionToken;

  if (!token) {
    // email is guaranteed non-null here: the guard above ensures email || sessionToken is set,
    // and we only enter this branch when sessionToken is falsy.
    const customersRes = await fetch(
      `${POLAR_BASE}/v1/customers/?email=${encodeURIComponent(email as string)}&limit=1`,
      { headers: { Authorization: `Bearer ${env.POLAR_ACCESS_TOKEN}` } }
    );
    if (!customersRes.ok)
      return c.json({ error: "Failed to reach Polar" }, 502);

    const customers = (await customersRes.json()) as {
      items: Array<{ id: string }>;
    };
    const customer = customers.items?.[0];
    if (!customer) {
      return c.json({ error: "No account found for this email address" }, 404);
    }

    const sessionRes = await fetch(`${POLAR_BASE}/v1/customer-sessions/`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.POLAR_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ customer_id: customer.id }),
    });
    if (!sessionRes.ok)
      return c.json({ error: "Failed to create session" }, 502);

    const session = (await sessionRes.json()) as { token: string };
    token = session.token;
  }

  // List all customer portal license keys to find the matching one
  const keysRes = await fetch(
    `${POLAR_BASE}/v1/customer-portal/license-keys/?limit=100`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  if (!keysRes.ok)
    return c.json({ error: "Failed to fetch license keys" }, 502);

  const keysData = (await keysRes.json()) as {
    items: Array<{ id: string; key: string }>;
  };
  const matchedKey = keysData.items?.find((k) => k.key === licenseKey);

  if (!matchedKey) {
    return c.json(
      { error: "This license key is not associated with that account" },
      404
    );
  }

  // Fetch the license key with its activations (admin API)
  const keyDetailRes = await fetch(
    `${POLAR_BASE}/v1/license-keys/${matchedKey.id}`,
    {
      headers: { Authorization: `Bearer ${env.POLAR_ACCESS_TOKEN}` },
    }
  );
  if (!keyDetailRes.ok)
    return c.json({ error: "Failed to fetch activation details" }, 502);

  const keyDetail = (await keyDetailRes.json()) as {
    activations?: Array<{ id: string; label?: string }>;
  };

  const activations = keyDetail.activations ?? [];

  // Deactivate all existing activations in parallel
  await Promise.allSettled(
    activations.map((activation) =>
      fetch(`${POLAR_BASE}/v1/customer-portal/license-keys/deactivate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: licenseKey,
          organization_id: organizationId,
          activation_id: activation.id,
        }),
      })
    )
  );

  return c.json({ success: true, deactivated: activations.length });
});
