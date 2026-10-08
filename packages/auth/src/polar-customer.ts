import type { Polar } from "@polar-sh/sdk";
import { APIError } from "better-auth/api";

interface Account {
  id: string;
  email: string;
  emailVerified: boolean;
}
/** Only a verified account can associate a Polar customer with its login ID. */
export async function ensureVerifiedPolarCustomer(
  user: Account | undefined,
  client: Polar
): Promise<void> {
  if (!user?.emailVerified) {
    throw new APIError("FORBIDDEN", {
      message: "Verify your email before accessing billing",
    });
  }
  const email = user.email.trim().toLowerCase();
  const { result } = await client.customers.list({ email, limit: 2 });
  const customers = result.items.filter(
    (customer) => customer.email.trim().toLowerCase() === email
  );
  if (customers.length > 1) {
    throw new APIError("CONFLICT", {
      message: "Customer association requires support",
    });
  }
  const customer = customers[0];
  if (!customer) {
    await client.customers.create({ email, externalId: user.id });
    return;
  }
  if (customer.externalId && customer.externalId !== user.id) {
    throw new APIError("CONFLICT", {
      message: "Customer association requires support",
    });
  }
  if (!customer.externalId) {
    await client.customers.update({
      id: customer.id,
      customerUpdate: { externalId: user.id },
    });
  }
  // Verify the exact external-ID lookup used by the plugin, including legacy bindings.
  const linked = await client.customers.getExternal({ externalId: user.id });
  if (
    linked.id !== customer.id ||
    linked.email.trim().toLowerCase() !== email
  ) {
    throw new APIError("FORBIDDEN", { message: "Customer identity mismatch" });
  }
}
