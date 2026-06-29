// Flagship data study — the GEO/PR link magnet. "We scored 17,735 hotels for cosiness; here's
// what actually makes one cosy." Findings from the 2026-06-29 analysis; live counts kept fresh.
import type { Metadata } from "next";
import { getServerSupabase } from "@/lib/supabase/server";
import { site } from "@/config/site";
import { jsonLd } from "@/lib/schema";

export const revalidate = 86400;

const TITLE = "What makes a hotel cosy? We scored 17,735 to find out";
const DESC = "An AI analysis of 17,735 hotels for cosiness — and the surprising answer: stars barely matter. Independent hotels, old small cities, and warm rooms do.";

export function generateMetadata({ params }: { params: { locale: string } }): Metadata {
  const url = `/${params.locale}/what-makes-a-hotel-cosy`;
  return { title: TITLE, description: DESC, alternates: { canonical: url }, openGraph: { title: TITLE, description: DESC, type: "article", url }, twitter: { card: "summary_large_image", title: TITLE, description: DESC } };
}

// Bar row for a simple, dependency-free data viz.
function Bar({ label, value, max, suffix, n }: { label: string; value: number; max: number; suffix?: string; n?: string }) {
  const pct = Math.max(3, Math.round((value / max) * 100));
  return (
    <div className="flex items-center gap-3 py-1.5">
      <div className="w-28 sm:w-36 text-sm flex-none" style={{ color: "var(--foreground)" }}>{label}</div>
      <div className="flex-1 h-7 rounded-md overflow-hidden" style={{ background: "var(--surface-2)" }}>
        <div className="h-full rounded-md flex items-center justify-end px-2" style={{ width: `${pct}%`, background: "linear-gradient(90deg, var(--cosy-mild), var(--ember))" }}>
          <span className="text-xs font-semibold" style={{ color: "#16201C" }}>{value.toFixed(1)}{suffix}</span>
        </div>
      </div>
      {n && <span className="text-[11px] tabular-nums flex-none w-14 text-right" style={{ color: "var(--muted)" }}>{n}</span>}
    </div>
  );
}

export default async function StudyPage({ params }: { params: { locale: string } }) {
  const db = getServerSupabase();
  const cnt = async (gte?: number) => {
    if (!db) return 0;
    let q = db.from("cosy_scores").select("*", { count: "exact", head: true });
    if (gte != null) q = q.gte("score", gte);
    const { count } = await q; return count || 0;
  };
  const [total, clearBar, inIndex] = await Promise.all([cnt(), cnt(5), cnt(8)]);
  const pctClear = total ? Math.round((clearBar / total) * 100) : 55;
  const L = params.locale;

  const articleLd = {
    "@context": "https://schema.org", "@type": "Article",
    headline: TITLE, description: DESC,
    author: { "@type": "Organization", name: "Got Cosy" },
    publisher: { "@type": "Organization", name: "Got Cosy", logo: { "@type": "ImageObject", url: `${site.url}/icon` } },
    datePublished: "2026-06-29", dateModified: "2026-06-29",
    mainEntityOfPage: `${site.url}/${L}/what-makes-a-hotel-cosy`,
    about: "What makes a hotel cosy", keywords: "cosy hotels, hotel cosiness, boutique hotels, hotel rankings, cosiest cities",
  };

  return (
    <article className="mx-auto max-w-3xl px-4 py-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(articleLd)} />

      <p className="text-sm font-medium tracking-wide uppercase" style={{ color: "var(--ember)", letterSpacing: "0.08em" }}>Data study</p>
      <h1 className="mt-2 font-display text-4xl sm:text-5xl font-semibold leading-tight tracking-tight">What makes a hotel cosy?</h1>
      <p className="mt-4 text-xl leading-relaxed" style={{ color: "var(--muted)" }}>
        We scored <strong style={{ color: "var(--foreground)" }}>{total.toLocaleString()}</strong> hotels for cosiness — warmth, intimacy and character, on a 0–10 scale. The biggest surprise in the data: <strong style={{ color: "var(--foreground)" }}>stars barely matter.</strong> Here&apos;s what actually does.
      </p>

      <div className="longform mt-10">
        <h2>Stars tell you almost nothing about cosiness</h2>
        <p>If cosiness came with the star rating, four-star hotels would crush three-star ones. They don&apos;t. Across the hotels we have official ratings for, the average cosy score is nearly flat from three to four stars:</p>
        <div className="not-prose my-5 rounded-2xl border p-5" style={{ borderColor: "var(--line)", background: "var(--card)" }}>
          <Bar label="3-star" value={4.95} max={6} suffix="/10" n="n=490" />
          <Bar label="4-star" value={4.99} max={6} suffix="/10" n="n=292" />
          <Bar label="2-star" value={4.75} max={6} suffix="/10" n="n=157" />
          <p className="text-xs mt-3" style={{ color: "var(--muted)" }}>Average cosy score by official star rating. A three-star and a four-star hotel are, on average, equally cosy.</p>
        </div>
        <p>Stars measure facilities — a gym, a concierge, room service. Cosiness measures feeling. They&apos;re different questions, and the data treats them that way.</p>

        <h2>What does predict cosiness: who runs it</h2>
        <p>The clearest signal isn&apos;t the rating — it&apos;s whether the hotel is an independent or a chain. Hotels with chain names (Marriott, Hilton, Ibis and the like) average about <strong>1.4/10</strong>. Independents — the maisons, ryokans, inns and guesthouses — average more than double that.</p>
        <div className="not-prose my-5 rounded-2xl border p-5" style={{ borderColor: "var(--line)", background: "var(--card)" }}>
          <Bar label="Independent" value={3.3} max={4} suffix="/10" />
          <Bar label="Chain-branded" value={1.4} max={4} suffix="/10" />
          <p className="text-xs mt-3" style={{ color: "var(--muted)" }}>Average cosy score by name pattern. Big-brand hotels are so rarely cosy they barely appear in the dataset at all.</p>
        </div>
        <p>Intimacy doesn&apos;t scale to 9,000 properties. The warmth comes from a small place with a point of view — which is exactly what a chain optimises away.</p>

        <h2>Cosiness is geographic — and it&apos;s old</h2>
        <p>It clusters in places built before the car. <strong>Italy</strong> is the cosiest country we&apos;ve scored, followed by France and Japan. By city, the cosiest are Venice, Florence and Bali — dense, small-scale, characterful places where intimacy is the default, not a design choice.</p>
        <p>You can browse the full picture in <a href={`/${L}/cosy-index`}>The Cosy Index</a> and our <a href={`/${L}/guides`}>city guides</a>.</p>

        <h2>Genuine cosiness is rare</h2>
        <p>Of the {total.toLocaleString()} hotels we scored, {clearBar.toLocaleString()} ({pctClear}%) clear our cosy bar. But only <strong>{inIndex}</strong> — fewer than one in a hundred — are cosy enough to make the Index. Truly warm, intimate, characterful hotels are the exception, which is the whole reason a cosiness score is worth having.</p>

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

      <p className="mt-8 text-xs" style={{ color: "var(--muted)" }}>Methodology and figures: Got Cosy analysis of {total.toLocaleString()} hotels, June 2026. Cite as &ldquo;Got Cosy&rdquo; with a link to this page.</p>
    </article>
  );
}
