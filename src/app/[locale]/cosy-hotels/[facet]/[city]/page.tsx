// Long-tail facet page: "Cosy hotels {facet} in {City}" — e.g. /en/cosy-hotels/fireplace/edinburgh.
// Only hotels whose REAL cosy signals/description support the facet are shown; pages with <2
// matches 404 (no thin/AI-filler pages). Copy is data-led (counts, names, scores) on purpose.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getServerSupabase } from "@/lib/supabase/server";
import { cityToSlug } from "@/lib/citySlug";
import { stay22AllezUrl } from "@/lib/affiliates";
import { CONCEPT_BY_SLUG, cityCollectionMin, LEGACY_FACET_SLUGS, conceptCityBlocked } from "@/lib/travellerFit";
import { FACET_CITY_COPY } from "@/data/discoveryOverrides";
import { translate, translateMany } from "@/lib/i18n/translate";
import { localeSeo } from "@/lib/i18n/seoLocale";
import HotelCard from "@/components/HotelCard";
import { buildSaveLabels } from "@/lib/i18n/saveLabels";
import {
  loadCityCosyHotels, resolveCity, cityBaseSlug, loadConceptAssignments,
  conceptMembers, orderConceptMembers, conceptLabelPhrase,
} from "@/lib/seo/cityHotels";
import { guideCityHasLivePick } from "@/lib/seo/guidePicks";
import { getStay22WrongSlugs } from "@/lib/ctaPolicy";

export const revalidate = 3600;

// City rows come from the shared loadCityCosyHotels (src/lib/seo/cityHotels.ts) so page + sitemap
// apply IDENTICAL dedup/isLatin/city-match rules; membership then follows the Traveller Fit contract
// (stored hotel_traveller_fit ≥ minConfidence ∪ legacy regex). With the table empty the legacy 5
// degrade to exactly today's facet membership + ≥2 gate.
async function load(conceptSlug: string, citySlug: string) {
  const concept = CONCEPT_BY_SLUG[conceptSlug];
  if (!concept || !concept.collectionEnabled) return null;
  // Experiment-control exclusion: NEW rising-intent facets never mint a control-market city page
  // (York/Savannah/Fez/Venice) — the page structurally does not exist (404). Legacy 5 untouched.
  if (conceptCityBlocked(concept, resolveCity(citySlug))) return null;
  const res = await loadCityCosyHotels(citySlug);
  if (!res) return null;
  const assignments = await loadConceptAssignments([concept.slug], res.hotels.map((h) => h.id));
  const hotels = orderConceptMembers(conceptMembers(concept, res.hotels, assignments));
  return { concept, cityName: res.cityName, hotels };
}

export async function generateMetadata({ params }: { params: { locale: string; facet: string; city: string } }): Promise<Metadata> {
  const concept = CONCEPT_BY_SLUG[params.facet];
  if (!concept || !concept.collectionEnabled) return {};
  const cityName = resolveCity(params.city);
  const phrase = conceptLabelPhrase(concept);
  const titleBase = FACET_CITY_COPY[`${params.facet}/${params.city}`]?.title ?? `Cosy hotels ${phrase} in ${cityName}`;
  const descBase = LEGACY_FACET_SLUGS.has(concept.slug)
    ? `AI-ranked cosy hotels ${phrase} in ${cityName}, scored from 0 to 10 for warmth and character, with real photos and the signals behind each score.`
    : `${concept.description} The cosiest hotels ${phrase} in ${cityName}, AI-scored from 0 to 10 for warmth and character.`;
  const title = params.locale === "en" ? titleBase : await translate(titleBase, params.locale);
  const description = params.locale === "en" ? descBase : await translate(descBase, params.locale);
  // Body copy below is genuinely translated for TRANSLATED_LOCALES (isEn ? ... : translate(...)),
  // so canonical/hreflang are locale-aware; every other locale still points at the /en twin.
  // canonicalCitySlug (not the raw params.city) so every dirty/alternate-spelling/substring-matched
  // city slug that clears the render gate declares the SAME one true canonical — the slug
  // sitemapData.ts's collectionUrls() would itself emit — instead of self-canonicalizing to
  // whatever variant was requested (GSC "duplicate without user-selected canonical" class).
  const canonicalCitySlug = cityBaseSlug(cityName);
  const { canonical: url, languages } = localeSeo(params.locale, `/cosy-hotels/${params.facet}/${canonicalCitySlug}`);
  return { title, description, alternates: { canonical: url, ...(languages ? { languages } : {}) }, openGraph: { title, description, type: "website", url } };
}

export default async function FacetPage({ params }: { params: { locale: string; facet: string; city: string } }) {
  const res = await load(params.facet, params.city);
  if (!res || res.hotels.length < cityCollectionMin(res.concept)) notFound(); // legacy → ≥2, new → ≥5
  const { concept, cityName, hotels } = res;
  const phrase = conceptLabelPhrase(concept);
  const isLegacy = LEGACY_FACET_SLUGS.has(concept.slug);

  // Vetted photos.
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
  const lead = `We've scored ${hotels.length} cosy ${hotels.length === 1 ? "hotel" : "hotels"} ${phrase} in ${cityName}; ${top.name} leads at ${top.score.toFixed(1)}/10. Ranked by cosy score.`;
  const introEn = FACET_CITY_COPY[`${params.facet}/${params.city}`]?.intro ?? (isLegacy ? lead : `${concept.description} ${lead}`);
  // Visible body copy renders in the target language for non-en; en path is byte-identical (G14).
  const isEn = params.locale === "en";
  const h1 = isEn ? "" : await translate(`Cosy hotels ${phrase} in ${cityName}`, params.locale);
  const intro = isEn ? introEn : await translate(introEn, params.locale);
  const snippets = isEn ? hotels.map((h) => h.snippet) : await translateMany(hotels.map((h) => h.snippet || ""), params.locale);
  const saveLabels = await buildSaveLabels(params.locale);
  const footerLine = isEn
    ? { seeAll: "See all", cosyHotelsIn: `cosy hotels in ${cityName}`, or: "or", cosyHotelsFacet: `cosy hotels ${phrase}`, seeFacet: `See cosy hotels ${phrase}`, worldwide: "worldwide" }
    : {
        seeAll: await translate("See all", params.locale),
        cosyHotelsIn: await translate(`cosy hotels in ${cityName}`, params.locale),
        or: await translate("or", params.locale),
        cosyHotelsFacet: await translate(`cosy hotels ${phrase}`, params.locale),
        seeFacet: await translate(`See cosy hotels ${phrase}`, params.locale),
        worldwide: await translate("worldwide", params.locale),
      };
  // The city guide's TRUST filter is a stricter exact-match than this facet page's own
  // `loadCityCosyHotels` (substring match), so this page rendering does NOT guarantee the guide
  // renders (2026-07-16 link audit). Verify before linking it.
  const cityGuideLive = await guideCityHasLivePick(db, cityName);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://gotcosy.com";
  const jsonLd = {
    "@context": "https://schema.org", "@type": "ItemList", name: `Cosy hotels ${phrase} in ${cityName}`, numberOfItems: hotels.length,
    itemListElement: hotels.map((h, i) => ({ "@type": "ListItem", position: i + 1, item: { "@type": "Hotel", name: h.name, url: `${siteUrl}/${params.locale}/hotels/${h.slug}`, ...(photo.get(h.id) ? { image: photo.get(h.id) } : {}), review: { "@type": "Review", author: { "@type": "Organization", name: "Got Cosy" }, reviewRating: { "@type": "Rating", ratingValue: Number(h.score.toFixed(1)), bestRating: 10, worstRating: 0, name: "Cosy score" } } } })),
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <h1 className="text-2xl font-semibold">{isEn ? <>Cosy hotels {phrase} in {cityName}</> : h1}</h1>
      <p className="mt-2" style={{ color: "var(--muted)" }}>{intro}</p>
      <ol className="mt-6 space-y-3">
        {hotels.map((h, idx) => {
          const cta = stay22AllezUrl({ name: h.name, city: h.city, country: h.country, lat: h.lat, lng: h.lng, campaign: `facet-${concept.slug}` });
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
              shareTitle={`${h.name}, a cosy hotel in ${h.city}`}
              shareUrl={`/${params.locale}/hotels/${h.slug}`}
            />
          );
        })}
      </ol>
      <p className="mt-8 text-sm" style={{ color: "var(--muted)" }}>{cityGuideLive ? <>{footerLine.seeAll} <a href={`/${params.locale}/guides/${cityToSlug(cityName)}`} className="underline">{footerLine.cosyHotelsIn}</a>, {footerLine.or} {footerLine.cosyHotelsFacet} </> : <>{footerLine.seeFacet} </>}<a href={`/${params.locale}/cosy-hotels/${concept.slug}`} className="underline">{footerLine.worldwide}</a>.</p>
    </div>
  );
}
