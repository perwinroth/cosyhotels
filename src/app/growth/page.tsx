// Growth dashboard: content inventory + publish/outreach readiness in one place, plus the
// external-analytics links and what to watch at each funnel stage. Internal/noindexed.
// (Most live metrics — traffic, affiliate clicks, social reach — live in external dashboards;
// this surfaces the in-app inventory + readiness and points you to the rest.)
import type { Metadata } from "next";
import Link from "next/link";
import { getServerSupabase } from "@/lib/supabase/server";
import outreachData from "@/data/outreach.json";
import OutreachStatus from "@/components/OutreachStatus";
import BlogScheduleRow from "@/components/BlogScheduleRow";
import BlogFeedback from "@/components/BlogFeedback";
import RedditLeadStatus from "@/components/RedditLeadStatus";
import { getScheduleForPanel } from "@/lib/blogSchedule";
import { gmailComposeUrl } from "@/lib/outreachTemplates";
import { cityToSlug } from "@/lib/citySlug";
import { getGscSummary, gscConfigured } from "@/lib/gsc";
import { gmailConfigured } from "@/lib/gmail";
import GmailDraftButton from "@/components/GmailDraftButton";

type OutreachItem = { id: string; outlet: string; type: string; fit: string; email: string; contactRoute: string; region: string; notes: string; status: string; rec?: string };
const outreach = outreachData as OutreachItem[];
const recRank = (r?: string) => (({ "start-here": 0, "if-budget": 2, skip: 3 }) as Record<string, number>)[r ?? ""] ?? 1;
// Per-target: what to actually pitch, keyed by the row's `fit`. Turns an opaque tag into a next step.
const fitAngle: Record<string, string> = {
  "data-study": "Pitch the cosiness data study — citable stats they can quote.",
  "hotelier-asset": "Offer the “make your hotel look cosy” guide for their audience.",
  "listicle": "Offer a “best cosy hotels for X” round-up angle.",
  "expert-source": "Offer yourself as an expert source on cosy / boutique travel.",
};

// Section heading with an anchor (for the jump menu) + a one-line, action-first "how to use" note.
function SectionHead({ id, icon, title, aside, how }: { id: string; icon: string; title: string; aside?: string; how?: string }) {
  return (
    <>
      <h2 id={id} style={{ fontSize: 16, fontWeight: 700, marginTop: 30, scrollMarginTop: 62 }}>
        {icon} {title}{aside ? <span style={{ color: "#9DA89F", fontWeight: 400, fontSize: 13 }}> · {aside}</span> : null}
      </h2>
      {how ? <p style={{ color: "#D8B25A", fontSize: 12.5, marginTop: 5, marginBottom: 0, lineHeight: 1.5 }}>▸ {how}</p> : null}
    </>
  );
}

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

  // Journal release schedule (editable from any phone via the pickers below).
  const blogSchedule = await getScheduleForPanel();
  const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short" }) : "");
  // Existing per-post feedback notes (blog content lives in code, so feedback is the edit loop).
  const blogFeedback = new Map<string, string>();
  try {
    const { data } = await db.from("blog_feedback").select("slug,note");
    for (const r of (data || []) as Array<{ slug: string; note: string | null }>) if (r.note) blogFeedback.set(r.slug, r.note);
  } catch { /* table not created yet */ }

  // Reddit opportunities — threads asking for cosy/boutique hotel recs (from find-reddit-threads.mjs).
  // Reply MANUALLY + genuinely; dismissed ones drop off. Empty until the finder script is run.
  type RedditLead = { id: string; subreddit: string | null; title: string | null; url: string; snippet: string | null; city: string | null; status: string };
  let redditLeads: RedditLead[] = [];
  try {
    const { data } = await db.from("reddit_leads").select("id,subreddit,title,url,snippet,city,status").neq("status", "dismissed").order("found_at", { ascending: false }).limit(120);
    redditLeads = (data || []) as RedditLead[];
  } catch { /* table not created yet */ }

  // Google Search Console — the SEO signal (impressions/clicks for our queries). null until the
  // service account is wired (GSC_SA_EMAIL + GSC_SA_PRIVATE_KEY).
  const gsc = await getGscSummary().catch(() => null);
  const gscOn = gscConfigured();
  const gmailOn = gmailConfigured();
  const host = (u: string) => { try { return new URL(u).pathname || u; } catch { return u; } };

  // What needs doing right now — surfaced in the Today strip so you never hunt for the next action.
  const redditNew = redditLeads.filter((r) => r.status === "new").length;
  const prToStart = outreachRows.filter((o) => o.rec === "start-here" && o.status === "queued").length;
  const scheduledPosts = blogSchedule.filter((b) => b.status === "scheduled").length;
  // Jump menu (matches page order). ⚡📝✉️👽🧰 = things you DO · 🔍📊📦📈 = things you MONITOR.
  const NAV = [
    { id: "today", icon: "⚡", label: "Today" },
    { id: "roadmap", icon: "🗺", label: "Roadmap" },
    { id: "journal", icon: "📝", label: "Journal" },
    { id: "pr", icon: "✉️", label: "PR" },
    { id: "reddit", icon: "👽", label: "Reddit" },
    { id: "tools", icon: "🧰", label: "Tools" },
    { id: "search", icon: "🔍", label: "Search" },
    { id: "funnel", icon: "📊", label: "Traffic" },
    { id: "inventory", icon: "📦", label: "Inventory" },
    { id: "analytics", icon: "📈", label: "External" },
  ];
  const todoChip = { flex: "none", display: "inline-flex", alignItems: "baseline", gap: 7, padding: "11px 15px", borderRadius: 12, border: "1px solid #2f4133", background: "#16201A", color: "#C7CFC8", fontSize: 13, fontWeight: 600, textDecoration: "none" } as const;
  // Where the growth build stands. status: done | ready (I can start now) | blocked (needs you).
  const ROADMAP: Array<{ wp: string; label: string; status: "done" | "ready" | "blocked"; note?: string }> = [
    { wp: "WP1–4", label: "SEO foundation — split sitemaps, internal links, theme/country hubs, thin-page noindex", status: "done" },
    { wp: "WP5", label: "Reddit lead finder · badge-outreach engine · Today action queue", status: "done" },
    { wp: "WP6", label: "Search Console KPI panel (above)", status: "done" },
    { wp: "WP8", label: "Competitor backlinks — 16 pitchable targets added to the PR list (rest were spam / rival hotels)", status: "done" },
    { wp: "WP5", label: "Real Gmail drafts from per@gotcosy.com (the ✉ buttons below)", status: "done" },
    { wp: "WP6", label: "Daily 08:30 + Friday calendar reminders → “open /growth Today”", status: "ready", note: "Not blocked — say go and pick calendar events vs phone push." },
    { wp: "WP7", label: "Blog audit + rewrite + 40-listicle drip", status: "ready", note: "Audit-first — you read everything before it publishes." },
  ];
  const stStyle: Record<string, { background: string; color: string }> = { done: { background: "#1c3b2e", color: "#7FB7A2" }, ready: { background: "#243b52", color: "#7FB4FF" }, blocked: { background: "#3a3320", color: "#D8B25A" } };
  const stLabel: Record<string, string> = { done: "✓ done", ready: "🟢 ready", blocked: "🔒 needs you" };
  const navPill = { flex: "none", display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 11px", borderRadius: 999, border: "1px solid #243029", background: "#16201A", color: "#C7CFC8", fontSize: 13, fontWeight: 600, textDecoration: "none" } as const;

  return (
    <div style={{ minHeight: "100vh", background: "#0F1512", color: "#F3EEE6", fontFamily: "Inter, system-ui, sans-serif", padding: "32px 20px" }}>
      <meta httpEquiv="refresh" content="120" />
      <div style={{ maxWidth: 1000, margin: "0 auto" }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0 }}>Growth command center</h1>
        <p style={{ color: "#9DA89F", marginTop: 6, fontSize: 13.5 }}>Everything you run to grow Got Cosy. Jump with the menu; every section tells you what to do.</p>

        {/* Sticky jump menu — findability on desktop + phone (scrolls sideways on small screens). */}
        <nav style={{ position: "sticky", top: 0, zIndex: 20, margin: "12px -20px 0", padding: "9px 20px", background: "rgba(15,21,18,0.94)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)", borderBottom: "1px solid #243029", display: "flex", gap: 7, overflowX: "auto", whiteSpace: "nowrap" }}>
          {NAV.map((n) => <a key={n.id} href={`#${n.id}`} style={navPill}>{n.icon} {n.label}</a>)}
        </nav>

        {/* Today — the only section that tells you what to do RIGHT NOW. */}
        <h2 id="today" style={{ fontSize: 16, fontWeight: 700, marginTop: 22, scrollMarginTop: 62 }}>⚡ Today <span style={{ color: "#9DA89F", fontWeight: 400, fontSize: 13 }}>· do these first</span></h2>
        {(redditNew + prToStart + scheduledPosts) === 0 ? (
          <p style={{ color: "#7FB7A2", fontSize: 13.5, marginTop: 8 }}>All caught up ✨ Nothing queued right now. Refresh Reddit leads (see 👽 Reddit) or work down the PR list.</p>
        ) : (
          <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
            {redditNew > 0 && <a href="#reddit" style={todoChip}><b style={{ color: "#7FB4FF", fontSize: 18 }}>{redditNew}</b> new Reddit {redditNew === 1 ? "thread" : "threads"} to reply to →</a>}
            {prToStart > 0 && <a href="#pr" style={todoChip}><b style={{ color: "#7FB7A2", fontSize: 18 }}>{prToStart}</b> ★ outreach {prToStart === 1 ? "target" : "targets"} to start →</a>}
            {scheduledPosts > 0 && <a href="#journal" style={todoChip}><b style={{ color: "#D8B25A", fontSize: 18 }}>{scheduledPosts}</b> blog {scheduledPosts === 1 ? "post" : "posts"} scheduled →</a>}
          </div>
        )}

        <SectionHead id="roadmap" icon="🗺" title="Roadmap" how="What’s shipped and what’s next. 🔒 = waiting on you · 🟢 = I can start now, just say go." />
        <div style={{ background: "#16201A", border: "1px solid #243029", borderRadius: 12, marginTop: 12, overflow: "hidden" }}>
          {ROADMAP.map((r, i) => (
            <div key={i} style={{ padding: "10px 14px", borderTop: i ? "1px solid #243029" : "none", display: "flex", gap: 10, alignItems: "flex-start" }}>
              <span style={{ flex: "none", fontSize: 11, fontWeight: 700, color: "#6f7a72", width: 46, paddingTop: 3 }}>{r.wp}</span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: 13.5, color: r.status === "done" ? "#9DA89F" : "#F3EEE6" }}>{r.label}</span>
                {r.note && <span style={{ display: "block", fontSize: 12, color: "#9DA89F", marginTop: 2 }}>{r.note}</span>}
              </span>
              <span style={{ flex: "none", fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 6, whiteSpace: "nowrap", ...stStyle[r.status] }}>{stLabel[r.status]}</span>
            </div>
          ))}
        </div>

        <SectionHead id="funnel" icon="📊" title="Traffic & funnel" aside="last 30 days, in-app" how="Which sources send visitors who click “Check availability”. Pour effort into the ones that convert." />
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

        <SectionHead id="search" icon="🔍" title="Search Console" aside="last 28 days" how="Your Google visibility. Rising impressions mean the SEO work is landing; a strong position with low CTR means sharpen the page title." />
        {!gscOn ? (
          <p style={{ color: "#9DA89F", fontSize: 13, marginTop: 8 }}>Not wired yet — add <code>GSC_SA_EMAIL</code> + <code>GSC_SA_PRIVATE_KEY</code> to Vercel (service account <code>gsc-reader@cosy-hotels.iam.gserviceaccount.com</code> must be a user on the gotcosy.com property). Then Google impressions/clicks/queries appear here.</p>
        ) : !gsc ? (
          <p style={{ color: "#E0654B", fontSize: 13, marginTop: 8 }}>Credentials set but the API returned nothing — the SA may not have access to the property yet, or <code>GSC_PROPERTY</code> is the wrong form. Run <code>node --env-file=.env.local scripts/gsc-test.mjs</code> to diagnose.</p>
        ) : (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginTop: 12 }}>
              <Stat label="Impressions" value={Math.round(gsc.totals.impressions).toLocaleString()} sub="in Google search" />
              <Stat label="Clicks" value={Math.round(gsc.totals.clicks).toLocaleString()} sub="to the site" />
              <Stat label="Avg CTR" value={`${(gsc.totals.ctr * 100).toFixed(1)}%`} />
              <Stat label="Avg position" value={gsc.totals.position ? gsc.totals.position.toFixed(1) : "—"} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
              <div style={{ background: "#16201A", border: "1px solid #243029", borderRadius: 12, overflow: "hidden" }}>
                <div style={{ padding: "8px 12px", fontSize: 11, color: "#6f7a72", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>Top queries</div>
                {gsc.queries.length === 0 && <div style={{ padding: "8px 12px", fontSize: 12.5, color: "#9DA89F" }}>No query data yet.</div>}
                {gsc.queries.map((q) => (
                  <div key={q.keys?.[0]} style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "7px 12px", borderTop: "1px solid #243029", fontSize: 13 }}>
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{q.keys?.[0]}</span>
                    <span style={{ color: "#7FB7A2", flexShrink: 0 }}>{Math.round(q.clicks)}c · {Math.round(q.impressions)}i</span>
                  </div>
                ))}
              </div>
              <div style={{ background: "#16201A", border: "1px solid #243029", borderRadius: 12, overflow: "hidden" }}>
                <div style={{ padding: "8px 12px", fontSize: 11, color: "#6f7a72", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>Top pages</div>
                {gsc.pages.length === 0 && <div style={{ padding: "8px 12px", fontSize: 12.5, color: "#9DA89F" }}>No page data yet.</div>}
                {gsc.pages.map((p) => (
                  <div key={p.keys?.[0]} style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "7px 12px", borderTop: "1px solid #243029", fontSize: 13 }}>
                    <a href={p.keys?.[0]} target="_blank" rel="noreferrer" style={{ color: "#F3EEE6", textDecoration: "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{host(p.keys?.[0] || "")}</a>
                    <span style={{ color: "#7FB7A2", flexShrink: 0 }}>{Math.round(p.clicks)}c · {Math.round(p.impressions)}i</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        <SectionHead id="inventory" icon="📦" title="Content inventory" how="A health snapshot of what’s built and scored. Nothing to action here — just glance to confirm the catalogue looks right." />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginTop: 12 }}>
          <Stat label="Cities live" value={cities} />
          <Stat label="Hotels scored" value={scored.toLocaleString()} />
          <Stat label="Featured (≥5/10)" value={featured.toLocaleString()} sub="surface publicly" />
          <Stat label="Vetted photos" value={vettedPhotos.toLocaleString()} sub={`${rejectedPhotos.toLocaleString()} rejected · ${uncheckedPhotos.toLocaleString()} unchecked`} />
          <Stat label="IG handles" value={withInstagram.toLocaleString()} sub="taggable / outreach" />
          <Stat label="Names romanized" value={transliterated.toLocaleString()} />
        </div>

        <SectionHead id="tools" icon="🧰" title="Tools" how="Your working pages. Tap in to post to Pinterest, DM hotels, pitch badges, or check what publishes." />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, marginTop: 12 }}>
          <Link href="/today" style={{ background: "#16201A", border: "1px solid #243029", borderRadius: 12, padding: 14, textDecoration: "none", color: "#F3EEE6" }}><div style={{ fontWeight: 700 }}>📌 /today</div><div style={{ color: "#9DA89F", fontSize: 12, marginTop: 4 }}>Manual Pinterest warm-up queue (pin-worthy hotels).</div></Link>
          <Link href="/outreach" style={{ background: "#16201A", border: "1px solid #243029", borderRadius: 12, padding: 14, textDecoration: "none", color: "#F3EEE6" }}><div style={{ fontWeight: 700 }}>✉️ /outreach</div><div style={{ color: "#9DA89F", fontSize: 12, marginTop: 4 }}>{withInstagram.toLocaleString()} hotels with handles — DM their feature for backlinks + reposts.</div></Link>
          <Link href="/posts" style={{ background: "#16201A", border: "1px solid #243029", borderRadius: 12, padding: 14, textDecoration: "none", color: "#F3EEE6" }}><div style={{ fontWeight: 700 }}>🖼 /posts</div><div style={{ color: "#9DA89F", fontSize: 12, marginTop: 4 }}>Exactly what publishes per city.</div></Link>
          <Link href="/en/cosy-index" style={{ background: "#16201A", border: "1px solid #243029", borderRadius: 12, padding: 14, textDecoration: "none", color: "#F3EEE6" }}><div style={{ fontWeight: 700 }}>🏆 /cosy-index</div><div style={{ color: "#9DA89F", fontSize: 12, marginTop: 4 }}>Flagship ranking — share / pitch for backlinks.</div></Link>
          <Link href="/badge-outreach" style={{ background: "#16201A", border: "1px solid #243029", borderRadius: 12, padding: 14, textDecoration: "none", color: "#F3EEE6" }}><div style={{ fontWeight: 700 }}>🏅 /badge-outreach</div><div style={{ color: "#9DA89F", fontSize: 12, marginTop: 4 }}>Top-2.3% hotels — pitch their &quot;Rated Cosy&quot; badge for editorial backlinks.</div></Link>
        </div>

        <SectionHead id="journal" icon="📝" title="Journal — posts & feedback" aside={`${blogSchedule.filter((b) => b.visible).length}/${blogSchedule.length} live`} how="Read each post (↗), leave feedback for me to action, and set live / scheduled / draft (live = public now · scheduled = auto-publishes on its date · draft = hidden). Everything saves instantly." />
        <div style={{ background: "#16201A", border: "1px solid #243029", borderRadius: 12, marginTop: 12, overflow: "hidden" }}>
          {blogSchedule.map((b) => (
            <div key={b.slug} style={{ padding: "10px 14px", borderTop: "1px solid #243029", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <span style={{ width: 8, height: 8, borderRadius: 8, flex: "none", background: b.visible ? "#7FB7A2" : "#3a4038" }} title={b.visible ? "public" : "hidden"} />
              <span style={{ flex: 1, minWidth: 180 }}>
                <a href={`/en/blog/${b.slug}`} target="_blank" rel="noreferrer" style={{ color: "#F3EEE6", fontWeight: 600, fontSize: 14, textDecoration: "none" }}>{b.title} ↗</a>
                <span style={{ display: "block", fontSize: 11, color: "#6f7a72", marginTop: 2 }}>{b.eyebrow}{b.status === "scheduled" && b.publish_at ? ` · scheduled ${fmtDate(b.publish_at)}` : b.visible ? " · live" : " · hidden"}</span>
              </span>
              <BlogScheduleRow slug={b.slug} status={b.status} publishAt={b.publish_at} />
              <BlogFeedback slug={b.slug} initial={blogFeedback.get(b.slug) || ""} />
            </div>
          ))}
        </div>

        <SectionHead id="pr" icon="✉️" title="PR & backlink outreach" aside={`${outreachRows.length} targets · ${outreachRows.filter((o) => o.rec === "start-here").length} to start`} how="Work the ★ START HERE rows first. Per row: tap Draft in Gmail → personalise the pitch → send → set the status. It all saves to the database." />
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
              {fitAngle[o.fit] && <div style={{ color: "#7FB7A2", fontSize: 12, marginTop: 2 }}>→ {fitAngle[o.fit]}</div>}
              <div style={{ marginTop: 5, fontSize: 12, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                {o.email ? (
                  <>
                    {gmailOn
                      ? <GmailDraftButton outlet={o.outlet} fit={o.fit} email={o.email} />
                      : <a href={gmailComposeUrl(o)} target="_blank" rel="noreferrer" style={{ fontWeight: 700, color: "#0F1512", background: "#7FB7A2", borderRadius: 6, padding: "4px 10px", textDecoration: "none" }}>✉ Draft in Gmail ↗</a>}
                    <a href={"mailto:" + o.email} style={{ color: "#6f7a72" }}>{o.email}</a>
                  </>
                ) : /^https?:/.test(o.contactRoute) ? <a href={o.contactRoute} target="_blank" rel="noreferrer" style={{ color: "#7FB4FF" }}>{o.contactRoute} ↗</a> : <span style={{ color: "#6f7a72" }}>{o.contactRoute}</span>}
              </div>
            </div>
          ))}
        </div>

        <SectionHead id="reddit" icon="👽" title="Reddit opportunities" aside={`${redditLeads.length} open${redditLeads.filter((r) => r.status === "new").length ? ` · ${redditLeads.filter((r) => r.status === "new").length} new` : ""}`} how="Open a thread, reply like a human — never a bare link or the same message twice (that’s how you get banned) — then mark it replied. One genuinely helpful reply that mentions our guide." />
        <p style={{ color: "#6f7a72", fontSize: 12, marginTop: 6 }}>Refresh leads: <code>node --env-file=.env.local scripts/find-reddit-threads.mjs --execute</code></p>
        {redditLeads.length === 0 ? (
          <p style={{ color: "#9DA89F", fontSize: 13, marginTop: 8 }}>No leads yet — run the finder script above.</p>
        ) : (
          <div style={{ background: "#16201A", border: "1px solid #243029", borderRadius: 12, marginTop: 12, overflow: "hidden" }}>
            {redditLeads.map((r) => (
              <div key={r.id} style={{ padding: "10px 14px", borderTop: "1px solid #243029" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <a href={r.url} target="_blank" rel="noreferrer" style={{ color: "#F3EEE6", fontWeight: 600, fontSize: 14, textDecoration: "none" }}>{r.title || r.url} ↗</a>
                  <RedditLeadStatus id={r.id} status={r.status} />
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 4, fontSize: 11.5, color: "#6f7a72" }}>
                  {r.subreddit && <span style={{ border: "1px solid #243029", borderRadius: 5, padding: "1px 6px" }}>r/{r.subreddit}</span>}
                  {r.city && <span style={{ border: "1px solid #243029", borderRadius: 5, padding: "1px 6px" }}>{r.city}</span>}
                  {r.city && <a href={`/en/guides/${cityToSlug(r.city)}`} target="_blank" rel="noreferrer" style={{ color: "#7FB4FF" }}>reply with {r.city} guide ↗</a>}
                </div>
                {r.snippet && <div style={{ color: "#9DA89F", fontSize: 12.5, marginTop: 4 }}>{r.snippet}</div>}
              </div>
            ))}
          </div>
        )}

        <SectionHead id="analytics" icon="📈" title="External analytics" how="The numbers that matter live off-site. Check these weekly — especially which cities convert." />
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
