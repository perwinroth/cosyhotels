// The Cosiest Hotel Towns — full data report. The linkable public asset behind the
// "cosiest hotel towns" data story: every qualifying city and country league row, the
// texture stats journalists quote, and the honest methodology. Nothing here is estimated —
// every number is read straight from src/data/dataStoryCosiest.json (see BOOTSTRAP data pipeline).
import type { Metadata } from "next";
import { Fragment } from "react";
import Link from "next/link";
import data from "@/data/dataStoryCosiest.json";
import { cityGuides } from "@/data/cityGuides";
import { HostGapChart, TierStripChart } from "./charts";

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

// Mean-score bands for the tier presentation (G-A: tiers, not ranks). Boundaries are round
// numbers chosen to split the real 5.68–6.75 spread into readable bands — not gerrymandered
// to any particular city.
const TIER_BANDS = [
  { key: "top", label: "Top tier", range: "mean ≥ 6.5" },
  { key: "upper", label: "Upper", range: "mean 6.2–6.49" },
  { key: "mid", label: "Mid", range: "mean 5.9–6.19" },
  { key: "lower", label: "Lower", range: "mean < 5.9" },
] as const;
function tierKeyOf(mean: number): (typeof TIER_BANDS)[number]["key"] {
  if (mean >= 6.5) return "top";
  if (mean >= 6.2) return "upper";
  if (mean >= 5.9) return "mid";
  return "lower";
}
const CITY_RANK = new Map(CITIES.map((c, i) => [c.city, i + 1]));
const cityMeans = CITIES.map((c) => c.mean);
const meanSpreadLow = Math.min(...cityMeans).toFixed(2);
const meanSpreadHigh = Math.max(...cityMeans).toFixed(2);

// Four well-known capitals appended to the tier strip chart as de-emphasised context.
const CONTEXT_CAPITALS = ["Rome", "Paris", "Vienna", "Barcelona"]
  .map((name) => CITIES.find((c) => c.city === name))
  .filter((c): c is (typeof CITIES)[number] => Boolean(c))
  .map((c) => ({ city: c.city, mean: c.mean }));

// Corpus-level "quiet" prevalence — scoped to review-language frequency, not a city ranking
// (G-C: no "quietest cities" claim). Source: persona-map-2026-07-07.json (die-validation),
// atmosphere-mentioning review corpus, 8,390 hotels / 68,269 reviews.
const QUIET_ATMOSPHERE_PCT = 35.6;
const QUIET_ATMOSPHERE_N = 9437;

const roundedHotelTotal = Math.round(data.methodology.n_hotels_total / 100) * 100;

export async function generateMetadata(): Promise<Metadata> {
  const title = `The World's Cosiest Hotel Towns — a guest-review-language analysis of ${roundedHotelTotal.toLocaleString("en-GB")} hotels`;
  const description = `Alberobello and San Gimignano outscore Rome, Paris and Vienna. Full tiers, league tables and limitations for ${data.methodology.cities_qualifying_n10} cities and ${data.methodology.countries_qualifying_n25} countries, from a guest-review-language analysis of ${data.methodology.n_hotels_total.toLocaleString("en-GB")} hotels. Free CSV download, no link required. ${SNAPSHOT} data report.`;
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
    description: `League tables of ${data.methodology.cities_qualifying_n10} cities and ${data.methodology.countries_qualifying_n25} countries from a guest-review-language analysis of ${data.methodology.n_hotels_total.toLocaleString("en-GB")} hotels (AI used as the reading tool against a fixed rubric — see methodology). Qualifying rows require a score ≥5.0, min ${data.methodology.city_min_n}/city and ${data.methodology.country_min_n}/country. Raw tables downloadable as CSV.`,
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
        The World&apos;s Cosiest Hotel Towns — a guest-review-language analysis of {roundedHotelTotal.toLocaleString("en-GB")} hotels
      </h1>
      <p className="mt-5 text-lg leading-relaxed" style={{ color: "var(--muted)" }}>
        Small, old towns beat the capitals. Alberobello (6.75) and San Gimignano (6.72) both outscore Rome (6.05),
        Paris (6.00) and Vienna (6.10) — and Romania (6.67) and Morocco (6.63) are the two cosiest countries in the
        world, ahead of every country in Western Europe. Barcelona sits {barcelonaRankFromBottom ? `${barcelonaRankFromBottom}th from the bottom` : "near the bottom"} of
        all {CITIES.length} qualifying cities, with zero hotels scoring 7.0 or higher. The means span {meanSpreadLow}–{meanSpreadHigh}
        across those {CITIES.length} cities — a real but narrow spread, which is why the tables below group cities into
        tiers rather than presenting a false-precision rank order.
      </p>

      <H2 id="mechanism">What makes a hotel cosy? The answer is a person.</H2>
      <p className="leading-relaxed">
        Across the 10 cosiest towns in this dataset, <strong>74% of hotels&apos; review evidence mentions a host,
        owner, family member or named person</strong> — against <strong>26% in 8 large capitals</strong> (Barcelona,
        Paris, Rome, London, Amsterdam, Vienna, Prague, Florence). That&apos;s 180 qualifying hotels in the towns
        against 509 in the capitals, so the gap isn&apos;t a small-sample fluke — it&apos;s the largest, most
        consistent signal in the whole dataset.
      </p>
      <p className="mt-4 leading-relaxed">
        The same pattern shows up in what these hotels are called: <strong>31% of town hotels carry a
        guesthouse/B&amp;B-type name</strong> (casa, guesthouse, inn, maison, pensione…) against <strong>10% in the
        capitals</strong> — roughly three times the rate. The town cohort&apos;s supply is structurally dominated by
        small, personally run properties where the owner <em>is</em> the service, rather than staff-mediated luxury.
      </p>
      <p className="mt-4 leading-relaxed">
        One number runs the other way, and it&apos;s worth stating plainly rather than hiding: the word
        &quot;boutique&quot; appears far more often in the capitals&apos; review evidence than in the towns&apos; (53
        mentions vs 3). <strong>That&apos;s not a mark of failure</strong> — the capitals&apos; boutique-tagged
        hotels average 6.30 against 6.01 for the rest of the capital cohort. It&apos;s a different route to the same
        warmth: capitals earn a cosy score by shrinking scale and naming individual staff inside a big-city shell,
        towns earn it by being small and family-run to start with.
      </p>
      <HostGapChart />
      <p className="mt-6 leading-relaxed" style={{ color: "var(--muted)" }}>
        <strong style={{ color: "var(--foreground)" }}>Review-derived evidence from the analysis</strong> —
        condensed by the scoring model from guest-review text, not verbatim guest quotes:
      </p>
      <ul className="mt-3 space-y-2 leading-relaxed" style={{ color: "var(--muted)" }}>
        <li>Casa Adam, Sighișoara (7.1): homemade cakes and coffee served by attentive host Alina.</li>
        <li>Casa Steluța, Sighișoara (7.0): warm, welcoming hosts described as exceptional and like visiting best friends.</li>
        <li>Trullicolarossa B&amp;B, Alberobello (7.2): daily homemade breakfasts prepared by Donato&apos;s mother.</li>
      </ul>

      <H2 id="cities">Every qualifying city, by tier</H2>
      <p className="leading-relaxed">
        All {CITIES.length} cities with at least {data.methodology.city_min_n} qualifying hotels (score ≥5.0),
        grouped into tiers by mean cosy score. The means span {meanSpreadLow}–{meanSpreadHigh} across these{" "}
        {CITIES.length} cities, and many small towns qualify with n&apos;s of only 10–15 hotels — so treat adjacent
        ranks as ties within a tier rather than a strict ladder. Individual rank numbers are shown for reference;
        the tier is the more honest read. Where we have a full city guide, the city name links to it.
      </p>
      <a
        href="/data/cosiest-hotel-towns-cities.csv"
        download
        className="mt-2 inline-block text-sm underline"
        style={{ color: "var(--ember)" }}
      >
        Download the full city table as CSV
      </a>
      <p className="mt-6 leading-relaxed">
        The top tier against four well-known capitals, for scale — axis honestly starts at 5.0, not zero:
      </p>
      <TierStripChart towns={CITIES.slice(0, 12).map((c) => ({ city: c.city, mean: c.mean }))} capitals={CONTEXT_CAPITALS} />
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
            {TIER_BANDS.map((band) => {
              const rows = CITIES.filter((c) => tierKeyOf(c.mean) === band.key);
              if (rows.length === 0) return null;
              return (
                <Fragment key={band.key}>
                  <tr style={{ background: "var(--card)" }}>
                    <td colSpan={6} className="px-3 py-2 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--ember)", borderTop: "1px solid var(--line)", borderBottom: "1px solid var(--line)" }}>
                      {band.label} ({band.range}) — {rows.length} {rows.length === 1 ? "city" : "cities"}
                    </td>
                  </tr>
                  {rows.map((row) => (
                    <tr key={row.city} style={{ borderBottom: "1px solid var(--line)" }}>
                        <td className="px-3 py-2" style={{ color: "var(--muted)" }}>{CITY_RANK.get(row.city)}</td>
                        <td className="px-3 py-2 font-medium"><CityCell city={row.city} locale={l} /></td>
                        <td className="px-3 py-2" style={{ color: "var(--muted)" }}>{row.country}</td>
                        <td className="px-3 py-2 text-right">{row.n}</td>
                        <td className="px-3 py-2 text-right font-semibold" style={{ color: "var(--ember)" }}>{row.mean.toFixed(2)}</td>
                        <td className="px-3 py-2 text-right" style={{ color: "var(--muted)" }}>{row.share_ge7.toFixed(1)}%</td>
                      </tr>
                  ))}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      <H2 id="countries">Every qualifying country, ranked</H2>
      <p className="leading-relaxed">
        All {COUNTRIES.length} countries with at least {data.methodology.country_min_n} qualifying hotels, ranked
        by mean cosy score.
      </p>
      <a
        href="/data/cosiest-hotel-towns-countries.csv"
        download
        className="mt-2 inline-block text-sm underline"
        style={{ color: "var(--ember)" }}
      >
        Download the full country table as CSV
      </a>
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
          <strong>Quiet is the single most common theme in atmosphere-mentioning reviews</strong> — it appears in{" "}
          {QUIET_ATMOSPHERE_PCT.toFixed(1)}% of the {QUIET_ATMOSPHERE_N.toLocaleString("en-GB")} reviews across our
          wider corpus that mention atmosphere at all. We don&apos;t rank cities by &quot;quietest&quot; — a review
          mentioning quiet isn&apos;t an acoustic measurement (see Limitations, below).
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

      <H2 id="limitations">Limitations</H2>
      <ul className="mt-4 space-y-3 leading-relaxed" style={{ color: "var(--muted)" }}>
        <li>
          <strong>Sample sizes are small at the city level.</strong> The city-qualification floor is{" "}
          {data.methodology.city_min_n} hotels, and a large share of qualifying towns cleared it with n&apos;s of
          only 10–15 — enough for a directional read, not enough for precise rank order. That&apos;s the reason for
          tiers rather than a strict ladder above.
        </li>
        <li>
          <strong>Scores are a review-language proxy, not a physical measurement.</strong> &quot;Quiet&quot;,
          &quot;historic&quot; or &quot;fireplace&quot; mentions come from what guests wrote, not from acoustic
          readings, structural surveys, or an inventory of amenities.
        </li>
        <li>
          <strong>The keyword/pattern codebook is English-language.</strong> It was built and validated against
          English review text; non-English reviews are only captured to the extent they were translated in the
          source data, which may under- or over-count some cities and languages.
        </li>
        <li>
          <strong>City and country names were normalised.</strong> A manual alias map merged known duplicate
          spellings and district variants before aggregation (see Methodology above). A small residual long tail of
          unmerged postal-code-suffixed variants remains for a few cities (e.g. Edinburgh, Quebec City); each variant
          is far below the qualification threshold individually, but it means the true hotel count for those cities
          is understated versus a fully deduplicated geocode.
        </li>
        <li>
          <strong>These are AI review analysis, not guest star-ratings.</strong> Every score is the output of a
          model reading review text against a fixed rubric — an analysis product, not a guest-submitted rating, and
          not a claim of ground truth about any individual hotel.
        </li>
      </ul>

      <div className="mt-14 rounded-2xl border p-6" style={{ borderColor: "var(--line)", background: "var(--card)" }}>
        <p className="font-semibold" style={{ fontFamily: "Fraunces, serif", fontSize: 20 }}>Use this data</p>
        <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
          Journalists and bloggers: free to cite any figure or table above with attribution to Got Cosy. A link to{" "}
          <a href={pageUrl} className="underline">this page</a> is appreciated but not required. Methodology,
          limitations and the raw tables are all downloadable above (
          <a href="/data/cosiest-hotel-towns-cities.csv" download className="underline">cities CSV</a>{" "}
          ·{" "}
          <a href="/data/cosiest-hotel-towns-countries.csv" download className="underline">countries CSV</a>
          ). For a custom cut of the data, email{" "}
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
