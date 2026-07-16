// Per-hotel asset pack for the Instagram badge wave: the page a DM'd hotelier lands on. Shows the
// hotel's LIVE score (page = current truth; the DM's numbers are stamped at queue time), the tier
// label, the live "Top {pct}%" percentile (rounded UP), the two downloadable graphics (feed +
// story), the web-badge embed snippet, and the evidence line — always disclosed as condensed from
// guest reviews.
//
// FAIL-SOFT GATES (hotels may be sent links by mistake — this page must NEVER 404):
//   score >= 6.0          → full pack (percentile + graphics + embed)
//   5 <= score < 6.0      → score only, no percentile/graphics, link to /for-hotels
//   score < 5 / missing   → no score at all, just the for-hotels pitch
import type { Metadata } from "next";
import type { CSSProperties } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerSupabase } from "@/lib/supabase/server";
import { tierForScore, roundPctUp } from "@/lib/badgePitch";
import { pitchExcerpt } from "@/lib/badgePitch";
import { displayCity } from "@/lib/placeText";
import { isDelisted } from "@/lib/delisted";
import BadgeEmbed from "@/components/BadgeEmbed";

export const dynamic = "force-dynamic";

// NOINDEX + not in any sitemap (verified: sitemapData.ts lists /en/for-hotels only, no globbing).
// generateMetadata (not a static export) so the per-hotel og:image is the LANDSCAPE 1200×630 card
// (format=og) — a link preview wants 1.91:1, and the square feed graphic was being cropped + blurred
// in Instagram DM previews (founder, 2026-07-15). Card 404s below the 6.0 floor → preview falls back
// to text, never a broken square. robots stays noindex,nofollow (asserted in ig-wave.test.ts).
export async function generateMetadata({ params }: { params: Promise<{ locale: string; slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const base = process.env.NEXT_PUBLIC_SITE_URL || "https://gotcosy.com";
  const ogImage = `${base}/api/asset-card?slug=${encodeURIComponent(slug)}&format=og`;
  return {
    title: "Your Got Cosy asset pack",
    robots: { index: false, follow: false },
    openGraph: { title: "Your Got Cosy asset pack", images: [{ url: ogImage, width: 1200, height: 630 }] },
    twitter: { card: "summary_large_image", images: [ogImage] },
  };
}

const wrap: CSSProperties = { maxWidth: 760, margin: "0 auto", padding: "40px 16px 64px" };
const muted: CSSProperties = { color: "var(--muted)", fontSize: 14, lineHeight: 1.6 };
const card: CSSProperties = { background: "var(--card)", border: "1px solid var(--line)", borderRadius: 16, padding: 18, marginTop: 18 };
const cta: CSSProperties = { display: "inline-block", background: "var(--ember)", color: "#16201C", borderRadius: 10, padding: "9px 16px", fontSize: 13.5, fontWeight: 700, textDecoration: "none" };

// The no-score / below-5 fallback: pure for-hotels pitch, no numbers. Never a 404.
function PitchOnly({ name }: { name?: string }) {
  return (
    <div style={wrap}>
      <h1 className="font-display" style={{ fontSize: 30, fontWeight: 600 }}>{name || "Your hotel"} on Got Cosy</h1>
      <p style={{ ...muted, marginTop: 10 }}>
        We analyse guest reviews to score hotels for cosiness: warmth, character, intimacy. Want to
        see how your hotel scores? Submit it and our AI runs it through the same scoring we use
        across the site.
      </p>
      <p style={{ marginTop: 18 }}>
        <Link href="/en/for-hotels" style={cta}>Get your cosy score</Link>
      </p>
    </div>
  );
}

export default async function AssetPackPage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { slug } = await params;
  const db = getServerSupabase();
  if (!db) return <PitchOnly />;
  if (await isDelisted(slug, db)) notFound(); // takedown: no asset pack for a delisted hotel

  const { data: hotel } = await db.from("hotels").select("id, slug, name, name_en, city").eq("slug", slug).maybeSingle();
  if (!hotel) return <PitchOnly />;
  const name = String(hotel.name_en || hotel.name || "").trim() || "Your hotel";
  const city = displayCity(hotel.city);

  const { data: sc } = await db.from("cosy_scores").select("score, score_final, description").eq("hotel_id", hotel.id).maybeSingle();
  const eff = sc == null ? null : Number(sc.score_final ?? sc.score ?? NaN);
  if (eff == null || !Number.isFinite(eff) || eff < 5) return <PitchOnly name={name} />;

  // Below the 6.0 proactive floor: score only — no percentile, no graphics (fail soft, never 404).
  if (eff < 6) {
    return (
      <div style={wrap}>
        <h1 className="font-display" style={{ fontSize: 30, fontWeight: 600 }}>{name}</h1>
        {city && <p style={muted}>{city}</p>}
        <div style={card}>
          <p style={{ fontSize: 15 }}>
            Cosy score: <strong>{eff.toFixed(1)}/10</strong>
          </p>
          <p style={{ ...muted, marginTop: 8 }}>
            Scored from the language of guest reviews. Curious how the score works, or how to raise it?
          </p>
          <p style={{ marginTop: 14 }}>
            <Link href="/en/for-hotels" style={cta}>For hotels</Link>
          </p>
        </div>
      </div>
    );
  }

  // Live percentile — the page shows CURRENT truth (rounded up), unlike the DM's stamped numbers.
  const [{ count: atOrAbove }, { count: totalScored }] = await Promise.all([
    db.from("cosy_scores").select("*", { count: "exact", head: true }).gte("score_final", eff),
    db.from("cosy_scores").select("*", { count: "exact", head: true }).not("score_final", "is", null),
  ]);
  const pct = totalScored ? roundPctUp((100 * (atOrAbove ?? 0)) / totalScored) : null;
  const tier = tierForScore(eff);
  const evidence = pitchExcerpt(sc?.description, 220);

  return (
    <div style={wrap}>
      <h1 className="font-display" style={{ fontSize: 30, fontWeight: 600 }}>{name}</h1>
      {city && <p style={muted}>{city}</p>}

      <div style={card}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <span className="font-display" style={{ width: 64, height: 64, borderRadius: 14, background: "var(--sage)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, fontWeight: 700 }}>
            {eff.toFixed(1)}
          </span>
          <div>
            {tier && <div style={{ fontSize: 16, fontWeight: 700 }}>{tier.label}</div>}
            {pct != null && totalScored != null && (
              <div style={muted}>Top {pct}% of {totalScored.toLocaleString("en-GB")} hotels analysed</div>
            )}
          </div>
        </div>
        {evidence && (
          <p style={{ ...muted, marginTop: 14 }}>
            <span style={{ fontWeight: 700, color: "var(--foreground)" }}>What your guests keep mentioning</span>{" "}
            (condensed from guest reviews): {evidence}
          </p>
        )}
        <p style={{ ...muted, marginTop: 10 }}>
          How the score works: <Link href="/en/cosy-score" style={{ color: "var(--ember)", textDecoration: "underline" }}>our methodology</Link>.
        </p>
      </div>

      <div style={card}>
        <h2 className="font-display" style={{ fontSize: 19, fontWeight: 600 }}>Your ready-to-post graphics</h2>
        <p style={{ ...muted, marginTop: 6 }}>Free, nothing asked. Post them as-is or crop as you like.</p>
        <p style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap" }}>
          <a href={`/api/asset-card?slug=${encodeURIComponent(hotel.slug)}&format=feed`} download={`${hotel.slug}-cosy-feed.png`} style={cta}>Download feed graphic (1080×1080)</a>
          <a href={`/api/asset-card?slug=${encodeURIComponent(hotel.slug)}&format=story`} download={`${hotel.slug}-cosy-story.png`} style={cta}>Download story graphic (1080×1920)</a>
        </p>
      </div>

      {/* The web badge — same copy-paste embed block hotels get on their public page. */}
      <BadgeEmbed slug={hotel.slug} score={eff} name={name} />
    </div>
  );
}
