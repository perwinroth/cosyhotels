// Growth dashboard: content inventory + publish/outreach readiness in one place, plus the
// external-analytics links and what to watch at each funnel stage. Internal/noindexed.
// (Most live metrics — traffic, affiliate clicks, social reach — live in external dashboards;
// this surfaces the in-app inventory + readiness and points you to the rest.)
import type { Metadata } from "next";
import Link from "next/link";
import { getServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata: Metadata = { title: "Growth", robots: { index: false, follow: false } };

export default async function GrowthPage() {
  const db = getServerSupabase();
  if (!db) return <div style={{ padding: 32, color: "#F3EEE6", background: "#0F1512" }}>Supabase not configured.</div>;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const count = async (table: string, mod?: (q: any) => any) => {
    let q: unknown = db.from(table).select("*", { count: "exact", head: true });
    if (mod) q = mod(q);
    const { count } = await (q as Promise<{ count: number | null }>);
    return count ?? 0;
  };

  const [cities, scored, featured, vettedPhotos, rejectedPhotos, uncheckedPhotos, withInstagram, transliterated] = await Promise.all([
    count("populate_state", (q) => q.eq("status", "done")),
    count("cosy_scores"),
    count("cosy_scores", (q) => q.gte("score", 5)),
    count("hotel_images", (q) => q.eq("vision_ok", true)),
    count("hotel_images", (q) => q.eq("vision_ok", false)),
    count("hotel_images", (q) => q.is("vision_checked_at", null).not("url", "like", "%placehold.co%")),
    count("hotels", (q) => q.not("instagram", "is", null)),
    count("hotels", (q) => q.not("name_en", "is", null)),
  ]);

  const Stat = ({ label, value, sub }: { label: string; value: string | number; sub?: string }) => (
    <div style={{ background: "#16201A", border: "1px solid #243029", borderRadius: 12, padding: 16 }}>
      <div style={{ fontSize: 28, fontWeight: 800, color: "#F3EEE6" }}>{value}</div>
      <div style={{ fontSize: 13, color: "#9DA89F", marginTop: 2 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: "#6f7a72", marginTop: 4 }}>{sub}</div>}
    </div>
  );

  const link = (href: string, label: string, watch: string) => (
    <a href={href} target="_blank" rel="noreferrer" style={{ display: "block", background: "#16201A", border: "1px solid #243029", borderRadius: 12, padding: 14, textDecoration: "none" }}>
      <div style={{ color: "#7FB4FF", fontWeight: 700, fontSize: 14 }}>{label} ↗</div>
      <div style={{ color: "#9DA89F", fontSize: 12, marginTop: 4 }}>{watch}</div>
    </a>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#0F1512", color: "#F3EEE6", fontFamily: "Inter, system-ui, sans-serif", padding: "32px 20px" }}>
      <meta httpEquiv="refresh" content="120" />
      <div style={{ maxWidth: 1000, margin: "0 auto" }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0 }}>Growth dashboard</h1>
        <p style={{ color: "#9DA89F", marginTop: 8, fontSize: 14 }}>In-app content inventory + readiness. Live traffic/affiliate/social numbers live in the external dashboards linked below — watch those for the metrics that actually matter.</p>

        <h2 style={{ fontSize: 16, fontWeight: 700, marginTop: 24 }}>Content inventory</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginTop: 12 }}>
          <Stat label="Cities live" value={cities} />
          <Stat label="Hotels scored" value={scored.toLocaleString()} />
          <Stat label="Featured (≥5/10)" value={featured.toLocaleString()} sub="surface publicly" />
          <Stat label="Vetted photos" value={vettedPhotos.toLocaleString()} sub={`${rejectedPhotos.toLocaleString()} rejected · ${uncheckedPhotos.toLocaleString()} unchecked`} />
          <Stat label="IG handles" value={withInstagram.toLocaleString()} sub="taggable / outreach" />
          <Stat label="Names romanized" value={transliterated.toLocaleString()} />
        </div>

        <h2 style={{ fontSize: 16, fontWeight: 700, marginTop: 28 }}>Readiness</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, marginTop: 12 }}>
          <Link href="/today" style={{ background: "#16201A", border: "1px solid #243029", borderRadius: 12, padding: 14, textDecoration: "none", color: "#F3EEE6" }}><div style={{ fontWeight: 700 }}>📌 /today</div><div style={{ color: "#9DA89F", fontSize: 12, marginTop: 4 }}>Manual Pinterest warm-up queue (pin-worthy hotels).</div></Link>
          <Link href="/outreach" style={{ background: "#16201A", border: "1px solid #243029", borderRadius: 12, padding: 14, textDecoration: "none", color: "#F3EEE6" }}><div style={{ fontWeight: 700 }}>✉️ /outreach</div><div style={{ color: "#9DA89F", fontSize: 12, marginTop: 4 }}>{withInstagram.toLocaleString()} hotels with handles — DM their feature for backlinks + reposts.</div></Link>
          <Link href="/posts" style={{ background: "#16201A", border: "1px solid #243029", borderRadius: 12, padding: 14, textDecoration: "none", color: "#F3EEE6" }}><div style={{ fontWeight: 700 }}>🖼 /posts</div><div style={{ color: "#9DA89F", fontSize: 12, marginTop: 4 }}>Exactly what publishes per city.</div></Link>
          <Link href="/en/cosy-index" style={{ background: "#16201A", border: "1px solid #243029", borderRadius: 12, padding: 14, textDecoration: "none", color: "#F3EEE6" }}><div style={{ fontWeight: 700 }}>🏆 /cosy-index</div><div style={{ color: "#9DA89F", fontSize: 12, marginTop: 4 }}>Flagship ranking — share / pitch for backlinks.</div></Link>
        </div>

        <h2 style={{ fontSize: 16, fontWeight: 700, marginTop: 28 }}>External analytics — the numbers that matter</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12, marginTop: 12 }}>
          {link("https://vercel.com/perwinroths-projects/cosyhotels/analytics", "Vercel Analytics", "Traffic by page & source. Watch which CITIES get visits.")}
          {link("https://app.stay22.com", "Stay22 dashboard", "Affiliate clicks & bookings — the REVENUE metric. Per city.")}
          {link("https://www.pinterest.com/business/hub/", "Pinterest analytics", "Impressions & OUTBOUND CLICKS (pin → site). The traffic metric.")}
          {link("https://business.instagram.com", "Instagram insights", "Reach, saves, profile visits, follower growth.")}
          {link("https://search.google.com/search-console", "Search Console", "Impressions/clicks for 'cosy hotels {city}'. The SEO signal.")}
        </div>

        <p style={{ color: "#6f7a72", fontSize: 12, marginTop: 24, lineHeight: 1.6 }}>
          Funnel to watch: <strong>impressions</strong> (Pinterest/Search Console) → <strong>site visits</strong> (Vercel, by city) → <strong>affiliate clicks</strong> (Stay22) → bookings. Double down on the cities that convert; drop the ones that don&apos;t.
        </p>
      </div>
    </div>
  );
}
