"use client";
// Badge-outreach board (top ~2.3% hotels). Wraps <Kanban> with the hotel-outreach move path
// (POST /api/admin/hotel-outreach { hotel_id, status, channel } — upserts, sets contacted_at). Each
// card carries the hotel's Cosy Score badge (via cosyBadgeColor) and a channel-aware pitch action:
// email → open in Gmail (pre-filled), else Instagram → copy pitch + open the DM thread, else copy.
import { useState, type CSSProperties } from "react";
import Kanban, { type KanbanCard, type KanbanColumn } from "./Kanban";
import { cosyBadgeColor } from "@/lib/cosyColor";

export type BadgeBoardRow = {
  hotelId: string; name: string; city: string; score: number;
  channel: string; status: string; hotelHref: string; pitch: string;
  // Contact channels. The hotels table has no email column today, so `email` is null in practice —
  // the Gmail branch is future-proofing for when/if an address exists. Instagram/website do exist.
  email?: string | null; instagram?: string | null;
};

const COLUMNS: KanbanColumn[] = [
  { id: "queued", title: "Queued", hint: "Top-tier hotels waiting to be pitched.", advanceLabel: "Mark contacted" },
  { id: "contacted", title: "Contacted", hint: "Pitched — awaiting a reply.", advanceLabel: "Mark replied" },
  { id: "replied", title: "Replied", hint: "They responded — move here.", advanceLabel: "Mark won" },
  { id: "won", title: "Won", hint: "Badge embedded — backlink earned." },
  { id: "declined", title: "Declined", hint: "Not interested.", discard: true },
];

// Shared button styling — matches the original copy-pitch button (tokens only: --sage / #fff).
const BTN: CSSProperties = { border: "none", background: "var(--sage)", color: "#fff", borderRadius: 7, padding: "5px 11px", fontSize: 12, fontWeight: 700, cursor: "pointer", textDecoration: "none", display: "inline-block", lineHeight: 1.4 };

// Gmail compose deep link — opens the gotcosy@gmail.com account with a pre-filled, editable draft
// (nothing is auto-sent). Mirrors the builder in lib/outreachTemplates.ts, but inlined here because
// the badge pitch is a custom per-hotel body, not one of the PR `fit` templates that helper hardcodes.
const GMAIL_ACCOUNT = "gotcosy@gmail.com";
const BADGE_SUBJECT = "You made the Cosy Index — here's your badge";
function gmailUrl(to: string, subject: string, body: string): string {
  const p = new URLSearchParams({ view: "cm", fs: "1", to, su: subject, body });
  return `https://mail.google.com/mail/u/${GMAIL_ACCOUNT}/?` + p.toString();
}

function CopyPitch({ pitch }: { pitch: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try { await navigator.clipboard.writeText(pitch); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch { /* ignore */ }
  }
  return (
    <button onClick={copy} style={BTN}>
      {copied ? "✓ Copied" : "Copy pitch"}
    </button>
  );
}

function InstagramPitch({ pitch, handle }: { pitch: string; handle: string }) {
  const [copied, setCopied] = useState(false);
  // Instagram DMs CANNOT be URL-prefilled (hard platform limit) — so we copy the pitch to the
  // clipboard on click, then let the anchor open the DM thread natively (an <a> avoids the popup
  // blocking that a post-await window.open() can trigger). Per pastes the copied pitch into the DM.
  const h = handle.replace(/^@/, "").trim();
  const url = /^[A-Za-z0-9._]+$/.test(h) ? `https://ig.me/m/${h}` : `https://instagram.com/${encodeURIComponent(h)}`;
  async function copy() {
    try { await navigator.clipboard.writeText(pitch); setCopied(true); setTimeout(() => setCopied(false), 2400); } catch { /* ignore */ }
  }
  return (
    <a href={url} target="_blank" rel="noreferrer" onClick={copy} style={BTN}>
      {copied ? "✓ Pitch copied — paste in DM" : "Open Instagram"}
    </a>
  );
}

export default function BadgeBoard({ rows, channelById }: { rows: BadgeBoardRow[]; channelById: Record<string, string> }) {
  async function onMove(hotelId: string, status: string) {
    const r = await fetch("/api/admin/hotel-outreach", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ hotel_id: hotelId, status, channel: channelById[hotelId] }) });
    return r.ok;
  }

  const cards: KanbanCard[] = rows.map((h) => {
    // Channel-aware primary action: email → Gmail (pre-filled), else Instagram → copy + open DM,
    // else fall back to the plain copy-pitch button (website-only or no channel).
    const action = h.email
      ? <a href={gmailUrl(h.email, BADGE_SUBJECT, h.pitch)} target="_blank" rel="noreferrer" style={BTN}>Open in Gmail</a>
      : h.instagram
      ? <InstagramPitch pitch={h.pitch} handle={h.instagram} />
      : <CopyPitch pitch={h.pitch} />;
    const body = (
      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
        <span style={{ flex: "none", width: 40, height: 40, borderRadius: 8, background: cosyBadgeColor(h.score), color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Fraunces, serif", fontSize: 15, fontWeight: 700 }}>{h.score.toFixed(1)}</span>
        {action}
      </div>
    );
    return {
      id: h.hotelId, status: h.status || "queued", title: h.name, href: h.hotelHref,
      subtitle: [h.city, h.channel].filter(Boolean).join(" · ") || undefined,
      body, sortKey: -h.score, // best scores first
    };
  });

  return <Kanban columns={COLUMNS} cards={cards} onMove={onMove} />;
}
