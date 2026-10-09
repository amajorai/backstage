import { afterAll, expect, spyOn, test } from "bun:test";
import { verifiedAssetURL } from "./verified-asset";

const digest =
  "770e607624d689265ca6c44884d0807d9b054d23c473c106c72be9de08b7376c";
let body = "good";
const fetchSpy = spyOn(globalThis, "fetch").mockImplementation(
  Object.assign(async () => new Response(body), {
    preconnect: globalThis.fetch.preconnect,
  })
);
afterAll(() => fetchSpy.mockRestore());
test("only verified bounded bytes become executable blob URLs", async () => {
  const url = await verifiedAssetURL(
    "https://asset.example/core",
    digest,
    4,
    "application/wasm"
  );
  expect(url.startsWith("blob:")).toBe(true);
  URL.revokeObjectURL(url);
  body = "evil";
  await expect(
    verifiedAssetURL(
      "https://asset.example/core",
      digest,
      4,
      "application/wasm"
    )
  ).rejects.toThrow("integrity");
  body = "good-extra";
  await expect(
    verifiedAssetURL(
      "https://asset.example/core",
      digest,
      4,
      "application/wasm"
    )
  ).rejects.toThrow("size limit");
});
