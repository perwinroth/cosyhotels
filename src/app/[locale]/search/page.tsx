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

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-2xl font-semibold">
        {q ? <>Cosy hotels for &ldquo;{q}&rdquo;</> : "Search cosy hotels"}
      </h1>

      {hasResults && (
        <p className="mt-2" style={{ color: "var(--muted)" }}>
          {[
            hotels.length > 0 && `${hotels.length} hotel${hotels.length === 1 ? "" : "s"}`,
            regions.length > 0 && `${regions.length} area${regions.length === 1 ? "" : "s"}`,
            countries.length > 0 && `${countries.length} countr${countries.length === 1 ? "y" : "ies"}`,
            cities.length > 0 && `${cities.length} cit${cities.length === 1 ? "y" : "ies"}`,
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
              snippet={h.description}
              clampSnippet
              snippetEyebrow="Why it's cosy"
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
          <h2 className="text-xl font-semibold">Cosy hotels by area</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {regions.map((r) => (
              <a key={r.slug} href={`/${locale}/cosy-hotels/region/${r.slug}`} className="rounded-full border px-3 py-1.5 text-sm no-underline hover:underline" style={{ borderColor: "var(--line)", color: "var(--foreground)" }}>
                Cosy hotels in {r.the ? "the " : ""}{r.name}
              </a>
            ))}
          </div>
        </section>
      )}

      {countries.length > 0 && (
        <section className="mt-12">
          <h2 className="text-xl font-semibold">Cosy hotels by country</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {countries.map((c) => (
              <a key={c.slug} href={`/${locale}/cosy-hotels/in/${c.slug}`} className="rounded-full border px-3 py-1.5 text-sm no-underline hover:underline" style={{ borderColor: "var(--line)", color: "var(--foreground)" }}>
                Cosy hotels in {c.name}
              </a>
            ))}
          </div>
        </section>
      )}

      {cities.length > 0 && (
        <section className="mt-12">
          <h2 className="text-xl font-semibold">Cosy city guides</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {cities.map((c) => (
              <a key={c.slug} href={`/${locale}/guides/${c.slug}-cosy-hotel`} className="rounded-full border px-3 py-1.5 text-sm no-underline hover:underline" style={{ borderColor: "var(--line)", color: "var(--foreground)" }}>
                Cosy hotels in {c.name}
              </a>
            ))}
          </div>
        </section>
      )}

      {!hasResults && (
        <div className="mx-auto max-w-2xl px-4 py-16">
          <div className="rounded-2xl border p-8 text-center" style={{ borderColor: "var(--line)", background: "var(--card)", boxShadow: "var(--shadow)" }}>
            <h2 className="font-display text-2xl font-semibold" style={{ color: "var(--foreground)" }}>
              {q ? <>No cosy matches for &ldquo;{q}&rdquo; yet.</> : "Search for a cosy hotel or city."}
            </h2>
            <p className="mt-3 text-sm leading-relaxed" style={{ color: "var(--muted)" }}>
              {q
                ? "We haven't scored a hotel by that name yet. Try a city, or a different spelling."
                : "Type a hotel name or a city to see AI-scored cosy stays."}
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
                Add your hotel
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
