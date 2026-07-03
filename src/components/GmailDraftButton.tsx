"use client";
// Creates a real Gmail draft (From per@gotcosy.com) for an outreach target via /api/admin/gmail-draft,
// then swaps to an "open in Gmail" link. Nothing sends — Per reviews + hits send himself.
import { useState } from "react";

export default function GmailDraftButton({ outlet, fit, email }: { outlet: string; fit: string; email: string }) {
  const [state, setState] = useState<"idle" | "creating" | "done" | "err">("idle");
  const [link, setLink] = useState("");

  async function create() {
    setState("creating");
    try {
      const r = await fetch("/api/admin/gmail-draft", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ outlet, fit, email }) });
      const j = await r.json();
      if (r.ok && j.link) { setLink(j.link); setState("done"); } else setState("err");
    } catch { setState("err"); }
  }

  if (state === "done") {
    return <a href={link} target="_blank" rel="noreferrer" style={{ fontWeight: 700, color: "#0F1512", background: "#D8B25A", borderRadius: 6, padding: "4px 10px", textDecoration: "none" }}>✓ Draft ready — open in Gmail ↗</a>;
  }
  return (
    <button onClick={create} disabled={state === "creating"} style={{ fontWeight: 700, color: "#0F1512", background: state === "err" ? "#E0654B" : "#7FB7A2", border: "none", borderRadius: 6, padding: "4px 10px", fontSize: 12, cursor: "pointer" }}>
      {state === "creating" ? "Creating…" : state === "err" ? "✗ retry draft" : "✉ Draft from per@gotcosy.com"}
    </button>
  );
}
