"use client";
// Per-post blog feedback box in /growth. Blog content lives in code, so this is the loop: leave a
// note here → Claude applies it → deploy. Saves to /api/admin/blog-feedback (panel-cookie gated).
import { useState } from "react";

export default function BlogFeedback({ slug, initial }: { slug: string; initial: string }) {
  const [note, setNote] = useState(initial || "");
  const [state, setState] = useState<"idle" | "saving" | "saved" | "err">("idle");
  async function save() {
    setState("saving");
    try {
      const r = await fetch("/api/admin/blog-feedback", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ slug, note }) });
      if (r.ok) { setState("saved"); setTimeout(() => setState("idle"), 1600); } else setState("err");
    } catch { setState("err"); }
  }
  return (
    <div style={{ flexBasis: "100%", marginTop: 6 }}>
      <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={note ? 2 : 1}
        placeholder="Feedback for Claude — what to fix, cut, or rewrite. Saved here; I apply it on the next pass."
        style={{ width: "100%", background: "#0F1512", color: "#F3EEE6", border: "1px solid #243029", borderRadius: 8, padding: "7px 10px", fontSize: 12.5, lineHeight: 1.5, fontFamily: "inherit", resize: "vertical", boxSizing: "border-box" }} />
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
        <button onClick={save} disabled={state === "saving"} style={{ fontSize: 11.5, fontWeight: 700, color: "#0F1512", background: "#7FB7A2", border: "none", borderRadius: 6, padding: "3px 11px", cursor: "pointer" }}>{state === "saving" ? "Saving…" : "Save feedback"}</button>
        {state === "saved" && <span style={{ fontSize: 11, color: "#7FB7A2" }}>✓ saved — I&apos;ll action it</span>}
        {state === "err" && <span style={{ fontSize: 11, color: "#E0654B" }}>error — retry</span>}
      </div>
    </div>
  );
}
