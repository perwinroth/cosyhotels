import type { Metadata } from "next";
import { getServerSupabase } from "@/lib/supabase/server";
import { translate } from "@/lib/i18n/translate";

// One-click unsubscribe (GDPR / RFC 8058). Reads ?token=<unsubscribe_token>, a stable per-email
// token stored on email_contacts (never the magic-link access token). A plain GET is intentional:
// mail clients pre-fetch List-Unsubscribe links, and unsubscribing is the one action that is safe
// to trigger from a pre-fetch. Idempotent: running it twice (or ten times) leaves the same result.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Unsubscribe",
  robots: { index: false, follow: false },
};

type Props = { params: { locale: string }; searchParams: { token?: string } };

export default async function CollectionsUnsubscribePage({ params, searchParams }: Props) {
  const locale = params.locale;
  const t = (s: string) => (locale === "en" ? Promise.resolve(s) : translate(s, locale));
  const rawToken = searchParams?.token;

  const [heading, confirmedBody, invalidHeading, invalidBody] = await Promise.all([
    t("You have been unsubscribed"),
    t("You will no longer receive marketing emails from Got Cosy."),
    t("This link is not valid"),
    t("This unsubscribe link is not valid. If you still get emails, contact per@gotcosy.com."),
  ]);

  function invalidView() {
    return (
      <article className="mx-auto max-w-xl px-4 py-12">
        <h1 className="font-display text-2xl md:text-3xl font-semibold tracking-tight">{invalidHeading}</h1>
        <p className="mt-3 text-sm" style={{ color: "var(--muted)" }}>{invalidBody}</p>
      </article>
    );
  }

  if (!rawToken || typeof rawToken !== "string") return invalidView();

  const db = getServerSupabase();
  if (!db) return invalidView();

  const { data: row } = await db
    .from("email_contacts")
    .select("email,unsubscribed_at")
    .eq("unsubscribe_token", rawToken)
    .maybeSingle();

  if (!row) return invalidView();

  if (!row.unsubscribed_at) {
    // Best-effort, idempotent: if this races or repeats, the end state is identical either way.
    try {
      const now = new Date().toISOString();
      await db
        .from("email_contacts")
        .update({ marketing_consent: false, unsubscribed_at: now, updated_at: now })
        .eq("unsubscribe_token", rawToken);
    } catch {
      /* best-effort: the confirmation below is shown regardless */
    }
  }

  return (
    <article className="mx-auto max-w-xl px-4 py-12">
      <h1 className="font-display text-2xl md:text-3xl font-semibold tracking-tight">{heading}</h1>
      <p className="mt-3 text-sm" style={{ color: "var(--muted)" }}>{confirmedBody}</p>
    </article>
  );
}
