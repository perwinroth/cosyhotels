// /growth/reporting — the read-only numbers: traffic & funnel, Search Console, content inventory,
// roadmap, and links out to the off-site dashboards. Data logic is ported 1:1 from the old monolith
// (same 30-day / 28-day windows, same empty states); only the styling moved to brand tokens.
import { getServerSupabase } from "@/lib/supabase/server";
import { getFunnel, getGsc, getInventory, ROADMAP, roadmapChip, EXTERNAL_LINKS, Stat, SectionHead } from "../lib";

export const dynamic = "force-dynamic";

const cardStyle = { background: "var(--card)", border: "1px solid var(--line)", borderRadius: 16, boxShadow: "var(--shadow)", overflow: "hidden" } as const;
const headRow = { fontSize: 11, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 } as const;
const host = (u: string) => { try { return new URL(u).pathname || u; } catch { return u; } };

export default async function ReportingPage() {
  const db = getServerSupabase();
  if (!db) return <p style={{ color: "var(--muted)" }}>Supabase not configured.</p>;

  const [{ funnel, funnelError }, { gsc, gscOn }, inv] = await Promise.all([getFunnel(db), getGsc(), getInventory(db)]);

  return (
    <div>
      <h1 className="font-display" style={{ fontSize: 24, fontWeight: 600, margin: 0, color: "var(--foreground)" }}>Reporting</h1>
      <p style={{ color: "var(--muted)", marginTop: 6, fontSize: 13.5 }}>Traffic, search visibility and catalogue health. The revenue numbers live off-site (linked below).</p>

      {/* Traffic & funnel */}
      <SectionHead id="funnel" title="Traffic & funnel" aside="last 30 days, in-app" how="Which sources send visitors who click “Check availability”. Pour effort into the ones that convert." />
      {funnelError ? (
        <p style={{ color: "var(--ember-ink)", fontSize: 13, marginTop: 8 }}>events table not found: apply <code>supabase/2026_events.sql</code>, then traffic populates here automatically.</p>
      ) : funnel && funnel.pageviews > 0 ? (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4" style={{ marginTop: 12 }}>
            <Stat label="Unique visitors" value={funnel.visitors.toLocaleString()} />
            <Stat label="Pageviews" value={funnel.pageviews.toLocaleString()} />
            <Stat label="CTA clicks" value={funnel.clicks.toLocaleString()} sub="check availability" />
            <Stat label="Click-through rate" value={`${funnel.ctr}%`} sub="clicks / pageviews" />
          </div>
          <div style={{ ...cardStyle, marginTop: 12 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr 1fr .8fr", padding: "10px 14px", ...headRow }}>
              <span>Source</span><span>Visitors</span><span>Pageviews</span><span>CTA clicks</span><span>CTR</span>
            </div>
            {funnel.bySource.map((src) => (
              <div key={src.source} style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr 1fr .8fr", padding: "10px 14px", borderTop: "1px solid var(--line)", fontSize: 14, color: "var(--foreground)" }}>
                <span style={{ fontWeight: 600 }}>{src.source}</span><span>{src.visitors.toLocaleString()}</span><span>{src.views.toLocaleString()}</span><span>{src.clicks.toLocaleString()}</span><span style={{ color: "var(--sage)" }}>{src.ctr}%</span>
              </div>
            ))}
          </div>
          <p style={{ color: "var(--muted)", fontSize: 11, marginTop: 8, opacity: 0.85 }}>Funnel per source: <strong>visit → CTA click</strong>, the part we control. Stay22 has no public reporting API, so booking + revenue stay in their dashboard. The CTA click is our best in-app proxy for intent-to-book.</p>
        </>
      ) : (
        <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 8 }}>No events yet. Once <code>2026_events.sql</code> is applied and visitors arrive, traffic and source→click funnels appear here.</p>
      )}

      {/* Search Console */}
      <SectionHead id="search" title="Search Console" aside="last 28 days" how="Your Google visibility. Rising impressions mean the SEO work is landing; strong position with low CTR means sharpen the page title." />
      {!gscOn ? (
        <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 8 }}>Not wired yet: add <code>GSC_SA_EMAIL</code> + <code>GSC_SA_PRIVATE_KEY</code> to Vercel (service account must be a user on the gotcosy.com property). Then Google impressions/clicks/queries appear here.</p>
      ) : !gsc ? (
        <p style={{ color: "var(--ember-ink)", fontSize: 13, marginTop: 8 }}>Credentials set but the API returned nothing: the SA may not have access yet, or <code>GSC_PROPERTY</code> is the wrong form. Run <code>node --env-file=.env.local scripts/gsc-test.mjs</code> to diagnose.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4" style={{ marginTop: 12 }}>
            <Stat label="Impressions" value={Math.round(gsc.totals.impressions).toLocaleString()} sub="in Google search" />
            <Stat label="Clicks" value={Math.round(gsc.totals.clicks).toLocaleString()} sub="to the site" />
            <Stat label="Avg CTR" value={`${(gsc.totals.ctr * 100).toFixed(1)}%`} />
            <Stat label="Avg position" value={gsc.totals.position ? gsc.totals.position.toFixed(1) : "–"} />
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2" style={{ marginTop: 12 }}>
            <div style={cardStyle}>
              <div style={{ padding: "8px 12px", ...headRow }}>Top queries</div>
              {gsc.queries.length === 0 && <div style={{ padding: "8px 12px", fontSize: 12.5, color: "var(--muted)" }}>No query data yet.</div>}
              {gsc.queries.map((q) => (
                <div key={q.keys?.[0]} style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "7px 12px", borderTop: "1px solid var(--line)", fontSize: 13, color: "var(--foreground)" }}>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{q.keys?.[0]}</span>
                  <span style={{ color: "var(--sage)", flexShrink: 0 }}>{Math.round(q.clicks)}c · {Math.round(q.impressions)}i</span>
                </div>
              ))}
            </div>
            <div style={cardStyle}>
              <div style={{ padding: "8px 12px", ...headRow }}>Top pages</div>
              {gsc.pages.length === 0 && <div style={{ padding: "8px 12px", fontSize: 12.5, color: "var(--muted)" }}>No page data yet.</div>}
              {gsc.pages.map((p) => (
                <div key={p.keys?.[0]} style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "7px 12px", borderTop: "1px solid var(--line)", fontSize: 13 }}>
                  <a href={p.keys?.[0]} target="_blank" rel="noreferrer" style={{ color: "var(--foreground)", textDecoration: "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{host(p.keys?.[0] || "")}</a>
                  <span style={{ color: "var(--sage)", flexShrink: 0 }}>{Math.round(p.clicks)}c · {Math.round(p.impressions)}i</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Content inventory */}
      <SectionHead id="inventory" title="Content inventory" how="A health snapshot of what’s built and scored; glance to confirm the catalogue looks right." />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3" style={{ marginTop: 12 }}>
        <Stat label="Cities live" value={inv.cities} />
        <Stat label="Hotels scored" value={inv.scored.toLocaleString()} />
        <Stat label="Featured (≥5/10)" value={inv.featured.toLocaleString()} sub="surface publicly" />
        <Stat label="Vetted photos" value={inv.vettedPhotos.toLocaleString()} sub={`${inv.rejectedPhotos.toLocaleString()} rejected · ${inv.uncheckedPhotos.toLocaleString()} unchecked`} />
        <Stat label="IG handles" value={inv.withInstagram.toLocaleString()} sub="taggable / outreach" />
        <Stat label="Names romanized" value={inv.transliterated.toLocaleString()} />
      </div>

      {/* Roadmap */}
      <SectionHead id="roadmap" title="Roadmap" how="What’s shipped and what’s next. “needs you” = waiting on Per · “ready” = can start now, just say go." />
      <div style={{ ...cardStyle, marginTop: 12 }}>
        {ROADMAP.map((r, i) => {
          const chip = roadmapChip[r.status];
          return (
            <div key={i} style={{ padding: "10px 14px", borderTop: i ? "1px solid var(--line)" : "none", display: "flex", gap: 10, alignItems: "flex-start" }}>
              <span style={{ flex: "none", fontSize: 11, fontWeight: 700, color: "var(--muted)", width: 46, paddingTop: 3 }}>{r.wp}</span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: 13.5, color: r.status === "done" ? "var(--muted)" : "var(--foreground)" }}>{r.label}</span>
                {r.note && <span style={{ display: "block", fontSize: 12, color: "var(--muted)", marginTop: 2 }}>{r.note}</span>}
              </span>
              <span style={{ flex: "none", fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 999, whiteSpace: "nowrap", background: chip.bg, color: chip.fg }}>{chip.label}</span>
            </div>
          );
        })}
      </div>

      {/* External analytics */}
      <SectionHead id="analytics" title="External analytics" how="The numbers that matter live off-site. Check these weekly, especially which cities convert." />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2" style={{ marginTop: 12 }}>
        {EXTERNAL_LINKS.map((l) => (
          <a key={l.href} href={l.href} target="_blank" rel="noreferrer" className="growth-navlink hov" style={{ display: "block", ...cardStyle, padding: 14, textDecoration: "none" }}>
            <div style={{ color: "var(--ember)", fontWeight: 600, fontSize: 14 }}>{l.label} ↗</div>
            <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 4 }}>{l.watch}</div>
          </a>
        ))}
      </div>

      <p style={{ color: "var(--muted)", fontSize: 12, marginTop: 24, lineHeight: 1.6, opacity: 0.85 }}>
        Funnel to watch: <strong>impressions</strong> (Pinterest / Search Console) → <strong>site visits</strong> (Vercel, by city) → <strong>affiliate clicks</strong> (Stay22) → bookings. Double down on the cities that convert; drop the ones that don’t.
      </p>
    </div>
  );
}
