// The Cosiness Report — flagship data study. Every number on this page is a verified snapshot
// of the Got Cosy dataset (audited 2 July 2026 via SQL against cosy_scores/hotels); nothing is
// estimated or invented. Built for PR: citable stats, interactive charts, Article+Dataset JSON-LD.
import type { Metadata } from "next";
import { Histogram, StarsChart, LiftChart, CitiesChart } from "./charts";

export const revalidate = 86400;

// ——— Verified data snapshot (2 July 2026) ———
const SNAPSHOT = "2 July 2026";
const TOTAL = 17727; // hotels scored
const REVIEWS = 68269; // guest reviews analysed
const REVIEW_HOTELS = 8341; // hotels those reviews cover
const COSY_N = 404; // score >= 7.0
const COSY_PCT = "2.3"; // 404/17,727
const BELOW_FLOOR = 11382; // < 5.0, not listed
const HISTOGRAM = [
  { bucket: 0, n: 3522 }, { bucket: 0.5, n: 3 }, { bucket: 1, n: 27 }, { bucket: 1.5, n: 67 },
  { bucket: 2, n: 375 }, { bucket: 2.5, n: 408 }, { bucket: 3, n: 804 }, { bucket: 3.5, n: 1010 },
  { bucket: 4, n: 1062 }, { bucket: 4.5, n: 2834 }, { bucket: 5, n: 1523 }, { bucket: 5.5, n: 906 },
  { bucket: 6, n: 1487 }, { bucket: 6.5, n: 2695 }, { bucket: 7, n: 933 }, { bucket: 7.5, n: 70 }, { bucket: 8, n: 1 },
];
const STARS = [
  { stars: "1★", n: 19, avg: 6.13 }, { stars: "2★", n: 126, avg: 6.14 }, { stars: "3★", n: 455, avg: 6.08 },
  { stars: "4★", n: 258, avg: 6.15 }, { stars: "5★", n: 24, avg: 6.29 },
];
const SIGNALS = [
  { label: "Hands-on host / family-run", cosy: 96.0, uncosy: 47.8 },
  { label: "Homemade breakfast", cosy: 73.8, uncosy: 37.2 },
  { label: "Small scale / intimate", cosy: 59.2, uncosy: 26.9 },
  { label: "Garden or courtyard", cosy: 49.3, uncosy: 14.9 },
  { label: "Quiet location", cosy: 40.8, uncosy: 25.8 },
  { label: "Historic building", cosy: 22.5, uncosy: 6.5 },
  { label: "Wood & stone materials", cosy: 13.9, uncosy: 2.5 },
  { label: "Fireplace / wood stove", cosy: 9.4, uncosy: 1.1 },
];
const CITIES = [
  { city: "Sighișoara", country: "Romania", n: 15, avg: 6.66, standouts: 3 },
  { city: "Fez", country: "Morocco", n: 18, avg: 6.64, standouts: 6 },
  { city: "Matera", country: "Italy", n: 21, avg: 6.64, standouts: 3 },
  { city: "Marrakech", country: "Morocco", n: 48, avg: 6.61, standouts: 9 },
  { city: "Pitlochry", country: "Scotland", n: 18, avg: 6.59, standouts: 2 },
  { city: "Como", country: "Italy", n: 15, avg: 6.57, standouts: 3 },
  { city: "Siena", country: "Italy", n: 42, avg: 6.55, standouts: 11 },
  { city: "Antwerp", country: "Belgium", n: 23, avg: 6.55, standouts: 3 },
  { city: "Keswick", country: "England", n: 18, avg: 6.54, standouts: 3 },
  { city: "Kinsale", country: "Ireland", n: 17, avg: 6.54, standouts: 3 },
  { city: "Bruges", country: "Belgium", n: 60, avg: 6.52, standouts: 13 },
];

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const title = `We scored ${TOTAL.toLocaleString("en-GB")} hotels for cosiness. Only ${COSY_N} made the cut.`;
  const description = `A data study of ${REVIEWS.toLocaleString("en-GB")} guest reviews: cosiness is rare (${COSY_PCT}% of hotels), star ratings can't predict it, and a fireplace is its strongest single signal.`;
  const url = `/${locale}/cosiness-report`;
  return { title, description, alternates: { canonical: url }, openGraph: { title, description, type: "article", url }, twitter: { card: "summary_large_image", title, description } };
}

function Stat({ big, label }: { big: string; label: string }) {
  return (
    <div className="flex flex-col">
      <span style={{ fontFamily: "Fraunces, serif", fontSize: 44, fontWeight: 600, color: "var(--ember)", lineHeight: 1.05 }}>{big}</span>
      <span className="text-sm mt-1" style={{ color: "var(--muted)" }}>{label}</span>
    </div>
  );
}

function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="text-2xl font-semibold mt-16 mb-3" style={{ fontFamily: "Fraunces, serif" }}>{children}</h2>;
}

export default async function CosinessReport({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: l } = await params;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://gotcosy.com";
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: `We scored ${TOTAL.toLocaleString("en-GB")} hotels for cosiness. Only ${COSY_N} made the cut.`,
    datePublished: "2026-07-02",
    author: { "@type": "Organization", name: "Got Cosy", url: siteUrl },
    publisher: { "@type": "Organization", name: "Got Cosy", url: siteUrl },
    about: {
      "@type": "Dataset",
      name: "Got Cosy hotel cosiness dataset",
      description: `${TOTAL.toLocaleString("en-GB")} hotels scored 0–10 for cosiness from ${REVIEWS.toLocaleString("en-GB")} guest reviews and vetted photos. Snapshot ${SNAPSHOT}.`,
      creator: { "@type": "Organization", name: "Got Cosy" },
      variableMeasured: ["cosy score (0-10)", "cosy signals", "city", "country", "star rating"],
    },
  };
  return (
    <article className="mx-auto max-w-3xl px-4 py-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <p className="text-sm uppercase tracking-widest" style={{ color: "var(--ember)" }}>The Cosiness Report · {SNAPSHOT}</p>
      <h1 className="mt-3 text-4xl sm:text-5xl font-semibold leading-tight" style={{ fontFamily: "Fraunces, serif" }}>
        We scored {TOTAL.toLocaleString("en-GB")} hotels for cosiness. Only {COSY_N} made the cut.
      </h1>
      <p className="mt-5 text-lg leading-relaxed" style={{ color: "var(--muted)" }}>
        We analysed {REVIEWS.toLocaleString("en-GB")} guest reviews to score hotels on one quality nobody rates:
        cosiness. It turns out to be genuinely rare — {COSY_PCT}% of hotels — and the things that predict it are
        not the things hotels advertise.
      </p>

      <div className="mt-10 grid grid-cols-2 sm:grid-cols-4 gap-6 rounded-2xl border p-6" style={{ borderColor: "var(--line)", background: "var(--card)" }}>
        <Stat big={TOTAL.toLocaleString("en-GB")} label="hotels scored, worldwide" />
        <Stat big={REVIEWS.toLocaleString("en-GB")} label="guest reviews analysed" />
        <Stat big={`${COSY_PCT}%`} label="score 7.0+ — genuinely cosy" />
        <Stat big="8.5×" label="a fireplace's cosiness lift" />
      </div>

      <H2>Cosiness is rarer than a five-star rating</H2>
      <p className="leading-relaxed">
        Of {TOTAL.toLocaleString("en-GB")} hotels we scored, just <strong>{COSY_N} ({COSY_PCT}%) reach 7.0 or higher</strong> —
        our bar for genuinely cosy. {BELOW_FLOOR.toLocaleString("en-GB")} ({Math.round((BELOW_FLOOR / TOTAL) * 100)}%)
        fall below 5.0, which means we don&apos;t list them at all. Put differently: our bar for genuinely cosy
        admits <strong>one hotel in forty-four</strong>.
      </p>
      <div className="mt-6 rounded-2xl border p-4" style={{ borderColor: "var(--line)", background: "var(--card)" }}>
        <Histogram data={HISTOGRAM} floor={5} cosy={7} />
      </div>

      <H2>Do five-star hotels feel cosier? No.</H2>
      <p className="leading-relaxed">
        Across the listed hotels with a known star rating, the average cosy score barely moves:
        {" "}<strong>6.13 for one-star, 6.29 for five-star</strong>. A two-star guesthouse (6.14) is statistically
        indistinguishable from a four-star hotel (6.15). Stars measure facilities — pools, porters, room service.
        None of that makes a place feel like somewhere you want to stay in on a rainy evening.
      </p>
      <div className="mt-6 rounded-2xl border p-4" style={{ borderColor: "var(--line)", background: "var(--card)" }}>
        <StarsChart data={STARS} />
      </div>

      <H2>What actually makes a hotel cosy</H2>
      <p className="leading-relaxed">
        We compared what guests describe at genuinely cosy hotels (7.0+) against the rest (below 6.0).
        The rarest signal has the biggest effect: <strong>a fireplace or wood stove is 8.5× more common in cosy
        hotels</strong>. But the most universal ingredient is a person, not a feature —
        <strong> 96% of the cosiest hotels have a hands-on host or family running the place</strong>, and guests
        name them in reviews. Warmth, it turns out, is mostly labour.
      </p>
      <div className="mt-6 rounded-2xl border p-4" style={{ borderColor: "var(--line)", background: "var(--card)" }}>
        <LiftChart data={SIGNALS} />
      </div>
      <blockquote className="my-10 border-l-4 pl-6 text-2xl leading-snug" style={{ borderColor: "var(--ember)", fontFamily: "Fraunces, serif" }}>
        96% of the world&apos;s cosiest hotels have one thing in common — and it isn&apos;t a feature. It&apos;s a host guests know by name.
      </blockquote>

      <H2>Which towns have the cosiest hotels?</H2>
      <p className="leading-relaxed">
        Cosiness clusters in small, old towns: Sighișoara&apos;s citadel, the medinas of Fez and Marrakech, the cave
        town of Matera, canal-ringed Bruges. Every town in our top ten was <strong>built before the car</strong> —
        narrow streets, small plots, buildings that force hotels to stay little and characterful. The big capitals
        don&apos;t make the list; their averages drown in large modern builds.
      </p>
      <div className="mt-6 rounded-2xl border p-4" style={{ borderColor: "var(--line)", background: "var(--card)" }}>
        <CitiesChart data={CITIES} />
      </div>

      <H2>The cosiest hotel we found has six rooms</H2>
      <p className="leading-relaxed">
        The top of our index isn&apos;t a grand hotel. It&apos;s <a href={`/${l}/hotels/follonico-6099822548`} className="underline">Follonico</a>,
        a six-room agriturismo in the hills between Montepulciano and Montefollonico, at <strong>7.8/10</strong> —
        guests describe sun-dried linen, a wood-burning fireplace in the bedroom, and candlelit dinners the owner
        cooks from his kitchen garden. The entire top twelve is B&amp;Bs, guesthouses and small inns. Not one
        international chain appears.
      </p>

      <H2>How we scored it (and the honest limits)</H2>
      <p className="leading-relaxed" style={{ color: "var(--muted)" }}>
        Each listed hotel&apos;s score is grounded in evidence: {REVIEWS.toLocaleString("en-GB")} guest reviews across
        {" "}{REVIEW_HOTELS.toLocaleString("en-GB")} hotels, scored by an AI model judging concrete things guests
        describe — lighting, materials, scale, hosting — then calibrated against {`150+`} human-graded hotels.
        Hotels without enough evidence aren&apos;t scored and aren&apos;t listed. The limits: cosiness is subjective, and our
        calibration study shows the score agrees with human raters roughly as well as two humans agree with each
        other — that&apos;s the ceiling for any measure of a feeling. Scores are a {SNAPSHOT} snapshot and move as new
        reviews arrive. Full method on <a href={`/${l}/cosy-score`} className="underline">the Cosy Score page</a>.
      </p>

      <div className="mt-14 rounded-2xl border p-6" style={{ borderColor: "var(--line)", background: "var(--card)" }}>
        <p className="font-semibold" style={{ fontFamily: "Fraunces, serif", fontSize: 20 }}>Explore the data yourself</p>
        <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
          Browse the <a href={`/${l}/cosy-index`} className="underline">Cosy Index</a> — every genuinely cosy hotel we&apos;ve
          found, ranked — or start with a city guide like <a href={`/${l}/guides/bruges-cosy-hotel`} className="underline">Bruges</a> or{" "}
          <a href={`/${l}/guides/edinburgh-cosy-hotel`} className="underline">Edinburgh</a>.
        </p>
        <p className="mt-3 text-sm" style={{ color: "var(--muted)" }}>
          Journalists: cite any figure as “according to Got Cosy” with a link to this page. For the underlying
          data or custom cuts, email <a href="mailto:per@gotcosy.com" className="underline">per@gotcosy.com</a>.
        </p>
      </div>
    </article>
  );
}
