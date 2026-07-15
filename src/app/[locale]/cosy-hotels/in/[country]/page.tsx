// Country hub (WP3): "Cosy hotels in {Country}" — e.g. /en/cosy-hotels/in/italy. Aggregates every
// live cosy hotel in the country (raw country values are canonicalised, so "Italia"/"Italy"/postcode
// noise all fold into one hub) and ranks the cosiest. Thin countries are noindexed; near-empty 404.
import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getServerSupabase } from "@/lib/supabase/server";
import { countryBySlug } from "@/lib/country";
import { loadCountryCounts, loadCountryHotels, HUB_MIN, HUB_404_BELOW } from "@/lib/countryHub";
import { stay22AllezUrl } from "@/lib/affiliates";
import { cosyBadgeColor } from "@/lib/cosyColor";
import { breadcrumbSchema, jsonLd } from "@/lib/schema";
import { translate, translateMany } from "@/lib/i18n/translate";
import HotelActions from "@/components/HotelActions";
import { buildSaveLabels } from "@/lib/i18n/saveLabels";

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
  // Untranslated pages: only /en is indexed, so canonical (and og:url) point at the /en twin.
  const url = `/en/cosy-hotels/in/${country.slug}`;
  const titleBase = `Cosy hotels in ${country.name}, AI-ranked for cosiness`;
  const descBase = `The cosiest boutique and independent hotels in ${country.name}, each AI-scored from 0 to 10 for warmth, character and intimacy; ranked best first, not by stars.`;
  const title = params.locale === "en" ? titleBase : await translate(titleBase, params.locale);
  const description = params.locale === "en" ? descBase : await translate(descBase, params.locale);
  const thin = (await liveCount(country.slug)) < HUB_MIN;
  return {
    title, description,
    alternates: { canonical: url },
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
      <nav className="text-sm" style={{ color: "var(--muted)" }}><a href={`/${params.locale}/cosy-hotels`} className="hover:underline">Cosy hotels</a> / {country.name}</nav>
      <h1 className="mt-2 text-2xl font-semibold">{isEn ? <>Cosy hotels in {country.name}</> : h1}</h1>
      <p className="mt-2" style={{ color: "var(--muted)" }}>{intro}</p>
      {shownCities.length > 1 && (
        <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>{isEn ? <>Featuring stays in {shownCities.join(", ")}.</> : featuring}</p>
      )}

      <ol className="mt-6 space-y-3">
        {hotels.map((h, idx) => {
          const cta = stay22AllezUrl({ name: h.name, city: h.city, country: country.name, lat: h.lat, lng: h.lng, campaign: `country-${country.slug}` });
          const ph = photo.get(h.id);
          return (
            <li key={h.id} className="rounded-xl border p-4" style={{ borderColor: "var(--line)", background: "var(--card)" }}>
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 hidden sm:flex items-center justify-center rounded-2xl text-white shadow" style={{ background: cosyBadgeColor(h.score), width: 56, height: 56, fontFamily: "Fraunces, serif", fontSize: 22, fontWeight: 600 }}>{h.score.toFixed(1)}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2"><span className="sm:hidden inline-flex items-center justify-center rounded-lg px-2 py-0.5 text-sm font-semibold text-white" style={{ background: cosyBadgeColor(h.score), fontFamily: "Fraunces, serif" }}>{h.score.toFixed(1)}</span><span className="text-sm tabular-nums" style={{ color: "var(--muted)" }}>#{idx + 1}</span><h2 className="text-lg font-semibold leading-tight"><a href={`/${params.locale}/hotels/${h.slug}`} className="hover:underline">{h.name}</a></h2></div>
                  <div className="text-sm" style={{ color: "var(--muted)" }}>{[h.city, country.name].filter(Boolean).join(", ")}</div>
                  {snippets[idx] && <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--foreground)" }}>{snippets[idx]}</p>}
                  <HotelActions href={cta} hotelName={h.name} city={h.city} slug={h.slug} locale={params.locale} saveLabels={saveLabels} shareTitle={`${h.name}, a cosy hotel in ${country.name}`} shareUrl={`/${params.locale}/hotels/${h.slug}`} />
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
