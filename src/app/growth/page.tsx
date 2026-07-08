// /growth "Today" — the at-a-glance overview: one card per action board (with its live pending
// count) plus a compact strip of the four numbers worth watching. The detail lives in each board;
// this page only answers "what needs doing, and is the site growing?". No meta-refresh (it caused
// scroll jumps); the data is force-dynamic so every visit is fresh.
import Link from "next/link";
import { getServerSupabase } from "@/lib/supabase/server";
import { getBoardCounts, getTodayStats, getTodayPlan, Stat } from "./lib";
import { LISTING_TARGETS } from "@/data/listingTargets";
import TodayPlan from "@/components/growth/TodayPlan";

export const dynamic = "force-dynamic";

type Board = { href: string; title: string; count: number; blurb: string };

function BoardCard({ b }: { b: Board }) {
  const pending = b.count > 0;
  return (
    <Link
      href={b.href}
      className="growth-navlink hov"
      style={{
        display: "block",
        background: "var(--card)",
        border: "1px solid var(--line)",
        borderRadius: 16,
        padding: 18,
        textDecoration: "none",
        boxShadow: "var(--shadow)",
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: "var(--foreground)" }}>{b.title}</span>
        <span style={{ fontSize: 11.5, color: pending ? "var(--sage)" : "var(--muted)", fontWeight: 600 }}>
          {pending ? "to do →" : "clear"}
        </span>
      </div>
      <div className="font-display" style={{ fontSize: 40, fontWeight: 600, lineHeight: 1.05, marginTop: 8, color: pending ? "var(--foreground)" : "var(--muted)" }}>
        {b.count}
      </div>
      <p style={{ color: "var(--muted)", fontSize: 12.5, marginTop: 6, marginBottom: 0, lineHeight: 1.45 }}>{b.blurb}</p>
    </Link>
  );
}

export default async function GrowthTodayPage() {
  const db = getServerSupabase();
  if (!db) return <p style={{ color: "var(--muted)" }}>Supabase not configured.</p>;

  const [counts, stats, plan] = await Promise.all([getBoardCounts(db), getTodayStats(db), getTodayPlan(db)]);
  const planTotal = plan.emails.length + plan.instagram.length + plan.reddit.length;

  // Listing targets live in code; only their statuses are in the DB (table may not exist yet).
  let listingsDone = 0;
  try {
    const { data } = await db.from("listing_status").select("status").in("status", ["submitted", "live", "skip"]);
    listingsDone = data?.length ?? 0;
  } catch { /* table not created yet */ }
  const listingsCount = Math.max(0, LISTING_TARGETS.length - listingsDone);

  const boards: Board[] = [
    { href: "/growth/pr", title: "PR outreach", count: counts.pr, blurb: "Queued targets to pitch: draft, send, mark done." },
    { href: "/growth/badges", title: "Badge outreach", count: counts.badges, blurb: "Top-2.3% hotels to pitch their “Rated Cosy” badge (approx.)." },
    { href: "/growth/reddit", title: "Reddit", count: counts.reddit, blurb: "New threads asking for cosy hotels; reply like a human." },
    { href: "/growth/blog", title: "Blog", count: counts.blog, blurb: "Drafts + scheduled posts to review before they publish." },
    { href: "/growth/listings", title: "Listings & directories", count: listingsCount, blurb: "Entity profiles + directory submissions; copy kit included, chip away." },
  ];

  return (
    <div>
      <h1 className="font-display" style={{ fontSize: 24, fontWeight: 600, margin: 0, color: "var(--foreground)" }}>Today</h1>
      <p style={{ color: "var(--muted)", marginTop: 6, fontSize: 13.5 }}>
        {planTotal === 0
          ? "Nothing to do right now; all queues are clear."
          : "Your exact plan for today: work it top to bottom, then stop. No decisions needed."}
      </p>

      {/* ───────── Today's plan: the concrete daily to-do, tick each off ───────── */}
      <TodayPlan emails={plan.emails} instagram={plan.instagram} reddit={plan.reddit} totalEmailQueued={plan.totalEmailQueued} sentToday={plan.sentToday} />

      {/* ───────── Boards (navigation / full pipeline) ───────── */}
      <h2 className="font-display" style={{ fontSize: 15, fontWeight: 600, marginTop: 30, color: "var(--foreground)" }}>Boards</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2" style={{ marginTop: 12 }}>
        {boards.map((b) => <BoardCard key={b.href} b={b} />)}
      </div>

      <h2 className="font-display" style={{ fontSize: 15, fontWeight: 600, marginTop: 30, color: "var(--foreground)" }}>
        Signals <span style={{ color: "var(--muted)", fontWeight: 400, fontSize: 13, fontFamily: "Inter, sans-serif" }}>· full breakdown in Reporting</span>
      </h2>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4" style={{ marginTop: 12 }}>
        <Stat label="Visitors" value={stats.visitors.toLocaleString()} sub="last 30 days" />
        <Stat label="GSC impressions" value={stats.impressions === null ? "–" : stats.impressions.toLocaleString()} sub="last 28 days" />
        <Stat label="Live hotels" value={stats.liveHotels.toLocaleString()} sub="score ≥ 5, public" />
        <Stat label="Scheduled posts" value={stats.scheduledPosts.toLocaleString()} sub="auto-publish queued" />
      </div>
    </div>
  );
}
