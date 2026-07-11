"use client";
// The /growth "Today" daily plan, interactive: each item has a tickbox that records the kanban move
// straight from here — email/IG → "contacted" (POST /api/admin/hotel-outreach), Reddit lead → "replied"
// (POST /api/admin/reddit-status), Reddit planned answer → done marker in localStorage (no DB row for
// these — they come from src/data/redditAnswerPlan.ts, not reddit_leads). Ticked rows grey out; on
// next load they've left the plan (force-dynamic + the queries exclude non-queued / non-new).
// Optimistic: tick, POST (or localStorage write), grey.
import { useEffect, useState, type CSSProperties } from "react";
import { cosyBadgeColor } from "@/lib/cosyColor";
import CopyButton from "./CopyButton";

export type PlanEmail = { hotelId: string; name: string; city: string; score: number; email: string; gmailUrl: string; variant?: string };
export type PlanInstagram = { hotelId: string; name: string; city: string; score: number; handle: string; igUrl: string; pitch: string };
export type PlanReddit = {
  id: string; subreddit: string | null; title: string | null; url: string; city: string | null;
  answer?: string; worthiness?: number; source?: "planned" | "lead";
};

const REDDIT_DONE_KEY = "reddit-plan-done";

const CARD: CSSProperties = { display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", background: "var(--card)", border: "1px solid var(--line)", borderRadius: 12 };
const scoreBadge = (score: number): CSSProperties => ({ flex: "none", width: 34, height: 34, borderRadius: 8, background: cosyBadgeColor(score), color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Fraunces, serif", fontSize: 13.5, fontWeight: 700 });
const EMBER_BTN: CSSProperties = { flex: "none", background: "var(--ember)", color: "#16201C", borderRadius: 8, padding: "7px 12px", fontSize: 12.5, fontWeight: 700, textDecoration: "none", whiteSpace: "nowrap" };
const SAGE_BTN: CSSProperties = { flex: "none", background: "var(--sage)", color: "#fff", borderRadius: 8, padding: "7px 12px", fontSize: 12.5, fontWeight: 700, textDecoration: "none", whiteSpace: "nowrap" };
const nameStyle: CSSProperties = { fontSize: 13.5, fontWeight: 600, color: "var(--foreground)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };
const metaStyle: CSSProperties = { fontSize: 12, color: "var(--muted)" };
const planHead: CSSProperties = { fontSize: 13.5, fontWeight: 700, color: "var(--foreground)", margin: "18px 0 8px" };

function Tick({ done, busy, onTick }: { done: boolean; busy: boolean; onTick: () => void }) {
  return (
    <button
      type="button"
      onClick={onTick}
      disabled={busy || done}
      title={done ? "Done" : "Mark done"}
      aria-label={done ? "Done" : "Mark done"}
      style={{ flex: "none", width: 30, height: 30, borderRadius: 8, border: `1.5px solid ${done ? "var(--sage)" : "var(--line)"}`, background: done ? "var(--sage)" : "var(--card)", color: "#fff", cursor: done ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 800, lineHeight: 1 }}
    >
      {done ? "✓" : busy ? "·" : ""}
    </button>
  );
}

export default function TodayPlan({ emails, instagram, reddit, totalEmailQueued, sentToday, igNote }: { emails: PlanEmail[]; instagram: PlanInstagram[]; reddit: PlanReddit[]; totalEmailQueued: number; sentToday: { count: number }; igNote?: string }) {
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<Record<string, boolean>>({});

  // Planned reddit-answer "done" state lives only in localStorage — these threads have no
  // reddit_leads row to PATCH, so there's nothing server-side to move.
  const [redditDone, setRedditDone] = useState<Record<string, boolean>>({});
  useEffect(() => {
    try {
      const raw = localStorage.getItem(REDDIT_DONE_KEY);
      if (raw) setRedditDone(JSON.parse(raw));
    } catch { /* localStorage unavailable — plan just always shows as pending */ }
  }, []);
  function markRedditPlanDone(id: string) {
    setRedditDone((d) => {
      const next = { ...d, [id]: true };
      try { localStorage.setItem(REDDIT_DONE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }

  async function move(key: string, url: string, body: unknown) {
    if (done[key] || busy[key]) return;
    setBusy((b) => ({ ...b, [key]: true }));
    try {
      const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      if (r.ok) setDone((d) => ({ ...d, [key]: true }));
    } catch { /* leave un-ticked so Per can retry */ }
    setBusy((b) => ({ ...b, [key]: false }));
  }
  const tickHotel = (hotelId: string, channel: string) => move(hotelId, "/api/admin/hotel-outreach", { hotel_id: hotelId, status: "contacted", channel });
  const tickReddit = (id: string) => move(id, "/api/admin/reddit-status", { id, status: "replied" });
  // Bulk "mark all sent" for the day's emails — ticks every un-done one at once.
  const markAllEmails = () => Promise.all(emails.filter((e) => !done[e.hotelId] && !busy[e.hotelId]).map((e) => tickHotel(e.hotelId, "email")));
  const allEmailsDone = emails.length > 0 && emails.every((e) => done[e.hotelId]);

  // Today-reddit ordering: planned answers (worthiness >= 4, from redditAnswerPlan.ts) first, while
  // any remain un-done; once every planned answer is ticked done, fall back to the newest reddit_leads.
  const plannedReddit = reddit.filter((r) => r.source === "planned");
  const leadReddit = reddit.filter((r) => r.source !== "planned");
  const plannedPending = plannedReddit.filter((r) => !redditDone[r.id]);
  const redditToShow: PlanReddit[] = plannedPending.length > 0 ? plannedPending : leadReddit;

  const countDone = (keys: string[]) => keys.filter((k) => done[k]).length;
  const sub = { fontWeight: 400, color: "var(--muted)" } as const;

  return (
    <>
      {(emails.length > 0 || sentToday.count > 0) && (
        <>
          <div style={{ ...planHead, display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <span>
              {emails.length > 0 ? <>📧 Email: send these {emails.length}</> : <>📧 Email</>}
              {/* Server-derived sent-today acknowledgment: survives navigation/reload, unlike the
                  in-memory tick state. The queue refills after every tick, so without this the
                  founder's sent emails look like they vanished. */}
              {sentToday.count > 0 && (
                <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 700, color: "var(--sage)", border: "1px solid var(--line)", borderRadius: 999, padding: "1px 8px" }}>
                  {sentToday.count} sent today ✓
                </span>
              )}
              {emails.length > 0 && (
                <span style={sub}> · {countDone(emails.map((e) => e.hotelId))}/{emails.length} done{totalEmailQueued > emails.length ? `, ${totalEmailQueued - emails.length} more queued` : ""}</span>
              )}
            </span>
            {emails.length > 0 && (
              <button
                type="button"
                onClick={markAllEmails}
                disabled={allEmailsDone}
                style={{ flex: "none", border: "1px solid var(--line)", background: allEmailsDone ? "var(--sage)" : "var(--card)", color: allEmailsDone ? "#fff" : "var(--foreground)", borderRadius: 8, padding: "5px 12px", fontSize: 12, fontWeight: 700, cursor: allEmailsDone ? "default" : "pointer" }}
              >
                {allEmailsDone ? "✓ All marked" : "Mark all sent"}
              </button>
            )}
          </div>
          {emails.length > 0 && (
            <p style={{ ...metaStyle, margin: "0 0 8px" }}>Open Gmail (pitch pre-filled) → send → tick it. Or “Mark all sent” once you’ve blasted through them. Ticks move the cards to Contacted.</p>
          )}
          {sentToday.count > 0 && emails.length > 0 && (
            <p style={{ ...metaStyle, margin: "0 0 8px" }}>These are the next {emails.length} in the queue, not the ones you already sent.</p>
          )}
          {sentToday.count > 0 && emails.length === 0 && (
            <p style={{ ...metaStyle, margin: "0 0 8px" }}>Nothing more queued right now; today&apos;s sends are safely recorded.</p>
          )}
          <div style={{ display: "grid", gap: 6 }}>
            {emails.map((e) => {
              const d = !!done[e.hotelId];
              return (
                <div key={e.hotelId} style={{ ...CARD, opacity: d ? 0.5 : 1 }}>
                  <span style={scoreBadge(e.score)}>{e.score.toFixed(1)}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ ...nameStyle, textDecoration: d ? "line-through" : "none" }}>{e.name}</div>
                    <div style={metaStyle}>
                      {e.city}
                      {e.variant && <span style={{ marginLeft: 6, fontSize: 10.5, fontWeight: 700, color: "var(--muted)", border: "1px solid var(--line)", borderRadius: 999, padding: "0 6px" }}>{e.variant}</span>}
                    </div>
                  </div>
                  <a href={e.gmailUrl} target="_blank" rel="noreferrer" className="hov" style={EMBER_BTN}>Email ↗</a>
                  <Tick done={d} busy={!!busy[e.hotelId]} onTick={() => tickHotel(e.hotelId, "email")} />
                </div>
              );
            })}
          </div>
        </>
      )}

      {instagram.length > 0 && (
        <>
          <div style={planHead}>
            📸 Instagram: DM these {instagram.length}
            <span style={sub}> · {countDone(instagram.map((i) => i.hotelId))}/{instagram.length} done</span>
          </div>
          <p style={{ ...metaStyle, margin: "0 0 8px" }}>Copy the pitch → open the DM → paste & send → tick it (moves to Contacted).</p>
          {igNote && <p style={{ ...metaStyle, margin: "0 0 8px", color: "var(--ember-ink)", fontWeight: 600 }}>{igNote}</p>}
          <div style={{ display: "grid", gap: 6 }}>
            {instagram.map((i) => {
              const d = !!done[i.hotelId];
              return (
                <div key={i.hotelId} style={{ ...CARD, opacity: d ? 0.5 : 1 }}>
                  <span style={scoreBadge(i.score)}>{i.score.toFixed(1)}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ ...nameStyle, textDecoration: d ? "line-through" : "none" }}>{i.name}</div>
                    <div style={metaStyle}>@{i.handle} · {i.city}</div>
                  </div>
                  <CopyButton text={i.pitch} />
                  <a href={i.igUrl} target="_blank" rel="noreferrer" className="hov" style={SAGE_BTN}>IG ↗</a>
                  <Tick done={d} busy={!!busy[i.hotelId]} onTick={() => tickHotel(i.hotelId, "instagram")} />
                </div>
              );
            })}
          </div>
        </>
      )}

      {redditToShow.length > 0 && (
        <>
          <div style={planHead}>
            💬 Reddit: reply to these {redditToShow.length}
            <span style={sub}>
              {plannedReddit.length > 0
                ? ` · ${plannedReddit.length - plannedPending.length}/${plannedReddit.length} planned answers done`
                : ` · ${countDone(redditToShow.map((r) => r.id))}/${redditToShow.length} done`}
            </span>
          </div>
          <p style={{ ...metaStyle, margin: "0 0 8px" }}>
            {plannedPending.length > 0
              ? "Founder-reviewed answers, ready to post: skim the thread first for anything new, copy the answer, post it from your own Reddit account → tick done."
              : "Reply like a human (2–3 specific hotels + one link, never a bare link) → tick it (moves to Replied)."}
          </p>
          <div style={{ display: "grid", gap: 6 }}>
            {redditToShow.map((r) => {
              if (r.source === "planned") {
                const rd = !!redditDone[r.id];
                return (
                  <div key={r.id} style={{ ...CARD, flexDirection: "column", alignItems: "stretch", gap: 6, opacity: rd ? 0.5 : 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ ...nameStyle, textDecoration: rd ? "line-through" : "none" }}>{r.title || r.url}</div>
                        <div style={metaStyle}>
                          {r.subreddit ? `r/${r.subreddit}` : null}{r.city ? ` · ${r.city}` : ""}{r.worthiness ? ` · worthiness ${r.worthiness}/5` : ""}
                        </div>
                      </div>
                      <Tick done={rd} busy={false} onTick={() => markRedditPlanDone(r.id)} />
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      <CopyButton text={r.answer || ""} label="Copy answer" />
                      <a href={r.url} target="_blank" rel="noreferrer" className="hov" style={SAGE_BTN}>Open thread ↗</a>
                    </div>
                  </div>
                );
              }
              const d = !!done[r.id];
              return (
                <div key={r.id} style={{ ...CARD, opacity: d ? 0.5 : 1 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ ...nameStyle, textDecoration: d ? "line-through" : "none" }}>{r.title || r.url}</div>
                    <div style={metaStyle}>r/{r.subreddit}{r.city ? ` · ${r.city}` : ""}</div>
                  </div>
                  <a href={r.url} target="_blank" rel="noreferrer" className="hov" style={SAGE_BTN}>Open ↗</a>
                  <Tick done={d} busy={!!busy[r.id]} onTick={() => tickReddit(r.id)} />
                </div>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}
