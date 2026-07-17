import type { Metadata } from "next";
import Link from "next/link";
import { searchSite } from "@/lib/search";
import { logSearch } from "@/lib/searchLog";
import { cosyBadgeColor } from "@/lib/cosyColor";
import { cityGuides } from "@/data/cityGuides";
import { stay22AllezUrl } from "@/lib/affiliates";
import { getStay22WrongSlugs } from "@/lib/ctaPolicy";
import { getServerSupabase } from "@/lib/supabase/server";
import HotelActions from "@/components/HotelActions";
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

      {hotels.length > 0 && (
        <ol className="mt-6 space-y-3">
          {hotels.map((h, idx) => (
            <li key={h.slug} className="rounded-xl border p-4" style={{ borderColor: "var(--line)", background: "var(--card)" }}>
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 flex items-center justify-center rounded-2xl text-white shadow" style={{ background: cosyBadgeColor(h.score), width: 56, height: 56, fontFamily: "Fraunces, serif", fontSize: 22, fontWeight: 600 }}>
                  {h.score.toFixed(1)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="text-sm tabular-nums" style={{ color: "var(--muted)" }}>#{idx + 1}</span>
                    <h2 className="text-lg font-semibold leading-tight">
                      <a href={`/${locale}/hotels/${h.slug}`} className="hover:underline">{h.name}</a>
                    </h2>
                  </div>
                  <div className="text-sm" style={{ color: "var(--muted)" }}>{[h.city, h.country].filter(Boolean).join(", ")}</div>
                  {h.description && (
                    <div className="mt-2">
                      <span className="text-[11px] font-semibold uppercase" style={{ color: "var(--ember)", letterSpacing: "0.07em" }}>Why it&apos;s cosy</span>
                      <p className="mt-0.5 text-sm leading-relaxed line-clamp-2" style={{ color: "var(--foreground)" }}>{h.description}</p>
                    </div>
                  )}
                  {saveLabels && (
                    <HotelActions
                      stay22Href={stay22AllezUrl({ name: h.name, city: h.city, country: h.country, campaign: "search" })}
                      website={h.website}
                      isVerifiedWrong={wrongSlugs.has(h.slug)}
                      hotelName={h.name}
                      city={h.city}
                      slug={h.slug}
                      locale={locale}
                      saveLabels={saveLabels}
                      shareTitle={`${h.name}, a cosy hotel${h.city ? ` in ${h.city}` : ""}`}
                      shareUrl={`/${locale}/hotels/${h.slug}`}
                    />
                  )}
                </div>
              </div>
            </li>
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
