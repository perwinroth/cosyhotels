// Region hub: "Cosy hotels on the {Region}" — e.g. /en/cosy-hotels/region/amalfi-coast. The geo-bbox
// analogue of the country hub: aggregates every live cosy hotel inside the region's bounding box and
// ranks the cosiest. Thin regions are noindexed; near-empty 404. Mirrors the country hub structure.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getServerSupabase } from "@/lib/supabase/server";
import { REGIONS, regionBySlug, regionLabel } from "@/data/regions";
import { loadRegionHotels, loadRegionCount, HUB_MIN, HUB_404_BELOW } from "@/lib/regionHotels";
import { stay22AllezUrl } from "@/lib/affiliates";
import { breadcrumbSchema, jsonLd } from "@/lib/schema";
import { translate, translateMany } from "@/lib/i18n/translate";
import { localeSeo } from "@/lib/i18n/seoLocale";
import HotelCard from "@/components/HotelCard";
import { buildSaveLabels } from "@/lib/i18n/saveLabels";
import { getStay22WrongSlugs } from "@/lib/ctaPolicy";

export const revalidate = 3600;
const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://gotcosy.com";

// All curated regions are substantive, so prerender them all; the render gate still protects them.
export async function generateStaticParams() {
  return REGIONS.map((r) => ({ slug: r.slug }));
}

export async function generateMetadata({ params }: { params: { locale: string; slug: string } }): Promise<Metadata> {
  const region = regionBySlug(params.slug);
  if (!region) return {};
  // Body copy below is genuinely translated for TRANSLATED_LOCALES (isEn ? ... : translate(...)),
  // so canonical/hreflang are locale-aware; every other locale still points at the /en twin.
  const { canonical: url, languages } = localeSeo(params.locale, `/cosy-hotels/region/${region.slug}`);
  const place = regionLabel(region);
  const titleBase = `Cosy hotels in ${place}, AI-ranked for cosiness`;
  const descBase = `The cosiest boutique and independent hotels across ${place}, each AI-scored from 0 to 10 for warmth, character and intimacy; ranked best first, not by stars.`;
  const title = params.locale === "en" ? titleBase : await translate(titleBase, params.locale);
  const description = params.locale === "en" ? descBase : await translate(descBase, params.locale);
  const thin = (await loadRegionCount(region)) < HUB_MIN;
  return {
    title, description,
    alternates: { canonical: url, ...(languages ? { languages } : {}) },
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
  const place = regionLabel(region);
  const shownCities = [...new Set(hotels.map((h) => h.city).filter(Boolean))].slice(0, 6);
  const introEn = `We've scored ${total.toLocaleString()} cosy ${total === 1 ? "hotel" : "hotels"} across ${place} that clear our cosiness bar; ${top.name} leads at ${top.score.toFixed(1)}/10. Here are the ${hotels.length} cosiest, ranked by cosy score.`;
  const featuringEn = `Featuring stays in ${shownCities.join(", ")}.`;
  // Visible body copy renders in the target language for non-en; en path is byte-identical (G14).
  const isEn = params.locale === "en";
  const h1 = isEn ? "" : await translate(`Cosy hotels in ${place}`, params.locale);
  const intro = isEn ? introEn : await translate(introEn, params.locale);
  const featuring = isEn ? "" : await translate(featuringEn, params.locale);
  const snippets = isEn ? hotels.map((h) => h.snippet) : await translateMany(hotels.map((h) => h.snippet || ""), params.locale);
  const saveLabels = await buildSaveLabels(params.locale);
  const crumbLabel = isEn ? "Cosy hotels" : await translate("Cosy hotels", params.locale);
  const browseLine = isEn
    ? { pre: "Browse cosy hotels by", themeCountry: "theme and country", mid: "or explore our", cityGuides: "city guides" }
    : {
        pre: await translate("Browse cosy hotels by", params.locale),
        themeCountry: await translate("theme and country", params.locale),
        mid: await translate("or explore our", params.locale),
        cityGuides: await translate("city guides", params.locale),
      };

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
      <nav className="text-sm" style={{ color: "var(--muted)" }}><a href={`/${params.locale}/cosy-hotels`} className="hover:underline">{crumbLabel}</a> / {region.name}</nav>
      <h1 className="mt-2 text-2xl font-semibold">{isEn ? <>Cosy hotels in {place}</> : h1}</h1>
      <p className="mt-2" style={{ color: "var(--muted)" }}>{intro}</p>
      {shownCities.length > 1 && (
        <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>{isEn ? <>Featuring stays in {shownCities.join(", ")}.</> : featuring}</p>
      )}

      <ol className="mt-6 space-y-3">
        {hotels.map((h, idx) => {
          const cta = stay22AllezUrl({ name: h.name, city: h.city, country: region.country, lat: h.lat, lng: h.lng, campaign: `region-${region.slug}` });
          return (
            <HotelCard
              key={h.id}
              slug={h.slug}
              name={h.name}
              city={h.city}
              country={region.country}
              score={h.score}
              rank={idx + 1}
              snippet={snippets[idx]}
              photo={photo.get(h.id)}
              locale={params.locale}
              saveLabels={saveLabels}
              stay22Href={cta}
              website={h.website}
              isVerifiedWrong={wrongSlugs.has(h.slug)}
              shareTitle={`${h.name}, a cosy hotel in ${place}`}
              shareUrl={`/${params.locale}/hotels/${h.slug}`}
            />
          );
        })}
      </ol>
      <p className="mt-8 text-sm" style={{ color: "var(--muted)" }}>{browseLine.pre} <a href={`/${params.locale}/cosy-hotels`} className="underline">{browseLine.themeCountry}</a>, {browseLine.mid} <a href={`/${params.locale}/guides`} className="underline">{browseLine.cityGuides}</a>.</p>
    </div>
  );
}
