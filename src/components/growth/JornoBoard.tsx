"use client";
// /growth/journo board — journo_queries rows grouped by status. Each card shows the outlet/deadline/
// fit reasoning, a whitespace-collapsed summary (full text in a details toggle), a one-click
// "Draft with AI → Gmail" action (works on ANY row with a reply_to, not just good-fit ones), a
// manual-compose fallback link, and Skip / Mark sent actions.
import { useState, useTransition } from "react";
import { updateJournoStatus, draftAndOpen } from "@/app/growth/journo/actions";
import { gmailComposeUrl } from "@/lib/badgePitch";

export type JournoRow = {
  id: string;
  source: string | null;
  received_at: string | null;
  outlet: string | null;
  journalist: string | null;
  deadline: string | null;
  category: string | null;
  query_text: string;
  fit_score: number | null;
  fit_reason: string | null;
  status: string;
  draft_id: string | null;
  draft_link: string | null;
  reply_to: string | null;
  created_at: string;
};

const GROUPS: Array<{ id: string; label: string; hint: string }> = [
  { id: "drafted", label: "Drafted: review & send", hint: "A reply is waiting in Gmail Drafts." },
  { id: "new", label: "New: no draft yet", hint: "Low fit, or no reply address found in the digest." },
  { id: "sent", label: "Sent", hint: "You've replied." },
  { id: "skipped", label: "Skipped", hint: "Not worth a reply." },
  { id: "expired", label: "Expired", hint: "Deadline passed." },
];

function fmtDate(s: string | null) {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? s : d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function fitChip(score: number | null) {
  if (score == null) return null;
  const good = score >= 0.6;
  return (
    <span
      className="gk-chip"
      style={{ border: "1px solid var(--line)", borderRadius: 999, padding: "1px 8px", fontSize: 11, fontWeight: 700, color: good ? "#fff" : "var(--muted)", background: good ? "var(--sage)" : "transparent" }}
    >
      fit {Math.round(score * 100)}%
    </span>
  );
}

function Card({ row }: { row: JournoRow }) {
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState(row.status);
  const [err, setErr] = useState(false);

  const [draftLink, setDraftLink] = useState(row.draft_link);
  const [draftPending, startDraftTransition] = useTransition();
  const [draftErr, setDraftErr] = useState<string | null>(null);

  function act(next: string) {
    const prev = status;
    setStatus(next);
    setErr(false);
    startTransition(async () => {
      const r = await updateJournoStatus(row.id, next);
      if (!r.ok) {
        setStatus(prev);
        setErr(true);
      }
    });
  }

  function makeDraft() {
    setDraftErr(null);
    startDraftTransition(async () => {
      const r = await draftAndOpen(row.id);
      if (r.ok && r.link) {
        setDraftLink(r.link);
        setStatus("drafted");
      } else {
        setDraftErr(r.error || "draft failed; try again");
      }
    });
  }

  const collapsed = row.query_text.replace(/\s+/g, " ").trim();
  const summary = collapsed.length > 200 ? `${collapsed.slice(0, 200)}…` : collapsed;
  const manualSubject = `Re:${(row.outlet ? ` ${row.outlet}:` : "") + " " + summary.slice(0, 80)}`;
  const manualUrl = row.reply_to ? gmailComposeUrl(row.reply_to, manualSubject, `> ${row.query_text}`) : null;

  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 12, padding: "11px 12px", display: "flex", flexDirection: "column", gap: 7, opacity: pending ? 0.7 : 1 }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 13.5, fontWeight: 600 }}>{row.outlet || row.category || "Unlabeled query"}</span>
        {fitChip(row.fit_score)}
        {row.deadline && <span style={{ fontSize: 12, fontWeight: 700, color: "var(--ember-ink)" }}>deadline {row.deadline}</span>}
        {row.received_at && <span style={{ fontSize: 11, color: "var(--muted)" }}>{fmtDate(row.received_at)}</span>}
        {row.source && <span style={{ fontSize: 11, color: "var(--muted)" }}>· {row.source}</span>}
      </div>
      {row.fit_reason && <div style={{ fontSize: 12, color: "var(--muted)" }}>{row.fit_reason}</div>}
      <p style={{ fontSize: 12.5, color: "var(--foreground)", margin: 0, lineHeight: 1.5 }}>{summary}</p>
      <details>
        <summary style={{ cursor: "pointer", fontSize: 12.5, color: "var(--muted)" }}>Full query text</summary>
        <pre style={{ marginTop: 6, whiteSpace: "pre-wrap", fontFamily: "inherit", fontSize: 12.5, lineHeight: 1.5, background: "var(--surface-2)", borderRadius: 8, padding: 8 }}>{row.query_text}</pre>
      </details>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, fontSize: 12 }}>
        {draftLink && (
          <a href={draftLink} target="_blank" rel="noreferrer" style={{ fontWeight: 700, color: "#fff", background: "var(--sage)", borderRadius: 6, padding: "4px 10px", textDecoration: "none" }}>
            ✉ Open draft ↗
          </a>
        )}
        {!draftLink && row.reply_to && (
          <button disabled={draftPending} onClick={makeDraft} style={{ border: "none", background: "var(--sage)", color: "#fff", borderRadius: 6, padding: "4px 10px", fontSize: 12, fontWeight: 700, cursor: draftPending ? "default" : "pointer" }}>
            {draftPending ? "Drafting…" : "Draft with AI → Gmail"}
          </button>
        )}
        {manualUrl && (
          <a href={manualUrl} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: "var(--muted)", textDecoration: "underline" }}>
            Compose manually ↗
          </a>
        )}
        {status !== "sent" && (
          <button disabled={pending} onClick={() => act("sent")} style={{ border: "1px solid var(--line)", background: "none", borderRadius: 6, padding: "4px 10px", fontSize: 12, fontWeight: 600, color: "var(--foreground)", cursor: "pointer" }}>
            Mark sent
          </button>
        )}
        {status !== "skipped" && (
          <button disabled={pending} onClick={() => act("skipped")} style={{ border: "1px solid var(--line)", background: "none", borderRadius: 6, padding: "4px 10px", fontSize: 12, fontWeight: 600, color: "var(--muted)", cursor: "pointer" }}>
            Skip
          </button>
        )}
        {err && <span style={{ color: "var(--ember)", fontSize: 11.5 }}>couldn&apos;t save; try again</span>}
        {draftErr && <span style={{ color: "var(--ember)", fontSize: 11.5 }}>{draftErr}</span>}
      </div>
    </div>
  );
}

export default function JornoBoard({ rows }: { rows: JournoRow[] }) {
  if (!rows.length) {
    return <p style={{ color: "var(--muted)", fontSize: 13.5 }}>No queries yet; the cron runs 3x/day and needs Per subscribed to Source of Sources / Featured digests at the inbox GMAIL_REFRESH_TOKEN is authorized for.</p>;
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      {GROUPS.map((g) => {
        const inGroup = rows.filter((r) => r.status === g.id);
        if (!inGroup.length) return null;
        return (
          <section key={g.id}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 8 }}>
              <h2 style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>{g.label}</h2>
              <span style={{ fontSize: 12, color: "var(--muted)" }}>({inGroup.length})</span>
            </div>
            <p style={{ fontSize: 11.5, color: "var(--muted)", margin: "0 0 8px" }}>{g.hint}</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {inGroup.map((r) => <Card key={r.id} row={r} />)}
            </div>
          </section>
        );
      })}
    </div>
  );
}
