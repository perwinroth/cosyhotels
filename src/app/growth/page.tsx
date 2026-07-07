// /growth "Today" — the at-a-glance overview: one card per action board (with its live pending
// count) plus a compact strip of the four numbers worth watching. The detail lives in each board;
// this page only answers "what needs doing, and is the site growing?". No meta-refresh (it caused
// scroll jumps); the data is force-dynamic so every visit is fresh.
import Link from "next/link";
import { getServerSupabase } from "@/lib/supabase/server";
import { getBoardCounts, getTodayStats, getTodayPlan, Stat } from "./lib";
import CopyButton from "@/components/growth/CopyButton";
import { cosyBadgeColor } from "@/lib/cosyColor";

export const dynamic = "force-dynamic";

const CARD = { display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", background: "var(--card)", border: "1px solid var(--line)", borderRadius: 12 } as const;
const scoreBadge = (score: number) => ({ flex: "none", width: 34, height: 34, borderRadius: 8, background: cosyBadgeColor(score), color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Fraunces, serif", fontSize: 13.5, fontWeight: 700 } as const);
const EMBER_BTN = { flex: "none", background: "var(--ember)", color: "#16201C", borderRadius: 8, padding: "7px 12px", fontSize: 12.5, fontWeight: 700, textDecoration: "none", whiteSpace: "nowrap" } as const;
const SAGE_BTN = { flex: "none", background: "var(--sage)", color: "#fff", borderRadius: 8, padding: "7px 12px", fontSize: 12.5, fontWeight: 700, textDecoration: "none", whiteSpace: "nowrap" } as const;
const nameStyle = { fontSize: 13.5, fontWeight: 600, color: "var(--foreground)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } as const;
const metaStyle = { fontSize: 12, color: "var(--muted)" } as const;
const planHead = { fontSize: 13.5, fontWeight: 700, color: "var(--foreground)", margin: "18px 0 8px" } as const;

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

  const boards: Board[] = [
    { href: "/growth/pr", title: "PR outreach", count: counts.pr, blurb: "Queued targets to pitch — draft, send, mark done." },
    { href: "/growth/badges", title: "Badge outreach", count: counts.badges, blurb: "Top-2.3% hotels to pitch their “Rated Cosy” badge (approx.)." },
    { href: "/growth/reddit", title: "Reddit", count: counts.reddit, blurb: "New threads asking for cosy hotels — reply like a human." },
    { href: "/growth/blog", title: "Blog", count: counts.blog, blurb: "Drafts + scheduled posts to review before they publish." },
  ];

  return (
    <div>
      <h1 className="font-display" style={{ fontSize: 24, fontWeight: 600, margin: 0, color: "var(--foreground)" }}>Today</h1>
      <p style={{ color: "var(--muted)", marginTop: 6, fontSize: 13.5 }}>
        {planTotal === 0
          ? "Nothing to do right now — all queues are clear."
          : "Your exact plan for today — work it top to bottom, then stop. No decisions needed."}
      </p>

      {/* ───────── Today's plan: the concrete daily to-do ───────── */}
      {plan.emails.length > 0 && (
        <>
          <div style={planHead}>
            📧 Email — send these {plan.emails.length}
            {plan.totalEmailQueued > plan.emails.length && (
              <span style={{ fontWeight: 400, color: "var(--muted)" }}> · {plan.totalEmailQueued - plan.emails.length} more queued for the coming days</span>
            )}
          </div>
          <p style={{ ...metaStyle, margin: "0 0 8px" }}>One click opens Gmail with the personalized pitch pre-filled. Send all {plan.emails.length}, then stop — the pacing keeps you off spam lists.</p>
          <div style={{ display: "grid", gap: 6 }}>
            {plan.emails.map((e) => (
              <div key={e.email} style={CARD}>
                <span style={scoreBadge(e.score)}>{e.score.toFixed(1)}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={nameStyle}>{e.name}</div>
                  <div style={metaStyle}>{e.city}</div>
                </div>
                <a href={e.gmailUrl} target="_blank" rel="noreferrer" className="hov" style={EMBER_BTN}>Email ↗</a>
              </div>
            ))}
          </div>
        </>
      )}

      {plan.instagram.length > 0 && (
        <>
          <div style={planHead}>📸 Instagram — DM these {plan.instagram.length}</div>
          <p style={{ ...metaStyle, margin: "0 0 8px" }}>Tap “Copy pitch”, then “Open Instagram” opens the DM — paste and send.</p>
          <div style={{ display: "grid", gap: 6 }}>
            {plan.instagram.map((i) => (
              <div key={i.handle} style={CARD}>
                <span style={scoreBadge(i.score)}>{i.score.toFixed(1)}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={nameStyle}>{i.name}</div>
                  <div style={metaStyle}>@{i.handle} · {i.city}</div>
                </div>
                <CopyButton text={i.pitch} />
                <a href={i.igUrl} target="_blank" rel="noreferrer" className="hov" style={SAGE_BTN}>Open IG ↗</a>
              </div>
            ))}
          </div>
        </>
      )}

      {plan.reddit.length > 0 && (
        <>
          <div style={planHead}>💬 Reddit — reply to these {plan.reddit.length}</div>
          <p style={{ ...metaStyle, margin: "0 0 8px" }}>Reply like a human — name 2–3 specific cosy hotels + one link, never a bare link. Then mark it replied on the Reddit board.</p>
          <div style={{ display: "grid", gap: 6 }}>
            {plan.reddit.map((r) => (
              <div key={r.id} style={CARD}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={nameStyle}>{r.title}</div>
                  <div style={metaStyle}>r/{r.subreddit}{r.city ? ` · ${r.city}` : ""}</div>
                </div>
                <a href={r.url} target="_blank" rel="noreferrer" className="hov" style={SAGE_BTN}>Open ↗</a>
              </div>
            ))}
          </div>
        </>
      )}

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
        <Stat label="GSC impressions" value={stats.impressions === null ? "—" : stats.impressions.toLocaleString()} sub="last 28 days" />
        <Stat label="Live hotels" value={stats.liveHotels.toLocaleString()} sub="score ≥ 5, public" />
        <Stat label="Scheduled posts" value={stats.scheduledPosts.toLocaleString()} sub="auto-publish queued" />
      </div>
    </div>
  );
}
