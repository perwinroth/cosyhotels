// Region hub: "Cosy hotels on the {Region}" — e.g. /en/cosy-hotels/region/amalfi-coast. The geo-bbox
// analogue of the country hub: aggregates every live cosy hotel inside the region's bounding box and
// ranks the cosiest. Thin regions are noindexed; near-empty 404. Mirrors the country hub structure.
import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getServerSupabase } from "@/lib/supabase/server";
import { REGIONS, regionBySlug, regionLabel } from "@/data/regions";
import { loadRegionHotels, loadRegionCount, HUB_MIN, HUB_404_BELOW } from "@/lib/regionHotels";
import { stay22AllezUrl } from "@/lib/affiliates";
import { cosyBadgeColor } from "@/lib/cosyColor";
import { breadcrumbSchema, jsonLd } from "@/lib/schema";
import ShareButton from "@/components/ShareButton";

export const revalidate = 3600;
const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://gotcosy.com";

// All curated regions are substantive, so prerender them all; the render gate still protects them.
export async function generateStaticParams() {
  return REGIONS.map((r) => ({ slug: r.slug }));
}

export async function generateMetadata({ params }: { params: { locale: string; slug: string } }): Promise<Metadata> {
  const region = regionBySlug(params.slug);
  if (!region) return {};
  // Untranslated pages: only /en is indexed, so canonical (and og:url) point at the /en twin.
  const url = `/en/cosy-hotels/region/${region.slug}`;
  const place = regionLabel(region);
  const title = `Cosy hotels in ${place}, AI-ranked for cosiness`;
  const description = `The cosiest boutique and independent hotels across ${place}, each AI-scored from 0 to 10 for warmth, character and intimacy; ranked best first, not by stars.`;
  const thin = (await loadRegionCount(region)) < HUB_MIN;
  return {
    title, description,
    alternates: { canonical: url },
    openGraph: { title, description, type: "website", url },
    twitter: { card: "summary", title, description },
    ...(thin ? { robots: { index: false, follow: true } } : {}),
  };
}

export default async function RegionHub({ params }: { params: { locale: string; slug: string } }) {
  const region = regionBySlug(params.slug);
  if (!region) notFound();
  const [total, hotels] = await Promise.all([loadRegionCount(region), loadRegionHotels(region, 60)]);
  if (hotels.length < HUB_404_BELOW) notFound(); // too thin to be a real page

  // Vetted photos for the ranked hotels.
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
  const place = regionLabel(region);
  const shownCities = [...new Set(hotels.map((h) => h.city).filter(Boolean))].slice(0, 6);
  const intro = `We've scored ${total.toLocaleString()} cosy ${total === 1 ? "hotel" : "hotels"} across ${place} that clear our cosiness bar; ${top.name} leads at ${top.score.toFixed(1)}/10. Here are the ${hotels.length} cosiest, ranked by cosy score.`;

  const itemList = {
    "@context": "https://schema.org", "@type": "ItemList", name: `Cosy hotels in ${place}`, numberOfItems: hotels.length,
    itemListElement: hotels.map((h, i) => ({
      "@type": "ListItem", position: i + 1,
      item: { "@type": "Hotel", name: h.name, url: `${SITE}/${params.locale}/hotels/${h.slug}`, ...(photo.get(h.id) ? { image: photo.get(h.id) } : {}),
        review: { "@type": "Review", author: { "@type": "Organization", name: "Got Cosy" }, reviewRating: { "@type": "Rating", ratingValue: Number(h.score.toFixed(1)), bestRating: 10, worstRating: 0, name: "Cosy score" } } },
    })),
  };
  const crumbs = breadcrumbSchema([
    { name: "Home", url: `/${params.locale}` },
    { name: "Cosy hotels", url: `/${params.locale}/cosy-hotels` },
    { name: region.name, url: `/${params.locale}/cosy-hotels/region/${region.slug}` },
  ]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(itemList)} />
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(crumbs)} />
      <nav className="text-sm" style={{ color: "var(--muted)" }}><a href={`/${params.locale}/cosy-hotels`} className="hover:underline">Cosy hotels</a> / {region.name}</nav>
      <h1 className="mt-2 text-2xl font-semibold">Cosy hotels in {place}</h1>
      <p className="mt-2" style={{ color: "var(--muted)" }}>{intro}</p>
      {shownCities.length > 1 && (
        <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>Featuring stays in {shownCities.join(", ")}.</p>
      )}

      <ol className="mt-6 space-y-3">
        {hotels.map((h, idx) => {
          const cta = stay22AllezUrl({ name: h.name, city: h.city, country: region.country, lat: h.lat, lng: h.lng, campaign: `region-${region.slug}` });
          const ph = photo.get(h.id);
          return (
            <li key={h.id} className="rounded-xl border p-4" style={{ borderColor: "var(--line)", background: "var(--card)" }}>
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 flex items-center justify-center rounded-2xl text-white shadow" style={{ background: cosyBadgeColor(h.score), width: 56, height: 56, fontFamily: "Fraunces, serif", fontSize: 22, fontWeight: 600 }}>{h.score.toFixed(1)}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2"><span className="text-sm tabular-nums" style={{ color: "var(--muted)" }}>#{idx + 1}</span><h2 className="text-lg font-semibold leading-tight"><a href={`/${params.locale}/hotels/${h.slug}`} className="hover:underline">{h.name}</a></h2></div>
                  <div className="text-sm" style={{ color: "var(--muted)" }}>{[h.city, region.country].filter(Boolean).join(", ")}</div>
                  {h.snippet && <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--foreground)" }}>{h.snippet}</p>}
                  <div className="mt-3 flex items-center gap-2"><a href={cta} target="_blank" rel="noopener nofollow sponsored" data-cta="check_availability" data-hotel={h.name} data-city={h.city} className="inline-flex items-center justify-center rounded-lg text-white px-4 py-2 text-sm font-medium no-underline" style={{ background: "var(--ember)" }}>Check availability</a><ShareButton variant="icon" title={`${h.name}, a cosy hotel in ${place}`} url={`/${params.locale}/hotels/${h.slug}`} /></div>
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
