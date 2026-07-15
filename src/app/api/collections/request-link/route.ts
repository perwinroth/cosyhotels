import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";
import {
  ACCESS_TOKEN_TTL_MIN,
  REQUEST_RATE_LIMIT,
  REQUEST_RATE_WINDOW_MIN,
  generateAccessToken,
  hashToken,
  isValidEmail,
  normalizeLocale,
} from "@/lib/savedLists";
import { resendConfigured, sendEmail } from "@/lib/email/resend";
import { translate } from "@/lib/i18n/translate";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://gotcosy.com";

// Byte-identical generic success, whatever happened (or didn't) server-side. No branch below this
// route may ever return anything else, or the response itself becomes an email-enumeration oracle.
// A fresh NextResponse per call (the underlying body stream is single-use).
const genericResponse = () => NextResponse.json({ ok: true });

// "Find my collections" magic link. POST { email, locale }. Always resolves 200 { ok: true } —
// never reveals whether the email is valid, has collections, was rate-limited, or was sent to.
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const rawEmail: unknown = body.email;
    const locale = normalizeLocale(body.locale);

    if (!isValidEmail(rawEmail)) return genericResponse();
    const email = (rawEmail as string).trim();

    const supabase = getServerSupabase();
    if (!supabase) return genericResponse();

    // Rate-limit: too many requests for this email recently -> silently throttle (still 200 ok).
    const windowStart = new Date(Date.now() - REQUEST_RATE_WINDOW_MIN * 60_000).toISOString();
    const { count } = await supabase
      .from("collection_access_tokens")
      .select("email", { count: "exact", head: true })
      .eq("email", email)
      .gte("created_at", windowStart);
    if ((count || 0) >= REQUEST_RATE_LIMIT) return genericResponse();

    // No enumeration: whether or not this email has any collections, the response is identical.
    const { data: lists } = await supabase.from("shortlists").select("slug").eq("email", email).limit(1);
    if (!lists || lists.length === 0) return genericResponse();

    const raw = generateAccessToken();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ACCESS_TOKEN_TTL_MIN * 60_000).toISOString();
    const { error: insertError } = await supabase.from("collection_access_tokens").insert({
      token_hash: hashToken(raw),
      email,
      created_at: now.toISOString(),
      expires_at: expiresAt,
    });
    if (insertError) return genericResponse();

    if (resendConfigured()) {
      const link = `${SITE}/${locale}/collections/view?token=${raw}`;
      const t = (s: string) => (locale === "en" ? Promise.resolve(s) : translate(s, locale));
      const [subject, intro, cta, expiry, ignore] = await Promise.all([
        t("Your Got Cosy collections"),
        t("Someone asked to find the cosy hotel collections saved with this email."),
        t("Open them here"),
        t("The link works for 30 minutes."),
        t("If this was not you, you can ignore this email."),
      ]);
      const text = `${intro}\n\n${cta}: ${link}\n\n${expiry} ${ignore}`;
      const html = `<p>${intro}</p><p><a href="${link}">${cta}</a></p><p>${expiry} ${ignore}</p>`;
      await sendEmail({ to: email, subject, html, text });
    }

    return genericResponse();
  } catch {
    return genericResponse();
  }
}
