"use client";
// One row of the badge-outreach queue: a top-tier hotel with a copy-paste pitch, its "Rated Cosy"
// badge preview, contact links, and a phone-friendly status picker. Status writes to Supabase via
// /api/admin/hotel-outreach (gated by the panel login cookie). Optimistic; brief save state.
import { useState } from "react";

const STATUSES = ["queued", "contacted", "replied", "won", "declined"];
const COLOR: Record<string, string> = { queued: "#9DA89F", contacted: "#D8B25A", replied: "#7FB7A2", won: "#7FB7A2", declined: "#b07a4a" };

export type BadgeRow = {
  hotelId: string; name: string; city: string; score: number;
  instagram: string | null; website: string | null;
  badgeSrc: string; badgeLink: string; pitch: string; channel: string; status: string;
};

export default function BadgeOutreachRow(p: BadgeRow) {
  const [status, setStatus] = useState(p.status || "queued");
  const [state, setState] = useState<"idle" | "saving" | "err">("idle");
  const [copied, setCopied] = useState(false);

  async function change(e: React.ChangeEvent<HTMLSelectElement>) {
    const s = e.target.value;
    setStatus(s);
    setState("saving");
    try {
      const r = await fetch("/api/admin/hotel-outreach", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ hotel_id: p.hotelId, status: s, channel: p.channel }) });
      setState(r.ok ? "idle" : "err");
    } catch { setState("err"); }
  }
  async function copy() {
    try { await navigator.clipboard.writeText(p.pitch); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch { /* ignore */ }
  }

  return (
    <div style={{ background: "#16201A", border: "1px solid #243029", borderRadius: 12, padding: 16 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
        <span style={{ color: "#D8B25A", fontWeight: 700 }}>{p.score.toFixed(1)}/10</span>
        <span style={{ fontSize: 17, fontWeight: 700 }}>{p.name}</span>
        {p.city && <span style={{ color: "#9DA89F", fontSize: 13 }}>· {p.city}</span>}
        {p.instagram && <a href={`https://instagram.com/${p.instagram.replace(/^@/, "")}`} target="_blank" rel="noreferrer" style={{ color: "#7FB4FF", fontSize: 13 }}>{p.instagram}</a>}
        {p.website && <a href={p.website} target="_blank" rel="noreferrer" style={{ color: "#6f7a72", fontSize: 12 }}>site ↗</a>}
        <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 5 }}>
          <select value={status} onChange={change} disabled={state === "saving"} style={{ background: "#0f1512", color: COLOR[status] || "#f3eee6", border: "1px solid #243029", borderRadius: 6, padding: "3px 7px", fontSize: 12, fontWeight: 600 }}>
            {STATUSES.map((s) => <option key={s} value={s} style={{ color: "#f3eee6" }}>{s}</option>)}
          </select>
          {state === "saving" && <span style={{ fontSize: 11, color: "#6f7a72" }}>…</span>}
          {state === "err" && <span style={{ fontSize: 11, color: "#E0654B" }}>!</span>}
        </span>
      </div>
      <div style={{ display: "flex", gap: 14, marginTop: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={p.badgeSrc} alt={`Rated ${p.score.toFixed(1)}/10 for cosiness by Got Cosy`} width={200} height={77} style={{ flexShrink: 0, borderRadius: 10 }} />
        <div style={{ flex: 1, minWidth: 260 }}>
          <pre style={{ whiteSpace: "pre-wrap", fontFamily: "inherit", fontSize: 13, color: "#C7CFC8", margin: 0, lineHeight: 1.5, background: "#0F1512", borderRadius: 8, padding: 12 }}>{p.pitch}</pre>
          <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button onClick={copy} style={{ border: "1px solid #243029", background: "#7FB7A2", color: "#0F1512", borderRadius: 8, padding: "6px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>{copied ? "✓ Copied" : "Copy pitch"}</button>
            <a href={p.badgeLink} target="_blank" rel="noreferrer" style={{ border: "1px solid #243029", color: "#7FB4FF", borderRadius: 8, padding: "6px 14px", fontSize: 13, fontWeight: 700, textDecoration: "none" }}>Their badge page ↗</a>
          </div>
        </div>
      </div>
    </div>
  );
}
