// Flagship data study — the GEO/PR link magnet. "We scored 17,727 hotels for cosiness; here's
// what actually makes one cosy." Every figure below is from the 2026-06 analysis and is
// reproducible from the cosy_scores + hotels tables. Live counts (total / clear-bar / Index) are
// pulled fresh so the rarity section never drifts.
import type { Metadata } from "next";
import { getServerSupabase } from "@/lib/supabase/server";
import { site } from "@/config/site";
import { jsonLd } from "@/lib/schema";

export const revalidate = 86400;

const TITLE = "What makes a hotel cosy? We scored 17,727 to find out";
const DESC = "An AI analysis of 17,727 hotels for cosiness — and the surprising answer: stars barely move it. Independent ownership, small scale, and warm rooms do. With the data.";

export function generateMetadata({ params }: { params: { locale: string } }): Metadata {
  const url = `/${params.locale}/what-makes-a-hotel-cosy`;
  return { title: TITLE, description: DESC, alternates: { canonical: url }, openGraph: { title: TITLE, description: DESC, type: "article", url }, twitter: { card: "summary_large_image", title: TITLE, description: DESC } };
}

// ── Verified figures (2026-06 analysis; reproducible from the DB) ───────────────────────────────
// Cosy score by official star rating (hotels.stars, n=2,141 with both a star rating and a score).
const STARS = [
  { label: "1-star", v: 4.16, n: 86 },
  { label: "2-star", v: 4.91, n: 376 },
  { label: "3-star", v: 5.01, n: 1087 },
  { label: "4-star", v: 5.11, n: 558 },
  { label: "5-star", v: 5.81, n: 34 },
];
// Full score distribution (floor-bucketed, all 17,727 scored hotels).
const HIST = [
  { label: "0–2", v: 2653 },
  { label: "3", v: 1290 },
  { label: "4", v: 4022 },
  { label: "5", v: 7570 },
  { label: "6", v: 1201 },
  { label: "7", v: 874 },
  { label: "8–10", v: 117, hot: true },
];
const HIST_TOTAL = 17727;
// The image categories we most often reject as "not the hotel" or "not cosy" (aesthetic rejects).
const REJECTS = [
  { label: "Logos & wordmarks", n: 1057 },
  { label: "Landmarks (not the hotel)", n: 737 },
  { label: "Text / offer graphics", n: 422 },
  { label: "Photos of people", n: 338 },
  { label: "Tight detail crops", n: 295 },
  { label: "Award badges", n: 172 },
];

function Bar({ label, value, max, suffix, n, hot }: { label: string; value: number; max: number; suffix?: string; n?: string; hot?: boolean }) {
  const pct = Math.max(3, Math.round((value / max) * 100));
  return (
    <div className="flex items-center gap-3 py-1.5">
      <div className="w-24 sm:w-28 text-sm flex-none" style={{ color: "var(--foreground)" }}>{label}</div>
      <div className="flex-1 h-7 rounded-md overflow-hidden" style={{ background: "var(--surface-2)" }}>
        <div className="h-full rounded-md flex items-center justify-end px-2" style={{ width: `${pct}%`, background: hot ? "linear-gradient(90deg, var(--ember), var(--gold))" : "linear-gradient(90deg, var(--cosy-mild), var(--ember))" }}>
          <span className="text-xs font-semibold" style={{ color: "#16201C" }}>{value.toFixed(1)}{suffix}</span>
        </div>
      </div>
      {n && <span className="text-[11px] tabular-nums flex-none w-14 text-right" style={{ color: "var(--muted)" }}>{n}</span>}
    </div>
  );
}

// Count histogram row — width by share of the largest bucket; the elite tail is highlighted.
function HistBar({ label, value, max, total, hot }: { label: string; value: number; max: number; total: number; hot?: boolean }) {
  const pct = Math.max(2, Math.round((value / max) * 100));
  const share = ((value / total) * 100);
  return (
    <div className="flex items-center gap-3 py-1">
      <div className="w-12 text-xs flex-none tabular-nums" style={{ color: hot ? "var(--ember)" : "var(--foreground)" }}>{label}</div>
      <div className="flex-1 h-6 rounded-md overflow-hidden" style={{ background: "var(--surface-2)" }}>
        <div className="h-full rounded-md" style={{ width: `${pct}%`, background: hot ? "var(--ember)" : "color-mix(in srgb, var(--ember) 38%, var(--surface-2))" }} />
      </div>
      <span className="text-[11px] tabular-nums flex-none w-24 text-right" style={{ color: "var(--muted)" }}>{value.toLocaleString()} · {share < 1 ? share.toFixed(1) : Math.round(share)}%</span>
    </div>
  );
}

function Stat({ n, l }: { n: string; l: string }) {
  return (
    <div className="rounded-2xl border p-4" style={{ borderColor: "var(--line)", background: "var(--card)" }}>
      <div className="font-display text-3xl font-semibold leading-none" style={{ color: "var(--foreground)" }}>{n}</div>
      <div className="text-xs mt-1.5 leading-snug" style={{ color: "var(--muted)" }}>{l}</div>
    </div>
  );
}

function Quote({ children }: { children: React.ReactNode }) {
  return <p className="not-prose my-8 font-display text-2xl sm:text-3xl font-medium leading-snug" style={{ color: "var(--ember)" }}>{children}</p>;
}

export default async function StudyPage({ params }: { params: { locale: string } }) {
  const db = getServerSupabase();
  const cnt = async (gte?: number) => {
    if (!db) return 0;
    let q = db.from("cosy_scores").select("*", { count: "exact", head: true });
    if (gte != null) q = q.gte("score", gte);
    const { count } = await q; return count || 0;
  };
  const [total, clearBar, atSeven, inIndex] = await Promise.all([cnt(), cnt(5), cnt(7), cnt(8)]);
  const pctClear = total ? Math.round((clearBar / total) * 100) : 55;
  const L = params.locale;
  const histMax = Math.max(...HIST.map((h) => h.v));
  const starMax = 6;

  const articleLd = {
    "@context": "https://schema.org", "@type": "Article",
    headline: TITLE, description: DESC,
    author: { "@type": "Organization", name: "Got Cosy" },
    publisher: { "@type": "Organization", name: "Got Cosy", logo: { "@type": "ImageObject", url: `${site.url}/icon` } },
    datePublished: "2026-06-29", dateModified: "2026-06-30",
    mainEntityOfPage: `${site.url}/${L}/what-makes-a-hotel-cosy`,
    about: "What makes a hotel cosy", keywords: "cosy hotels, hotel cosiness, boutique hotels, hotel rankings, cosiest countries, independent hotels",
  };

  return (
    <article className="mx-auto max-w-3xl px-4 py-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(articleLd)} />

      <p className="text-sm font-medium tracking-wide uppercase" style={{ color: "var(--ember)", letterSpacing: "0.08em" }}>Data study · {total.toLocaleString()} hotels</p>
      <h1 className="mt-2 font-display text-4xl sm:text-5xl font-semibold leading-tight tracking-tight">The cosiest hotels in the world aren&apos;t the ones you&apos;d expect</h1>
      <p className="mt-5 text-xl leading-relaxed" style={{ color: "var(--muted)" }}>
        The cosiest places we found are a renovated mansion in Palma, a wooden ryokan in Kyoto, a spa-kúria in rural Hungary. Not one is a name you&apos;d recognise. Not one is a chain. We scored <strong style={{ color: "var(--foreground)" }}>{total.toLocaleString()} hotels</strong> for cosiness — and what predicts it has almost nothing to do with the things hotels brag about. We&apos;ll show you the data, finding by finding.
      </p>

      <div className="not-prose mt-8 grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat n={total.toLocaleString()} l="hotels AI-scored for cosiness" />
        <Stat n={`${pctClear}%`} l={`clear the cosy bar (5+/10)`} />
        <Stat n={atSeven.toLocaleString()} l="genuinely cosy (7+/10)" />
        <Stat n={inIndex.toLocaleString()} l="elite-cosy, the Index (8+/10)" />
      </div>

      <div className="longform mt-12">
        <h2>1. Stars barely move cosiness</h2>
        <p>If cosiness came bundled with the star rating, four-star hotels would crush two-star ones. They don&apos;t. Across the {(STARS.reduce((a, b) => a + b.n, 0)).toLocaleString()} hotels we have an official star rating for, the average cosy score is almost flat from two to four stars — exactly the band where nearly every hotel lives:</p>
        <div className="not-prose my-5 rounded-2xl border p-5" style={{ borderColor: "var(--line)", background: "var(--card)" }}>
          {STARS.map((s) => <Bar key={s.label} label={s.label} value={s.v} max={starMax} suffix="/10" n={`n=${s.n.toLocaleString()}`} />)}
          <p className="text-xs mt-3" style={{ color: "var(--muted)" }}>Average cosy score by official star rating. From 2 to 4 stars the line barely moves (4.9 → 5.0 → 5.1). Five-star edges up, but on only 34 hotels — too few to lean on.</p>
        </div>
        <p>A four-star hotel is, on average, <strong>a fifth of a point</strong> cosier than a two-star one. Stars are awarded for facilities — a lift, a 24-hour desk, a minibar. None of those is warmth.</p>
        <Quote>Stars measure facilities. Cosiness measures feeling. They&apos;re different questions — and the data treats them that way.</Quote>

        <h2>2. What does predict it: who runs the place</h2>
        <p>The clearest signal isn&apos;t the rating — it&apos;s whether the hotel is an independent or a chain. Across all {total.toLocaleString()} hotels, independents average <strong>4.6/10</strong>; the handful with chain names (Marriott, Hilton, Ibis and the like) average <strong>3.1</strong>. And chains barely appear at all — just <strong>367</strong> of the hotels we scored carry a big-brand name, because intimacy is the first thing a 9,000-room operation optimises away.</p>
        <div className="not-prose my-5 rounded-2xl border p-5" style={{ borderColor: "var(--line)", background: "var(--card)" }}>
          <Bar label="Independent" value={4.57} max={starMax} suffix="/10" n="n=17,360" />
          <Bar label="Chain-branded" value={3.14} max={starMax} suffix="/10" n="n=367" />
          <p className="text-xs mt-3" style={{ color: "var(--muted)" }}>Average cosy score by ownership pattern. Independents score ~45% higher — and outnumber chains 47 to 1 in the cosy world.</p>
        </div>
        <p>It tracks all the way down to the words in a hotel&apos;s own name. The property types that score highest are the smallest and most personal: <strong>B&amp;Bs, guesthouses, riads, pensions, lodges</strong> — places where someone is on a first-name basis with the building.</p>

        <h2>3. Genuine cosiness is rare — here&apos;s the whole curve</h2>
        <p>Most hotels are fine. Few are cosy. When you plot every score, the distribution piles up just over the bar and thins fast toward the top — the warm tail is tiny:</p>
        <div className="not-prose my-5 rounded-2xl border p-5" style={{ borderColor: "var(--line)", background: "var(--card)" }}>
          {HIST.map((h) => <HistBar key={h.label} label={h.label} value={h.v} max={histMax} total={HIST_TOTAL} hot={h.hot} />)}
          <p className="text-xs mt-3" style={{ color: "var(--muted)" }}>Hotels by cosy score (0–10). Almost half land in the 5s — pleasant, not memorable. Only the highlighted tail, <strong style={{ color: "var(--ember)" }}>117 hotels</strong>, scores 8 or above.</p>
        </div>
        <p>{atSeven.toLocaleString()} hotels ({total ? ((atSeven / total) * 100).toFixed(1) : "5.6"}%) are genuinely cosy at 7+. Only {inIndex} — about <strong>1 in {total ? Math.round(total / Math.max(inIndex, 1)) : 150}</strong> — reach the elite 8+ that makes <a href={`/${L}/cosy-index`}>The Cosy Index</a>.</p>
        <Quote>Truly warm, intimate hotels are roughly a 1-in-150 find. That rarity is the whole reason a cosiness score is worth having.</Quote>

        <h2>4. Cosiness is geographic — and it&apos;s old</h2>
        <p>It clusters in places built before the car. <strong>Italy</strong> is the cosiest country we&apos;ve scored — about 174 hotels clear 7/10, more than anywhere else, led by Venice and Florence. But the connoisseur&apos;s pick is <strong>Japan</strong>: roughly <strong>1 in 27</strong> Japanese hotels we scored is elite-cosy (8+), the highest hit-rate of any country — the ryokan tradition shows in the numbers.</p>
        <p>The flip side is just as clear. The <strong>United States</strong> has more hotels in our set than almost any country, yet the lowest average cosiness of the big markets — about <strong>3.5/10</strong>. A market built on chains and parking lots scores exactly how you&apos;d expect. You can browse the full picture in <a href={`/${L}/cosy-index`}>The Cosy Index</a> and our <a href={`/${L}/guides`}>city guides</a>.</p>

        <h2>5. We&apos;re strict about the photos, too</h2>
        <p>A score is only as honest as what feeds it, so an AI vets every image before it counts — and rejects most of what hotels lead with. The things we throw out, by how often we see them:</p>
        <div className="not-prose my-5 rounded-2xl border p-5" style={{ borderColor: "var(--line)", background: "var(--card)" }}>
          {REJECTS.map((r) => <HistBar key={r.label} label={String(r.n)} value={r.n} max={REJECTS[0].n} total={REJECTS.reduce((a, b) => a + b.n, 0)} />)}
          <p className="text-xs mt-3" style={{ color: "var(--muted)" }}>Most-rejected image types (counts). A logo or a photo of the cathedral down the road tells a guest nothing about how it feels to stay.</p>
        </div>
        <p>If you run a hotel, that reject list is a free playbook — we turned it into one: <a href={`/${L}/make-your-hotel-look-cosy`}>how to make your hotel look cosy online</a>.</p>

        <h2>How we measure it — and where it&apos;s fuzzy</h2>
        <p>Each hotel is scored 0–10 by AI reading its real photos and guest reviews, weighting cosiness signals: warm light, natural materials, fireplaces, intimate scale, and the language guests use when they feel genuinely welcomed rather than processed.</p>
        <p><strong>The honest caveat:</strong> cosiness is subjective. Our score agrees with human raters about as well as two humans agree with each other — no further, because there isn&apos;t a further. We&apos;d rather show you a transparent, consistent score than pretend cosiness is an exact science.</p>
      </div>

      <div className="mt-10 rounded-2xl border p-6 text-center" style={{ borderColor: "color-mix(in srgb, var(--ember) 35%, transparent)", background: "color-mix(in srgb, var(--ember) 6%, var(--card))" }}>
        <p className="font-display text-xl font-semibold">See the cosiest hotels, ranked</p>
        <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>The full data, hotel by hotel and city by city.</p>
        <div className="mt-4 flex flex-wrap gap-3 justify-center">
          <a href={`/${L}/cosy-index`} className="rounded-xl px-5 py-2.5 font-medium no-underline text-sm" style={{ background: "var(--ember)", color: "#16201C" }}>The Cosy Index →</a>
          <a href={`/${L}/guides`} className="rounded-xl px-5 py-2.5 font-medium no-underline text-sm" style={{ border: "1px solid var(--line)", color: "var(--foreground)" }}>City guides</a>
        </div>
      </div>

      <p className="mt-8 text-xs" style={{ color: "var(--muted)" }}>Methodology and figures: Got Cosy analysis of {total.toLocaleString()} hotels, June 2026. Star, ownership, distribution and geographic figures are reproducible from our scored dataset. Cite as &ldquo;Got Cosy&rdquo; with a link to this page.</p>
    </article>
  );
}
