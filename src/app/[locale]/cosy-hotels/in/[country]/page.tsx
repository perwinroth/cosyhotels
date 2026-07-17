// Country hub (WP3): "Cosy hotels in {Country}" — e.g. /en/cosy-hotels/in/italy. Aggregates every
// live cosy hotel in the country (raw country values are canonicalised, so "Italia"/"Italy"/postcode
// noise all fold into one hub) and ranks the cosiest. Thin countries are noindexed; near-empty 404.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getServerSupabase } from "@/lib/supabase/server";
import { countryBySlug } from "@/lib/country";
import { loadCountryCounts, loadCountryHotels, HUB_MIN, HUB_404_BELOW } from "@/lib/countryHub";
import { stay22AllezUrl } from "@/lib/affiliates";
import { breadcrumbSchema, jsonLd } from "@/lib/schema";
import { translate, translateMany } from "@/lib/i18n/translate";
import { localeSeo } from "@/lib/i18n/seoLocale";
import HotelCard from "@/components/HotelCard";
import { buildSaveLabels } from "@/lib/i18n/saveLabels";
import { getStay22WrongSlugs } from "@/lib/ctaPolicy";

export const revalidate = 3600;
const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://gotcosy.com";

// Prerender the substantive hubs; thinner ones resolve on demand (and noindex themselves).
export async function generateStaticParams() {
  const counts = await loadCountryCounts();
  return counts.filter((c) => c.live >= HUB_MIN).map((c) => ({ country: c.country.slug }));
}

async function liveCount(slug: string): Promise<number> {
  const counts = await loadCountryCounts();
  return counts.find((c) => c.country.slug === slug)?.live ?? 0;
}

export async function generateMetadata({ params }: { params: { locale: string; country: string } }): Promise<Metadata> {
  const country = countryBySlug(params.country);
  if (!country) return {};
  // Body copy below is genuinely translated for TRANSLATED_LOCALES (isEn ? ... : translate(...)),
  // so canonical/hreflang are locale-aware; every other locale still points at the /en twin.
  const { canonical: url, languages } = localeSeo(params.locale, `/cosy-hotels/in/${country.slug}`);
  const titleBase = `Cosy hotels in ${country.name}, AI-ranked for cosiness`;
  const descBase = `The cosiest boutique and independent hotels in ${country.name}, each AI-scored from 0 to 10 for warmth, character and intimacy; ranked best first, not by stars.`;
  const title = params.locale === "en" ? titleBase : await translate(titleBase, params.locale);
  const description = params.locale === "en" ? descBase : await translate(descBase, params.locale);
  const thin = (await liveCount(country.slug)) < HUB_MIN;
  return {
    title, description,
    alternates: { canonical: url, ...(languages ? { languages } : {}) },
    openGraph: { title, description, type: "website", url },
    twitter: { card: "summary", title, description },
    ...(thin ? { robots: { index: false, follow: true } } : {}),
  };
}

export default async function CountryHub({ params }: { params: { locale: string; country: string } }) {
  const country = countryBySlug(params.country);
  if (!country) notFound();
  const [total, hotels] = await Promise.all([liveCount(country.slug), loadCountryHotels(country, 60)]);
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
  const shownCities = [...new Set(hotels.map((h) => h.city).filter(Boolean))].slice(0, 6);
  const introEn = `We've scored ${total.toLocaleString()} cosy ${total === 1 ? "hotel" : "hotels"} in ${country.name} that clear our cosiness bar; ${top.name} leads at ${top.score.toFixed(1)}/10. Here are the ${hotels.length} cosiest, ranked by cosy score.`;
  const featuringEn = `Featuring stays in ${shownCities.join(", ")}.`;
  // Visible body copy renders in the target language for non-en (translate() preserves numbers,
  // hotel + city names, and scores via its system prompt). The en path is untouched: the strings and
  // JSX below are byte-identical to before, so /en output does not change (G14).
  const isEn = params.locale === "en";
  const h1 = isEn ? "" : await translate(`Cosy hotels in ${country.name}`, params.locale);
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
    "@context": "https://schema.org", "@type": "ItemList", name: `Cosy hotels in ${country.name}`, numberOfItems: hotels.length,
    itemListElement: hotels.map((h, i) => ({
      "@type": "ListItem", position: i + 1,
      item: { "@type": "Hotel", name: h.name, url: `${SITE}/${params.locale}/hotels/${h.slug}`, ...(photo.get(h.id) ? { image: photo.get(h.id) } : {}),
        review: { "@type": "Review", author: { "@type": "Organization", name: "Got Cosy" }, reviewRating: { "@type": "Rating", ratingValue: Number(h.score.toFixed(1)), bestRating: 10, worstRating: 0, name: "Cosy score" } } },
    })),
  };
  const crumbs = breadcrumbSchema([
    { name: "Home", url: `/${params.locale}` },
    { name: "Cosy hotels", url: `/${params.locale}/cosy-hotels` },
    { name: country.name, url: `/${params.locale}/cosy-hotels/in/${country.slug}` },
  ]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(itemList)} />
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(crumbs)} />
      <nav className="text-sm" style={{ color: "var(--muted)" }}><a href={`/${params.locale}/cosy-hotels`} className="hover:underline">{crumbLabel}</a> / {country.name}</nav>
      <h1 className="mt-2 text-2xl font-semibold">{isEn ? <>Cosy hotels in {country.name}</> : h1}</h1>
      <p className="mt-2" style={{ color: "var(--muted)" }}>{intro}</p>
      {shownCities.length > 1 && (
        <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>{isEn ? <>Featuring stays in {shownCities.join(", ")}.</> : featuring}</p>
      )}

      <ol className="mt-6 space-y-3">
        {hotels.map((h, idx) => {
          const cta = stay22AllezUrl({ name: h.name, city: h.city, country: country.name, lat: h.lat, lng: h.lng, campaign: `country-${country.slug}` });
          return (
            <HotelCard
              key={h.id}
              slug={h.slug}
              name={h.name}
              city={h.city}
              country={country.name}
              score={h.score}
              rank={idx + 1}
              snippet={snippets[idx]}
              photo={photo.get(h.id)}
              locale={params.locale}
              saveLabels={saveLabels}
              stay22Href={cta}
              website={h.website}
              isVerifiedWrong={wrongSlugs.has(h.slug)}
              shareTitle={`${h.name}, a cosy hotel in ${country.name}`}
              shareUrl={`/${params.locale}/hotels/${h.slug}`}
            />
          );
        })}
      </ol>
      <p className="mt-8 text-sm" style={{ color: "var(--muted)" }}>{browseLine.pre} <a href={`/${params.locale}/cosy-hotels`} className="underline">{browseLine.themeCountry}</a>, {browseLine.mid} <a href={`/${params.locale}/guides`} className="underline">{browseLine.cityGuides}</a>.</p>
    </div>
  );
}
