import { APIError } from "better-auth/api";

export async function sendAccountVerification(
  user: { email: string },
  url: string
): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.VERIFICATION_FROM_EMAIL;
  if (!(key && from)) {
    throw new APIError("SERVICE_UNAVAILABLE", {
      message: "Email verification is unavailable",
    });
  }
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [user.email],
      subject: "Verify your Backstage email",
      text: `Verify your email to access your Backstage licenses and billing:\n\n${url}\n\nIf you did not request this, ignore this email.`,
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    throw new APIError("SERVICE_UNAVAILABLE", {
      message: "Unable to send verification email",
    });
  }
}
