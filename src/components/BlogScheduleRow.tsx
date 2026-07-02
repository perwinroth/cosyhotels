"use client";
// Phone-friendly release-schedule control for a journal post on /growth. Writes straight to
// Supabase via /api/admin/blog-schedule (gated by the panel login cookie). status = draft | live |
// scheduled; when scheduled, a date picker sets when it goes public. Optimistic with a save state.
import { useState } from "react";

const STATUSES = ["draft", "scheduled", "live"] as const;
const COLOR: Record<string, string> = { draft: "#9DA89F", scheduled: "#D8B25A", live: "#7FB7A2" };

function toDateInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

export default function BlogScheduleRow({ slug, status: initStatus, publishAt }: { slug: string; status: string; publishAt: string | null }) {
  const [status, setStatus] = useState(initStatus || "draft");
  const [date, setDate] = useState(toDateInput(publishAt));
  const [state, setState] = useState<"idle" | "saving" | "err">("idle");

  async function save(nextStatus: string, nextDate: string) {
    setState("saving");
    const publish_at = nextStatus === "scheduled" && nextDate ? new Date(`${nextDate}T00:00:00.000Z`).toISOString() : null;
    try {
      const r = await fetch("/api/admin/blog-schedule", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ slug, status: nextStatus, publish_at }) });
      setState(r.ok ? "idle" : "err");
    } catch { setState("err"); }
  }

  function onStatus(e: React.ChangeEvent<HTMLSelectElement>) {
    const s = e.target.value;
    setStatus(s);
    // Don't save a 'scheduled' with no date yet — wait for the date pick.
    if (s !== "scheduled" || date) save(s, date);
  }
  function onDate(e: React.ChangeEvent<HTMLInputElement>) {
    const d = e.target.value;
    setDate(d);
    if (status === "scheduled" && d) save(status, d);
  }

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <select value={status} onChange={onStatus} disabled={state === "saving"}
        style={{ background: "#0f1512", color: COLOR[status] || "#f3eee6", border: "1px solid #243029", borderRadius: 6, padding: "3px 7px", fontSize: 12, fontWeight: 600 }}>
        {STATUSES.map((s) => <option key={s} value={s} style={{ color: "#f3eee6" }}>{s}</option>)}
      </select>
      {status === "scheduled" && (
        <input type="date" value={date} onChange={onDate} disabled={state === "saving"}
          style={{ background: "#0f1512", color: "#f3eee6", border: "1px solid #243029", borderRadius: 6, padding: "3px 7px", fontSize: 12 }} />
      )}
      {state === "saving" && <span style={{ fontSize: 11, color: "#6f7a72" }}>…</span>}
      {state === "err" && <span style={{ fontSize: 11, color: "#E0654B" }}>!</span>}
    </span>
  );
}
