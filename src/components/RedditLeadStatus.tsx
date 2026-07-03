"use client";
// Status picker for a Reddit lead in /growth. Writes to /api/admin/reddit-status (panel-cookie
// gated). Optimistic; brief save state. 'dismissed' hides the lead on next load.
import { useState } from "react";

const STATUSES = ["new", "replied", "dismissed"];
const COLOR: Record<string, string> = { new: "#7FB4FF", replied: "#7FB7A2", dismissed: "#6f7a72" };

export default function RedditLeadStatus({ id, status: initial }: { id: string; status: string }) {
  const [status, setStatus] = useState(initial || "new");
  const [state, setState] = useState<"idle" | "saving" | "err">("idle");
  async function change(e: React.ChangeEvent<HTMLSelectElement>) {
    const s = e.target.value;
    setStatus(s);
    setState("saving");
    try {
      const r = await fetch("/api/admin/reddit-status", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, status: s }) });
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
