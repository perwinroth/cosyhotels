"use client";
// Phone-friendly status picker for the /growth outreach pipeline. Writes straight to Supabase via
// /api/admin/outreach (gated by the panel login cookie). Optimistic; shows a brief save state.
import { useState } from "react";

const STATUSES = ["queued", "contacted", "replied", "won", "declined"];
const COLOR: Record<string, string> = { queued: "#9DA89F", contacted: "#D8B25A", replied: "#7FB7A2", won: "#7FB7A2", declined: "#b07a4a" };

export default function OutreachStatus({ id, status: initial }: { id: string; status: string }) {
  const [status, setStatus] = useState(initial || "queued");
  const [state, setState] = useState<"idle" | "saving" | "err">("idle");
  async function change(e: React.ChangeEvent<HTMLSelectElement>) {
    const s = e.target.value;
    setStatus(s);
    setState("saving");
    try {
      const r = await fetch("/api/admin/outreach", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, status: s }) });
      setState(r.ok ? "idle" : "err");
    } catch { setState("err"); }
  }
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
      <select value={status} onChange={change} disabled={state === "saving"}
        style={{ background: "#0f1512", color: COLOR[status] || "#f3eee6", border: "1px solid #243029", borderRadius: 6, padding: "3px 7px", fontSize: 12, fontWeight: 600 }}>
        {STATUSES.map((s) => <option key={s} value={s} style={{ color: "#f3eee6" }}>{s}</option>)}
      </select>
      {state === "saving" && <span style={{ fontSize: 11, color: "#6f7a72" }}>…</span>}
      {state === "err" && <span style={{ fontSize: 11, color: "#E0654B" }}>!</span>}
    </span>
  );
}
