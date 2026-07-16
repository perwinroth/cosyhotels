// Curated editorial collection: cosy hotels that were once something else (adaptive reuse) —
// former banks, churches, prisons, post offices, factories, stations, schools, monasteries, palaces.
// A hand-picked slug list (the editorial curation) rendered with LIVE scores + descriptions from
// cosy_scores at request time (never stored snapshots — the blogPickScores invariant), gated at the
// public 5.0, with experiment-control cities (Venice-historic, Savannah) scrubbed at the data layer.
// Grouping by original building type is editorial and translatable; hotel descriptions are live data.
import { cache } from "react";
import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getServerSupabase } from "@/lib/supabase/server";
import { isFacetMintControlCity } from "@/lib/controlMarkets";
import { displayCity, isLatin } from "@/lib/placeText";
import { stay22AllezUrl } from "@/lib/affiliates";
import { cosyBadgeColor } from "@/lib/cosyColor";
import { breadcrumbSchema, jsonLd } from "@/lib/schema";
import { translate } from "@/lib/i18n/translate";
import HotelActions from "@/components/HotelActions";
import { buildSaveLabels } from "@/lib/i18n/saveLabels";
import { getDelistedSlugSet } from "@/lib/delisted";
import { getStay22WrongSlugs } from "@/lib/ctaPolicy";

export const revalidate = 3600;
const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://gotcosy.com";
const PUBLIC_GATE = 5;

// Editorial curation: which hotels, and what each used to be. Order within a group is by live score.
const CURATED: Array<{ slug: string; group: string }> = [
  { slug: "edinburgh-townhouse", group: "Former bank" },
  { slug: "lhotel-in-pietra", group: "Former church" },
  { slug: "den-gamle-arrest", group: "Former prison" },
  { slug: "inn-at-the-old-jail", group: "Former prison" },
  { slug: "belgium-ghent-1898-the-post", group: "Former post office" },
  { slug: "the-kendall-hotel", group: "Former firehouse" },
  { slug: "ny-12534-the-wick-hudson-a-tribute-portfolio-hotel", group: "Former factory & mill" },
  { slug: "me-04005-the-lincoln-hotel", group: "Former factory & mill" },
  { slug: "the-brakeman-hotel", group: "Former railway station" },
  { slug: "zum-alten-bahnhof", group: "Former railway station" },
  { slug: "santa-chiara-boutique-hotel", group: "Former school" },
  { slug: "monastero-santa-rosa-hotel-and-spa", group: "Former monastery & convent" },
  { slug: "prague-augustine-a-luxury-collection-hotel-prague", group: "Former monastery & convent" },
  { slug: "benediktushaus-im-schottenstift", group: "Former monastery & convent" },
  { slug: "hotel-boutique-convento-de-cadiz-9891868", group: "Former monastery & convent" },
  { slug: "donna-camilla-savelli", group: "Former monastery & convent" },
  { slug: "la-cour-sainte-catherine", group: "Former monastery & convent" },
  { slug: "porto-pestana-palacio-do-freixo", group: "Former palace & palazzo" },
  { slug: "palazzo-arrivabene-bed-e-breakfast", group: "Former palace & palazzo" },
  { slug: "palazzo-seneca", group: "Former palace & palazzo" },
  { slug: "edinburgh-eh6-6qn-ocean-mist-2", group: "And a former ship" },
];

const GROUP_ORDER = [
  "Former bank", "Former church", "Former prison", "Former post office", "Former firehouse",
  "Former factory & mill", "Former railway station", "Former school",
  "Former monastery & convent", "Former palace & palazzo", "And a former ship",
];

type Hotel = { id: string; slug: string; name: string; city: string; country: string; score: number; snippet: string; lat: number | null; lng: number | null; group: string; website: string | null };
type HotelRow = { id: string; slug: string; name: string | null; name_en: string | null; city: string | null; country: string | null; lat: number | null; lng: number | null; website: string | null; cosy_scores: Array<{ score: number | null; score_final: number | null; description: string | null }> | { score: number | null; score_final: number | null; description: string | null } | null };

// cache()'d so metadata + body share one DB load. Live scores + descriptions by slug.
const loadHotels = cache(async (): Promise<Hotel[]> => {
  const db = getServerSupabase();
  if (!db) return [];
  const groupBySlug = new Map(CURATED.map((c) => [c.slug, c.group]));
  const slugs = [...groupBySlug.keys()];
  const delisted = await getDelistedSlugSet(db);
  const bySlug = new Map<string, HotelRow>();
  for (let i = 0; i < slugs.length; i += 100) {
    const { data } = await db
      .from("hotels")
      .select("id, slug, name, name_en, city, country, lat, lng, website, cosy_scores(score, score_final, description)")
      .in("slug", slugs.slice(i, i + 100));
    for (const r of (data || []) as unknown as HotelRow[]) bySlug.set(r.slug, r);
  }
  const out: Hotel[] = [];
  for (const c of CURATED) {
    const r = bySlug.get(c.slug);
    if (!r) continue;
    if (delisted.has(c.slug)) continue; // takedown excludes listing surfaces
    const cs = Array.isArray(r.cosy_scores) ? r.cosy_scores[0] : r.cosy_scores;
    if (!cs) continue;
    const score = typeof cs.score_final === "number" ? cs.score_final : typeof cs.score === "number" ? cs.score : null;
    if (score == null || score < PUBLIC_GATE) continue;          // never feature a below-gate hotel
    if (isFacetMintControlCity(r.city)) continue;                 // scrub Venice-historic + Savannah
    const name = String(r.name_en || r.name || "").trim();
    if (!name || !isLatin(name)) continue;
    out.push({ id: String(r.id), slug: r.slug, name, city: displayCity(r.city), country: r.country || "", score, snippet: cs.description || "", lat: r.lat ?? null, lng: r.lng ?? null, group: c.group, website: r.website ?? null });
  }
  return out;
});

export async function generateMetadata({ params }: { params: { locale: string } }): Promise<Metadata> {
  const url = `/en/adaptive-reuse-hotels`;
  const titleBase = "Cosy hotels that used to be something else";
  const descBase = "Adaptive-reuse hotels across the US and Europe: former banks, prisons, post offices, factories and monasteries, each AI-scored from 0 to 10 for warmth, read from real guest reviews.";
  const title = params.locale === "en" ? titleBase : await translate(titleBase, params.locale);
  const description = params.locale === "en" ? descBase : await translate(descBase, params.locale);
  return {
    title, description,
    alternates: { canonical: url },
    robots: { index: false, follow: false }, // private per-recipient preview — never indexed
    openGraph: { title, description, type: "website", url },
    twitter: { card: "summary", title, description },
  };
}

// Private preview link, keyed on the recipient's name. The page is noindexed and 404s without the
// correct ?key=, so it can be shared with one journalist without being public or discoverable.
const ACCESS_KEYS = new Set(["lauren-harano"]);

export default async function AdaptiveReusePage({ params, searchParams }: { params: { locale: string }; searchParams: { key?: string } }) {
  if (!ACCESS_KEYS.has((searchParams?.key || "").toLowerCase())) notFound();
  const { locale } = params;
  const hotels = await loadHotels();
  if (hotels.length < 2) notFound();

  // Approved photos (vision_ok), same pattern as the theme hub.
  const db = getServerSupabase()!;
  // Verdict-gated CTA swap (founder FINAL rule, 2026-07-16): only hotels the real-browser sweep
  // has verified WRONG get the swap; everything else keeps today's default (fail-safe empty set).
  const wrongSlugs = await getStay22WrongSlugs(db);
  const photo = new Map<string, string>();
  const ids = hotels.map((h) => h.id);
  for (let i = 0; i < ids.length; i += 150) {
    const { data: imgs } = await db.from("hotel_images").select("hotel_id,url").in("hotel_id", ids.slice(i, i + 150)).eq("vision_ok", true);
    for (const im of (imgs || []) as Array<{ hotel_id: string | null; url: string | null }>) {
      const hid = im.hotel_id ? String(im.hotel_id) : ""; const u = im.url || "";
      if (hid && u && !u.includes("placehold.co") && !photo.has(hid)) photo.set(hid, u);
    }
  }

  // Group by original building type; order groups editorially, sort within by live score.
  const byGroup = new Map<string, Hotel[]>();
  for (const h of hotels) { const arr = byGroup.get(h.group) || []; arr.push(h); byGroup.set(h.group, arr); }
  const sections = GROUP_ORDER.filter((g) => byGroup.has(g)).map((g) => ({ group: g, items: byGroup.get(g)!.sort((a, b) => b.score - a.score) }));

  // Editorial copy is translatable; live hotel data (names, scores, descriptions) stays as-is.
  const tl = async (s: string) => (locale === "en" ? s : await translate(s, locale));
  const h1 = await tl("Cosy hotels that used to be something else");
  const intro = await tl("Adaptive-reuse stays we've scored worldwide: former banks, prisons, post offices, factories and monasteries, each read for warmth from real guest reviews. The number is our cosy score, 0 to 10.");
  const labels = new Map<string, string>();
  for (const s of sections) labels.set(s.group, await tl(s.group));
  const saveLabels = await buildSaveLabels(locale);

  const itemList = {
    "@context": "https://schema.org", "@type": "ItemList", name: "Cosy hotels that used to be something else", numberOfItems: hotels.length,
    itemListElement: hotels.map((h, i) => ({
      "@type": "ListItem", position: i + 1,
      item: { "@type": "Hotel", name: h.name, url: `${SITE}/${locale}/hotels/${h.slug}`, ...(photo.get(h.id) ? { image: photo.get(h.id) } : {}),
        review: { "@type": "Review", author: { "@type": "Organization", name: "Got Cosy" }, reviewRating: { "@type": "Rating", ratingValue: Number(h.score.toFixed(1)), bestRating: 10, worstRating: 0, name: "Cosy score" } } },
    })),
  };
  const crumbs = breadcrumbSchema([
    { name: "Home", url: `/${locale}` },
    { name: "Cosy hotels", url: `/${locale}/cosy-hotels` },
    { name: "Adaptive-reuse hotels", url: `/${locale}/adaptive-reuse-hotels` },
  ]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(itemList)} />
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(crumbs)} />
      <nav className="text-sm" style={{ color: "var(--muted)" }}><a href={`/${locale}/cosy-hotels`} className="hover:underline">Cosy hotels</a> / {h1}</nav>
      <h1 className="mt-2 text-2xl font-semibold" style={{ fontFamily: "Fraunces, serif" }}>{h1}</h1>
      <p className="mt-2" style={{ color: "var(--muted)" }}>{intro}</p>

      {sections.map((sec) => (
        <section key={sec.group} className="mt-8">
          <h2 className="text-sm font-medium uppercase" style={{ color: "var(--ember)", letterSpacing: "0.08em" }}>{labels.get(sec.group)}</h2>
          <ol className="mt-3 space-y-3">
            {sec.items.map((h) => {
              const cta = stay22AllezUrl({ name: h.name, city: h.city, country: h.country, lat: h.lat, lng: h.lng, campaign: "adaptive-reuse" });
              const ph = photo.get(h.id);
              return (
                <li key={h.id} className="rounded-xl border p-4" style={{ borderColor: "var(--line)", background: "var(--card)" }}>
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 hidden sm:flex items-center justify-center rounded-2xl text-white shadow" style={{ background: cosyBadgeColor(h.score), width: 56, height: 56, fontFamily: "Fraunces, serif", fontSize: 22, fontWeight: 600 }}>{h.score.toFixed(1)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2"><span className="sm:hidden inline-flex items-center justify-center rounded-lg px-2 py-0.5 text-sm font-semibold text-white" style={{ background: cosyBadgeColor(h.score), fontFamily: "Fraunces, serif" }}>{h.score.toFixed(1)}</span><h3 className="text-lg font-semibold leading-tight"><a href={`/${locale}/hotels/${h.slug}`} className="hover:underline">{h.name}</a></h3></div>
                      {(h.city || h.country) && <div className="text-sm" style={{ color: "var(--muted)" }}>{[h.city, h.country].filter(Boolean).join(", ")}</div>}
                      {h.snippet && <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--foreground)" }}>{h.snippet}</p>}
                      <HotelActions stay22Href={cta} website={h.website} isVerifiedWrong={wrongSlugs.has(h.slug)} hotelName={h.name} city={h.city} slug={h.slug} locale={locale} saveLabels={saveLabels} shareTitle={`${h.name}, a cosy hotel that used to be something else`} shareUrl={`/${locale}/hotels/${h.slug}`} />
                    </div>
                    {ph && <a href={`/${locale}/hotels/${h.slug}`} className="flex-shrink-0 hidden sm:block"><div className="relative rounded-lg overflow-hidden" style={{ width: 120, height: 90 }}><Image src={ph} alt={h.name} fill className="object-cover" sizes="120px" quality={60} unoptimized={/^https?:\/\//.test(ph)} /></div></a>}
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      ))}

      <p className="mt-10 text-sm" style={{ color: "var(--muted)" }}>Browse more cosy hotels by <a href={`/${locale}/cosy-hotels`} className="underline">theme and country</a>, or explore our <a href={`/${locale}/guides`} className="underline">city guides</a>. Every score is read from real guest reviews; each hotel page shows the evidence.</p>
    </div>
  );
}
