import { NextResponse } from "next/server";

const USESEND_API_KEY = process.env.USESEND_API_KEY;
const USESEND_HOST = process.env.USESEND_HOST ?? "https://send.amajor.ai";
const DOWNLOAD_URL = "https://github.com/amajorai/backstage/releases/latest";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim() : "";

  if (!(email && email.includes("@"))) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }

  if (!USESEND_API_KEY) {
    return NextResponse.json(
      { error: "Email service not configured" },
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
    const text = await res.text().catch(() => "");
    return NextResponse.json(
      { error: `Failed to send email: ${text}` },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true });
}
