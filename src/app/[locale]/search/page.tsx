import type { Metadata } from "next";
import Link from "next/link";
import { searchSite } from "@/lib/search";
import { logSearch } from "@/lib/searchLog";
import { cityGuides } from "@/data/cityGuides";
import { stay22AllezUrl } from "@/lib/affiliates";
import { getStay22WrongSlugs } from "@/lib/ctaPolicy";
import { getServerSupabase } from "@/lib/supabase/server";
import HotelCard from "@/components/HotelCard";
import { buildSaveLabels } from "@/lib/i18n/saveLabels";
import { translate, translateMany } from "@/lib/i18n/translate";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string }>;
};

// Search results always render 200 — never notFound() — so a raw submit of ANY string is safe.
// noindex,follow keeps thin/infinite query-param pages out of the index (self-canonical to the
// bare /en/search, so Google never treats each query as a distinct page).
export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const q = ((await searchParams).q || "").trim();
  return {
    title: q ? `Search: ${q}` : "Search cosy hotels",
    robots: { index: false, follow: true },
    alternates: { canonical: "/en/search" },
  };
}

// A few known-good guides to offer when a query finds nothing (all render, none 404).
const POPULAR = ["Paris", "Venice", "Kyoto", "Edinburgh", "Barcelona", "Copenhagen"];

export default async function SearchPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const sp = await searchParams;
  const q = (sp.q || "").trim();
  const { hotels, cities, countries, regions } = q.length >= 2 ? await searchSite(q, { hotelLimit: 24 }) : { hotels: [], cities: [], countries: [], regions: [] };
  const hasResults = hotels.length > 0 || cities.length > 0 || countries.length > 0 || regions.length > 0;
  // Search is a high-intent surface; give each hotel the same book/save/share actions as our other
  // listing cards. The page is noindex, so these carry no SEO cost, only UX and affiliate upside.
  const saveLabels = hotels.length > 0 ? await buildSaveLabels(locale) : null;
  // Verdict-gated CTA swap (founder FINAL rule, 2026-07-16): fail-safe empty set by default.
  const wrongSlugs = hotels.length > 0 ? await getStay22WrongSlugs(getServerSupabase()) : new Set<string>();
  // Fire-and-forget: record real on-site demand (esp. zero-result queries). Never blocks this render.
  if (q.length >= 2) logSearch(q, { hotels: hotels.length, cities: cities.length, countries: countries.length, regions: regions.length, locale });

  // Reader-facing chrome routes through translate() for non-en locales; en short-circuits before
  // any await (founder, 2026-07-17: /sv/search rendered wholly in English). The pluralized count
  // words are translated as {n}-placeholder TEMPLATES (8 fixed strings) so the cache never explodes
  // per distinct count; region/country/city facet-link labels are assembled per-item sentences,
  // the same pattern as the guide page's "Cosy hotels in {city}" (city/country/region NAMES stay
  // DATA, never translated).
  const isEn = locale === "en";
  const CH = {
    h1Default: "Search cosy hotels",
    forQuery: "Cosy hotels for",
    byArea: "Cosy hotels by area",
    byCountry: "Cosy hotels by country",
    cityGuides: "Cosy city guides",
    snippetEyebrow: "Why it's cosy",
    noMatches: "No cosy matches for",
    noMatchesSuffix: "yet.",
    searchPrompt: "Search for a cosy hotel or city.",
    tryDifferent: "We haven't scored a hotel by that name yet. Try a city, or a different spelling.",
    typeHint: "Type a hotel name or a city to see AI-scored cosy stays.",
    addHotel: "Add your hotel",
    nHotel: "{n} hotel", nHotels: "{n} hotels",
    nArea: "{n} area", nAreas: "{n} areas",
    nCountry: "{n} country", nCountries: "{n} countries",
    nCity: "{n} city", nCities: "{n} cities",
  };
  let LC = CH;
  let regionLabels = regions.map((r) => `Cosy hotels in ${r.the ? "the " : ""}${r.name}`);
  let countryLabels = countries.map((c) => `Cosy hotels in ${c.name}`);
  let cityLabels = cities.map((c) => `Cosy hotels in ${c.name}`);
  // Hotel review-description snippets are review-grounded content, translated like every other
  // listing surface (guide/facet/hotel pages).
  let hotelSnippetsT = hotels.map((h) => h.description || "");
  if (!isEn) {
    const keys = Object.keys(CH) as (keyof typeof CH)[];
    const [chromeVals, regionRes, countryRes, cityRes, snippetsRes] = await Promise.all([
      Promise.all(keys.map((k) => translate(CH[k], locale))),
      translateMany(regionLabels, locale),
      translateMany(countryLabels, locale),
      translateMany(cityLabels, locale),
      hotelSnippetsT.length ? translateMany(hotelSnippetsT, locale) : Promise.resolve(hotelSnippetsT),
    ]);
    LC = Object.fromEntries(keys.map((k, i) => [k, chromeVals[i]])) as typeof CH;
    regionLabels = regionRes; countryLabels = countryRes; cityLabels = cityRes; hotelSnippetsT = snippetsRes;
  }
  const countWord = (n: number, one: string, many: string) => (n === 1 ? LC[one as keyof typeof LC] : LC[many as keyof typeof LC]).replace("{n}", String(n));

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-2xl font-semibold">
        {q ? <>{LC.forQuery} &ldquo;{q}&rdquo;</> : LC.h1Default}
      </h1>

      {hasResults && (
        <p className="mt-2" style={{ color: "var(--muted)" }}>
          {[
            hotels.length > 0 && countWord(hotels.length, "nHotel", "nHotels"),
            regions.length > 0 && countWord(regions.length, "nArea", "nAreas"),
            countries.length > 0 && countWord(countries.length, "nCountry", "nCountries"),
            cities.length > 0 && countWord(cities.length, "nCity", "nCities"),
          ].filter(Boolean).join(" · ")}
        </p>
      )}

      {hotels.length > 0 && saveLabels && (
        <ol className="mt-6 space-y-3">
          {hotels.map((h, idx) => (
            <HotelCard
              key={h.slug}
              slug={h.slug}
              name={h.name}
              city={h.city}
              country={h.country}
              score={h.score}
              rank={idx + 1}
              snippet={hotelSnippetsT[idx]}
              clampSnippet
              snippetEyebrow={LC.snippetEyebrow}
              locale={locale}
              saveLabels={saveLabels}
              stay22Href={stay22AllezUrl({ name: h.name, city: h.city, country: h.country, campaign: "search" })}
              website={h.website}
              isVerifiedWrong={wrongSlugs.has(h.slug)}
              shareTitle={`${h.name}, a cosy hotel${h.city ? ` in ${h.city}` : ""}`}
              shareUrl={`/${locale}/hotels/${h.slug}`}
            />
          ))}
        </ol>
      )}

      {regions.length > 0 && (
        <section className="mt-12">
          <h2 className="text-xl font-semibold">{LC.byArea}</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {regions.map((r, i) => (
              <a key={r.slug} href={`/${locale}/cosy-hotels/region/${r.slug}`} className="rounded-full border px-3 py-1.5 text-sm no-underline hover:underline" style={{ borderColor: "var(--line)", color: "var(--foreground)" }}>
                {regionLabels[i]}
              </a>
            ))}
          </div>
        </section>
      )}

      {countries.length > 0 && (
        <section className="mt-12">
          <h2 className="text-xl font-semibold">{LC.byCountry}</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {countries.map((c, i) => (
              <a key={c.slug} href={`/${locale}/cosy-hotels/in/${c.slug}`} className="rounded-full border px-3 py-1.5 text-sm no-underline hover:underline" style={{ borderColor: "var(--line)", color: "var(--foreground)" }}>
                {countryLabels[i]}
              </a>
            ))}
          </div>
        </section>
      )}

      {cities.length > 0 && (
        <section className="mt-12">
          <h2 className="text-xl font-semibold">{LC.cityGuides}</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {cities.map((c, i) => (
              <a key={c.slug} href={`/${locale}/guides/${c.slug}-cosy-hotel`} className="rounded-full border px-3 py-1.5 text-sm no-underline hover:underline" style={{ borderColor: "var(--line)", color: "var(--foreground)" }}>
                {cityLabels[i]}
              </a>
            ))}
          </div>
        </section>
      )}

      {!hasResults && (
        <div className="mx-auto max-w-2xl px-4 py-16">
          <div className="rounded-2xl border p-8 text-center" style={{ borderColor: "var(--line)", background: "var(--card)", boxShadow: "var(--shadow)" }}>
            <h2 className="font-display text-2xl font-semibold" style={{ color: "var(--foreground)" }}>
              {q ? <>{LC.noMatches} &ldquo;{q}&rdquo; {LC.noMatchesSuffix}</> : LC.searchPrompt}
            </h2>
            <p className="mt-3 text-sm leading-relaxed" style={{ color: "var(--muted)" }}>
              {q ? LC.tryDifferent : LC.typeHint}
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              {POPULAR.map((city) => {
                const cg = cityGuides.find((g) => g.city === city);
                if (!cg) return null;
                return (
                  <a key={city} href={`/${locale}/guides/${cg.slug}`} className="rounded-full border px-3 py-1.5 text-sm no-underline hover:underline" style={{ borderColor: "var(--line)", color: "var(--foreground)" }}>
                    {city}
                  </a>
                );
              })}
            </div>
            <div className="mt-6">
              <Link href="/en/for-hotels" className="inline-flex items-center justify-center rounded-lg text-white px-4 py-2 text-sm font-medium no-underline" style={{ background: "var(--ember)" }}>
                {LC.addHotel}
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
