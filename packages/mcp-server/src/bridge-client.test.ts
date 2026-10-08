import { afterAll, expect, test } from "bun:test";
import { serve } from "bun";
import { bridgeClient } from "./bridge-client.js";

const token = "a".repeat(43);
let calls = 0;
const server = serve({
  hostname: "127.0.0.1",
  port: 0,
  fetch(request) {
    calls++;
    if (request.headers.get("Authorization") !== `Bearer ${token}`)
      return new Response(null, { status: 401 });
    return Response.json({ tools: [], path: new URL(request.url).pathname });
  },
});
afterAll(() => server.stop(true));
test("only configured local bridge requests send the shared credential", async () => {
  expect(() => bridgeClient(server.url.href, undefined)).toThrow(
    "configuration"
  );
  expect(() => bridgeClient("https://attacker.example", token)).toThrow(
    "local HTTP"
  );
  expect(() =>
    bridgeClient("http://127.0.0.1@attacker.example", token)
  ).toThrow("local HTTP");
  expect(calls).toBe(0);
  const request = bridgeClient(server.url.href, token);
  expect((await request("/api/tools")).status).toBe(200);
  expect(
    (
      await request("/api/tools/call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      })
    ).status
  ).toBe(200);
  expect(calls).toBe(2);
});
