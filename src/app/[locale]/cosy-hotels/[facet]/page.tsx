// Theme hub (WP3): "Cosy hotels {concept}" across every city — e.g. /en/cosy-hotels/fireplace.
// Ranks the cosiest hotels that belong to the Traveller Fit concept (stored hotel_traveller_fit
// assignments ≥ minConfidence ∪, for the legacy 5, the original real-signal regex) and links out to
// the per-city collection pages (/cosy-hotels/{concept}/{city}) — the internal-linking payoff.
// With hotel_traveller_fit empty the legacy 5 degrade to exactly the original facet hub; new
// concepts have no legacy source, so they render nothing (→ notFound below 2 total).
import { cache } from "react";
import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getServerSupabase } from "@/lib/supabase/server";
import { CONCEPTS, CONCEPT_BY_SLUG, LEGACY_FACET_SLUGS, cityCollectionMin } from "@/lib/travellerFit";
import { cityToSlug, cityFromSlug } from "@/lib/citySlug";
import { displayCity, isLatin } from "@/lib/placeText";
import { stay22AllezUrl } from "@/lib/affiliates";
import { cosyBadgeColor } from "@/lib/cosyColor";
import { breadcrumbSchema, jsonLd } from "@/lib/schema";
import ShareButton from "@/components/ShareButton";
import {
  CITY_HOTEL_SELECT, THEME_HUB_INDEX_MIN, conceptLabelPhrase,
  loadConceptAssignments, conceptCityMembersLive, type ScoreHotelRow,
} from "@/lib/seo/cityHotels";

export const revalidate = 3600;
const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://gotcosy.com";
const INDEX_MIN = THEME_HUB_INDEX_MIN; // a theme hub with fewer matches than this is noindexed (thin)

export function generateStaticParams() {
  return CONCEPTS.filter((c) => c.collectionEnabled).map((c) => ({ facet: c.slug }));
}

type Match = { id: string; slug: string; name: string; city: string; country: string; score: number; snippet: string; lat: number | null; lng: number | null; fitConfidence: number | null };

// cache()'d so metadata + body share one load. Membership = the Traveller Fit contract: the legacy 5
// scan the cosiest 4k live hotels in score order and keep real-signal regex matches (unchanged);
// every concept also unions its stored hotel_traveller_fit assignments (ordered by confidence),
// deduped by hotel id + name. Per-city links are tallied over the full membership.
const loadConcept = cache(async (conceptSlug: string): Promise<{ hotels: Match[]; cities: Array<{ city: string; slug: string; n: number }> } | null> => {
  const concept = CONCEPT_BY_SLUG[conceptSlug];
  const db = getServerSupabase();
  if (!concept || !concept.collectionEnabled || !db) return null;
  const isLegacy = LEGACY_FACET_SLUGS.has(concept.slug);

  const cityTally = new Map<string, { city: string; slug: string; n: number }>();
  const seen = new Set<string>();     // dedup by hotel name
  const seenIds = new Set<string>();  // dedup by hotel id across the two sources
  const hotels: Match[] = [];
  const tallyCity = (city: string) => {
    if (!city) return;
    // Tally per KNOWN city (round-trips cleanly), so a per-city link never points at a 404.
    const base = cityToSlug(city).replace(/-cosy-hotel$/, "");
    if (!cityFromSlug(`${base}-cosy-hotel`)) return;
    const cur = cityTally.get(base);
    if (cur) cur.n++; else cityTally.set(base, { city, slug: base, n: 1 });
  };

  // Stored assignments (empty map when hotel_traveller_fit is empty).
  const assignments = await loadConceptAssignments([concept.slug]);

  // ── Legacy regex source (the original 5 only): scan the cosiest 4k live hotels in score order and
  //    keep real-signal/description matches — preserving today's ordering + per-city tally. ──
  if (isLegacy) {
    const { data } = await db
      .from("cosy_scores")
      .select(CITY_HOTEL_SELECT)
      .gte("score", 5)
      .order("score", { ascending: false })
      .limit(4000); // the cosiest 4k live hotels — deep enough to surface every strong theme match
    for (const r of (data || []) as unknown as ScoreHotelRow[]) {
      const h = r.hotel; if (!h || !r.hotel_id) continue;
      if (!concept.re.test(`${(r.signals || []).join(" ")} ${r.description || ""}`)) continue; // == matchesFacet
      const name = String(h.name_en || h.name || "").trim();
      if (!name || !isLatin(name) || seen.has(name)) continue;
      seen.add(name); seenIds.add(String(r.hotel_id));
      tallyCity(displayCity(h.city));
      if (hotels.length < 60) hotels.push({ id: String(r.hotel_id), slug: h.slug, name, city: displayCity(h.city), country: h.country || "", score: Number((r.score_final ?? r.score) || 0), snippet: r.description || "", lat: h.lat ?? null, lng: h.lng ?? null, fitConfidence: assignments.get(String(r.hotel_id))?.get(concept.slug) ?? null });
    }
  }

  // ── Stored source: hotels assigned to this concept (≥ minConfidence) not already surfaced above,
  //    ordered by confidence desc. New concepts' only membership; live-gated (score ≥ 5) via the
  //    same cosy_scores join for render data. ──
  const storedEntries: Array<{ id: string; conf: number }> = [];
  for (const [hid, m] of assignments) {
    const conf = m.get(concept.slug);
    if (conf != null && conf >= concept.minConfidence && !seenIds.has(hid)) storedEntries.push({ id: hid, conf });
  }
  storedEntries.sort((a, b) => b.conf - a.conf);
  if (storedEntries.length) {
    const byId = new Map<string, ScoreHotelRow>();
    const ids = storedEntries.map((e) => e.id);
    for (let i = 0; i < ids.length; i += 200) {
      const { data } = await db.from("cosy_scores").select(CITY_HOTEL_SELECT).in("hotel_id", ids.slice(i, i + 200)).gte("score", 5);
      for (const r of (data || []) as unknown as ScoreHotelRow[]) if (r.hotel_id) byId.set(String(r.hotel_id), r);
    }
    for (const e of storedEntries) {
      const r = byId.get(e.id); if (!r) continue;
      const h = r.hotel; if (!h) continue;
      const name = String(h.name_en || h.name || "").trim();
      if (!name || !isLatin(name) || seen.has(name)) continue;
      seen.add(name); seenIds.add(e.id);
      tallyCity(displayCity(h.city));
      if (hotels.length < 60) hotels.push({ id: e.id, slug: h.slug, name, city: displayCity(h.city), country: h.country || "", score: Number((r.score_final ?? r.score) || 0), snippet: r.description || "", lat: h.lat ?? null, lng: h.lng ?? null, fitConfidence: e.conf });
    }
  }

  // Per-city links need ≥ the concept's city-collection min (legacy 5 → 2, matching the old hub).
  // The tally is only a CANDIDATE list — it counts this hub's (unbounded) universe, while the city
  // page renders from the top-80 RPC window. Verify each candidate through the page's own path
  // (conceptCityMembersLive) so a hub link can never point at a city page that 404s.
  const candidates = [...cityTally.values()].filter((c) => c.n >= cityCollectionMin(concept)).sort((a, b) => b.n - a.n).slice(0, 30);
  const checks = await Promise.all(candidates.map(async (c) => {
    const members = await conceptCityMembersLive(concept, c.slug);
    return members != null && members.length >= cityCollectionMin(concept) ? c : null;
  }));
  const cities = checks.filter((c): c is NonNullable<typeof c> => c != null).slice(0, 24);
  // Membership is gathered in raw-`score` scan order (legacy) then confidence order (stored); the
  // badge shows `score_final ?? score` (h.score), so re-sort the capped set by the DISPLAYED score
  // before render so the visible list — and the "leads at" intro — descend by cosy score.
  hotels.sort((a, b) => b.score - a.score);
  return { hotels, cities };
});

export async function generateMetadata({ params }: { params: { locale: string; facet: string } }): Promise<Metadata> {
  const concept = CONCEPT_BY_SLUG[params.facet];
  if (!concept || !concept.collectionEnabled) return {};
  const res = await loadConcept(params.facet);
  const n = res?.hotels.length ?? 0;
  const phrase = conceptLabelPhrase(concept);
  // Untranslated pages: only /en is indexed, so canonical (and og:url) point at the /en twin.
  const url = `/en/cosy-hotels/${concept.slug}`;
  const title = `Cosy hotels ${phrase}, AI-ranked worldwide`;
  const description = `The cosiest hotels ${phrase}, from around the world, each AI-scored 0–10 for warmth and character, ranked best first.`;
  return {
    title, description,
    alternates: { canonical: url },
    openGraph: { title, description, type: "website", url },
    twitter: { card: "summary", title, description },
    ...(n < INDEX_MIN ? { robots: { index: false, follow: true } } : {}),
  };
}

export default async function ThemeHub({ params }: { params: { locale: string; facet: string } }) {
  const concept = CONCEPT_BY_SLUG[params.facet];
  if (!concept || !concept.collectionEnabled) notFound();
  const res = await loadConcept(params.facet);
  if (!res || res.hotels.length < 2) notFound();
  const { hotels, cities } = res;
  const phrase = conceptLabelPhrase(concept);

  const db = getServerSupabase()!;
  const photo = new Map<string, string>();
  const ids = hotels.map((h) => h.id);
  for (let i = 0; i < ids.length; i += 150) {
    const { data: imgs } = await db.from("hotel_images").select("hotel_id,url").in("hotel_id", ids.slice(i, i + 150)).eq("vision_ok", true);
    for (const im of (imgs || []) as Array<{ hotel_id: string | null; url: string | null }>) {
      const hid = im.hotel_id ? String(im.hotel_id) : ""; const u = im.url || "";
      if (hid && u && !u.includes("placehold.co") && !photo.has(hid)) photo.set(hid, u);
    }
  }

  const top = hotels[0];
  const intro = `The cosiest hotels ${phrase} we've scored worldwide; ${top.name} leads at ${top.score.toFixed(1)}/10. Ranked by cosy score, backed by real signals and guest reviews.`;
  const itemList = {
    "@context": "https://schema.org", "@type": "ItemList", name: `Cosy hotels ${phrase}`, numberOfItems: hotels.length,
    itemListElement: hotels.map((h, i) => ({
      "@type": "ListItem", position: i + 1,
      item: { "@type": "Hotel", name: h.name, url: `${SITE}/${params.locale}/hotels/${h.slug}`, ...(photo.get(h.id) ? { image: photo.get(h.id) } : {}),
        review: { "@type": "Review", author: { "@type": "Organization", name: "Got Cosy" }, reviewRating: { "@type": "Rating", ratingValue: Number(h.score.toFixed(1)), bestRating: 10, worstRating: 0, name: "Cosy score" } } },
    })),
  };
  const crumbs = breadcrumbSchema([
    { name: "Home", url: `/${params.locale}` },
    { name: "Cosy hotels", url: `/${params.locale}/cosy-hotels` },
    { name: `Cosy hotels ${phrase}`, url: `/${params.locale}/cosy-hotels/${concept.slug}` },
  ]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(itemList)} />
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(crumbs)} />
      <nav className="text-sm" style={{ color: "var(--muted)" }}><a href={`/${params.locale}/cosy-hotels`} className="hover:underline">Cosy hotels</a> / {phrase}</nav>
      <h1 className="mt-2 text-2xl font-semibold">Cosy hotels {phrase}</h1>
      <p className="mt-2" style={{ color: "var(--muted)" }}>{intro}</p>

      {cities.length > 0 && (
        <section className="mt-5">
          <h2 className="text-sm font-medium" style={{ color: "var(--muted)" }}>By city</h2>
          <div className="mt-2 flex flex-wrap gap-2">
            {cities.map((c) => (
              <a key={c.slug} href={`/${params.locale}/cosy-hotels/${concept.slug}/${c.slug}`} className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm hover:underline" style={{ borderColor: "var(--line)", background: "var(--card)" }}>
                {c.city} <span className="tabular-nums" style={{ color: "var(--muted)" }}>{c.n}</span>
              </a>
            ))}
          </div>
        </section>
      )}

      <ol className="mt-6 space-y-3">
        {hotels.map((h, idx) => {
          const cta = stay22AllezUrl({ name: h.name, city: h.city, country: h.country, lat: h.lat, lng: h.lng, campaign: `theme-${concept.slug}` });
          const ph = photo.get(h.id);
          return (
            <li key={h.id} className="rounded-xl border p-4" style={{ borderColor: "var(--line)", background: "var(--card)" }}>
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 flex items-center justify-center rounded-2xl text-white shadow" style={{ background: cosyBadgeColor(h.score), width: 56, height: 56, fontFamily: "Fraunces, serif", fontSize: 22, fontWeight: 600 }}>{h.score.toFixed(1)}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2"><span className="text-sm tabular-nums" style={{ color: "var(--muted)" }}>#{idx + 1}</span><h2 className="text-lg font-semibold leading-tight"><a href={`/${params.locale}/hotels/${h.slug}`} className="hover:underline">{h.name}</a></h2></div>
                  {h.city && <div className="text-sm" style={{ color: "var(--muted)" }}>{h.city}</div>}
                  {h.snippet && <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--foreground)" }}>{h.snippet}</p>}
                  <div className="mt-3 flex items-center gap-2"><a href={cta} target="_blank" rel="noopener nofollow sponsored" data-cta="check_availability" data-hotel={h.name} data-city={h.city} className="inline-flex items-center justify-center rounded-lg text-white px-4 py-2 text-sm font-medium no-underline" style={{ background: "var(--ember)" }}>Check availability</a><ShareButton variant="icon" title={`${h.name}, a cosy hotel ${phrase}`} url={`/${params.locale}/hotels/${h.slug}`} /></div>
                </div>
                {ph && <a href={`/${params.locale}/hotels/${h.slug}`} className="flex-shrink-0 hidden sm:block"><div className="relative rounded-lg overflow-hidden" style={{ width: 120, height: 90 }}><Image src={ph} alt={h.name} fill className="object-cover" sizes="120px" quality={60} unoptimized={/^https?:\/\//.test(ph)} /></div></a>}
              </div>
            </li>
          );
        })}
      </ol>
      <p className="mt-8 text-sm" style={{ color: "var(--muted)" }}>Browse cosy hotels by <a href={`/${params.locale}/cosy-hotels`} className="underline">theme and country</a>, or explore our <a href={`/${params.locale}/guides`} className="underline">city guides</a>.</p>
    </div>
  );
}
