import { client } from "@backstage/db";
import { env } from "@backstage/env/server";
import { expo } from "@better-auth/expo";
import { checkout, polar, portal } from "@polar-sh/better-auth";
import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import {
  APIError,
  createAuthMiddleware,
  getSessionFromCtx,
} from "better-auth/api";
import { sendAccountVerification } from "./email-verification";
import { polarClient } from "./lib/payments";
import { ensureVerifiedPolarCustomer } from "./polar-customer";

export const auth = betterAuth({
  database: mongodbAdapter(client),
  trustedOrigins: [env.CORS_ORIGIN, "mybettertapp://", "exp://"],
  emailAndPassword: {
    enabled: true,
  },
  emailVerification: {
    sendOnSignUp: true,
    sendOnSignIn: true,
    sendVerificationEmail: ({ user, url }) =>
      sendAccountVerification(user, url),
  },
  hooks: {
    before: createAuthMiddleware(async (context) => {
      if (
        !(context.path.startsWith("/customer/") || context.path === "/checkout")
      ) {
        return;
      }
      const session = await getSessionFromCtx(context);
      if (context.query?.referenceId) {
        throw new APIError("FORBIDDEN", {
          message: "Customer references are not supported",
        });
      }
      await ensureVerifiedPolarCustomer(session?.user, polarClient);
    }),
  },
  advanced: {
    defaultCookieAttributes: {
      sameSite: "none",
      secure: true,
      httpOnly: true,
    },
  },
  plugins: [
    polar({
      client: polarClient,
      createCustomerOnSignUp: false,
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
