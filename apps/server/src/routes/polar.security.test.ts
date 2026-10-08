import { afterAll, expect, mock, spyOn, test } from "bun:test";
import { MongoClient } from "mongodb";

let session: { user: { email: string; emailVerified: boolean } } | null = null;
mock.module("@backstage/auth", () => ({
  auth: { api: { getSession: () => Promise.resolve(session) } },
}));
mock.module("@backstage/env/server", () => ({
  env: {
    CORS_ORIGIN: "https://backstage.test",
    POLAR_ACCESS_TOKEN: "test-admin-token",
  },
}));
const client = new MongoClient(
  process.env.POLAR_TEST_MONGO_URL ?? "mongodb://127.0.0.1:1"
);
const database = client.db(
  `polar_security_${crypto.randomUUID().replaceAll("-", "")}`
);
mock.module("@backstage/db", () => ({ client: database }));
process.env.RENEWAL_BEARER_SECRET = "test-renewal-secret";
process.env.POLAR_RENEWAL_PRODUCT_ID = "renewal-product";
const { polarRouter } = await import("./polar");
const calls: { url: string; body?: string }[] = [];
let paid = true;
let product = "renewal-product";
let keyOrg = "own-org";
let deactivateOk = true;
let expiresAt = "2030-01-01T00:00:00.000Z";
const response = (value: unknown, status = 200) =>
  Promise.resolve(Response.json(value, { status }));
const fetchSpy = spyOn(globalThis, "fetch").mockImplementation(
  Object.assign(
    (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, body: init?.body as string | undefined });
      if (url.includes("/v1/orders/")) {
        return response({
          id: url.split("/").at(-1),
          paid,
          product_id: product,
          customer_id: "own-customer",
          customer: { email: "owner@example.com" },
        });
      }
      if (url.includes("/v1/customers/?")) {
        return response({ items: [{ id: "own-customer" }] });
      }
      if (url.endsWith("/v1/customer-sessions/")) {
        return response({
          token: "own-portal",
          customer_portal_url: "https://polar.test/portal",
        });
      }
      if (url.includes("/customer-portal/license-keys/?")) {
        return response({
          items: [{ id: "own-key", key: "license", organization_id: keyOrg }],
        });
      }
      if (url.endsWith("/deactivate")) {
        return response({}, deactivateOk ? 200 : 502);
      }
      if (url.includes("/v1/license-keys/?")) {
        return response({
          items: [
            {
              id: "own-key",
              customer_id: "own-customer",
              expires_at: expiresAt,
              status: "granted",
              created_at: "2025-01-01",
            },
          ],
          pagination: { max_page: 1 },
        });
      }
      if (url.endsWith("/v1/license-keys/own-key")) {
        if (init?.method === "PATCH") {
          expiresAt = JSON.parse(String(init.body)).expires_at;
          return response({});
        }
        return response({
          expires_at: expiresAt,
          activations: [{ id: "activation" }],
        });
      }
      throw new Error(`Unexpected fixture request: ${url}`);
    },
    { preconnect: globalThis.fetch.preconnect }
  )
);
afterAll(async () => {
  fetchSpy.mockRestore();
  if (process.env.POLAR_TEST_MONGO_URL) {
    await database.dropDatabase();
    await client.close();
  }
});
const post = (
  path: string,
  body: unknown,
  headers: Record<string, string> = {}
) =>
  polarRouter.request(path, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
test("portal and transfer require verified identity and enforce owner organization before admin or destructive calls", async () => {
  calls.length = 0;
  expect(
    (await post("/customer-session", { email: "victim@example.com" })).status
  ).toBe(401);
  expect(
    (
      await post("/transfer", {
        licenseKey: "license",
        organizationId: "own-org",
        sessionToken: "victim-token",
      })
    ).status
  ).toBe(401);
  expect(calls).toHaveLength(0);
  session = { user: { email: "owner@example.com", emailVerified: false } };
  expect((await post("/customer-session", {})).status).toBe(401);
  session.user.emailVerified = true;
  expect(
    (
      await post(
        "/customer-session",
        {},
        { cookie: "session=test", origin: "https://attacker.test" }
      )
    ).status
  ).toBe(401);
  expect(
    (
      await post(
        "/customer-session",
        { email: "victim@example.com" },
        { cookie: "session=test", origin: "https://backstage.test" }
      )
    ).status
  ).toBe(200);
  expect(calls[0]?.url).toContain("email=owner%40example.com");
  calls.length = 0;
  keyOrg = "foreign-org";
  expect(
    (
      await post("/transfer", {
        licenseKey: "license",
        organizationId: "own-org",
      })
    ).status
  ).toBe(404);
  expect(
    calls.some(
      (call) =>
        call.url.includes("/v1/license-keys/own-key") ||
        call.url.endsWith("/deactivate")
    )
  ).toBe(false);
  keyOrg = "own-org";
  expect(
    (
      await post("/transfer", {
        licenseKey: "license",
        organizationId: "own-org",
      })
    ).status
  ).toBe(200);
  deactivateOk = false;
  expect(
    (
      await post("/transfer", {
        licenseKey: "license",
        organizationId: "own-org",
      })
    ).status
  ).toBe(502);
});
test("renewals require a real paid product order, and retries extend once", async () => {
  if (!process.env.POLAR_TEST_MONGO_URL) {
    throw new Error(
      "POLAR_TEST_MONGO_URL is required for the real Mongo renewal test"
    );
  }
  await client.connect();
  calls.length = 0;
  expect(
    (await post("/renew-updates", { email: "victim@example.com" })).status
  ).toBe(401);
  const headers = { authorization: "Bearer test-renewal-secret" };
  expect(
    (await post("/renew-updates", { email: "victim@example.com" }, headers))
      .status
  ).toBe(400);
  paid = false;
  expect(
    (await post("/renew-updates", { orderId: "order-1" }, headers)).status
  ).toBe(400);
  paid = true;
  product = "unrelated-product";
  expect(
    (await post("/renew-updates", { orderId: "order-1" }, headers)).status
  ).toBe(400);
  expect(calls.some((call) => call.body?.includes("expires_at"))).toBe(false);
  product = "renewal-product";
  expect(
    (await post("/renew-updates", { orderId: "order-1" }, headers)).status
  ).toBe(200);
  expect(expiresAt).toBe("2031-01-01T00:00:00.000Z");
  expect(
    (await post("/renew-updates", { orderId: "order-1" }, headers)).status
  ).toBe(200);
  expect(expiresAt).toBe("2031-01-01T00:00:00.000Z");
  expect(
    calls.filter((call) => call.body?.includes("expires_at"))
  ).toHaveLength(1);
});

test("signed paid-order webhooks accept exact bodies and reject tampering and stale delivery", async () => {
  process.env.POLAR_WEBHOOK_SECRET = "whsec_raw-polar-test";
  const body = JSON.stringify({ type: "order.paid", data: { id: "order-1" } });
  const timestamp = String(Math.floor(Date.now() / 1000));
  const sign = async (ts: string) => {
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(process.env.POLAR_WEBHOOK_SECRET),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    return Buffer.from(
      await crypto.subtle.sign(
        "HMAC",
        key,
        new TextEncoder().encode(`delivery.${ts}.${body}`)
      )
    ).toString("base64");
  };
  const request = (raw: string, ts: string, signature: string) =>
    polarRouter.request("/renew-updates", {
      method: "POST",
      body: raw,
      headers: {
        "content-type": "application/json",
        "webhook-id": "delivery",
        "webhook-timestamp": ts,
        "webhook-signature": `v1,${signature}`,
      },
    });
  calls.length = 0;
  expect(
    (await request(`${body} `, timestamp, await sign(timestamp))).status
  ).toBe(401);
  const stale = String(Number(timestamp) - 601);
  expect((await request(body, stale, await sign(stale))).status).toBe(401);
  expect(calls).toHaveLength(0);
  expect((await request(body, timestamp, await sign(timestamp))).status).toBe(
    200
  );
  expect(expiresAt).toBe("2031-01-01T00:00:00.000Z");
  process.env.POLAR_WEBHOOK_SECRET = undefined;
});
