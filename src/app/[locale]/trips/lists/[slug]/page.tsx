import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getServerSupabase } from "@/lib/supabase/server";
import { resolveSavedListPicks } from "@/lib/tripsLive";
import { translate } from "@/lib/i18n/translate";
import { cosyBadgeColor } from "@/lib/cosyColor";
import TripListRemoveControl from "@/components/TripListRemoveControl";

type Props = { params: { locale: string; slug: string }; searchParams: { token?: string } };

// Same editorial-string rule as the trip board page: everything reader-facing routes through
// translate() for non-en locales. The list TITLE is user data (never translated); hotel
// names/cities/scores are always data too.
const tx = (locale: string) => (s: string) => (locale === "en" ? Promise.resolve(s) : translate(s, locale));

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://gotcosy.com";

/** Substance gate for indexing a saved list: a title AND at least 4 hotels that still clear the
 *  live 5.0 gate. Thin/anonymous lists stay noindex forever (G13 doorway rule) — mirrors the
 *  `shortlists_indexable` view in sql/saved-lists-v1.sql, but re-checked against LIVE picks (a
 *  list can fall below 4 after a rescore even if it started with 4+ items). */
const MIN_INDEXABLE_PICKS = 4;

type ListRow = { slug: string; title: string | null; items: string[]; updated_at: string; locale: string | null };

async function loadList(slug: string): Promise<ListRow | null> {
  const db = getServerSupabase();
  if (!db) return null;
  // Public render query: title/items/updated_at/locale ONLY — email and edit_token never leave
  // the server for this fetch.
  const { data } = await db.from("shortlists").select("slug,title,items,updated_at,locale").eq("slug", slug).maybeSingle();
  if (!data) return null;
  return { slug: data.slug, title: data.title, items: Array.isArray(data.items) ? data.items : [], updated_at: data.updated_at, locale: data.locale };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const list = await loadList(params.slug);
  if (!list) return { robots: { index: false, follow: false } };
  const title = (list.title || "").trim();
  const picks = await resolveSavedListPicks(list.items);
  const indexable = title.length > 0 && picks.length >= MIN_INDEXABLE_PICKS;
  if (!indexable) return { robots: { index: false, follow: false } };

  const t = tx(params.locale);
  const suffix = await t("A cosy travel plan on Got Cosy");
  const descTemplate = await t("hand-picked cosy hotels, chosen with Got Cosy's live cosy scores.");
  const pageTitle = `${title} · ${suffix}`;
  const description = `${title}: ${picks.length} ${descTemplate}`;
  const url = `/${params.locale}/trips/lists/${list.slug}`;
  return {
    title: pageTitle,
    description,
    alternates: { canonical: url },
    openGraph: { title: pageTitle, description, type: "article", url },
    twitter: { card: "summary_large_image", title: pageTitle, description },
  };
}

export default async function SavedListPage({ params, searchParams }: Props) {
  const list = await loadList(params.slug);
  if (!list) notFound();

  const t = tx(params.locale);
  const [
    lDefaultTitle, lYourPlan, lNoPicks, lRemove, lRemoving, lMethod, lDisclosure,
  ] = await Promise.all([
    t("Your Got Cosy plan"),
    t("Hotels in this plan"),
    t("None of the saved hotels currently clear our cosy bar. They may return if they are rescored."),
    t("Remove"),
    t("Removing…"),
    t("How we score cosiness"),
    t("Hotel picks are our own AI cosy scores, read live at the moment you open this page. Links to book are affiliate links; the scores are not for sale."),
  ]);

  // Edit affordance: only when the visitor's own ?token= matches this row's edit_token. The token
  // value is never fetched or rendered unless it already equals what the URL gave us, so nothing
  // new leaks into the HTML beyond what this specific visitor already possesses.
  let canEdit = false;
  const suppliedToken = searchParams?.token;
  if (suppliedToken) {
    const db = getServerSupabase();
    if (db) {
      const { data: tokenRow } = await db.from("shortlists").select("edit_token").eq("slug", params.slug).maybeSingle();
      canEdit = Boolean(tokenRow?.edit_token) && tokenRow!.edit_token === suppliedToken;
    }
  }

  const picks = await resolveSavedListPicks(list.items);
  const displayTitle = (list.title || "").trim() || lDefaultTitle;
  const detailsHref = (slug: string) => `/${params.locale}/hotels/${slug}`;

  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: displayTitle,
    numberOfItems: picks.length,
    itemListElement: picks.map((p, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: p.name,
      item: { "@type": "LodgingBusiness", name: p.name, url: `${SITE}${detailsHref(p.slug)}` },
    })),
  };

  return (
    <article className="mx-auto max-w-3xl px-4 py-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }} />
      <h1 className="font-display text-3xl md:text-4xl font-semibold tracking-tight">{displayTitle}</h1>

      <section className="mt-8">
        <h2 className="text-xl font-semibold">{lYourPlan}</h2>
        {picks.length > 0 ? (
          <ul className="mt-4 space-y-3">
            {picks.map((p) => (
              <li key={p.slug} className="flex items-center gap-3 rounded-xl border p-3" style={{ borderColor: "var(--line)", background: "var(--card)" }}>
                <span className="flex-shrink-0 flex items-center justify-center rounded-2xl text-white" style={{ background: cosyBadgeColor(p.score), width: 44, height: 44, fontFamily: "Fraunces, serif", fontSize: 18, fontWeight: 600 }}>
                  {p.score.toFixed(1)}
                </span>
                <div className="min-w-0">
                  <a href={detailsHref(p.slug)} className="font-medium hover:underline">{p.name}</a>
                  <div className="text-xs" style={{ color: "var(--muted)" }}>{[p.city, p.country].filter(Boolean).join(", ")}</div>
                </div>
                {canEdit && suppliedToken && (
                  <TripListRemoveControl slug={list.slug} token={suppliedToken} hotelSlug={p.slug} label={lRemove} removingLabel={lRemoving} />
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>{lNoPicks}</p>
        )}
      </section>

      <footer className="mt-12 border-t pt-6 text-sm" style={{ borderColor: "var(--line)", color: "var(--muted)" }}>
        <a href={`/${params.locale}/cosy-index`} className="hover:underline">{lMethod}</a>
        <p className="mt-2">{lDisclosure}</p>
      </footer>
    </article>
  );
}

// Dynamic per request: a saved list changes whenever its owner adds/removes an item, and the
// ?token= edit affordance must be re-checked every visit (never cached across different visitors).
export const dynamic = "force-dynamic";
