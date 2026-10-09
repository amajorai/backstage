import { NextResponse } from "next/server";
import { z } from "zod";
import { reserveDownloadEmail } from "@/lib/download-email-budget";

const USESEND_API_KEY = process.env.USESEND_API_KEY;
const USESEND_HOST = process.env.USESEND_HOST ?? "https://send.amajor.ai";
const DOWNLOAD_URL = "https://github.com/amajorai/backstage/releases/latest";
export async function POST(req: Request) {
  const reader = req.body?.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  if (reader) {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 4096) {
        await reader.cancel();
        return NextResponse.json(
          { error: "Request too large" },
          { status: 413 }
        );
      }
      chunks.push(value);
    }
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  const parsed = z
    .object({
      email: z.email().max(254),
      name: z.string().trim().min(1).max(200),
    })
    .safeParse(
      await Promise.resolve()
        .then(() => JSON.parse(new TextDecoder().decode(bytes)))
        .catch(() => null)
    );
  if (!parsed.success)
    return NextResponse.json(
      { error: "Invalid email or name" },
      { status: 400 }
    );
  const { email } = parsed.data;

  if (!USESEND_API_KEY) {
    return NextResponse.json(
      { error: "Email service not configured" },
      { status: 503 }
    );
  }

  try {
    if (!(await reserveDownloadEmail(email)))
      return NextResponse.json(
        {
          error:
            "Download email limit reached. Download directly from GitHub releases.",
        },
        { status: 429 }
      );
  } catch {
    return NextResponse.json(
      {
        error:
          "Email service temporarily unavailable. Download directly from GitHub releases.",
      },
      { status: 503 }
    );
  }

  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#09090b;color:#fff;border-radius:12px">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:24px">
        <span style="font-weight:600;font-size:16px">Backstage</span>
      </div>
      <h1 style="font-size:22px;font-weight:500;margin:0 0 8px">Your download link</h1>
      <p style="color:#a1a1aa;font-size:14px;margin:0 0 24px">
        Click the button below to download the latest version of Backstage.
      </p>
      <a href="${DOWNLOAD_URL}" style="display:inline-block;background:#fff;color:#09090b;font-weight:600;font-size:14px;padding:12px 24px;border-radius:8px;text-decoration:none">
        Download Backstage
      </a>
      <p style="color:#52525b;font-size:12px;margin-top:32px">
        Available for Windows, macOS, and Linux. Free and open source.
      </p>
    </div>
  `;

  const res = await fetch(`${USESEND_HOST}/api/v1/emails`, {
    signal: AbortSignal.timeout(15_000),
    method: "POST",
    headers: {
      Authorization: `Bearer ${USESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Backstage <no-reply@amajor.ai>",
      to: email,
      subject: "Your Backstage download link",
      html,
    }),
  });

  if (!res.ok) {
    return NextResponse.json(
      { error: "Failed to send email" },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true });
}
