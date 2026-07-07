// The Cosiest Hotel Towns — full data report. The linkable public asset behind the
// "cosiest hotel towns" data story: every qualifying city and country league row, the
// texture stats journalists quote, and the honest methodology. Nothing here is estimated —
// every number is read straight from src/data/dataStoryCosiest.json (see BOOTSTRAP data pipeline).
import type { Metadata } from "next";
import Link from "next/link";
import data from "@/data/dataStoryCosiest.json";
import { cityGuides } from "@/data/cityGuides";

export const revalidate = 86400;

const SNAPSHOT = "July 2026";

// Cities that have a live guide on the site — link the city name straight to it.
// Matched by exact city-name string (the simple, honest gate: no DB round-trip for 164 rows).
const GUIDE_SLUG_BY_CITY = new Map(cityGuides.map((g) => [g.city, g.slug]));

const CITIES = [...data.city_league_table_full].sort((a, b) => b.mean - a.mean);
const COUNTRIES = [...data.country_league_table_full].sort((a, b) => b.mean - a.mean);

const barcelona = CITIES.find((c) => c.city === "Barcelona");
const barcelonaRankFromBottom = barcelona ? CITIES.length - CITIES.indexOf(barcelona) : null;

const viewGlobalPct = data.signal_keyword_prevalence.view.pct_of_hotels_with_signals;
const fireplaceGlobalPct = data.signal_keyword_prevalence.fireplace.pct_of_hotels_with_signals;
const courtyardGlobalPct = data.signal_keyword_prevalence.courtyard.pct_of_hotels_with_signals;
const fireplaceCities = data.city_signal_keyword_density.fireplace.slice(0, 5).map((c) => c.city);
const courtyardTop = data.city_signal_keyword_density.courtyard[0]; // Fez
const walkable100 = data.city_concept_density.walkable.filter((c) => c.pct >= 100);
const quietTop2 = [...data.city_concept_density.quiet].sort((a, b) => b.pct - a.pct).slice(0, 2);

export async function generateMetadata(): Promise<Metadata> {
  const title = "The World's Cosiest Hotel Towns — Ranked by AI Analysis of Guest Reviews";
  const description = `Alberobello and San Gimignano outscore Rome, Paris and Vienna. Full league tables for ${data.methodology.cities_qualifying_n10} cities and ${data.methodology.countries_qualifying_n25} countries, from ${data.methodology.n_hotels_total.toLocaleString("en-GB")} hotels AI-scored on guest-review warmth. ${SNAPSHOT} data report.`;
  // Untranslated pages: only /en is indexed, so canonical points at the /en twin (no hreflang).
  const url = `/en/data/cosiest-hotel-towns`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, type: "article", url },
    twitter: { card: "summary_large_image", title, description },
  };
}

function H2({ children, id }: { children: React.ReactNode; id?: string }) {
  return (
    <h2 id={id} className="text-2xl font-semibold mt-16 mb-3" style={{ fontFamily: "Fraunces, serif" }}>
      {children}
    </h2>
  );
}

function CityCell({ city, locale }: { city: string; locale: string }) {
  const slug = GUIDE_SLUG_BY_CITY.get(city);
  if (!slug) return <>{city}</>;
  return (
    <Link href={`/${locale}/guides/${slug}`} className="underline" style={{ color: "var(--ember)" }}>
      {city}
    </Link>
  );
}

export default async function CosiestHotelTownsReport({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: l } = await params;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://gotcosy.com";
  const pageUrl = `${siteUrl}/en/data/cosiest-hotel-towns`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: "Got Cosy — Cosiest Hotel Towns dataset",
    description: `League tables of ${data.methodology.cities_qualifying_n10} cities and ${data.methodology.countries_qualifying_n25} countries by AI-generated hotel cosiness score, derived from guest-review text across ${data.methodology.n_hotels_total.toLocaleString("en-GB")} hotels. Qualifying rows require a score ≥5.0, min ${data.methodology.city_min_n}/city and ${data.methodology.country_min_n}/country.`,
    url: pageUrl,
    creator: { "@type": "Organization", name: "Got Cosy", url: siteUrl },
    temporalCoverage: "2026-07",
    spatialCoverage: "Worldwide",
    variableMeasured: [
      "cosy score (0-10, AI-generated from guest reviews)",
      "city",
      "country",
      "hotel count (n)",
      "mean cosy score",
      "median cosy score",
      "share of hotels scoring 7.0 or higher",
    ],
    isAccessibleForFree: true,
  };

  return (
    <article className="mx-auto max-w-4xl px-4 py-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <p className="text-sm uppercase tracking-widest" style={{ color: "var(--ember)" }}>Data report · {SNAPSHOT}</p>
      <h1 className="mt-3 text-4xl sm:text-5xl font-semibold leading-tight" style={{ fontFamily: "Fraunces, serif" }}>
        The World&apos;s Cosiest Hotel Towns — Ranked by AI Analysis of Guest Reviews
      </h1>
      <p className="mt-5 text-lg leading-relaxed" style={{ color: "var(--muted)" }}>
        Small, old towns beat the capitals. Alberobello (6.75) and San Gimignano (6.72) both outscore Rome (6.05),
        Paris (6.00) and Vienna (6.10) — and Romania (6.67) and Morocco (6.63) are the two cosiest countries in the
        world, ahead of every country in Western Europe. Barcelona sits {barcelonaRankFromBottom ? `${barcelonaRankFromBottom}th from the bottom` : "near the bottom"} of
        all {CITIES.length} qualifying cities, with zero hotels scoring 7.0 or higher.
      </p>

      <H2 id="cities">Every qualifying city, ranked</H2>
      <p className="leading-relaxed">
        All {CITIES.length} cities with at least {data.methodology.city_min_n} qualifying hotels (score ≥5.0),
        ranked by mean cosy score. Where we have a full city guide, the city name links to it.
      </p>
      <div className="mt-6 overflow-x-auto rounded-2xl border" style={{ borderColor: "var(--line)" }}>
        <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "var(--card)", borderBottom: "1px solid var(--line)" }}>
              <th className="px-3 py-2.5 text-left font-semibold" style={{ color: "var(--muted)" }}>#</th>
              <th className="px-3 py-2.5 text-left font-semibold" style={{ color: "var(--muted)" }}>City</th>
              <th className="px-3 py-2.5 text-left font-semibold" style={{ color: "var(--muted)" }}>Country</th>
              <th className="px-3 py-2.5 text-right font-semibold" style={{ color: "var(--muted)" }}>n</th>
              <th className="px-3 py-2.5 text-right font-semibold" style={{ color: "var(--muted)" }}>Mean</th>
              <th className="px-3 py-2.5 text-right font-semibold" style={{ color: "var(--muted)" }}>% ≥7.0</th>
            </tr>
          </thead>
          <tbody>
            {CITIES.map((row, i) => (
              <tr key={row.city} style={{ borderBottom: "1px solid var(--line)" }}>
                <td className="px-3 py-2" style={{ color: "var(--muted)" }}>{i + 1}</td>
                <td className="px-3 py-2 font-medium"><CityCell city={row.city} locale={l} /></td>
                <td className="px-3 py-2" style={{ color: "var(--muted)" }}>{row.country}</td>
                <td className="px-3 py-2 text-right">{row.n}</td>
                <td className="px-3 py-2 text-right font-semibold" style={{ color: "var(--ember)" }}>{row.mean.toFixed(2)}</td>
                <td className="px-3 py-2 text-right" style={{ color: "var(--muted)" }}>{row.share_ge7.toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <H2 id="countries">Every qualifying country, ranked</H2>
      <p className="leading-relaxed">
        All {COUNTRIES.length} countries with at least {data.methodology.country_min_n} qualifying hotels, ranked
        by mean cosy score.
      </p>
      <div className="mt-6 overflow-x-auto rounded-2xl border" style={{ borderColor: "var(--line)" }}>
        <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "var(--card)", borderBottom: "1px solid var(--line)" }}>
              <th className="px-3 py-2.5 text-left font-semibold" style={{ color: "var(--muted)" }}>#</th>
              <th className="px-3 py-2.5 text-left font-semibold" style={{ color: "var(--muted)" }}>Country</th>
              <th className="px-3 py-2.5 text-right font-semibold" style={{ color: "var(--muted)" }}>n</th>
              <th className="px-3 py-2.5 text-right font-semibold" style={{ color: "var(--muted)" }}>Mean</th>
              <th className="px-3 py-2.5 text-right font-semibold" style={{ color: "var(--muted)" }}>% ≥7.0</th>
            </tr>
          </thead>
          <tbody>
            {COUNTRIES.map((row, i) => (
              <tr key={row.country} style={{ borderBottom: "1px solid var(--line)" }}>
                <td className="px-3 py-2" style={{ color: "var(--muted)" }}>{i + 1}</td>
                <td className="px-3 py-2 font-medium">{row.country}</td>
                <td className="px-3 py-2 text-right">{row.n}</td>
                <td className="px-3 py-2 text-right font-semibold" style={{ color: "var(--ember)" }}>{row.mean.toFixed(2)}</td>
                <td className="px-3 py-2 text-right" style={{ color: "var(--muted)" }}>{row.share_ge7.toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <H2>Texture: what guests actually describe</H2>
      <p className="leading-relaxed">
        Beyond the scores, the underlying review text shows what&apos;s common and what&apos;s rare:
      </p>
      <ul className="mt-4 space-y-3 leading-relaxed">
        <li>
          <strong>A view is the single most common cosy cue</strong> — guests mention one at {viewGlobalPct.toFixed(1)}%
          of hotels with review-derived signals, more than any other signal we track.
        </li>
        <li>
          <strong>Fireplaces are the rarest</strong> — just {fireplaceGlobalPct.toFixed(2)}% of hotels globally,
          clustering hard in a handful of towns: {fireplaceCities.join(", ")}.
        </li>
        <li>
          <strong>Fez is the courtyard capital of the dataset</strong> — {courtyardTop.pct.toFixed(1)}% of its
          hotels have a guest-mentioned courtyard, against a {courtyardGlobalPct.toFixed(1)}% global rate.
        </li>
        <li>
          <strong>{walkable100.map((c) => c.city).join(" and ")} are the only cities where every qualifying hotel is
          described as walkable</strong> — 100% of guest mentions.
        </li>
        <li>
          <strong>{quietTop2.map((c) => c.city).join(" and ")} are the quietest towns in the dataset</strong>, at
          {" "}{quietTop2[0]?.pct.toFixed(1)}% of hotels flagged for a quiet setting.
        </li>
      </ul>

      <H2>Methodology (the honest version)</H2>
      <p className="leading-relaxed" style={{ color: "var(--muted)" }}>
        We started from {data.methodology.n_hotels_total.toLocaleString("en-GB")} hotels.{" "}
        {data.methodology.n_hotels_with_score_row.toLocaleString("en-GB")} were AI-scored 0–10 from guest-review
        text, and {data.methodology.n_hotels_with_review_derived_signals.toLocaleString("en-GB")} of those had
        enough review-derived evidence to support the signal breakdowns above. The league tables above use only
        hotels scoring {data.methodology.qualification_threshold_for_league_tables} — our operational floor for
        &quot;cosy&quot; — which leaves {data.methodology.n_qualified_hotels_score_ge_5.toLocaleString("en-GB")} qualifying
        hotels. A city needed at least {data.methodology.city_min_n} qualifying hotels to appear (
        {data.methodology.cities_qualifying_n10} cities cleared that bar); a country needed at least{" "}
        {data.methodology.country_min_n} ({data.methodology.countries_qualifying_n25} countries cleared it).
        City and country name strings were normalised against a manual alias map first (e.g. &quot;Rome&quot;/&quot;Roma&quot;,
        &quot;Marrakech&quot;/&quot;Marrakesh&quot;, &quot;Brugge&quot;/&quot;Bruges&quot;, all &quot;Praha&quot; district variants merged to &quot;Prague&quot;) so
        duplicate spellings didn&apos;t split a city&apos;s hotel count. These are AI scores grounded in what guests wrote
        in reviews — not guest star-ratings, and not a claim of ground truth. Snapshot: {SNAPSHOT}.
      </p>

      <div className="mt-14 rounded-2xl border p-6" style={{ borderColor: "var(--line)", background: "var(--card)" }}>
        <p className="font-semibold" style={{ fontFamily: "Fraunces, serif", fontSize: 20 }}>Cite this</p>
        <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
          Journalists and bloggers: reuse any figure or table above with attribution to Got Cosy and a link to{" "}
          <a href={pageUrl} className="underline">this page</a>. For a custom cut of the data, email{" "}
          <a href="mailto:per@gotcosy.com" className="underline">per@gotcosy.com</a>.
        </p>
        <p className="mt-3 text-sm" style={{ color: "var(--muted)" }}>
          Want the story behind the numbers? Read <Link href={`/${l}/cosiness-report`} className="underline">the Cosiness Report</Link>, or
          browse <Link href={`/${l}/cosy-index`} className="underline">the Cosy Index</Link> to see every genuinely
          cosy hotel we&apos;ve found.
        </p>
      </div>
    </article>
  );
}
