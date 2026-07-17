// Theme hub (WP3): "Cosy hotels {concept}" across every city — e.g. /en/cosy-hotels/fireplace.
// Ranks the cosiest hotels that belong to the Traveller Fit concept (stored hotel_traveller_fit
// assignments ≥ minConfidence ∪, for the legacy 5, the original real-signal regex) and links out to
// the per-city collection pages (/cosy-hotels/{concept}/{city}) — the internal-linking payoff.
// With hotel_traveller_fit empty the regex facets (legacy 5 + rising-intent) degrade to exactly
// the regex-backed hub; stored-only concepts render nothing (→ notFound below 2 total).
import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getServerSupabase } from "@/lib/supabase/server";
import { CONCEPTS, CONCEPT_BY_SLUG, REGEX_FACET_SLUGS, cityCollectionMin, conceptCityBlocked } from "@/lib/travellerFit";
import { facetBySlug } from "@/lib/facets";
import { cityToSlug, cityFromSlug } from "@/lib/citySlug";
import { displayCity, isLatin } from "@/lib/placeText";
import { stay22AllezUrl } from "@/lib/affiliates";
import { breadcrumbSchema, jsonLd } from "@/lib/schema";
import { translate, translateMany } from "@/lib/i18n/translate";
import { localeSeo } from "@/lib/i18n/seoLocale";
import HotelCard from "@/components/HotelCard";
import { buildSaveLabels } from "@/lib/i18n/saveLabels";
import { getStay22WrongSlugs } from "@/lib/ctaPolicy";
import {
  CITY_HOTEL_SELECT, THEME_HUB_INDEX_MIN, conceptLabelPhrase,
  loadConceptAssignments, conceptCityMembersLive, type ScoreHotelRow,
} from "@/lib/seo/cityHotels";
import { getDelistedSlugSet } from "@/lib/delisted";

export const revalidate = 3600;
const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://gotcosy.com";
const INDEX_MIN = THEME_HUB_INDEX_MIN; // a theme hub with fewer matches than this is noindexed (thin)

export function generateStaticParams() {
  return CONCEPTS.filter((c) => c.collectionEnabled).map((c) => ({ facet: c.slug }));
}

type Match = { id: string; slug: string; name: string; city: string; country: string; score: number; snippet: string; lat: number | null; lng: number | null; fitConfidence: number | null; website: string | null };

// cache()'d so metadata + body share one load. Membership = the Traveller Fit contract: the legacy 5
// scan the cosiest 4k live hotels in score order and keep real-signal regex matches (unchanged);
// every concept also unions its stored hotel_traveller_fit assignments (ordered by confidence),
// deduped by hotel id + name. Per-city links are tallied over the full membership.
const loadConcept = cache(async (conceptSlug: string): Promise<{ hotels: Match[]; cities: Array<{ city: string; slug: string; n: number }> } | null> => {
  const concept = CONCEPT_BY_SLUG[conceptSlug];
  const db = getServerSupabase();
  if (!concept || !concept.collectionEnabled || !db) return null;
  const regexLive = REGEX_FACET_SLUGS.has(concept.slug); // legacy 5 + rising-intent facets

  const cityTally = new Map<string, { city: string; slug: string; n: number }>();
  const seen = new Set<string>();     // dedup by hotel name
  const seenIds = new Set<string>();  // dedup by hotel id across the two sources
  const hotels: Match[] = [];
  const tallyCity = (city: string) => {
    if (!city) return;
    // Experiment-control exclusion: NEW rising-intent facets never list a control-market city
    // (its city page structurally does not exist — see conceptCityBlocked).
    if (conceptCityBlocked(concept, city)) return;
    // Tally per KNOWN city (round-trips cleanly), so a per-city link never points at a 404.
    const base = cityToSlug(city).replace(/-cosy-hotel$/, "");
    if (!cityFromSlug(`${base}-cosy-hotel`)) return;
    const cur = cityTally.get(base);
    if (cur) cur.n++; else cityTally.set(base, { city, slug: base, n: 1 });
  };

  // Stored assignments (empty map when hotel_traveller_fit is empty).
  const assignments = await loadConceptAssignments([concept.slug]);
  const delisted = await getDelistedSlugSet(db);

  // ── Live regex source (regex facets: the original 5 + rising-intent): scan the cosiest 4k live
  //    hotels in score order and keep real-signal/description matches — same ordering + tally. ──
  if (regexLive) {
    const { data } = await db
      .from("cosy_scores")
      .select(CITY_HOTEL_SELECT)
      .gte("score", 5)
      .order("score", { ascending: false })
      .limit(4000); // the cosiest 4k live hotels — deep enough to surface every strong theme match
    for (const r of (data || []) as unknown as ScoreHotelRow[]) {
      const h = r.hotel; if (!h || !r.hotel_id) continue;
      if (delisted.has(h.slug)) continue; // takedown excludes listing surfaces
      if (!concept.re.test(`${(r.signals || []).join(" ")} ${r.description || ""}`)) continue; // == matchesFacet
      const name = String(h.name_en || h.name || "").trim();
      if (!name || !isLatin(name) || seen.has(name)) continue;
      seen.add(name); seenIds.add(String(r.hotel_id));
      tallyCity(displayCity(h.city));
      if (hotels.length < 60) hotels.push({ id: String(r.hotel_id), slug: h.slug, name, city: displayCity(h.city), country: h.country || "", score: Number((r.score_final ?? r.score) || 0), snippet: r.description || "", lat: h.lat ?? null, lng: h.lng ?? null, fitConfidence: assignments.get(String(r.hotel_id))?.get(concept.slug) ?? null, website: h.website ?? null });
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
      if (delisted.has(h.slug)) continue; // takedown excludes listing surfaces
      const name = String(h.name_en || h.name || "").trim();
      if (!name || !isLatin(name) || seen.has(name)) continue;
      seen.add(name); seenIds.add(e.id);
      tallyCity(displayCity(h.city));
      if (hotels.length < 60) hotels.push({ id: e.id, slug: h.slug, name, city: displayCity(h.city), country: h.country || "", score: Number((r.score_final ?? r.score) || 0), snippet: r.description || "", lat: h.lat ?? null, lng: h.lng ?? null, fitConfidence: e.conf, website: h.website ?? null });
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
  // Body copy below is genuinely translated for TRANSLATED_LOCALES (isEn ? ... : translate(...)),
  // so canonical/hreflang are locale-aware; every other locale still points at the /en twin.
  const { canonical: url, languages } = localeSeo(params.locale, `/cosy-hotels/${concept.slug}`);
  const titleBase = `Cosy hotels ${phrase}, AI-ranked worldwide`;
  const descBase = `The cosiest hotels ${phrase}, from around the world, each AI-scored from 0 to 10 for warmth and character, ranked best first.`;
  const title = params.locale === "en" ? titleBase : await translate(titleBase, params.locale);
  const description = params.locale === "en" ? descBase : await translate(descBase, params.locale);
  return {
    title, description,
    alternates: { canonical: url, ...(languages ? { languages } : {}) },
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
  // Verdict-gated CTA swap (founder FINAL rule, 2026-07-16): fail-safe empty set by default.
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

  const top = hotels[0];
  // A facet-specific opening sentence (facets.ts `intro`, e.g. quiet's rising-intent vocabulary)
  // is prepended to the data-led line when present; the data-led line always renders.
  const facetIntro = facetBySlug(concept.slug)?.intro;
  const introEn = `${facetIntro ? `${facetIntro} ` : ""}The cosiest hotels ${phrase} we've scored worldwide; ${top.name} leads at ${top.score.toFixed(1)}/10. Ranked by cosy score, backed by real signals and guest reviews.`;
  // Visible body copy renders in the target language for non-en; en path is byte-identical (G14).
  const isEn = params.locale === "en";
  const h1 = isEn ? "" : await translate(`Cosy hotels ${phrase}`, params.locale);
  const intro = isEn ? introEn : await translate(introEn, params.locale);
  const byCityLabel = isEn ? "By city" : await translate("By city", params.locale);
  const snippets = isEn ? hotels.map((h) => h.snippet) : await translateMany(hotels.map((h) => h.snippet || ""), params.locale);
  const crumbLabel = isEn ? "Cosy hotels" : await translate("Cosy hotels", params.locale);
  const browseLine = isEn
    ? { pre: "Browse cosy hotels by", themeCountry: "theme and country", mid: "or explore our", cityGuides: "city guides" }
    : {
        pre: await translate("Browse cosy hotels by", params.locale),
        themeCountry: await translate("theme and country", params.locale),
        mid: await translate("or explore our", params.locale),
        cityGuides: await translate("city guides", params.locale),
      };
  const saveLabels = await buildSaveLabels(params.locale);
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
      <nav className="text-sm" style={{ color: "var(--muted)" }}><a href={`/${params.locale}/cosy-hotels`} className="hover:underline">{crumbLabel}</a> / {phrase}</nav>
      <h1 className="mt-2 text-2xl font-semibold">{isEn ? <>Cosy hotels {phrase}</> : h1}</h1>
      <p className="mt-2" style={{ color: "var(--muted)" }}>{intro}</p>

      {cities.length > 0 && (
        <section className="mt-5">
          <h2 className="text-sm font-medium" style={{ color: "var(--muted)" }}>{byCityLabel}</h2>
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
          return (
            <HotelCard
              key={h.id}
              slug={h.slug}
              name={h.name}
              city={h.city}
              country={h.country}
              score={h.score}
              rank={idx + 1}
              snippet={snippets[idx]}
              photo={photo.get(h.id)}
              locale={params.locale}
              saveLabels={saveLabels}
              stay22Href={cta}
              website={h.website}
              isVerifiedWrong={wrongSlugs.has(h.slug)}
              shareTitle={`${h.name}, a cosy hotel ${phrase}`}
              shareUrl={`/${params.locale}/hotels/${h.slug}`}
            />
          );
        })}
      </ol>
      <p className="mt-8 text-sm" style={{ color: "var(--muted)" }}>{browseLine.pre} <a href={`/${params.locale}/cosy-hotels`} className="underline">{browseLine.themeCountry}</a>, {browseLine.mid} <a href={`/${params.locale}/guides`} className="underline">{browseLine.cityGuides}</a>.</p>
    </div>
  );
}
