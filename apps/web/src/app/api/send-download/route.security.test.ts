import { afterAll, expect, mock, spyOn, test } from "bun:test";

process.env.USESEND_API_KEY = "test-only";
process.env.USESEND_HOST = "https://mail.example";
let admitted = false;
const providerUrls: string[] = [];
mock.module("@/lib/download-email-budget", () => ({
  reserveDownloadEmail: async () => admitted,
}));
const fetchSpy = spyOn(globalThis, "fetch").mockImplementation(
  Object.assign(
    async (url: string | URL | Request) => {
      providerUrls.push(String(url));
      return Response.json({ ok: true });
    },
    { preconnect: globalThis.fetch.preconnect }
  )
);
afterAll(() => {
  fetchSpy.mockRestore();
});
const { POST } = await import("./route");
function request(body: unknown) {
  return new Request("https://frontend.example/api/send-download", {
    method: "POST",
    body: JSON.stringify(body),
  });
}
test("rejected or oversized requests send nothing and delivery never subscribes the recipient", async () => {
  expect(
    (await POST(request({ email: "user@example.com", name: "User" }))).status
  ).toBe(429);
  expect((await POST(request({ email: "invalid", name: "User" }))).status).toBe(
    400
  );
  expect(
    (await POST(request({ email: "user@example.com", name: "x".repeat(5000) })))
      .status
  ).toBe(413);
  expect(providerUrls).toHaveLength(0);
  admitted = true;
  expect(
    (await POST(request({ email: "user@example.com", name: "User" }))).status
  ).toBe(200);
  expect(providerUrls).toEqual(["https://mail.example/api/v1/emails"]);
});
