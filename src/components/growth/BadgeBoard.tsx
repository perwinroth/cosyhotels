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
  subject: string; variant: string;
  // Contact channels. The hotels table has no email column today, so `email` is null in practice —
  // the Gmail branch is future-proofing for when/if an address exists. Instagram/website do exist.
  email?: string | null; instagram?: string | null;
};

const COLUMNS: KanbanColumn[] = [
  { id: "queued", title: "Queued", hint: "Top-tier hotels waiting to be pitched.", advanceLabel: "Mark contacted" },
  { id: "contacted", title: "Contacted", hint: "Pitched; awaiting a reply.", advanceLabel: "Mark replied" },
  { id: "replied", title: "Replied", hint: "They responded; move here.", advanceLabel: "Mark won" },
  { id: "won", title: "Won", hint: "Said yes; badge on the way.", advanceLabel: "Mark confirmed" },
  { id: "won_confirmed", title: "Won confirmed", hint: "Badge embedded; backlink verified live." },
  { id: "declined", title: "Declined", hint: "Not interested.", discard: true },
];

// Shared button styling — matches the original copy-pitch button (tokens only: --sage / #fff).
const BTN: CSSProperties = { border: "none", background: "var(--sage)", color: "#fff", borderRadius: 7, padding: "5px 11px", fontSize: 12, fontWeight: 700, cursor: "pointer", textDecoration: "none", display: "inline-block", lineHeight: 1.4 };

// Primary contact CTA — the site's canonical ember button (var(--ember) bg, #16201C ink, per BRAND.md
// "CTA button"). One click opens a pre-filled Gmail compose so Per can contact a hotel straight from
// the card. Full-width to read as THE action on the card.
const EMAIL_CTA: CSSProperties = { border: "none", background: "var(--ember)", color: "#16201C", borderRadius: 8, padding: "8px 12px", fontSize: 13, fontWeight: 700, cursor: "pointer", textDecoration: "none", display: "block", textAlign: "center", lineHeight: 1.4 };

// Gmail compose deep link — opens the gotcosy@gmail.com account with a pre-filled, editable draft
// (nothing is auto-sent). `authuser` targets the gotcosy inbox; the from-address is that account's
// DEFAULT send-as (Per sets per@gotcosy.com as default once in Gmail settings). Mirrors the builder in
// lib/outreachTemplates.ts, but inlined here because the badge pitch is a custom per-hotel body, not
// one of the PR `fit` templates that helper hardcodes.
const GMAIL_ACCOUNT = "gotcosy@gmail.com";

function gmailUrl(to: string, subject: string, body: string): string {
  const p = new URLSearchParams({ view: "cm", fs: "1", to, su: subject, body });
  // Path-pinned account (u/<email>) — authuser + u/0 contradicted each other and fell back to the
  // browser default account after an error (2026-07-09).
  p.set("authuser", GMAIL_ACCOUNT);
  return `https://mail.google.com/mail/?` + p.toString();
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
      {copied ? "✓ Pitch copied. Paste in DM" : "Open Instagram"}
    </a>
  );
}

export default function BadgeBoard({ rows, channelById }: { rows: BadgeBoardRow[]; channelById: Record<string, string> }) {
  async function onMove(hotelId: string, status: string) {
    const r = await fetch("/api/admin/hotel-outreach", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ hotel_id: hotelId, status, channel: channelById[hotelId] }) });
    return r.ok;
  }

  const cards: KanbanCard[] = rows.map((h) => {
    // Contact straight from the card. With an email → a prominent full-width "Email {hotel}" ember CTA
    // that opens a pre-filled Gmail compose in one click. Without one → the inline sage fallback next to
    // the badge (Instagram → copy + open DM, else plain copy-pitch).
    const badge = (
      <span style={{ flex: "none", width: 40, height: 40, borderRadius: 8, background: cosyBadgeColor(h.score), color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Fraunces, serif", fontSize: 15, fontWeight: 700 }}>{h.score.toFixed(1)}</span>
    );
    const fallback = h.instagram ? <InstagramPitch pitch={h.pitch} handle={h.instagram} /> : <CopyPitch pitch={h.pitch} />;
    const body = h.email ? (
      <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>{badge}</div>
        <a href={gmailUrl(h.email, h.subject, h.pitch)} target="_blank" rel="noreferrer" style={EMAIL_CTA}>Email {h.name} ({h.variant}) ↗</a>
      </div>
    ) : (
      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
        {badge}
        {fallback}
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
