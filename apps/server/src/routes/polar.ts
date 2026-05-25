import { timingSafeEqual } from "node:crypto";
import { env } from "@backstage/env/server";
import { Hono } from "hono";

const POLAR_BASE =
  process.env.POLAR_ENV === "sandbox"
    ? "https://sandbox-api.polar.sh"
    : "https://api.polar.sh";

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

/**
 * POST /api/polar/renew-updates
 * Extends the update window on a customer's license key by 1 year.
 * Identified solely by email — no key entry needed on the user side.
 *
 * Auth is required, enforced two ways:
 *   1. Polar webhook signature (Standard Webhooks format) — three headers
 *      `webhook-id`, `webhook-timestamp`, `webhook-signature`. Verified as
 *      HMAC-SHA256 over `{id}.{timestamp}.{body}` using POLAR_WEBHOOK_SECRET,
 *      base64-encoded, in `v1,<sig>` format. Timestamp must be within ±5 min
 *      to prevent replay.
 *   2. Shared bearer secret (fallback for ops/manual extension) —
 *      `Authorization: Bearer <RENEWAL_BEARER_SECRET>`.
 * Without one of these, the request is rejected.
 */
type AuthCtx = {
  req: { header: (name: string) => string | undefined; raw: Request };
};

const WEBHOOK_TOLERANCE_SECONDS = 5 * 60;

/** Constant-time string equality. Length mismatch leaks length, acceptable for fixed-format secrets. */
function safeEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a, "utf8");
  const bBuf = Buffer.from(b, "utf8");
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

async function computeWebhookSignature(
  secret: string,
  webhookId: string,
  webhookTimestamp: string,
  body: string
): Promise<string> {
  const enc = new TextEncoder();
  const signedPayload = `${webhookId}.${webhookTimestamp}.${body}`;
  // Polar uses the secret as raw bytes (including any `whsec_` prefix); it
  // does NOT base64-decode it per the strict Standard Webhooks spec.
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sigBytes = await crypto.subtle.sign(
    "HMAC",
    key,
    enc.encode(signedPayload)
  );
  return Buffer.from(sigBytes).toString("base64");
}

async function verifyRenewalAuth(
  c: AuthCtx
): Promise<{ ok: true; bodyText: string } | { ok: false; reason: string }> {
  const bodyText = await c.req.raw.clone().text();

  const webhookId = c.req.header("webhook-id");
  const webhookTimestamp = c.req.header("webhook-timestamp");
  const webhookSigHeader = c.req.header("webhook-signature");
  const webhookSecret = process.env.POLAR_WEBHOOK_SECRET;
  const sharedSecret = process.env.RENEWAL_BEARER_SECRET;

  // Fail loud on misconfigured deploy rather than silently rejecting everything
  if (!(webhookSecret || sharedSecret)) {
    return {
      ok: false,
      reason:
        "Server misconfigured: POLAR_WEBHOOK_SECRET or RENEWAL_BEARER_SECRET must be set",
    };
  }

  if (webhookId && webhookTimestamp && webhookSigHeader) {
    if (!webhookSecret) return { ok: false, reason: "Unauthorized" };

    const ts = Number.parseInt(webhookTimestamp, 10);
    if (!Number.isFinite(ts)) {
      return { ok: false, reason: "Invalid webhook timestamp" };
    }
    const nowSec = Math.floor(Date.now() / 1000);
    if (Math.abs(nowSec - ts) > WEBHOOK_TOLERANCE_SECONDS) {
      return { ok: false, reason: "Webhook timestamp outside tolerance" };
    }

    const expected = await computeWebhookSignature(
      webhookSecret,
      webhookId,
      webhookTimestamp,
      bodyText
    );

    // The header is space-separated `v1,<sig> v1,<sig2> ...` to support key rotation
    for (const versioned of webhookSigHeader.split(" ").filter(Boolean)) {
      const [version, sig] = versioned.split(",", 2);
      if (version !== "v1" || !sig) continue;
      if (safeEqual(expected, sig)) return { ok: true, bodyText };
    }
    return { ok: false, reason: "Invalid webhook signature" };
  }

  const bearer = c.req.header("authorization");
  if (bearer && sharedSecret && safeEqual(bearer, `Bearer ${sharedSecret}`)) {
    return { ok: true, bodyText };
  }

  return { ok: false, reason: "Unauthorized" };
}

polarRouter.post("/renew-updates", async (c) => {
  const auth = await verifyRenewalAuth(c);
  if (!auth.ok) return c.json({ error: auth.reason }, 401);

  let body: unknown;
  try {
    body = JSON.parse(auth.bodyText);
  } catch {
    return c.json({ error: "Invalid JSON" }, 400);
  }

  // Accept either a flat { email } payload or a Polar webhook envelope
  // { type, data: { customer: { email } } }.
  const flat = body as { email?: unknown };
  const webhook = body as {
    type?: string;
    data?: { customer?: { email?: unknown } };
  };
  const rawEmail =
    typeof flat.email === "string"
      ? flat.email
      : typeof webhook.data?.customer?.email === "string"
        ? webhook.data.customer.email
        : null;
  const email = rawEmail?.trim().toLowerCase() ?? null;
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
  if (!customer)
    return c.json({ error: "No account found for this email" }, 404);

  // Polar's /v1/license-keys/ list endpoint silently ignores customer_id as a
  // query parameter — it only honours organization_id/benefit_id/page/limit.
  // So we have to fetch org-wide and filter on `customer_id` client-side.
  // We paginate so an org with many license keys still finds the customer's.
  type LicenseKey = {
    id: string;
    customer_id: string;
    expires_at: string | null;
    status: string;
    created_at: string;
  };
  type ListResponse = {
    items: LicenseKey[];
    pagination?: { total_count?: number; max_page?: number };
  };

  const matchingKeys: LicenseKey[] = [];
  const PAGE_LIMIT = 100;
  const MAX_PAGES = 50; // hard ceiling to avoid runaway loops
  let page = 1;
  let maxPage = 1;
  while (page <= Math.min(maxPage, MAX_PAGES)) {
    const keysRes = await fetch(
      `${POLAR_BASE}/v1/license-keys/?limit=${PAGE_LIMIT}&page=${page}`,
      { headers: { Authorization: `Bearer ${env.POLAR_ACCESS_TOKEN}` } }
    );
    if (!keysRes.ok)
      return c.json({ error: "Failed to fetch license keys" }, 502);

    const keysData = (await keysRes.json()) as ListResponse;
    for (const k of keysData.items ?? []) {
      if (k.customer_id === customer.id && k.status === "granted") {
        matchingKeys.push(k);
      }
    }
    maxPage = keysData.pagination?.max_page ?? page;
    page += 1;
  }

  // Pick the most-recently-created granted key
  const activeKey = matchingKeys.sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )[0];
  if (!activeKey)
    return c.json(
      { error: "No active license key found for this customer" },
      404
    );

  // Extend: max(current expiresAt, now) + 1 year
  const base = activeKey.expires_at
    ? new Date(Math.max(new Date(activeKey.expires_at).getTime(), Date.now()))
    : new Date();
  base.setFullYear(base.getFullYear() + 1);

  const patchRes = await fetch(
    `${POLAR_BASE}/v1/license-keys/${activeKey.id}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${env.POLAR_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ expires_at: base.toISOString() }),
    }
  );

  if (!patchRes.ok) {
    const err = await patchRes.text();
    return c.json({ error: `Failed to extend license: ${err}` }, 502);
  }

  return c.json({
    success: true,
    licenseKeyId: activeKey.id,
    newExpiresAt: base.toISOString(),
  });
});
