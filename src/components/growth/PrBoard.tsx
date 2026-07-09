"use client";
// PR outreach board, action-plan edition. Replaces the old kanban (judgment call: the six status
// columns fought the action-type grouping the plan is built around) with a grouped list in plan
// order, DataBriefBoard-style. Status still moves through the same six outreach stages via per-card
// pill buttons that POST /api/admin/outreach { id, status }, exactly like the kanban did.
// Pitch rows carry the Challenger-approved email verbatim (copy buttons + one-click Gmail draft via
// the createPrDraft server action where a verified address exists). HOLD rows are greyed with the
// hold reason and no send buttons. "Today's best 3" keeps the founder pointed at the next action.
import { useState, useTransition } from "react";
import {
  HASHTAG_PLAYBOOK,
  COMMUNITY_PLAYBOOK,
  DIRECTORY_PLAYBOOK,
  REGISTER_PLAYBOOK,
  SECTION_ORDER,
  type PrActionType,
  type PrPitch,
} from "@/data/prActions";
import { createPrDraft } from "@/app/growth/pr/actions";
import Linkify from "@/components/growth/Linkify";

// Compose in Gmail AS gotcosy@gmail.com (account pinned in the path — never mailto:, which opens
// the device's default mail identity, i.e. the wrong-sender trap all over again).
const composeHref = (to: string) => `https://mail.google.com/mail/u/gotcosy@gmail.com/?${new URLSearchParams({ view: "cm", fs: "1", to })}`;


export type PrBoardRow = {
  id: string;
  outlet: string;
  status: string;
  email: string;
  contactRoute: string;
  notes: string;
  actionType: PrActionType;
  priority: number;
  priorityWhy: string;
  instructions?: string;
  pitch?: PrPitch;
  inPlan: boolean;
};

const STATUSES = ["queued", "contacted", "replied", "won", "won_confirmed", "declined"] as const;
const STATUS_LABEL: Record<string, string> = {
  queued: "queued", contacted: "contacted", replied: "replied",
  won: "won", won_confirmed: "confirmed", declined: "declined",
};
const DONE = new Set(["contacted", "replied", "won", "won_confirmed", "declined"]);

const SECTION_PLAYBOOK: Partial<Record<PrActionType, { title: string; text: string }>> = {
  register: { title: "Register playbook (applies to every row here)", text: REGISTER_PLAYBOOK },
  hashtag: { title: "Weekly hashtag routine (applies to every row here)", text: HASHTAG_PLAYBOOK },
  "community-post": { title: "Community posting rules (apply to every row here)", text: COMMUNITY_PLAYBOOK },
  "directory-submit": { title: "Directory submission text (reuse for every row here)", text: DIRECTORY_PLAYBOOK },
};

function priorityChip(p: number) {
  const bg = p >= 5 ? "var(--sage)" : p === 4 ? "color-mix(in oklab, var(--sage) 70%, transparent)" : p === 3 ? "var(--gold)" : "var(--muted)";
  return (
    <span className="rounded-md px-1.5 py-0.5 text-[11px] font-bold" style={{ background: bg, color: p >= 4 ? "#fff" : "#16201C" }}>
      P{p}
    </span>
  );
}

function CopyBtn({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="rounded-lg px-2.5 py-1 text-xs font-semibold"
      style={{ border: "1px solid var(--line)", background: done ? "var(--sage)" : "var(--card)", color: done ? "#fff" : "var(--foreground)", cursor: "pointer" }}
      onClick={async () => {
        try { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1600); } catch { /* ignore */ }
      }}
    >
      {done ? "Copied" : label}
    </button>
  );
}

function GmailDraftBtn({ id }: { id: string }) {
  const [link, setLink] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  if (link) {
    return (
      <a className="rounded-lg px-2.5 py-1 text-xs font-semibold no-underline" style={{ border: "1px solid var(--line)", background: "var(--sage)", color: "#fff" }} href={link} target="_blank" rel="noreferrer">
        Open Gmail draft
      </a>
    );
  }
  return (
    <>
      <button
        type="button"
        className="rounded-lg px-2.5 py-1 text-xs font-semibold"
        disabled={pending}
        title="Creates the draft in Gmail, From per@gotcosy.com, with the approved subject and body."
        style={{ border: "1px solid var(--line)", background: "var(--ember)", color: "#16201C", cursor: "pointer" }}
        onClick={() => {
          setError("");
          startTransition(async () => {
            const r = await createPrDraft(id);
            if (r.link) setLink(r.link);
            else setError(r.error || "failed");
          });
        }}
      >
        {pending ? "Creating draft..." : "Create Gmail draft"}
      </button>
      {error && <span className="text-xs" style={{ color: "var(--ember)" }}>{error}</span>}
    </>
  );
}

function StatusPills({ row, status, onSet }: { row: PrBoardRow; status: string; onSet: (id: string, s: string) => void }) {
  return (
    <span className="ml-auto flex flex-wrap gap-1">
      {STATUSES.map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => onSet(row.id, s)}
          className="rounded-md px-2 py-0.5 text-[11px]"
          style={{ border: "1px solid var(--line)", background: status === s ? "var(--ember)" : "transparent", color: status === s ? "#16201C" : "var(--muted)", cursor: "pointer" }}
        >
          {STATUS_LABEL[s]}
        </button>
      ))}
    </span>
  );
}

function Card({ row, status, gmailOn, onSet }: { row: PrBoardRow; status: string; gmailOn: boolean; onSet: (id: string, s: string) => void }) {
  const hold = row.pitch?.hold;
  const dimmed = row.actionType === "skip" || Boolean(hold);
  // authuser pins compose to the gotcosy@gmail.com account (default send-as = per@gotcosy.com via
  // Zoho relay); without it Gmail opens u/0 — whichever account the founder logged into first.
  const composeUrl = row.pitch?.to
    ? `https://mail.google.com/mail/u/gotcosy@gmail.com/?${new URLSearchParams({ view: "cm", fs: "1", to: row.pitch.to, su: row.pitch.subject, body: row.pitch.body })}`
    : null;
  return (
    <div className="rounded-2xl border p-4 mb-3" style={{ borderColor: DONE.has(status) ? "var(--sage)" : "var(--line)", background: "var(--card)", opacity: dimmed ? 0.55 : 1 }}>
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
        {priorityChip(row.priority)}
        <span className="font-semibold">{row.outlet}</span>
        <span className="text-[11px]" style={{ color: "var(--muted)" }}>{row.actionType}</span>
        <StatusPills row={row} status={status} onSet={onSet} />
      </div>
      <div className="mt-1.5 text-sm" style={{ color: "var(--muted)" }}><Linkify text={row.priorityWhy} /></div>
      {hold && (
        <div className="mt-1.5 text-sm rounded-lg px-2.5 py-1.5 font-semibold" style={{ background: "color-mix(in oklab, var(--ember) 14%, transparent)" }}>
          On hold: {hold}
        </div>
      )}
      {row.instructions && <div className="mt-1.5 text-sm whitespace-pre-wrap"><Linkify text={row.instructions} /></div>}
      {row.pitch && (
        <>
          <div className="mt-1.5 text-sm" style={{ color: "var(--muted)" }}>
            Route: {row.pitch.to ? <a className="underline" href={composeHref(row.pitch.to)} target="_blank" rel="noopener noreferrer">{row.pitch.to}</a> : row.pitch.route}
          </div>
          <details className="mt-2">
            <summary className="cursor-pointer text-sm" style={{ color: "var(--muted)" }}>Full email</summary>
            <div className="mt-2 text-sm font-semibold">Subject: {row.pitch.subject}</div>
            <pre className="mt-1.5 whitespace-pre-wrap rounded-xl border p-3 text-[13px] leading-relaxed" style={{ borderColor: "var(--line)", fontFamily: "inherit" }}>{row.pitch.body}</pre>
          </details>
          {!hold && (
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              <CopyBtn text={row.pitch.subject} label="Copy subject" />
              <CopyBtn text={row.pitch.body} label="Copy body" />
              {row.pitch.to && (gmailOn
                ? <GmailDraftBtn id={row.id} />
                : composeUrl && (
                  <a className="rounded-lg px-2.5 py-1 text-xs font-semibold no-underline" style={{ border: "1px solid var(--line)", background: "var(--ember)", color: "#16201C" }} href={composeUrl} target="_blank" rel="noreferrer">
                    Draft in Gmail
                  </a>
                ))}
            </div>
          )}
        </>
      )}
      {!row.pitch && row.actionType === "email" && (row.email || row.contactRoute) && (
        <div className="mt-1.5 text-sm" style={{ color: "var(--muted)" }}>
          Contact: {row.email
            ? <a className="underline" href={composeHref(row.email)} target="_blank" rel="noopener noreferrer">{row.email}</a>
            : /^https?:/.test(row.contactRoute)
              ? <a className="underline" href={row.contactRoute} target="_blank" rel="noreferrer">{row.contactRoute}</a>
              : row.contactRoute}
        </div>
      )}
      {!row.inPlan && <div className="mt-1.5 text-xs" style={{ color: "var(--muted)" }}>Not in the 2026-07-08 action plan.</div>}
    </div>
  );
}

export default function PrBoard({ rows, gmailOn }: { rows: PrBoardRow[]; gmailOn: boolean }) {
  // Optimistic local status; falls back to the server value. Same POST path the kanban used.
  const [statuses, setStatuses] = useState<Record<string, string>>({});
  const statusOf = (r: PrBoardRow) => statuses[r.id] ?? (r.status || "queued");
  async function onSet(id: string, status: string) {
    const prev = statuses[id];
    setStatuses((s) => ({ ...s, [id]: status }));
    try {
      const r = await fetch("/api/admin/outreach", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, status }) });
      if (!r.ok) throw new Error("save failed");
    } catch {
      setStatuses((s) => {
        if (prev === undefined) { const next = { ...s }; delete next[id]; return next; }
        return { ...s, [id]: prev };
      });
    }
  }

  const active = rows.filter((r) => r.actionType !== "skip" && !r.pitch?.hold);
  const parked = rows.filter((r) => r.actionType === "skip" || Boolean(r.pitch?.hold));
  const best3 = active.filter((r) => !DONE.has(statusOf(r))).slice(0, 3);

  return (
    <div>
      <div className="rounded-2xl border p-4 mb-6" style={{ borderColor: "var(--sage)", background: "var(--card)" }}>
        <div className="text-sm font-bold mb-2">Today&apos;s best 3</div>
        {best3.length === 0 && <div className="text-sm" style={{ color: "var(--muted)" }}>Nothing queued. Everything actionable is in flight or done.</div>}
        {best3.map((r, i) => (
          <div key={r.id} className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5 mb-1.5">
            <span className="text-sm font-bold" style={{ color: "var(--muted)" }}>{i + 1}.</span>
            {priorityChip(r.priority)}
            <span className="text-sm font-semibold">{r.outlet}</span>
            <span className="text-xs" style={{ color: "var(--muted)" }}>{r.actionType}</span>
            <span className="text-xs" style={{ color: "var(--muted)" }}>{r.priorityWhy}</span>
          </div>
        ))}
      </div>

      {SECTION_ORDER.map(({ type, title }) => {
        const sectionRows = active.filter((r) => r.actionType === type);
        if (sectionRows.length === 0) return null;
        const playbook = SECTION_PLAYBOOK[type];
        return (
          <section key={type} className="mb-7">
            <h2 className="text-base font-bold mb-2" style={{ fontFamily: "Fraunces, serif" }}>
              {title} <span className="text-sm font-normal" style={{ color: "var(--muted)" }}>({sectionRows.length})</span>
            </h2>
            {playbook && (
              <details className="rounded-2xl border p-3 mb-3" style={{ borderColor: "var(--line)", background: "var(--card)" }}>
                <summary className="cursor-pointer text-sm font-semibold">{playbook.title}</summary>
                <pre className="mt-2 whitespace-pre-wrap text-[13px] leading-relaxed" style={{ fontFamily: "inherit", color: "var(--muted)" }}>{playbook.text}</pre>
              </details>
            )}
            {sectionRows.map((r) => <Card key={r.id} row={r} status={statusOf(r)} gmailOn={gmailOn} onSet={onSet} />)}
          </section>
        );
      })}

      {parked.length > 0 && (
        <details className="mb-6">
          <summary className="cursor-pointer text-base font-bold" style={{ fontFamily: "Fraunces, serif" }}>
            Skips and holds <span className="text-sm font-normal" style={{ color: "var(--muted)" }}>({parked.length})</span>
          </summary>
          <div className="mt-3">
            {parked.map((r) => <Card key={r.id} row={r} status={statusOf(r)} gmailOn={gmailOn} onSet={onSet} />)}
          </div>
        </details>
      )}
    </div>
  );
}
