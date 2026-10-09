import { expect, spyOn, test } from "bun:test";
import { sendAccountVerification } from "./email-verification";

test("verification delivery uses a server-generated link and fails clearly when mail is unavailable", async () => {
  const originalKey = process.env.RESEND_API_KEY;
  const originalFrom = process.env.VERIFICATION_FROM_EMAIL;
  let body: Record<string, unknown> | undefined;
  let status = 200;
  const spy = spyOn(globalThis, "fetch").mockImplementation(
    Object.assign(
      (_input: Parameters<typeof fetch>[0], init?: RequestInit) => {
        body = JSON.parse(String(init?.body));
        return Promise.resolve(new Response(null, { status }));
      },
      { preconnect: globalThis.fetch.preconnect }
    )
  );
  try {
    Reflect.deleteProperty(process.env, "RESEND_API_KEY");
    Reflect.deleteProperty(process.env, "VERIFICATION_FROM_EMAIL");
    await expect(
      sendAccountVerification(
        { email: "owner@example.com" },
        "https://api.example/verify?token=test"
      )
    ).rejects.toThrow();
    expect(body).toBeUndefined();
    process.env.RESEND_API_KEY = "test-key";
    process.env.VERIFICATION_FROM_EMAIL = "Backstage <verify@example.com>";
    await sendAccountVerification(
      { email: "owner@example.com" },
      "https://api.example/verify?token=test"
    );
    expect(body?.to).toEqual(["owner@example.com"]);
    expect(body?.text).toContain("https://api.example/verify?token=test");
    status = 503;
    await expect(
      sendAccountVerification(
        { email: "owner@example.com" },
        "https://api.example/verify?token=test"
      )
    ).rejects.toThrow();
  } finally {
    spy.mockRestore();
    if (originalKey === undefined) {
      Reflect.deleteProperty(process.env, "RESEND_API_KEY");
    } else {
      process.env.RESEND_API_KEY = originalKey;
    }
    if (originalFrom === undefined) {
      Reflect.deleteProperty(process.env, "VERIFICATION_FROM_EMAIL");
    } else {
      process.env.VERIFICATION_FROM_EMAIL = originalFrom;
    }
  }
});
