import { client } from "@backstage/db";
import { env } from "@backstage/env/server";
import { expo } from "@better-auth/expo";
import { checkout, polar, portal } from "@polar-sh/better-auth";
import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { PostHog } from "posthog-node";

import { polarClient } from "./lib/payments";

const posthog =
  env.POSTHOG_API_KEY && env.POSTHOG_HOST
    ? new PostHog(env.POSTHOG_API_KEY, {
        host: env.POSTHOG_HOST,
        enableExceptionAutocapture: true,
      })
    : null;

export const auth = betterAuth({
  database: mongodbAdapter(client),
  trustedOrigins: [env.CORS_ORIGIN, "mybettertapp://", "exp://"],
  emailAndPassword: {
    enabled: true,
  },
  advanced: {
    defaultCookieAttributes: {
      sameSite: "none",
      secure: true,
      httpOnly: true,
    },
  },
  databaseHooks: {
    user: {
      create: {
        after: (user) => {
          posthog?.identify({
            distinctId: user.id,
            properties: {
              $set: { email: user.email, name: user.name },
              $set_once: { first_seen: new Date().toISOString() },
            },
          });
          posthog?.capture({
            distinctId: user.id,
            event: "user_signed_up",
            properties: { email: user.email, name: user.name },
          });
          return Promise.resolve();
        },
      },
    },
    session: {
      create: {
        after: (session) => {
          posthog?.capture({
            distinctId: session.userId,
            event: "user_signed_in",
            properties: { session_id: session.id },
          });
          return Promise.resolve();
        },
      },
    },
  },
  plugins: [
    polar({
      client: polarClient,
      createCustomerOnSignUp: true,
      enableCustomerPortal: true,
      use: [
        checkout({
          products: [
            {
              productId: "your-product-id",
              slug: "pro",
            },
          ],
          successUrl: env.POLAR_SUCCESS_URL,
          authenticatedUsersOnly: true,
        }),
        portal(),
      ],
    }),
    expo(),
  ],
});
