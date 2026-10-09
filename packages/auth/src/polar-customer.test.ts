import { expect, test } from "bun:test";
import type { Polar } from "@polar-sh/sdk";
import { ensureVerifiedPolarCustomer } from "./polar-customer";

const account = {
  id: "account",
  email: "owner@example.com",
  emailVerified: true,
};
test("unverified accounts cannot look up, create or rebind billing customers", async () => {
  let calls = 0;
  const client = {
    customers: {
      list: () => {
        calls++;
        return Promise.resolve({ result: { items: [] } });
      },
    },
  } as unknown as Polar;
  await expect(
    ensureVerifiedPolarCustomer(undefined, client)
  ).rejects.toThrow();
  await expect(
    ensureVerifiedPolarCustomer({ ...account, emailVerified: false }, client)
  ).rejects.toThrow();
  expect(calls).toBe(0);
});
test("verified owners can associate an unbound customer and retain ordinary existing access", async () => {
  let updates = 0;
  const customer = {
    id: "customer",
    email: account.email,
    externalId: null as string | null,
  };
  const client = {
    customers: {
      list: () => Promise.resolve({ result: { items: [customer] } }),
      update: ({
        customerUpdate,
      }: {
        customerUpdate: { externalId: string };
      }) => {
        updates++;
        customer.externalId = customerUpdate.externalId;
        return Promise.resolve(customer);
      },
      getExternal: () => Promise.resolve(customer),
    },
  } as unknown as Polar;
  await ensureVerifiedPolarCustomer(account, client);
  await ensureVerifiedPolarCustomer(account, client);
  expect(updates).toBe(1);
  expect(customer.externalId).toBe(account.id);
});
test("conflicting and legacy mismatched external customer identities fail closed", async () => {
  const customer = {
    id: "customer",
    email: account.email,
    externalId: "another-account",
  };
  const client = {
    customers: {
      list: () => Promise.resolve({ result: { items: [customer] } }),
      getExternal: () =>
        Promise.resolve({ ...customer, email: "different@example.com" }),
    },
  } as unknown as Polar;
  await expect(ensureVerifiedPolarCustomer(account, client)).rejects.toThrow();
  customer.externalId = account.id;
  await expect(ensureVerifiedPolarCustomer(account, client)).rejects.toThrow();
});
test("verified new customers retain checkout creation", async () => {
  let created: unknown;
  const client = {
    customers: {
      list: () => Promise.resolve({ result: { items: [] } }),
      create: (input: unknown) => {
        created = input;
        return Promise.resolve(input);
      },
    },
  } as unknown as Polar;
  await ensureVerifiedPolarCustomer(account, client);
  expect(created).toEqual({ email: account.email, externalId: account.id });
});
