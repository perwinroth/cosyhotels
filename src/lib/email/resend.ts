// Transactional email via Resend (magic-link collection access). Server-only, send-only (unlike
// gmail.ts, which only drafts). Never throws: callers get { ok, error } and decide how to react;
// the request-link route in particular must never let a Resend failure leak whether an email
// existed, so this stays a plain boolean/error result.
const API_URL = "https://api.resend.com/emails";

export function resendConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

// Same header-injection guard as gmail.ts's oneLine: strip CR/LF and collapse whitespace so a
// crafted subject or address can never smuggle extra headers into the request body.
const oneLine = (s: string) => s.replace(/[\r\n]+/g, " ").replace(/\s{2,}/g, " ").trim();

export async function sendEmail({
  to,
  subject,
  html,
  text,
}: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { ok: false, error: "email not configured" };
  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM,
        to: oneLine(to),
        subject: oneLine(subject),
        html,
        text,
        reply_to: "per@gotcosy.com",
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { ok: false, error: `resend ${res.status}: ${body.slice(0, 200)}` };
    }
    return { ok: true };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return { ok: false, error: message };
  }
}
