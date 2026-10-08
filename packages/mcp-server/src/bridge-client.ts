export function bridgeClient(base: string, token: string | undefined) {
  const url = new URL(base);
  if (
    url.protocol !== "http:" ||
    !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  )
    throw new Error("BACKSTAGE_API_URL must be a local HTTP bridge origin");
  if (!(token && /^[A-Za-z0-9_-]{43}$/.test(token)))
    throw new Error(
      "Copy the authenticated MCP configuration from Backstage Settings"
    );
  return (path: "/api/tools" | "/api/tools/call", init?: RequestInit) =>
    fetch(new URL(path, url), {
      ...init,
      redirect: "error",
      signal: AbortSignal.timeout(35_000),
      headers: {
        ...Object.fromEntries(new Headers(init?.headers)),
        Authorization: `Bearer ${token}`,
      },
    });
}
