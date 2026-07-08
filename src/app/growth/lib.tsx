// Shared server helpers + presentational bits for the /growth dashboard (Today + Reporting).
// Server-only (uses getServerSupabase indirectly via the caller-passed client). All styling goes
// through the brand CSS variables so both themes render correctly — no raw hex.
import type { ReactNode } from "react";
import { getGscSummary, gscConfigured } from "@/lib/gsc";
import { getScheduleForPanel } from "@/lib/blogSchedule";
import { buildBadgePitch, buildVariantPitch, variantFor, gmailComposeUrl, instagramDmUrl } from "@/lib/badgePitch";
import { displayCity, isLatin } from "@/lib/placeText";
import { REDDIT_ANSWER_PLAN } from "@/data/redditAnswerPlan";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

// The daily drip sizes — small enough to protect deliverability + get actually done every day.
export const DAILY = { emails: 30, instagram: 10, reddit: 3 };

export type TodayEmail = { hotelId: string; name: string; city: string; score: number; email: string; gmailUrl: string; variant: string };
export type TodayInstagram = { hotelId: string; name: string; city: string; score: number; handle: string; igUrl: string; pitch: string };
// `source: "planned"` = a founder-reviewed answer from redditAnswerPlan.ts (has `answer` + `worthiness`);
// `source: "lead"` = a fresh reddit_leads row Per hasn't answered yet — the fallback once every planned
// answer is marked done (done-tracking is client-side localStorage, see TodayPlan.tsx).
export type TodayReddit = {
  id: string; subreddit: string | null; title: string | null; url: string; city: string | null;
  answer?: string; worthiness?: number; source: "planned" | "lead";
};

// Pull "belgium" out of https://www.reddit.com/r/belgium/comments/... — best-effort, only used for display.
function subredditFromUrl(url: string): string | null {
  const m = url.match(/reddit\.com\/r\/([^/]+)/i);
  return m ? m[1] : null;
}

// The concrete "do exactly this today" queue: the top-scored queued hotels to email + DM, and the best
// Reddit threads to reply to — capped to DAILY so Per just works the list, no judgement calls.
export async function getTodayPlan(db: DB): Promise<{
  emails: TodayEmail[]; instagram: TodayInstagram[]; reddit: TodayReddit[];
  totalEmailQueued: number; totalIgQueued: number;
}> {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "https://gotcosy.com";
  const empty = { emails: [], instagram: [], reddit: [], totalEmailQueued: 0, totalIgQueued: 0 };
  try {
    const [{ data: queued }, { count: total }, { data: redditRows }] = await Promise.all([
      db.from("hotel_outreach").select("hotel_id").eq("status", "queued"),
      db.from("cosy_scores").select("*", { count: "exact", head: true }),
      db.from("reddit_leads").select("id,subreddit,title,url,city").eq("status", "new").order("found_at", { ascending: false }).limit(DAILY.reddit),
    ]);
    const totalTxt = (total || 17000).toLocaleString();

    // Today-reddit ordering: the founder-reviewed plan (worthiness >= 4) goes first — TodayPlan.tsx
    // hides each one client-side once ticked done (localStorage `reddit-plan-done`) and only falls
    // back to showing the newest reddit_leads once every planned answer is done.
    const planned: TodayReddit[] = REDDIT_ANSWER_PLAN
      .filter((p) => p.worthiness >= 4)
      .map((p) => ({
        id: p.threadUrl,
        subreddit: subredditFromUrl(p.threadUrl),
        title: p.title,
        url: p.threadUrl,
        city: p.market,
        answer: p.answer,
        worthiness: p.worthiness,
        source: "planned" as const,
      }));
    const leadReddit: TodayReddit[] = ((redditRows || []) as Array<{ id: string; subreddit: string | null; title: string | null; url: string; city: string | null }>)
      .map((r) => ({ ...r, source: "lead" as const }));
    const reddit: TodayReddit[] = [...planned, ...leadReddit];

    const ids = ((queued || []) as Array<{ hotel_id: string }>).map((r) => String(r.hotel_id));
    if (!ids.length) return { ...empty, reddit };

    // Pull the queued hotels' score + write-up + contact, best score first.
    const { data } = await db
      .from("cosy_scores")
      .select("hotel_id, score, score_final, description, hotel:hotel_id!inner(slug, name, name_en, city, instagram, email)")
      .in("hotel_id", ids)
      .order("score", { ascending: false })
      .limit(1000);

    type CRow = { hotel_id: string; score: number | null; score_final: number | null; description: string | null; hotel: { slug: string; name: string; name_en: string | null; city: string | null; instagram: string | null; email: string | null } | null };
    const seen = new Set<string>();
    const emails: TodayEmail[] = [];
    const instagram: TodayInstagram[] = [];
    for (const r of ((data || []) as unknown as CRow[])) {
      const h = r.hotel;
      if (!h) continue;
      const name = String(h.name_en || h.name || "").trim();
      if (!name || !isLatin(name) || seen.has(name)) continue;
      seen.add(name);
      const score = Number((r.score_final ?? r.score) || 0);
      const city = displayCity(h.city);
      const email = h.email && h.email.includes("@") ? h.email.trim() : null;
      const handle = h.instagram ? String(h.instagram).replace(/^@/, "").trim() : null;
      const pitch = buildBadgePitch({ name, score, slug: h.slug, city, description: r.description }, { totalTxt, base });
      // Variant experiment (pre-registered 2026-07-07): queued emails get v2/v3 by hotel-id hash.
      const variant = variantFor(r.hotel_id);
      const vp = buildVariantPitch(variant, { name, score, slug: h.slug, city, description: r.description }, { base });
      const hotelId = String(r.hotel_id);
      if (email) emails.push({ hotelId, name, city, score, email, variant, gmailUrl: gmailComposeUrl(email, vp.subject, vp.body) });
      else if (handle) instagram.push({ hotelId, name, city, score, handle, igUrl: instagramDmUrl(handle), pitch });
    }
    return {
      emails: emails.slice(0, DAILY.emails),
      instagram: instagram.slice(0, DAILY.instagram),
      reddit,
      totalEmailQueued: emails.length,
      totalIgQueued: instagram.length,
    };
  } catch {
    return empty;
  }
}

// A head-count that never throws (missing table / RLS → 0) so one bad count can't blank the shell.
export function mkCount(db: DB) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return async (table: string, mod?: (q: any) => any): Promise<number> => {
    try {
      let q: unknown = db.from(table).select("*", { count: "exact", head: true });
      if (mod) q = mod(q);
      const { count } = await (q as Promise<{ count: number | null }>);
      return count ?? 0;
    } catch {
      return 0;
    }
  };
}

// Pending-work counts that drive the nav rail badges + the Today board cards.
// `badges` is an approximation: (hotels scored ≥7) − (hotels already worked) — it does NOT dedupe
// by name or filter to contactable hotels the way /growth/badges does, so it slightly over-counts.
export async function getBoardCounts(db: DB) {
  const c = mkCount(db);
  const [pr, hi, worked, reddit, schedule] = await Promise.all([
    c("outreach", (q) => q.eq("status", "queued")),
    c("cosy_scores", (q) => q.gte("score", 7)),
    c("hotel_outreach", (q) => q.neq("status", "queued")),
    c("reddit_leads", (q) => q.eq("status", "new")),
    // The Blog board renders ALL code-defined posts (getScheduleForPanel); untouched posts default
    // to "draft" with no blog_schedule row, so a table-only count under-reports drafts. Count the
    // same set the board shows: everything not yet live (draft + scheduled).
    getScheduleForPanel().catch(() => []),
  ]);
  const blog = schedule.filter((s) => s.status !== "live").length;
  return { pr, badges: Math.max(0, hi - worked), reddit, blog };
}

export type Funnel = {
  pageviews: number;
  visitors: number;
  clicks: number;
  ctr: number;
  bySource: Array<{ source: string; visitors: number; views: number; clicks: number; ctr: number }>;
};

// In-app funnel from first-party events (last 30 days). Ported 1:1 from the old monolith.
export async function getFunnel(db: DB): Promise<{ funnel: Funnel | null; funnelError: boolean }> {
  type Ev = { type: string; source: string | null; visitor: string | null };
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
    const funnel: Funnel = {
      pageviews: pv.length,
      visitors: new Set(pv.map((r) => r.visitor).filter(Boolean)).size,
      clicks: ck.length,
      ctr: pv.length ? Math.round((100 * ck.length) / pv.length) : 0,
      bySource,
    };
    return { funnel, funnelError: false };
  } catch {
    return { funnel: null, funnelError: true };
  }
}

// Google Search Console summary (last 28 days) + whether it's wired.
export async function getGsc() {
  const gsc = await getGscSummary().catch(() => null);
  return { gsc, gscOn: gscConfigured() };
}

// Content-inventory head counts (unchanged queries from the old page).
export async function getInventory(db: DB) {
  const c = mkCount(db);
  const [cities, scored, featured, vettedPhotos, rejectedPhotos, uncheckedPhotos, withInstagram, transliterated] = await Promise.all([
    c("populate_state", (q) => q.eq("status", "done")),
    c("cosy_scores"),
    c("cosy_scores", (q) => q.gte("score", 5)),
    c("hotel_images", (q) => q.eq("vision_ok", true)),
    c("hotel_images", (q) => q.eq("vision_ok", false)),
    c("hotel_images", (q) => q.is("vision_checked_at", null).not("url", "like", "%placehold.co%")),
    c("hotels", (q) => q.not("instagram", "is", null)),
    c("hotels", (q) => q.not("name_en", "is", null)),
  ]);
  return { cities, scored, featured, vettedPhotos, rejectedPhotos, uncheckedPhotos, withInstagram, transliterated };
}

// The four headline numbers on the Today strip.
export async function getTodayStats(db: DB) {
  const c = mkCount(db);
  const [{ funnel }, { gsc }, liveHotels, scheduledPosts] = await Promise.all([
    getFunnel(db),
    getGsc(),
    c("cosy_scores", (q) => q.gte("score", 5)),
    c("blog_schedule", (q) => q.eq("status", "scheduled")),
  ]);
  return {
    visitors: funnel?.visitors ?? 0,
    impressions: gsc ? Math.round(gsc.totals.impressions) : null,
    liveHotels,
    scheduledPosts,
  };
}

// Where the growth build stands (static). status: done | ready (can start now) | blocked (needs Per).
export const ROADMAP: Array<{ wp: string; label: string; status: "done" | "ready" | "blocked"; note?: string }> = [
  { wp: "WP1–4", label: "SEO foundation — split sitemaps, internal links, theme/country hubs, thin-page noindex", status: "done" },
  { wp: "WP5", label: "Reddit lead finder · badge-outreach engine · Today action queue", status: "done" },
  { wp: "WP6", label: "Search Console KPI panel", status: "done" },
  { wp: "WP8", label: "Competitor backlinks — 16 pitchable targets added to the PR list", status: "done" },
  { wp: "WP5", label: "Real Gmail drafts from per@gotcosy.com (the outreach draft buttons)", status: "done" },
  { wp: "WP6", label: "Daily 08:30 + Friday calendar reminders → open /growth Today", status: "ready", note: "Not blocked — say go and pick calendar events vs phone push." },
  { wp: "WP7", label: "Blog audit + rewrite + 40-listicle drip", status: "ready", note: "Audit-first — you read everything before it publishes." },
];

// Palette-only status chips (tinted via color-mix of brand vars — theme-aware, no raw hex).
export const roadmapChip: Record<string, { bg: string; fg: string; label: string }> = {
  done: { bg: "color-mix(in srgb, var(--sage) 16%, var(--card))", fg: "var(--sage)", label: "done" },
  ready: { bg: "color-mix(in srgb, var(--ember) 16%, var(--card))", fg: "var(--ember-ink)", label: "ready" },
  blocked: { bg: "color-mix(in srgb, var(--gold) 18%, var(--card))", fg: "var(--gold)", label: "needs you" },
};

// External analytics — the numbers that live off-site (used by the rail + the reporting page).
export const EXTERNAL_LINKS: Array<{ href: string; label: string; watch: string }> = [
  { href: "https://vercel.com/perwinroths-projects/cosyhotels/analytics", label: "Vercel Analytics", watch: "Traffic by page & source. Watch which cities get visits." },
  { href: "https://app.stay22.com", label: "Stay22 dashboard", watch: "Affiliate clicks & bookings — the revenue metric. Per city." },
  { href: "https://www.pinterest.com/business/hub/", label: "Pinterest analytics", watch: "Impressions & outbound clicks (pin → site). The traffic metric." },
  { href: "https://business.instagram.com", label: "Instagram insights", watch: "Reach, saves, profile visits, follower growth." },
  { href: "https://search.google.com/search-console", label: "Search Console", watch: "Impressions/clicks for 'cosy hotels {city}'. The SEO signal." },
];

// A rounded-2xl stat tile (brand card). Big number in Fraunces.
export function Stat({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 16, padding: 16, boxShadow: "var(--shadow)" }}>
      <div className="font-display" style={{ fontSize: 28, fontWeight: 600, color: "var(--foreground)", lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: "var(--muted)", opacity: 0.8, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

// A reporting section heading (Fraunces) + anchor id + a one-line "how to read it" note.
export function SectionHead({ id, title, aside, how }: { id: string; title: string; aside?: string; how?: ReactNode }) {
  return (
    <>
      <h2 id={id} className="font-display" style={{ fontSize: 18, fontWeight: 600, marginTop: 34, scrollMarginTop: 24, color: "var(--foreground)" }}>
        {title}
        {aside ? <span style={{ color: "var(--muted)", fontWeight: 400, fontSize: 13, fontFamily: "Inter, sans-serif" }}> · {aside}</span> : null}
      </h2>
      {how ? <p style={{ color: "var(--ember-ink)", fontSize: 12.5, marginTop: 5, marginBottom: 0, lineHeight: 1.5 }}>{how}</p> : null}
    </>
  );
}
