// Long-tail facet page: "Cosy hotels {facet} in {City}" — e.g. /en/cosy-hotels/fireplace/edinburgh.
// Only hotels whose REAL cosy signals/description support the facet are shown; pages with <2
// matches 404 (no thin/AI-filler pages). Copy is data-led (counts, names, scores) on purpose.
import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getServerSupabase } from "@/lib/supabase/server";
import { displayCity, displayCountry, isLatin } from "@/lib/placeText";
import { cityFromSlug, cityToSlug } from "@/lib/citySlug";
import { stay22AllezUrl } from "@/lib/affiliates";
import { facetBySlug, matchesFacet } from "@/lib/facets";
import { cosyBadgeColor } from "@/lib/cosyColor";
import ShareButton from "@/components/ShareButton";

export const revalidate = 3600;

type Row = { hotel_id: string; score: number | null; score_final: number | null; signals: string[] | null; description: string | null; hotel: { slug: string; name: string; name_en: string | null; city: string | null; country: string | null; lat?: number | null; lng?: number | null } | null };

function resolveCity(slug: string): string {
  return cityFromSlug(`${slug}-cosy-hotel`) || slug.replace(/-/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

async function load(facetSlug: string, citySlug: string) {
  const facet = facetBySlug(facetSlug);
  if (!facet) return null;
  const db = getServerSupabase();
  if (!db) return null;
  const cityName = resolveCity(citySlug);
  const cityMatch = cityName.replace(/\s+/g, "-"); // hyphenated form matches stored city values
  const { data } = await db
    .from("cosy_scores")
    .select("hotel_id, score, score_final, signals, description, hotel:hotel_id!inner(slug, name, name_en, city, country, lat, lng)")
    .gte("score", 5)
    .ilike("hotel.city", `%${cityMatch}%`)
    .order("score", { ascending: false })
    .limit(80);

  const seen = new Set<string>();
  const hotels: Array<{ id: string; slug: string; name: string; city: string; country: string; score: number; snippet: string; lat: number | null; lng: number | null }> = [];
  for (const r of (data || []) as unknown as Row[]) {
    const h = r.hotel; if (!h || !r.hotel_id) continue;
    const name = String(h.name_en || h.name || "").trim();
    if (!name || !isLatin(name) || seen.has(name)) continue;
    if (!matchesFacet(facet, r.signals, r.description)) continue;
    seen.add(name);
    hotels.push({ id: String(r.hotel_id), slug: h.slug, name, city: displayCity(h.city, cityName), country: displayCountry(h.country), score: Number((r.score_final ?? r.score) || 0), snippet: r.description || "", lat: h.lat ?? null, lng: h.lng ?? null });
  }
  return { facet, cityName, hotels };
}

export async function generateMetadata({ params }: { params: { locale: string; facet: string; city: string } }): Promise<Metadata> {
  const facet = facetBySlug(params.facet);
  if (!facet) return {};
  const cityName = resolveCity(params.city);
  const title = `Cosy hotels ${facet.label} in ${cityName}`;
  const description = `AI-ranked cosy hotels ${facet.label} in ${cityName} — scored 0–10 for warmth and character, with real photos and honest cosy scores.`;
  const url = `/${params.locale}/cosy-hotels/${params.facet}/${params.city}`;
  return { title, description, alternates: { canonical: url }, openGraph: { title, description, type: "website", url } };
}

export default async function FacetPage({ params }: { params: { locale: string; facet: string; city: string } }) {
  const res = await load(params.facet, params.city);
  if (!res || res.hotels.length < 2) notFound(); // no thin pages
  const { facet, cityName, hotels } = res;

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
  const intro = `${hotels.length} of the cosy hotels we've scored in ${cityName} ${facet.label} — ${top.name} leads at ${top.score.toFixed(1)}/10. Ranked by cosy score.`;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://gotcosy.com";
  const jsonLd = {
    "@context": "https://schema.org", "@type": "ItemList", name: `Cosy hotels ${facet.label} in ${cityName}`, numberOfItems: hotels.length,
    itemListElement: hotels.map((h, i) => ({ "@type": "ListItem", position: i + 1, item: { "@type": "Hotel", name: h.name, url: `${siteUrl}/${params.locale}/hotels/${h.slug}`, ...(photo.get(h.id) ? { image: photo.get(h.id) } : {}), review: { "@type": "Review", author: { "@type": "Organization", name: "Got Cosy" }, reviewRating: { "@type": "Rating", ratingValue: Number(h.score.toFixed(1)), bestRating: 10, worstRating: 0, name: "Cosy score" } } } })),
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <h1 className="text-2xl font-semibold">Cosy hotels {facet.label} in {cityName}</h1>
      <p className="mt-2" style={{ color: "var(--muted)" }}>{intro}</p>
      <ol className="mt-6 space-y-3">
        {hotels.map((h, idx) => {
          const cta = stay22AllezUrl({ name: h.name, city: h.city, country: h.country, lat: h.lat, lng: h.lng, campaign: `facet-${facet.slug}` });
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
      <p className="mt-8 text-sm" style={{ color: "var(--muted)" }}>See all <a href={`/${params.locale}/guides/${cityToSlug(cityName)}`} className="underline">cosy hotels in {cityName}</a>, or cosy hotels {facet.label} <a href={`/${params.locale}/cosy-hotels/${facet.slug}`} className="underline">worldwide</a>.</p>
    </div>
  );
}
