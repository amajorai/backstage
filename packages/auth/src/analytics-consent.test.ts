import { expect, mock, test } from "bun:test";

let analyticsClients = 0;
let configuration: Record<string, unknown> = {};
mock.module("posthog-node", () => ({
  PostHog: class {
    constructor() {
      analyticsClients++;
    }
  },
}));
mock.module("@backstage/db", () => ({ client: {} }));
mock.module("@backstage/env/server", () => ({
  env: {
    POSTHOG_API_KEY: "configured",
    POSTHOG_HOST: "https://analytics.example",
    CORS_ORIGIN: "https://frontend.example",
    POLAR_SUCCESS_URL: "https://frontend.example/success",
  },
}));
mock.module("@better-auth/expo", () => ({ expo: () => ({ id: "expo" }) }));
mock.module("@polar-sh/better-auth", () => ({
  checkout: () => ({ id: "checkout" }),
  polar: () => ({ id: "polar" }),
  portal: () => ({ id: "portal" }),
}));
mock.module("better-auth", () => ({
  betterAuth: (options: Record<string, unknown>) => {
    configuration = options;
    return {};
  },
}));
mock.module("better-auth/adapters/mongodb", () => ({
  mongodbAdapter: () => ({}),
}));
mock.module("./lib/payments", () => ({ polarClient: {} }));
test("configured analytics cannot collect server auth events without account consent", async () => {
  await import("./index");
  expect(analyticsClients).toBe(0);
  expect(configuration.databaseHooks).toBeUndefined();
  expect(configuration.emailAndPassword).toEqual({ enabled: true });
  expect(configuration.trustedOrigins).toContain("https://frontend.example");
});
