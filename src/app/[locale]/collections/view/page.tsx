import type { Metadata } from "next";
import { getServerSupabase } from "@/lib/supabase/server";
import { hashToken } from "@/lib/savedLists";
import { translate } from "@/lib/i18n/translate";
import CollectionsViewSync, { type SyncEntry } from "@/components/CollectionsViewSync";
import CollectionsForgetButton from "@/components/CollectionsForgetButton";

// The destination of a "find my collections" magic link. Reads ?token=, hashes it, and looks it up
// by hash only (we never store the raw token, src/lib/savedLists.ts hashToken/generateAccessToken).
// Never cached: a token's validity depends on the current time and whether it's already been used.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Your collections",
  robots: { index: false, follow: false },
};

type Props = { params: { locale: string }; searchParams: { token?: string } };

type TokenRow = { email: string; expires_at: string; used_at: string | null };
type ListRow = { slug: string; title: string | null; items: string[] | null; edit_token: string | null };

export default async function CollectionsViewPage({ params, searchParams }: Props) {
  const locale = params.locale;
  const t = (s: string) => (locale === "en" ? Promise.resolve(s) : translate(s, locale));
  const rawToken = searchParams?.token;

  const [expiredHeading, expiredBody, requestNewLink] = await Promise.all([
    t("This link has expired"),
    t("Request a new one and we will send you a fresh link."),
    t("Request a new link"),
  ]);

  function expiredView() {
    return (
      <article className="mx-auto max-w-xl px-4 py-12">
        <h1 className="font-display text-2xl md:text-3xl font-semibold tracking-tight">{expiredHeading}</h1>
        <p className="mt-3 text-sm" style={{ color: "var(--muted)" }}>{expiredBody}</p>
        <a href={`/${locale}/collections/find`} className="mt-4 inline-block text-sm font-medium hover:underline" style={{ color: "var(--ember)" }}>
          {requestNewLink}
        </a>
      </article>
    );
  }

  if (!rawToken || typeof rawToken !== "string") return expiredView();

  const db = getServerSupabase();
  if (!db) return expiredView();

  const tokenHash = hashToken(rawToken);
  const { data: tokenRow } = await db
    .from("collection_access_tokens")
    .select("email,expires_at,used_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();
  const row = tokenRow as TokenRow | null;
  if (!row || new Date(row.expires_at).getTime() < Date.now()) return expiredView();

  // Best-effort mark-as-used: never blocks rendering even if this write fails.
  if (!row.used_at) {
    try {
      await db.from("collection_access_tokens").update({ used_at: new Date().toISOString() }).eq("token_hash", tokenHash);
    } catch {
      /* best-effort */
    }
  }

  // Strictly scoped to the token's own email: this is the only query in the whole feature allowed
  // to select edit_token, because the visitor just proved ownership of this exact email via the
  // emailed link.
  const { data: lists } = await db
    .from("shortlists")
    .select("slug,title,items,edit_token")
    .eq("email", row.email);
  const rows = (lists || []) as ListRow[];

  const [
    heading, forEmail, noneFound, hotelsCountLabel, viewLabel, manageLabel, findAgain,
    forgetHeading, forgetExplanation, forgetButton, forgetConfirmPrompt, forgetConfirmButton,
    forgetCancelButton, forgetDeleting, forgetDone, forgetError,
  ] = await Promise.all([
    t("Your collections"),
    t("Collections for"),
    t("No collections were found for this email."),
    t("hotels"),
    t("View"),
    t("Manage"),
    t("Find by email"),
    t("Delete everything"),
    t("This permanently deletes all your collections and your contact data. This cannot be undone."),
    t("Delete my data"),
    t("Are you sure? This cannot be undone."),
    t("Yes, delete everything"),
    t("Cancel"),
    t("Deleting…"),
    t("Your data has been deleted."),
    t("Something went wrong. Please try again or email per@gotcosy.com."),
  ]);

  const entries: SyncEntry[] = rows.map((r) => ({ slug: r.slug, editToken: r.edit_token || "", title: r.title }));

  return (
    <article className="mx-auto max-w-xl px-4 py-12">
      <CollectionsViewSync entries={entries.filter((e) => e.editToken)} />
      <h1 className="font-display text-2xl md:text-3xl font-semibold tracking-tight">{heading}</h1>
      <p className="mt-2 text-xs" style={{ color: "var(--muted)" }}>{forEmail} {row.email}</p>

      {rows.length === 0 ? (
        <p className="mt-6 text-sm" style={{ color: "var(--muted)" }}>{noneFound}</p>
      ) : (
        <ul className="mt-6 space-y-3">
          {rows.map((r) => {
            const displayTitle = (r.title || "").trim() || heading;
            const count = Array.isArray(r.items) ? r.items.length : 0;
            return (
              <li key={r.slug} className="rounded-xl border p-4" style={{ borderColor: "var(--line)", background: "var(--card)" }}>
                <p className="font-medium" style={{ color: "var(--foreground)" }}>{displayTitle}</p>
                <p className="mt-1 text-xs" style={{ color: "var(--muted)" }}>{count} {hotelsCountLabel}</p>
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <a href={`/${locale}/trips/lists/${r.slug}`} className="text-sm font-medium hover:underline" style={{ color: "var(--ember)" }}>{viewLabel}</a>
                  {r.edit_token && (
                    <a href={`/${locale}/trips/lists/${r.slug}?token=${encodeURIComponent(r.edit_token)}`} className="text-sm font-medium hover:underline" style={{ color: "var(--ember)" }}>
                      {manageLabel}
                    </a>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <a href={`/${locale}/collections/find`} className="mt-8 inline-block text-xs hover:underline" style={{ color: "var(--muted)" }}>{findAgain}</a>

      <CollectionsForgetButton
        token={rawToken}
        labels={{
          heading: forgetHeading,
          explanation: forgetExplanation,
          button: forgetButton,
          confirmPrompt: forgetConfirmPrompt,
          confirmButton: forgetConfirmButton,
          cancelButton: forgetCancelButton,
          deleting: forgetDeleting,
          done: forgetDone,
          error: forgetError,
        }}
      />
    </article>
  );
}
