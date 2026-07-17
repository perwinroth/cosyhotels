import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getServerSupabase } from "@/lib/supabase/server";
import { resolveSavedListPicks } from "@/lib/tripsLive";
import { translate } from "@/lib/i18n/translate";
import { stay22AllezUrl } from "@/lib/affiliates";
import { resolveBookingCta, getStay22WrongSlugs } from "@/lib/ctaPolicy";
import { buildSaveLabels } from "@/lib/i18n/saveLabels";
import HotelCard from "@/components/HotelCard";
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
  const suffix = await t("A cosy hotel collection on Got Cosy");
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
    lDefaultTitle, lYourCollection, lNoPicks, lRemove, lRemoving, lMethod, lDisclosureBase, lDisclosureAffiliate, lShareCollection, lIntro,
  ] = await Promise.all([
    t("Your Got Cosy collection"),
    t("Hotels in this collection"),
    t("None of the saved hotels currently clear our cosy bar. They may return if they are rescored."),
    t("Remove"),
    t("Removing…"),
    t("How we score cosiness"),
    t("Hotel picks are our own AI cosy scores, read live at the moment you open this page; the scores are not for sale."),
    t("Links to book are affiliate links."),
    t("Share collection"),
    t("A collection of cosy hotels on Got Cosy, each scored 0 to 10 for warmth and character."),
  ]);
  const saveLabels = await buildSaveLabels(params.locale);

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
  // Verdict-gated CTA swap (founder FINAL rule, 2026-07-16): fail-safe empty set by default.
  const wrongSlugs = await getStay22WrongSlugs(getServerSupabase());
  // Affiliate-disclosure gate: only meaningful when a Stay22 button actually renders somewhere on
  // this list; a list made entirely of verified-wrong hotels with real websites has no affiliate link.
  const anyStay22 = picks.some((p) => resolveBookingCta(p.website, "", wrongSlugs.has(p.slug)).mode === "stay22");
  const displayTitle = (list.title || "").trim() || lDefaultTitle;
  const detailsHref = (slug: string) => `/${params.locale}/hotels/${slug}`;
  // CLEAN public URL only, never the ?token= edit link — ShareButton takes `url` explicitly so this
  // is what gets shared, never window.location (which may carry the owner's own ?token=).
  const publicListUrl = `/${params.locale}/trips/lists/${list.slug}`;

  // Vetted photos, same pattern as the city facet page (src/app/[locale]/cosy-hotels/[facet]/[city]/page.tsx):
  // batch-fetch vision_ok images for the picks' hotel ids, chunked 150 at a time, skip placeholder art,
  // keep the first vetted photo per hotel. Feeds the thumbnail below AND the JSON-LD image field.
  const photo = new Map<string, string>();
  if (picks.length > 0) {
    const db = getServerSupabase();
    if (db) {
      const ids = picks.map((p) => p.id);
      for (let i = 0; i < ids.length; i += 150) {
        const { data: imgs } = await db.from("hotel_images").select("hotel_id,url").in("hotel_id", ids.slice(i, i + 150)).eq("vision_ok", true);
        for (const im of (imgs || []) as Array<{ hotel_id: string | null; url: string | null }>) {
          const hid = im.hotel_id ? String(im.hotel_id) : ""; const u = im.url || "";
          if (hid && u && !u.includes("placehold.co") && !photo.has(hid)) photo.set(hid, u);
        }
      }
    }
  }

  // ItemList JSON-LD upgraded to SEO parity with the city facet page: each item is a full Hotel
  // (not a bare LodgingBusiness name/url), carrying its vetted image when we have one and a
  // review/reviewRating that surfaces the live Cosy score to search engines.
  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: displayTitle,
    numberOfItems: picks.length,
    itemListElement: picks.map((p, i) => ({
      "@type": "ListItem",
      position: i + 1,
      item: {
        "@type": "Hotel",
        name: p.name,
        url: `${SITE}${detailsHref(p.slug)}`,
        ...(photo.get(p.id) ? { image: photo.get(p.id) } : {}),
        review: {
          "@type": "Review",
          author: { "@type": "Organization", name: "Got Cosy" },
          reviewRating: { "@type": "Rating", ratingValue: Number(p.score.toFixed(1)), bestRating: 10, worstRating: 0, name: "Cosy score" },
        },
      },
    })),
  };

  return (
    <article className="mx-auto max-w-3xl px-4 py-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }} />
      {/* Client-only, renders nothing: if this device owns this collection (gc_trip in localStorage)
          and the visitor arrived via the plain public URL, silently adds their own ?token= so the
          remove controls below appear without them needing to keep the emailed/copied link. */}
      <PlanOwnerControls slug={list.slug} />
      <div className="flex items-start justify-between gap-4">
        <h1 className="font-display text-3xl md:text-4xl font-semibold tracking-tight">{displayTitle}</h1>
        <div className="flex-none pt-1">
          <ShareButton variant="pill" label={lShareCollection} title={displayTitle} url={publicListUrl} />
        </div>
      </div>
      <p className="mt-3 text-base" style={{ color: "var(--muted)" }}>{lIntro}</p>

      <section className="mt-8">
        <h2 className="text-xl font-semibold">{lYourCollection}</h2>
        {picks.length > 0 ? (
          <ol className="mt-4 space-y-3">
            {picks.map((p) => {
              const stay22Href = stay22AllezUrl({ name: p.name, city: p.city, country: p.country, lat: p.lat, lng: p.lng, campaign: "collection" });
              return (
                <HotelCard
                  key={p.slug}
                  slug={p.slug}
                  name={p.name}
                  city={p.city}
                  country={p.country}
                  score={p.score}
                  // The full live description is deliberate SEO content on a collection page, never
                  // clamped (this is what makes the page content-rich and indexable, not a bare list).
                  snippet={p.description}
                  clampSnippet={false}
                  photo={photo.get(p.id)}
                  locale={params.locale}
                  saveLabels={saveLabels}
                  stay22Href={stay22Href}
                  website={p.website}
                  isVerifiedWrong={wrongSlugs.has(p.slug)}
                  shareTitle={`${p.name}, a cosy hotel in ${p.city}`}
                  shareUrl={detailsHref(p.slug)}
                  extraActions={canEdit && suppliedToken ? (
                    <TripListRemoveControl slug={list.slug} token={suppliedToken} hotelSlug={p.slug} label={lRemove} removingLabel={lRemoving} />
                  ) : undefined}
                />
              );
            })}
          </ol>
        ) : (
          <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>{lNoPicks}</p>
        )}
      </section>

      <footer className="mt-12 border-t pt-6 text-sm" style={{ borderColor: "var(--line)", color: "var(--muted)" }}>
        <a href={`/${params.locale}/cosy-index`} className="hover:underline">{lMethod}</a>
        <p className="mt-2">{lDisclosureBase}{anyStay22 ? ` ${lDisclosureAffiliate}` : ""}</p>
      </footer>
    </article>
  );
}

// Dynamic per request: a saved list changes whenever its owner adds/removes an item, and the
// ?token= edit affordance must be re-checked every visit (never cached across different visitors).
export const dynamic = "force-dynamic";
