"use client";
// Badge-outreach board (top ~2.3% hotels). Wraps <Kanban> with the hotel-outreach move path
// (POST /api/admin/hotel-outreach { hotel_id, status, channel } — upserts, sets contacted_at). Each
// card carries the hotel's Cosy Score badge (via cosyBadgeColor) and a copy-pitch button.
import { useState } from "react";
import Kanban, { type KanbanCard, type KanbanColumn } from "./Kanban";
import { cosyBadgeColor } from "@/lib/cosyColor";

export type BadgeBoardRow = {
  hotelId: string; name: string; city: string; score: number;
  channel: string; status: string; hotelHref: string; pitch: string;
};

const COLUMNS: KanbanColumn[] = [
  { id: "queued", title: "Queued", hint: "Top-tier hotels waiting to be pitched.", advanceLabel: "Mark contacted" },
  { id: "contacted", title: "Contacted", hint: "Pitched — awaiting a reply.", advanceLabel: "Mark replied" },
  { id: "replied", title: "Replied", hint: "They responded — move here.", advanceLabel: "Mark won" },
  { id: "won", title: "Won", hint: "Badge embedded — backlink earned." },
  { id: "declined", title: "Declined", hint: "Not interested.", discard: true },
];

function CopyPitch({ pitch }: { pitch: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try { await navigator.clipboard.writeText(pitch); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch { /* ignore */ }
  }
  return (
    <button onClick={copy} style={{ border: "none", background: "var(--sage)", color: "#fff", borderRadius: 7, padding: "5px 11px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
      {copied ? "✓ Copied" : "Copy pitch"}
    </button>
  );
}

export default function BadgeBoard({ rows, channelById }: { rows: BadgeBoardRow[]; channelById: Record<string, string> }) {
  async function onMove(hotelId: string, status: string) {
    const r = await fetch("/api/admin/hotel-outreach", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ hotel_id: hotelId, status, channel: channelById[hotelId] }) });
    return r.ok;
  }

  const cards: KanbanCard[] = rows.map((h) => {
    const body = (
      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
        <span style={{ flex: "none", width: 40, height: 40, borderRadius: 8, background: cosyBadgeColor(h.score), color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Fraunces, serif", fontSize: 15, fontWeight: 700 }}>{h.score.toFixed(1)}</span>
        <CopyPitch pitch={h.pitch} />
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
