// Growth dashboard: content inventory + publish/outreach readiness in one place, plus the
// external-analytics links and what to watch at each funnel stage. Internal/noindexed.
// (Most live metrics — traffic, affiliate clicks, social reach — live in external dashboards;
// this surfaces the in-app inventory + readiness and points you to the rest.)
import type { Metadata } from "next";
import Link from "next/link";
import { getServerSupabase } from "@/lib/supabase/server";
import outreachData from "@/data/outreach.json";
import OutreachStatus from "@/components/OutreachStatus";

type OutreachItem = { id: string; outlet: string; type: string; fit: string; email: string; contactRoute: string; region: string; notes: string; status: string; rec?: string };
const outreach = outreachData as OutreachItem[];
const recRank = (r?: string) => (({ "start-here": 0, "if-budget": 2, skip: 3 }) as Record<string, number>)[r ?? ""] ?? 1;

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

  // In-app funnel from first-party events (empty until 2026_events.sql is applied + traffic flows).
  type Ev = { type: string; source: string | null; visitor: string | null };
  let funnel: { pageviews: number; visitors: number; clicks: number; ctr: number; bySource: Array<{ source: string; visitors: number; views: number; clicks: number; ctr: number }> } | null = null;
  let funnelError = false;
  try {
    const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
    const { data: ev, error } = await db.from("events").select("type,source,visitor").gte("ts", since).limit(50000);
    if (error) throw error;
    const rows = (ev || []) as Ev[];
    const pv = rows.filter((r) => r.type === "pageview");
    const ck = rows.filter((r) => r.type === "cta_click");
    const bySrc = new Map<string, { views: number; clicks: number; vis: Set<string> }>();
    const bump = (s: string | null, kind: "v" | "c", vid: string | null) => {
      const key = s || "direct";
      const e = bySrc.get(key) || { views: 0, clicks: 0, vis: new Set<string>() };
      if (kind === "v") { e.views++; if (vid) e.vis.add(vid); } else e.clicks++;
      bySrc.set(key, e);
    };
    pv.forEach((r) => bump(r.source, "v", r.visitor));
    ck.forEach((r) => bump(r.source, "c", r.visitor));
    const bySource = [...bySrc.entries()]
      .map(([source, e]) => ({ source, visitors: e.vis.size, views: e.views, clicks: e.clicks, ctr: e.views ? Math.round((100 * e.clicks) / e.views) : 0 }))
      .sort((a, b) => b.views - a.views);
    funnel = { pageviews: pv.length, visitors: new Set(pv.map((r) => r.visitor).filter(Boolean)).size, clicks: ck.length, ctr: pv.length ? Math.round((100 * ck.length) / pv.length) : 0, bySource };
  } catch { funnelError = true; }

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

  // Live outreach from Supabase (editable from any phone via the status picker); fall back to the
  // committed snapshot if the table doesn't exist yet.
  let outreachRows: OutreachItem[] = outreach;
  try {
    const { data } = await db.from("outreach").select("id,outlet,type,fit,email,contact_route,region,notes,rec,status");
    if (data && data.length) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      outreachRows = data.map((r: any) => ({ id: r.id, outlet: r.outlet, type: r.type, fit: r.fit, email: r.email || "", contactRoute: r.contact_route || "", region: r.region || "", notes: r.notes || "", rec: r.rec ?? undefined, status: r.status || "queued" }));
    }
  } catch { /* table not created yet — use snapshot */ }

  return (
    <div style={{ minHeight: "100vh", background: "#0F1512", color: "#F3EEE6", fontFamily: "Inter, system-ui, sans-serif", padding: "32px 20px" }}>
      <meta httpEquiv="refresh" content="120" />
      <div style={{ maxWidth: 1000, margin: "0 auto" }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0 }}>Growth dashboard</h1>
        <p style={{ color: "#9DA89F", marginTop: 8, fontSize: 14 }}>In-app content inventory + readiness. Live traffic/affiliate/social numbers live in the external dashboards linked below — watch those for the metrics that actually matter.</p>

        <h2 style={{ fontSize: 16, fontWeight: 700, marginTop: 24 }}>Traffic &amp; funnel — last 30 days (in-app)</h2>
        {funnelError ? (
          <p style={{ color: "#E0654B", fontSize: 13, marginTop: 8 }}>events table not found — apply <code>supabase/2026_events.sql</code> in the Supabase SQL editor, then traffic populates here automatically.</p>
        ) : funnel && funnel.pageviews > 0 ? (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginTop: 12 }}>
              <Stat label="Unique visitors" value={funnel.visitors.toLocaleString()} />
              <Stat label="Pageviews" value={funnel.pageviews.toLocaleString()} />
              <Stat label="CTA clicks" value={funnel.clicks.toLocaleString()} sub="check availability" />
              <Stat label="Click-through rate" value={`${funnel.ctr}%`} sub="clicks / pageviews" />
            </div>
            <div style={{ background: "#16201A", border: "1px solid #243029", borderRadius: 12, marginTop: 12, overflow: "hidden" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr 1fr .8fr", padding: "10px 14px", fontSize: 11, color: "#6f7a72", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>
                <span>Source</span><span>Visitors</span><span>Pageviews</span><span>CTA clicks</span><span>CTR</span>
              </div>
              {funnel.bySource.map((src) => (
                <div key={src.source} style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr 1fr .8fr", padding: "10px 14px", borderTop: "1px solid #243029", fontSize: 14 }}>
                  <span style={{ fontWeight: 600 }}>{src.source}</span><span>{src.visitors.toLocaleString()}</span><span>{src.views.toLocaleString()}</span><span>{src.clicks.toLocaleString()}</span><span style={{ color: "#7FB7A2" }}>{src.ctr}%</span>
                </div>
              ))}
            </div>
            <p style={{ color: "#6f7a72", fontSize: 11, marginTop: 8 }}>Funnel per source: <strong>visit → CTA click</strong> — the part we control. Stay22 has no public reporting API/postback, so booking + revenue stay in their dashboard (campaign-attributed — slice by city there). The CTA click is our best in-app proxy for intent-to-book.</p>
          </>
        ) : (
          <p style={{ color: "#9DA89F", fontSize: 13, marginTop: 8 }}>No events yet. Once <code>2026_events.sql</code> is applied and visitors arrive, traffic, unique visitors and source→click funnels appear here.</p>
        )}

        <h2 style={{ fontSize: 16, fontWeight: 700, marginTop: 28 }}>Content inventory</h2>
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

        <h2 style={{ fontSize: 16, fontWeight: 700, marginTop: 28 }}>PR &amp; backlink outreach <span style={{ color: "#9DA89F", fontWeight: 400, fontSize: 13 }}>· {outreachRows.length} targets · {outreachRows.filter((o) => o.rec === "start-here").length} to start with</span></h2>
        <p style={{ color: "#9DA89F", fontSize: 13, marginTop: 6 }}>Journalist platforms, media, blogs, directories, data-citation sites &amp; podcasts. ★ = do first. Change a status below — it saves straight to the database, so you can update the pipeline from your phone.</p>
        <div style={{ background: "#16201A", border: "1px solid #243029", borderRadius: 12, marginTop: 12, overflow: "hidden" }}>
          {[...outreachRows].sort((a, b) => recRank(a.rec) - recRank(b.rec)).map((o) => (
            <div key={o.id} style={{ padding: "9px 14px", borderTop: "1px solid #243029" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
                <span style={{ fontWeight: 600, color: "#F3EEE6", fontSize: 14 }}>{o.outlet}</span>
                <OutreachStatus id={o.id} status={o.status} />
                {o.rec === "start-here" && <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 5, background: "#1c3b2e", color: "#7FB7A2" }}>★ START HERE</span>}
                {o.rec === "if-budget" && <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 5, background: "#3a3320", color: "#D8B25A" }}>IF BUDGET</span>}
                {o.rec === "skip" && <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 5, background: "#243029", color: "#b07a4a" }}>SKIP</span>}
                <span style={{ fontSize: 10.5, color: "#6f7a72", border: "1px solid #243029", borderRadius: 5, padding: "1px 6px" }}>{o.type}</span>
                <span style={{ fontSize: 10.5, color: "#6f7a72", border: "1px solid #243029", borderRadius: 5, padding: "1px 6px" }}>{o.fit}</span>
                {o.region && <span style={{ fontSize: 10.5, color: "#6f7a72", border: "1px solid #243029", borderRadius: 5, padding: "1px 6px" }}>{o.region}</span>}
              </div>
              {o.notes && <div style={{ color: "#9DA89F", fontSize: 12.5, marginTop: 3 }}>{o.notes}</div>}
              <div style={{ marginTop: 3, fontSize: 12 }}>
                {o.email ? <a href={"mailto:" + o.email} style={{ color: "#7FB4FF" }}>{o.email}</a> : /^https?:/.test(o.contactRoute) ? <a href={o.contactRoute} target="_blank" rel="noreferrer" style={{ color: "#7FB4FF" }}>{o.contactRoute} ↗</a> : <span style={{ color: "#6f7a72" }}>{o.contactRoute}</span>}
              </div>
            </div>
          ))}
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
