// Hotel detail — persisted, pre-scored Supabase hotels only.
import { notFound, permanentRedirect } from "next/navigation";
import Image from "next/image";
import type { Metadata } from "next";
import { site } from "@/config/site";
import { buildCosySnippet } from "@/i18n/snippets";
import { getServerSupabase } from "@/lib/supabase/server";
import { stay22AllezUrl } from "@/lib/affiliates";
import ShareButton from "@/components/ShareButton";
import BadgeEmbed from "@/components/BadgeEmbed";
import HotelActions from "@/components/HotelActions";
import { type SaveToTripLabels } from "@/components/SaveToTripButton";
import { buildSaveLabels } from "@/lib/i18n/saveLabels";
import { buildShareLabels } from "@/lib/i18n/shareLabels";
import { translate, translateMany } from "@/lib/i18n/translate";
import { cosyBadgeColor } from "@/lib/cosyColor";
import hotelFaqData from "@/data/hotelFaqs.json";
import { breadcrumbSchema, jsonLd } from "@/lib/schema";
import { cityToSlug } from "@/lib/citySlug";
import { displayCity, displayCountry } from "@/lib/placeText";
import { FACETS, matchesFacet } from "@/lib/facets";
import { isMalformedSlug } from "@/lib/seo/slugGuard";
import { Breadcrumb, HotelGraph, type MiniHotel, type LinkItem } from "@/components/HotelGraph";
import TravellerFit from "@/components/TravellerFit";
import { CONCEPT_BY_SLUG, cityCollectionMin, conceptCityBlocked, displayFits, type TravellerFitAssignment } from "@/lib/travellerFit";
import { loadCityCosyHotels, loadConceptAssignments, conceptMembers } from "@/lib/seo/cityHotels";
import { guideCityHasLivePick } from "@/lib/seo/guidePicks";
import { isDelisted, getDelistedSlugSet } from "@/lib/delisted";
import { resolveBookingCta, getStay22WrongSlugs } from "@/lib/ctaPolicy";

// Rendered on-demand then cached (ISR): Supabase is hit at most once per hotel per revalidate
// window, never on every view. These are the top SEO landing pages, so cache them hard.
export const revalidate = 86400;
export const dynamicParams = true;

// Prebuild none at build time (9k+ hotels); every slug renders on first request, then caches (ISR).
export function generateStaticParams() {
  return [] as { slug: string }[];
}

// Using implicit types from Supabase rows to avoid unused warnings

type Props = { params: { slug: string; locale: string } };

export async function generateMetadata({ params }: { params: { slug: string; locale: string } }): Promise<Metadata> {
  // Hotel content (description/FAQ) is not translated per locale, so the /fr /es /de … pages are
  // duplicate English. Point every locale's canonical at the /en page (and drop hreflang, which is
  // only valid for genuinely translated pages) so Google consolidates ranking on /en. Reversible —
  // restore self-canonical + hreflang if/when the content is actually localized.
  // EXPLICIT EXCEPTION (2026-07-17 sv locale-aware canonical work): this page deliberately does
  // NOT use src/lib/i18n/seoLocale.ts's localeSeo(), even though "sv" is in TRANSLATED_LOCALES.
  // localeSeo() is only correct for pages whose visible BODY branches on locale and renders
  // translated copy; hotel description/FAQ here stays English for every locale, so a self-canonical
  // /sv/hotels/... would just be a duplicate-English page competing with /en for the same content.
  // Malformed/placeholder slugs (e.g. %7Bsearch_term_string%7D, undefined) must never render an
  // indexable page — the body 404s them, so metadata stays noindex and skips the DB round-trip.
  if (isMalformedSlug(params.slug)) return { robots: { index: false, follow: false } };
  // Delisted hotels (takedown mechanism): never indexable, even before the 404 body renders.
  const delistDb = getServerSupabase();
  if (await isDelisted(params.slug, delistDb)) return { robots: { index: false, follow: false } };
  const canonical = `/en/hotels/${params.slug}`;
  const db = getServerSupabase();
  if (db) {
    const { data: h } = await db
      .from("hotels")
      .select("id, name, city, country, slug")
      .eq("slug", params.slug)
      .maybeSingle();
    if (h) {
      // No manual "| Got Cosy?" suffix: the [locale] layout's title.template already appends it
      // (%s | ${site.name}); adding it here too produced "Robyn's Inn | Got Cosy? | Got Cosy?".
      const title = h.name;
      // Unique, review-grounded meta description per hotel (SEO/AEO) — the same one-sentence
      // description shown on the page; falls back to location only if the hotel has none.
      let description = [displayCity(h.city as string | null, ""), displayCountry(h.country as string | null)].filter(Boolean).join(", ") || "Cosy boutique stay.";
      const { data: s } = await db.from("cosy_scores").select("description,score,score_final").eq("hotel_id", h.id).maybeSingle();
      const cosy = (s?.score_final as number | null) ?? (s?.score as number | null) ?? null;
      // Unrated / hidden hotels (no review-grounded score above the public floor) stay reachable
      // but are noindexed until they earn a rating — no thin pages in the index.
      const rated = cosy != null && cosy >= 5;
      if (s?.description && rated) {
        description = `Cosy score ${Number(cosy).toFixed(1)}/10. ${s.description}`.slice(0, 300);
      }
      return { title, description, alternates: { canonical }, ...(rated ? {} : { robots: { index: false, follow: true } }) };
    }
  }
  return { alternates: { canonical } };
}

// Per-hotel FAQ — natural-language Q&A for SEO rich results + GEO/AEO (answer engines lift these).
// Every answer is GROUNDED in real data (cosy score, our description, guest rating, location) — no
// invented facts, in keeping with the trustworthy-score promise.
function hotelFaqs(o: { name: string; city: string; country: string; cosy: number | null; description: string | null; rating5: number | null; reviews: number | null; amenities?: string[] }): Array<{ q: string; a: string }> {
  const { name, city, country, cosy: s, description, rating5, reviews } = o;
  const place = [city, country].filter(Boolean).join(", ");
  const band = s == null ? "" : s >= 7.8 ? "among the cosiest stays we've scored" : s >= 6.8 ? "a genuinely cosy, characterful stay" : s >= 5.6 ? "a warm, comfortable mid-cosy stay" : "a simple, milder stay on the cosy scale";
  const amen = (o.amenities || []).map((a) => String(a).trim()).filter(Boolean);
  const aLow = amen.map((a) => a.toLowerCase());
  const hasAmen = (re: RegExp) => aLow.some((a) => re.test(a));
  const faqs: Array<{ q: string; a: string }> = [];
  faqs.push({
    q: `Is ${name} a cosy hotel?`,
    a: s != null
      ? `${name} scores ${s.toFixed(1)}/10 on Got Cosy's cosiness scale: ${band}${city ? ` in ${city}` : ""}. The score weighs warmth, intimacy and character, not stars.`
      : `Got Cosy rates hotels from 0 to 10 for cosiness: warmth, intimacy and character${city ? `, including stays in ${city}` : ""}.`,
  });
  faqs.push({
    q: `What makes ${name} cosy?`,
    a: description && description.length > 20
      ? description
      : `We read each hotel's photos, guest reviews, scale and setting, weighting cues like warm light, natural materials and intimate scale. ${name}'s ${s != null ? `${s.toFixed(1)}/10` : "cosy score"} reflects how warm and characterful it feels.`,
  });
  if (rating5 != null) faqs.push({
    q: `How do guests rate ${name}?`,
    a: `Guests rate ${name} ${rating5.toFixed(1)}/5${reviews ? ` across ${reviews.toLocaleString()} reviews` : ""}. Got Cosy folds guest sentiment together with photos and setting into a single 0–10 cosy score${s != null ? ` (${s.toFixed(1)})` : ""}.`,
  });
  // Amenity-grounded questions (truthful — only from the hotel's listed facilities).
  if (amen.length) faqs.push({
    q: `What facilities does ${name} have?`,
    a: `${name} lists ${amen.slice(0, 8).join(", ").replace(/, ([^,]*)$/, " and $1")}${city ? `, in ${city}` : ""}.`,
  });
  const feature = hasAmen(/spa/) ? { what: "a spa", q: `Does ${name} have a spa?` }
    : hasAmen(/pool|swimming/) ? { what: "a pool", q: `Does ${name} have a pool?` }
    : hasAmen(/restaurant/) ? { what: "a restaurant", q: `Does ${name} have a restaurant?` }
    : hasAmen(/bar\b|lounge/) ? { what: "a bar", q: `Does ${name} have a bar?` }
    : hasAmen(/parking|garage/) ? { what: "parking", q: `Does ${name} offer parking?` }
    : null;
  if (feature) faqs.push({ q: feature.q, a: `Yes. ${name} lists ${feature.what} among its facilities.` });
  if (place) faqs.push({
    q: `Where is ${name} located?`,
    a: `${name} is in ${place}.${city ? ` You can browse more cosy hotels in ${city} on Got Cosy.` : ""}`,
  });
  faqs.push({
    q: `How is ${name}'s cosy score calculated?`,
    a: `Got Cosy's AI assesses a hotel's photos, guest reviews, amenities, room count and setting, scoring cosiness signals (fireplaces, warm lighting, soft textiles, intimate human scale) on one 0–10 scale. ${name} currently scores ${s != null ? s.toFixed(1) : "–"}.`,
  });
  if (s != null && s >= 7) faqs.push({
    q: `Is ${name} good for a romantic getaway?`,
    a: `With a cosy score of ${s.toFixed(1)}/10, ${name} leans warm and intimate: the kind of characterful stay that suits a couples or romantic trip${city ? ` in ${city}` : ""}.`,
  });
  return faqs;
}

export default async function HotelDetail({ params }: Props) {
  // NB (2026-07-16 link audit): a blind `slug.startsWith('osm-'|'am-')` guard used to live here,
  // added when the live per-visitor OSM/Amadeus lookup path was retired (f5292aa, 2026-06-18). At
  // the time those prefixes were the SYNTHETIC id namespace for that ephemeral, never-persisted
  // path ("am-<amadeusId>"). It was removed because it collided with real, persisted, scored
  // hotels whose slug legitimately starts with "am-" (German "Am ..." names: Am Rathaus, Am
  // Blumenhaus, Am Goldberg, ...); those hotels 404'd here while their generateMetadata (which
  // never had the guard) still reported them indexable, and 3 of them were live in
  // sitemap-hotels.xml, so Google was crawling a real, scored, sitemap-listed URL into a 404. The
  // retired live-lookup CODE no longer exists on this page at all (verified: no other am-/osm-
  // branch remains), so the guard was fully redundant with the plain "not found in `hotels`" path
  // below: a truly-synthetic, never-persisted "am-<id>" slug still 404s there exactly as before.
  if (isMalformedSlug(params.slug)) return notFound();

  const db = getServerSupabase();
  if (!db) return notFound();
  // Takedown mechanism: a delisted hotel (Set or hotels.delisted_at) never renders.
  if (await isDelisted(params.slug, db)) return notFound();

  const { data: hotel } = await db
    .from("hotels")
    .select("id,slug,name,city,country,website,affiliate_url,rating,reviews_count,lat,lng,amenities")
    .eq("slug", params.slug)
    .maybeSingle();
  if (!hotel) {
    // Deduped/renamed hotels: 301 to the canonical slug rather than 404 (preserves SEO + links).
    const { data: redir } = await db.from("hotel_slug_redirects").select("new_slug").eq("old_slug", params.slug).maybeSingle();
    if (redir?.new_slug && redir.new_slug !== params.slug) permanentRedirect(`/${params.locale}/hotels/${redir.new_slug}`);
    return notFound();
  }

  const { data: scoreRow } = await db
    .from("cosy_scores")
    .select("score,score_final,description,signals")
    .eq("hotel_id", hotel.id)
    .maybeSingle();
  const cosy = (scoreRow?.score_final as number | null) ?? (scoreRow?.score as number | null) ?? null;
  const cosyDescription = (scoreRow?.description as string | null) ?? null;
  // D-0008/G13 (hyper-relevance): the review-derived score evidence — the "why" behind the number
  // that neither the hotel's own site nor an OTA shows. Stored per hotel in cosy_scores.signals;
  // rendered below for rated hotels (was fetched but never displayed — audit finding #6).
  const cosySignals = Array.isArray(scoreRow?.signals)
    ? (scoreRow!.signals as unknown[]).filter((s): s is string => typeof s === "string" && s.trim().length > 8).slice(0, 5)
    : [];
  // Honest two-state (audit finding #2): "scored but below our public bar" is NOT "insufficient
  // data" — the hotel may have plenty of evidence and simply not be cosy. Never claim otherwise.
  const scoredBelowBar = typeof cosy === "number" && cosy < 5;

  // ——— WP2: build the internal-linking graph (same-city hotels + safe collection links) ———
  // cityRaw = the messy stored value (used ONLY to match same-city peers, which share it);
  // cityName = the cleaned display name (postcode/region/native-name junk removed) used for every
  // user-facing string AND for slugs, so links point at the real city guide, not a junk 404.
  const cityRaw = String(hotel.city || "").trim();
  const cityName = displayCity(cityRaw, "");
  const citySlugBase = cityName ? cityToSlug(cityName).replace(/-cosy-hotel$/, "") : "";
  let sameCity: MiniHotel[] = [];
  const collectionLinks: LinkItem[] = [];
  if (cityRaw) {
    const { data: peers } = await db
      .from("cosy_scores")
      .select("hotel_id,score,score_final,signals,description,hotel:hotel_id!inner(slug,name,name_en,city)")
      .gte("score", 5)
      .eq("hotel.city", cityRaw)
      .neq("hotel_id", hotel.id)
      .order("score", { ascending: false })
      .limit(40);
    type Peer = { hotel_id: string; score: number | null; score_final: number | null; signals: string[] | null; description: string | null; hotel: { slug: string; name: string; name_en: string | null } | null };
    const delistedPeers = await getDelistedSlugSet(db);
    const rows = ((peers || []) as unknown as Peer[]).filter((r) => !delistedPeers.has(String(r.hotel?.slug))); // takedown excludes the same-city peer list
    // Fetched in raw-`score` order, but the peer card shows `score_final ?? score` (±0.2 apart), so
    // sort by the DISPLAYED score before slicing so the 6 shown are the 6 cosiest, in order.
    rows.sort((a, b) => Number((b.score_final ?? b.score) || 0) - Number((a.score_final ?? a.score) || 0));
    sameCity = rows.slice(0, 6).map((r) => ({ slug: String(r.hotel?.slug), name: String(r.hotel?.name_en || r.hotel?.name || ""), score: Number((r.score_final ?? r.score) || 0) })).filter((h) => h.slug && h.name);
    // Safe collection links: a facet page needs ≥ its city minimum of in-city matches (legacy 5 →
    // 2, rising-intent facets → 5, per cityCollectionMin), so only link facets where this hotel +
    // its peers clear it — guarantees the /cosy-hotels/[facet]/[city] page won't 404.
    for (const f of FACETS) {
      // Experiment-control exclusion: a NEW rising-intent facet's control-market city page does
      // not exist (conceptCityBlocked), so never link it. Legacy 5 unaffected.
      if (conceptCityBlocked(CONCEPT_BY_SLUG[f.slug], cityName)) continue;
      const self = matchesFacet(f, (scoreRow?.signals as string[] | null) ?? null, cosyDescription) ? 1 : 0;
      const peerMatches = rows.filter((r) => matchesFacet(f, r.signals, r.description)).length;
      const min = cityCollectionMin(CONCEPT_BY_SLUG[f.slug]);
      if (self + peerMatches >= min && citySlugBase) collectionLinks.push({ href: `/${params.locale}/cosy-hotels/${f.slug}/${citySlugBase}`, label: `Cosy hotels ${f.label} in ${cityName}` });
    }
  }

  // ——— Traveller Fit: the "Best for" section (only for hotels with inferred concepts) ———
  // Table can be empty (inference hasn't run) — then `displayed` is [] and <TravellerFit> renders
  // nothing, so hotels without data get zero layout change.
  const { data: fitData } = await db
    .from("hotel_traveller_fit")
    .select("concept_id,confidence,evidence_text")
    .eq("hotel_id", hotel.id);
  const fitAssignments: TravellerFitAssignment[] = ((fitData || []) as { concept_id: string; confidence: number | null; evidence_text: string | null }[])
    .map((r) => ({ hotel_id: String(hotel.id), concept_id: r.concept_id, confidence: Number(r.confidence ?? 0), evidence_text: r.evidence_text || "", source: "llm" as const }));
  const displayedFits = displayFits(fitAssignments, 6);

  // Resolve each displayed concept's badge href (no-404 guarantee, mirrors Phase 3's gates):
  //  • collectionEnabled=false → non-link chip (null href)
  //  • city page only when ≥ cityCollectionMin verified in-city; else the always-on theme hub.
  const hrefBySlug: Record<string, string | null> = {};
  if (displayedFits.length) {
    const collectionSlugs = displayedFits
      .map((a) => CONCEPT_BY_SLUG[a.concept_id])
      .filter((c) => c != null && c.collectionEnabled)
      .map((c) => c!.slug);
    // Member counts by concept, computed EXACTLY as the city page computes them (RPC top-80 window
    // → cityMembers → stored ∪ legacy-regex via conceptMembers). Counting a different universe
    // (e.g. the exact-city peers list) can "verify" a link whose page, fed by the LIMIT 80 RPC,
    // then 404s. One RPC round-trip for the city, reused across all displayed concepts (ISR-cached).
    const cityMemberCount = new Map<string, number>();
    if (citySlugBase && collectionSlugs.length) {
      const cityRes = await loadCityCosyHotels(citySlugBase);
      if (cityRes) {
        const cityAssignments = await loadConceptAssignments(collectionSlugs, cityRes.hotels.map((h) => h.id));
        for (const slug of collectionSlugs) {
          const c = CONCEPT_BY_SLUG[slug];
          // Experiment-control exclusion: a blocked (concept, city) page 404s, so its member count
          // here stays 0 and the badge falls back to the always-on theme hub link below.
          if (c && !conceptCityBlocked(c, cityRes.cityName)) cityMemberCount.set(slug, conceptMembers(c, cityRes.hotels, cityAssignments).length);
        }
      }
    }
    for (const a of displayedFits) {
      const c = CONCEPT_BY_SLUG[a.concept_id];
      if (!c || !c.collectionEnabled) { hrefBySlug[a.concept_id] = null; continue; }
      const verified = citySlugBase != "" && (cityMemberCount.get(c.slug) ?? 0) >= cityCollectionMin(c);
      hrefBySlug[a.concept_id] = verified
        ? `/${params.locale}/cosy-hotels/${c.slug}/${citySlugBase}`
        : `/${params.locale}/cosy-hotels/${c.slug}`;
    }
  }

  // Real cached photo only (no placeholder).
  let photo: string | null = null;
  try {
    const { data: imgs } = await db.from("hotel_images").select("url,created_at,vision_ok").eq("hotel_id", hotel.id).eq("vision_ok", true).order("created_at", { ascending: false });
    // Only vision-QA-vetted photos (vision_ok=true) render — same gate as the listing/city/home
    // surfaces. Unchecked (null) and junk (false) never show, so a newly-scraped hotel can't flash
    // an unvetted image (the bug that surfaced a champagne-promo thumbnail). The JUNK regex is a
    // defence-in-depth backstop; \/_?\d… catches both /320x320 and /_320x320_ thumbnail paths.
    const JUNK = /logo|favicon|wi-?fi|sprite|qr[-_]?code|\bicon\b|\bbadge\b|\/_?\d{2,3}[-x_]\d{2,3}[-_.]/i;
    for (const r of (imgs || []) as Array<{ url: string | null; vision_ok: boolean | null }>) {
      if (r.url && !r.url.includes("placehold.co") && !JUNK.test(r.url)) { photo = r.url; break; }
    }
  } catch {}

  // Use DB values to compose concise snippet
  const rating5 = typeof hotel.rating === 'number' ? Number(hotel.rating) / 2 : undefined;
  // Below the public floor (or hidden for lack of findings) = not rated: no score is shown anywhere.
  const cosyDisplay = typeof cosy === 'number' && cosy >= 5 ? cosy : undefined;
  const cosySnippet = buildCosySnippet(params.locale, {
    city: cityName,
    name: String(hotel.name),
    rating: rating5,
    reviewsCount: (typeof hotel.reviews_count === 'number' ? hotel.reviews_count : undefined),
    cues: [],
    idealLevel: 'warm',
  });

  // Redirect to canonical SEO slug if any mismatch (future-safe)
  if (params.slug !== hotel.slug) {
    permanentRedirect(`/${params.locale}/hotels/${hotel.slug}`);
  }

  const badge = cosyBadgeColor(typeof cosyDisplay === 'number' ? cosyDisplay : 0);
  const bookingUrl = stay22AllezUrl({
    name: String(hotel.name), city: (hotel.city as string | null) ?? null, country: (hotel.country as string | null) ?? null,
    lat: (hotel.lat as number | null) ?? null, lng: (hotel.lng as number | null) ?? null,
    campaign: `detail-${params.locale}`,
  });
  // Factual, physical Traveller-Fit concepts → schema.org amenityFeature (SEO/AEO). Only HARD
  // amenities that survived deterministic-evidence gating at inference time; never soft vibes.
  const AMENITY_FEATURE_NAME: Record<string, string> = {
    spa: "Spa", sauna: "Sauna", pool: "Swimming pool", garden: "Garden", rooftop: "Rooftop terrace",
    bathtub: "Bathtub", fireplace: "Fireplace", "great-breakfast": "Breakfast highly rated", waterfront: "Waterfront location",
  };
  const amenityFeature = displayedFits
    .filter((a) => AMENITY_FEATURE_NAME[a.concept_id])
    .map((a) => ({ "@type": "LocationFeatureSpecification", name: AMENITY_FEATURE_NAME[a.concept_id], value: true }));
  const hotelJsonLd = {
    "@context": "https://schema.org",
    "@type": "Hotel",
    name: String(hotel.name),
    description: cosyDescription ?? undefined,
    image: photo ?? undefined,
    address: { "@type": "PostalAddress", addressLocality: cityName, addressCountry: displayCountry(String(hotel.country || "")) },
    ...(rating5 != null ? { aggregateRating: { "@type": "AggregateRating", ratingValue: Number(rating5.toFixed(1)), bestRating: 5, worstRating: 1, ...(typeof hotel.reviews_count === 'number' && hotel.reviews_count > 0 ? { ratingCount: hotel.reviews_count } : {}) } } : {}),
    ...(amenityFeature.length ? { amenityFeature } : {}),
    url: `${site.url}/${params.locale}/hotels/${hotel.slug}`,
  };
  // The city guide 404s at 0 live cosy picks, gated by the page's own exact-match TRUST filter,
  // stricter than loadCityCosyHotels' substring match (2026-07-16 link audit: a hotel whose raw
  // `city` field carries OSM postcode noise, e.g. "Bali 80571", can satisfy the substring check
  // while the guide itself finds zero exact matches and 404s). Verify with guideCityHasLivePick,
  // the SAME predicate the guide page renders with, so this crumb/link can never point at a 404.
  // When it wouldn't render, drop the city crumb/link and fall back to /cosy-hotels (always 200)
  // for the non-optional HotelGraph prop.
  const cityGuideRenders = citySlugBase ? await guideCityHasLivePick(db, cityName) : false;
  const cityGuideHref = cityGuideRenders
    ? `/${params.locale}/guides/${cityToSlug(cityName)}`
    : `/${params.locale}/cosy-hotels`;
  const breadcrumbJsonLd = breadcrumbSchema([
    { name: "Cosy hotel guides", url: `/${params.locale}/guides` },
    ...(cityName && cityGuideRenders ? [{ name: cityName, url: `/${params.locale}/guides/${cityToSlug(cityName)}` }] : []),
    { name: String(hotel.name), url: `/${params.locale}/hotels/${hotel.slug}` },
  ]);
  // Reader-facing chrome routes through translate() for non-en locales; en short-circuits before any
  // await (English pays zero cost). Hotel names, city/country, scores, review signals and FAQ answers
  // stay as DATA. The description body is a pure sv cache hit (pre-translated). British English, no
  // em/en dashes in source. generateMetadata/canonical/title are NOT touched here (other branch owns).
  const isEn = params.locale === "en";
  const CH = {
    guides: "Guides",
    cosyIndex: "The Cosy Index",
    browseGuides: "Browse guides",
    howScore: "How the cosy score works",
    faqHeading: "Frequently asked questions",
    disclosure: "Booking via this link may earn us a commission; it never affects cosy scores.",
    reviewed: "Reviewed",
    belowBar: "below our cosy bar",
    notRated: "Not yet rated",
    awaiting: "awaiting evidence",
    notEnough: "We haven't gathered enough guest evidence to score this hotel for cosiness yet. It will earn a score once we have real reviews or vetted photos.",
    ownTitle: "Own this hotel? Add your cosy badge",
    ownBlurb: "Show off your AI cosy score: paste this on your site and it links back to your ranking.",
    copyEmbed: "Copy embed code",
    copiedWord: "Copied",
    belowBarPre: "We reviewed",
    belowBarMid: "for cosiness (warmth, character, intimacy) and it didn't clear the bar for our shortlist. That's a verdict on cosiness, not on cleanliness or service",
    belowBarCityClause: "the {city} hotels that did clear it are",
    belowBarRankedHere: "ranked here",
  };
  let LC = CH;
  const rawDesc = cosyDescription ?? cosySnippet;
  let descBody = rawDesc;
  let whyScores = cosyDisplay != null ? `Why it scores ${cosyDisplay.toFixed(1)}, from guest reviews` : "";
  let cosyHotelsInCity = cityName ? `Cosy hotels in ${cityName}` : "";
  let moreCosyHotelsIn = cityName ? `More cosy hotels in ${cityName}` : "";
  let seeCityGuide = cityName ? `See the ${cityName} guide` : "";
  let exploreByStyle = `Explore cosy hotels ${cityName ? `in ${cityName} ` : ""}by style`;
  let collectionLabels = collectionLinks.map((l) => l.label);
  // Review signals ('Why it scores' bullets) are review-grounded content, translated like the
  // description body (founder, 2026-07-17: the /sv hotel page must read Swedish end to end).
  let signalsT = cosySignals;
  if (!isEn) {
    const keys = Object.keys(CH) as (keyof typeof CH)[];
    const [chromeVals, dsc, why, chic, sigs, moreCity, seeGuide, byStyle, collLabels] = await Promise.all([
      Promise.all(keys.map((k) => translate(CH[k], params.locale))),
      rawDesc ? translate(rawDesc, params.locale) : Promise.resolve(rawDesc),
      whyScores ? translate(whyScores, params.locale) : Promise.resolve(whyScores),
      cosyHotelsInCity ? translate(cosyHotelsInCity, params.locale) : Promise.resolve(cosyHotelsInCity),
      cosySignals.length ? translateMany(cosySignals, params.locale) : Promise.resolve(cosySignals),
      moreCosyHotelsIn ? translate(moreCosyHotelsIn, params.locale) : Promise.resolve(moreCosyHotelsIn),
      seeCityGuide ? translate(seeCityGuide, params.locale) : Promise.resolve(seeCityGuide),
      translate(exploreByStyle, params.locale),
      collectionLabels.length ? translateMany(collectionLabels, params.locale) : Promise.resolve(collectionLabels),
    ]);
    LC = Object.fromEntries(keys.map((k, i) => [k, chromeVals[i]])) as typeof CH;
    descBody = dsc; whyScores = why; cosyHotelsInCity = chic; signalsT = sigs;
    moreCosyHotelsIn = moreCity; seeCityGuide = seeGuide; exploreByStyle = byStyle; collectionLabels = collLabels;
  }
  const collectionLinksT: LinkItem[] = collectionLinks.map((l, i) => ({ href: l.href, label: collectionLabels[i] }));
  const hotelGraphLabels = { moreCosyHotelsIn, seeCityGuide, exploreByStyle };

  const crumbItems: LinkItem[] = [
    { href: `/${params.locale}/guides`, label: LC.guides },
    ...(cityName && cityGuideRenders ? [{ href: cityGuideHref, label: cityName }] : []),
    { href: `/${params.locale}/hotels/${hotel.slug}`, label: String(hotel.name) },
  ];
  const graphExtra: LinkItem[] = [
    { href: `/${params.locale}/cosy-index`, label: LC.cosyIndex },
    ...(cityName && cityGuideRenders ? [{ href: cityGuideHref, label: cosyHotelsInCity }] : []),
  ];
  // Bespoke, review-grounded FAQ when we have one for this hotel; else the data-tailored template.
  const bespoke = (hotelFaqData as Record<string, { q: string; a: string }[]>)[String(hotel.id)];
  const faqs = bespoke?.length
    ? bespoke
    : hotelFaqs({ name: String(hotel.name), city: cityName, country: displayCountry(String(hotel.country || '')), cosy: cosyDisplay ?? null, description: cosyDescription, rating5: rating5 ?? null, reviews: typeof hotel.reviews_count === 'number' ? hotel.reviews_count : null, amenities: Array.isArray(hotel.amenities) ? (hotel.amenities as string[]) : [] });
  const faqJsonLd = { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) };
  // FAQ answers are translated for DISPLAY on non-en; the JSON-LD above keeps the English source so
  // structured data stays aligned with the /en canonical.
  const faqsT = isEn ? faqs : await Promise.all(faqs.map(async (f) => ({ q: await translate(f.q, params.locale), a: await translate(f.a, params.locale) })));

  // "Save to your plan" (saved lists) — every reader-facing string routes through translate() for
  // non-en locales (standing rule); the button itself is a client component and receives only
  // already-translated strings, never raw English. Labels are built by the shared helper so this
  // page's copy stays identical to every listing card that also renders the button.
  const saveLabels: SaveToTripLabels = await buildSaveLabels(params.locale);
  const shareLabels = await buildShareLabels(params.locale);

  // Booking CTA policy (founder FINAL rule, 2026-07-16): the website only replaces Stay22 for a
  // hotel the real-browser sweep has actually VERIFIED wrong (see src/lib/ctaPolicy.ts). Used both
  // by HotelActions (renders the button) and below (gates the affiliate disclosure line to only
  // when a Stay22 button is actually on the page).
  const rawWebsite = String((hotel as { website?: string | null }).website || "").trim() || null;
  const isVerifiedWrong = (await getStay22WrongSlugs(db)).has(String(hotel.slug));
  const bookingCta = resolveBookingCta(rawWebsite, bookingUrl, isVerifiedWrong);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(hotelJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(breadcrumbJsonLd)} />
      <Breadcrumb items={crumbItems} />
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-display text-4xl font-semibold tracking-tight">{hotel.name}</h1>
          <div className="mt-1.5 text-base" style={{ color: 'var(--muted)' }}>{[cityName, displayCountry(String(hotel.country || ''))].filter(Boolean).join(', ')}</div>
        </div>
        <div className="flex-none pt-1"><ShareButton title={`${hotel.name}, a cosy hotel${cityName ? ` in ${cityName}` : ''}`} label={shareLabels.toggle} labels={shareLabels} /></div>
      </div>

      {photo && (
        <div className="relative mt-5 w-full overflow-hidden rounded-2xl" style={{ aspectRatio: "16/9", border: "1px solid var(--line)" }}>
          <Image src={photo} alt={`${hotel.name}${cityName ? `, ${cityName}` : ''}`} fill className="object-cover" sizes="(max-width:768px) 100vw, 768px" quality={70} unoptimized={/^https?:\/\//.test(photo)} priority />
        </div>
      )}

      <div className="mt-6 flex flex-col gap-4 rounded-2xl border p-5 sm:flex-row sm:items-center sm:gap-5" style={{ borderColor: 'var(--line)', background: 'var(--card)', boxShadow: 'var(--shadow)' }}>
        {cosyDisplay != null ? (
          <div className="flex-none flex flex-col items-center justify-center rounded-2xl font-display font-bold" style={{ width: 76, height: 76, background: badge, color: '#fff', fontSize: 28 }} aria-label={`Cosy score ${cosyDisplay.toFixed(1)} out of 10`}>
            {cosyDisplay.toFixed(1)}<span style={{ fontFamily: 'Inter', fontSize: 10, fontWeight: 600, letterSpacing: '0.12em', opacity: 0.8 }}>COSY</span>
          </div>
        ) : (
          <div className="flex-none rounded-2xl border px-4 py-3 text-sm font-medium" style={{ borderColor: 'var(--line)', color: 'var(--muted)' }} aria-label={scoredBelowBar ? 'Reviewed: below our cosy bar' : 'Not yet rated'}>
            {scoredBelowBar ? <>{LC.reviewed}<br /><span className="text-xs font-normal">{LC.belowBar}</span></> : <>{LC.notRated}<br /><span className="text-xs font-normal">{LC.awaiting}</span></>}
          </div>
        )}
        <div className="flex-1 min-w-0">
          {cosyDisplay != null && (cosyDescription ?? cosySnippet)
            ? <p className="text-[15px] leading-relaxed" style={{ color: 'var(--foreground)' }}>{descBody}</p>
            : cosyDisplay == null && (scoredBelowBar
              ? <p className="text-[15px] leading-relaxed" style={{ color: 'var(--muted)' }}>{LC.belowBarPre} {String(hotel.name)} {LC.belowBarMid}{cityName && cityGuideRenders ? <>; {LC.belowBarCityClause.replace('{city}', cityName)} <a href={cityGuideHref}>{LC.belowBarRankedHere}</a></> : null}.</p>
              : <p className="text-[15px] leading-relaxed" style={{ color: 'var(--muted)' }}>{LC.notEnough}</p>)}
          <a href={`/${params.locale}/about`} className="mt-2 inline-block text-xs no-underline" style={{ color: 'var(--muted)', borderBottom: '1px dotted var(--line)' }}>{LC.howScore} →</a>
        </div>
      </div>

      {cosyDisplay != null && cosySignals.length > 0 && (
        <section className="mt-4 rounded-2xl border p-5" style={{ borderColor: 'var(--line)', background: 'var(--card)' }}>
          <h2 className="text-sm font-semibold tracking-wide" style={{ color: 'var(--muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>{whyScores}</h2>
          <ul className="mt-3 space-y-2">
            {signalsT.map((s, i) => (
              <li key={i} className="flex gap-2.5 text-[15px] leading-relaxed" style={{ color: 'var(--foreground)' }}>
                <span aria-hidden="true" style={{ color: 'var(--ember)', flex: 'none' }}>·</span>
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <TravellerFit displayed={displayedFits} hrefBySlug={hrefBySlug} locale={params.locale} />

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <a className="inline-flex min-h-[44px] items-center rounded-xl px-4 no-underline text-sm" style={{ border: '1px solid var(--line)', color: 'var(--foreground)' }} href={cityName && cityGuideRenders ? cityGuideHref : `/${params.locale}/guides`}>← {cityName && cityGuideRenders ? cosyHotelsInCity : LC.browseGuides}</a>
        <div className="sm:ml-auto">
          <HotelActions stay22Href={bookingUrl} website={rawWebsite} isVerifiedWrong={isVerifiedWrong} showWebsiteSecondary hotelName={String(hotel.name)} city={cityName} slug={String(hotel.slug)} locale={params.locale} saveLabels={saveLabels} />
        </div>
      </div>
      {/* Adjacent affiliate disclosure (audit finding #4) — clear and conspicuous, next to the CTA, not
          only in the footer. Only meaningful when a Stay22 button actually renders (founder, 2026-07-16). */}
      {bookingCta.mode === "stay22" && (
        <p className="mt-2 text-right text-xs" style={{ color: 'var(--muted)' }}>{LC.disclosure}</p>
      )}

      <HotelGraph city={cityName} locale={params.locale} cityGuideHref={cityGuideHref} sameCity={sameCity} collections={collectionLinksT} extra={graphExtra} labels={hotelGraphLabels} />

      <section className="mt-12">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
        <h2 className="font-display text-2xl font-semibold">{LC.faqHeading}</h2>
        <dl className="mt-4 space-y-3">
          {faqsT.map((f, i) => (
            <div key={i} className="rounded-xl border p-4" style={{ borderColor: 'var(--line)', background: 'var(--card)' }}>
              <dt className="font-medium" style={{ color: 'var(--foreground)' }}>{f.q}</dt>
              <dd className="mt-1.5 text-sm leading-relaxed" style={{ color: 'var(--muted)' }}>{f.a}</dd>
            </div>
          ))}
        </dl>
      </section>

      {cosyDisplay != null && <BadgeEmbed slug={String(hotel.slug)} score={cosyDisplay} name={String(hotel.name)} title={LC.ownTitle} blurb={LC.ownBlurb} copyLabel={LC.copyEmbed} copiedLabel={LC.copiedWord} />}
    </div>
  );
}
