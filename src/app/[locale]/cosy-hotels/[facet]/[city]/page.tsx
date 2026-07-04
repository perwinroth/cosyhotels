// Long-tail facet page: "Cosy hotels {facet} in {City}" — e.g. /en/cosy-hotels/fireplace/edinburgh.
// Only hotels whose REAL cosy signals/description support the facet are shown; pages with <2
// matches 404 (no thin/AI-filler pages). Copy is data-led (counts, names, scores) on purpose.
import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getServerSupabase } from "@/lib/supabase/server";
import { cityToSlug } from "@/lib/citySlug";
import { stay22AllezUrl } from "@/lib/affiliates";
import { CONCEPT_BY_SLUG, cityCollectionMin, LEGACY_FACET_SLUGS } from "@/lib/travellerFit";
import { cosyBadgeColor } from "@/lib/cosyColor";
import ShareButton from "@/components/ShareButton";
import {
  loadCityCosyHotels, resolveCity, loadConceptAssignments,
  conceptMembers, orderConceptMembers, conceptLabelPhrase,
} from "@/lib/seo/cityHotels";

export const revalidate = 3600;

// City rows come from the shared loadCityCosyHotels (src/lib/seo/cityHotels.ts) so page + sitemap
// apply IDENTICAL dedup/isLatin/city-match rules; membership then follows the Traveller Fit contract
// (stored hotel_traveller_fit ≥ minConfidence ∪ legacy regex). With the table empty the legacy 5
// degrade to exactly today's facet membership + ≥2 gate.
async function load(conceptSlug: string, citySlug: string) {
  const concept = CONCEPT_BY_SLUG[conceptSlug];
  if (!concept || !concept.collectionEnabled) return null;
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
  const title = `Cosy hotels ${phrase} in ${cityName}`;
  const description = LEGACY_FACET_SLUGS.has(concept.slug)
    ? `AI-ranked cosy hotels ${phrase} in ${cityName} — scored 0–10 for warmth and character, with real photos and honest cosy scores.`
    : `${concept.description} The cosiest hotels ${phrase} in ${cityName}, AI-scored 0–10 for warmth and character.`;
  // Untranslated pages: only /en is indexed, so canonical (and og:url) point at the /en twin.
  const url = `/en/cosy-hotels/${params.facet}/${params.city}`;
  return { title, description, alternates: { canonical: url }, openGraph: { title, description, type: "website", url } };
}

export default async function FacetPage({ params }: { params: { locale: string; facet: string; city: string } }) {
  const res = await load(params.facet, params.city);
  if (!res || res.hotels.length < cityCollectionMin(res.concept)) notFound(); // legacy → ≥2, new → ≥5
  const { concept, cityName, hotels } = res;
  const phrase = conceptLabelPhrase(concept);
  const isLegacy = LEGACY_FACET_SLUGS.has(concept.slug);

  // Vetted photos.
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
  const lead = `We've scored ${hotels.length} cosy ${hotels.length === 1 ? "hotel" : "hotels"} ${phrase} in ${cityName} — ${top.name} leads at ${top.score.toFixed(1)}/10. Ranked by cosy score.`;
  const intro = isLegacy ? lead : `${concept.description} ${lead}`;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://gotcosy.com";
  const jsonLd = {
    "@context": "https://schema.org", "@type": "ItemList", name: `Cosy hotels ${phrase} in ${cityName}`, numberOfItems: hotels.length,
    itemListElement: hotels.map((h, i) => ({ "@type": "ListItem", position: i + 1, item: { "@type": "Hotel", name: h.name, url: `${siteUrl}/${params.locale}/hotels/${h.slug}`, ...(photo.get(h.id) ? { image: photo.get(h.id) } : {}), review: { "@type": "Review", author: { "@type": "Organization", name: "Got Cosy" }, reviewRating: { "@type": "Rating", ratingValue: Number(h.score.toFixed(1)), bestRating: 10, worstRating: 0, name: "Cosy score" } } } })),
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <h1 className="text-2xl font-semibold">Cosy hotels {phrase} in {cityName}</h1>
      <p className="mt-2" style={{ color: "var(--muted)" }}>{intro}</p>
      <ol className="mt-6 space-y-3">
        {hotels.map((h, idx) => {
          const cta = stay22AllezUrl({ name: h.name, city: h.city, country: h.country, lat: h.lat, lng: h.lng, campaign: `facet-${concept.slug}` });
          const ph = photo.get(h.id);
          return (
            <li key={h.id} className="rounded-xl border p-4" style={{ borderColor: "var(--line)", background: "var(--card)" }}>
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 flex items-center justify-center rounded-2xl text-white shadow" style={{ background: cosyBadgeColor(h.score), width: 56, height: 56, fontFamily: "Fraunces, serif", fontSize: 22, fontWeight: 600 }}>{h.score.toFixed(1)}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2"><span className="text-sm tabular-nums" style={{ color: "var(--muted)" }}>#{idx + 1}</span><h2 className="text-lg font-semibold leading-tight"><a href={`/${params.locale}/hotels/${h.slug}`} className="hover:underline">{h.name}</a></h2></div>
                  <div className="text-sm" style={{ color: "var(--muted)" }}>{[h.city, h.country].filter(Boolean).join(", ")}</div>
                  {h.snippet && <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--foreground)" }}>{h.snippet}</p>}
                  <div className="mt-3 flex items-center gap-2"><a href={cta} target="_blank" rel="noopener nofollow sponsored" data-cta="check_availability" data-hotel={h.name} data-city={h.city} className="inline-flex items-center justify-center rounded-lg text-white px-4 py-2 text-sm font-medium no-underline" style={{ background: "var(--ember)" }}>Check availability</a><ShareButton variant="icon" title={`${h.name} — cosy hotel in ${h.city}`} url={`/${params.locale}/hotels/${h.slug}`} /></div>
                </div>
                {ph && <a href={`/${params.locale}/hotels/${h.slug}`} className="flex-shrink-0 hidden sm:block"><div className="relative rounded-lg overflow-hidden" style={{ width: 120, height: 90 }}><Image src={ph} alt={h.name} fill className="object-cover" sizes="120px" quality={60} unoptimized={/^https?:\/\//.test(ph)} /></div></a>}
              </div>
            </li>
          );
        })}
      </ol>
      <p className="mt-8 text-sm" style={{ color: "var(--muted)" }}>See all <a href={`/${params.locale}/guides/${cityToSlug(cityName)}`} className="underline">cosy hotels in {cityName}</a>, or cosy hotels {phrase} <a href={`/${params.locale}/cosy-hotels/${concept.slug}`} className="underline">worldwide</a>.</p>
    </div>
  );
}
