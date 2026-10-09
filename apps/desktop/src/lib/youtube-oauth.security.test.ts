import { expect, mock, test } from "bun:test";

let fail = true;
const calls: Array<{ command: string; args: Record<string, unknown> }> = [];
mock.module("@/lib/logger", () => ({ logger: { error: () => {} } }));
mock.module("@tauri-apps/api/core", () => ({
  invoke: async (command: string, args: Record<string, unknown>) => {
    calls.push({ command, args });
    if (command === "secure_storage_retrieve")
      return args.key === "yt_oauth_refresh_token"
        ? "refresh-token"
        : "expired-access-token";
    if (command === "youtube_oauth_revoke" && fail)
      throw new Error("Provider unavailable");
  },
}));
const { revokeOAuth } = await import("./youtube-oauth");
test("revocation failure retains secrets and success revokes the refresh grant before local deletion", async () => {
  await expect(revokeOAuth()).rejects.toThrow("Provider unavailable");
  expect(
    calls.some((call) => call.command === "secure_storage_remove_encrypted")
  ).toBe(false);
  expect(
    calls.find((call) => call.command === "youtube_oauth_revoke")?.args
      .accessToken
  ).toBe("refresh-token");
  fail = false;
  calls.length = 0;
  await revokeOAuth();
  const revoke = calls.findIndex(
    (call) => call.command === "youtube_oauth_revoke"
  );
  const deletion = calls.findIndex(
    (call) => call.command === "secure_storage_remove_encrypted"
  );
  expect(revoke).toBeGreaterThanOrEqual(0);
  expect(deletion).toBeGreaterThan(revoke);
});
