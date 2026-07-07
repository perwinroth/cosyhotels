"use client";
// The /growth "Today" daily plan, interactive: each item has a tickbox that records the kanban move
// straight from here — email/IG → "contacted" (POST /api/admin/hotel-outreach), Reddit → "replied"
// (POST /api/admin/reddit-status). Ticked rows grey out; on next load they've left the plan (the page
// is force-dynamic and the queries exclude non-queued / non-new). Optimistic: tick, POST, grey.
import { useState, type CSSProperties } from "react";
import { cosyBadgeColor } from "@/lib/cosyColor";
import CopyButton from "./CopyButton";

export type PlanEmail = { hotelId: string; name: string; city: string; score: number; email: string; gmailUrl: string };
export type PlanInstagram = { hotelId: string; name: string; city: string; score: number; handle: string; igUrl: string; pitch: string };
export type PlanReddit = { id: string; subreddit: string | null; title: string | null; url: string; city: string | null };

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

export default function TodayPlan({ emails, instagram, reddit, totalEmailQueued }: { emails: PlanEmail[]; instagram: PlanInstagram[]; reddit: PlanReddit[]; totalEmailQueued: number }) {
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<Record<string, boolean>>({});

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

  const countDone = (keys: string[]) => keys.filter((k) => done[k]).length;
  const sub = { fontWeight: 400, color: "var(--muted)" } as const;

  return (
    <>
      {emails.length > 0 && (
        <>
          <div style={planHead}>
            📧 Email — send these {emails.length}
            <span style={sub}> · {countDone(emails.map((e) => e.hotelId))}/{emails.length} done{totalEmailQueued > emails.length ? `, ${totalEmailQueued - emails.length} more queued` : ""}</span>
          </div>
          <p style={{ ...metaStyle, margin: "0 0 8px" }}>Open Gmail (pitch pre-filled) → send → tick it. The tick moves the card to Contacted.</p>
          <div style={{ display: "grid", gap: 6 }}>
            {emails.map((e) => {
              const d = !!done[e.hotelId];
              return (
                <div key={e.hotelId} style={{ ...CARD, opacity: d ? 0.5 : 1 }}>
                  <span style={scoreBadge(e.score)}>{e.score.toFixed(1)}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ ...nameStyle, textDecoration: d ? "line-through" : "none" }}>{e.name}</div>
                    <div style={metaStyle}>{e.city}</div>
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
            📸 Instagram — DM these {instagram.length}
            <span style={sub}> · {countDone(instagram.map((i) => i.hotelId))}/{instagram.length} done</span>
          </div>
          <p style={{ ...metaStyle, margin: "0 0 8px" }}>Copy the pitch → open the DM → paste & send → tick it (moves to Contacted).</p>
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

      {reddit.length > 0 && (
        <>
          <div style={planHead}>
            💬 Reddit — reply to these {reddit.length}
            <span style={sub}> · {countDone(reddit.map((r) => r.id))}/{reddit.length} done</span>
          </div>
          <p style={{ ...metaStyle, margin: "0 0 8px" }}>Reply like a human (2–3 specific hotels + one link, never a bare link) → tick it (moves to Replied).</p>
          <div style={{ display: "grid", gap: 6 }}>
            {reddit.map((r) => {
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
