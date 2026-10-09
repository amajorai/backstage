/** Only bytes matching a release-pinned SHA-256 may become executable blob URLs. */
export async function verifiedAssetURL(
  url: string,
  expectedSha256: string,
  maxBytes: number,
  mimeType: string
): Promise<string> {
  const response = await fetch(url, { signal: AbortSignal.timeout(60_000) });
  if (
    !response.ok ||
    Number(response.headers.get("content-length") ?? 0) > maxBytes
  )
    throw new Error("Executable asset download failed");
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Executable asset body missing");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      throw new Error("Executable asset exceeds its size limit");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  const digest = Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
    (byte) => byte.toString(16).padStart(2, "0")
  ).join("");
  if (digest !== expectedSha256)
    throw new Error("Executable asset integrity check failed");
  return URL.createObjectURL(new Blob([bytes], { type: mimeType }));
}
