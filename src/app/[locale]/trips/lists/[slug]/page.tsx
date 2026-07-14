import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getServerSupabase } from "@/lib/supabase/server";
import { resolveSavedListPicks } from "@/lib/tripsLive";
import { translate } from "@/lib/i18n/translate";
import { cosyBadgeColor } from "@/lib/cosyColor";
import TripListRemoveControl from "@/components/TripListRemoveControl";
import PlanOwnerControls from "@/components/PlanOwnerControls";
import ShareButton from "@/components/ShareButton";

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
    lDefaultTitle, lYourPlan, lNoPicks, lRemove, lRemoving, lMethod, lDisclosure, lSharePlan,
  ] = await Promise.all([
    t("Your Got Cosy plan"),
    t("Hotels in this plan"),
    t("None of the saved hotels currently clear our cosy bar. They may return if they are rescored."),
    t("Remove"),
    t("Removing…"),
    t("How we score cosiness"),
    t("Hotel picks are our own AI cosy scores, read live at the moment you open this page. Links to book are affiliate links; the scores are not for sale."),
    t("Share plan"),
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
  // CLEAN public URL only, never the ?token= edit link — ShareButton takes `url` explicitly so this
  // is what gets shared, never window.location (which may carry the owner's own ?token=).
  const publicListUrl = `/${params.locale}/trips/lists/${list.slug}`;

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
      {/* Client-only, renders nothing: if this device owns this plan (gc_trip in localStorage) and
          the visitor arrived via the plain public URL, silently adds their own ?token= so the
          remove controls below appear without them needing to keep the emailed/copied link. */}
      <PlanOwnerControls slug={list.slug} />
      <div className="flex items-start justify-between gap-4">
        <h1 className="font-display text-3xl md:text-4xl font-semibold tracking-tight">{displayTitle}</h1>
        <div className="flex-none pt-1">
          <ShareButton variant="pill" label={lSharePlan} title={displayTitle} url={publicListUrl} />
        </div>
      </div>

      <section className="mt-8">
        <h2 className="text-xl font-semibold">{lYourPlan}</h2>
        {picks.length > 0 ? (
          <ul className="mt-4 space-y-3">
            {picks.map((p) => (
              <li key={p.slug} className="rounded-xl border p-3" style={{ borderColor: "var(--line)", background: "var(--card)" }}>
                <div className="flex items-center gap-3">
                  <span className="flex-shrink-0 flex items-center justify-center rounded-2xl text-white" style={{ background: cosyBadgeColor(p.score), width: 44, height: 44, fontFamily: "Fraunces, serif", fontSize: 18, fontWeight: 600 }}>
                    {p.score.toFixed(1)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <a href={detailsHref(p.slug)} className="font-medium hover:underline">{p.name}</a>
                    <div className="text-xs" style={{ color: "var(--muted)" }}>{[p.city, p.country].filter(Boolean).join(", ")}</div>
                  </div>
                  {canEdit && suppliedToken && (
                    <TripListRemoveControl slug={list.slug} token={suppliedToken} hotelSlug={p.slug} label={lRemove} removingLabel={lRemoving} />
                  )}
                </div>
                {/* Hotel descriptions are DATA, never translated per locale (same rule as the hotel
                    detail page) — rendered as-is, JSX-escaped. This is what makes each saved plan a
                    content-rich, indexable page instead of a bare name/score list. */}
                {p.description && (
                  <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--foreground)" }}>{p.description}</p>
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
