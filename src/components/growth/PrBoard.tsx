"use client";
// PR & backlink outreach board. Wraps <Kanban> with the outreach move path (POST /api/admin/outreach
// { id, status }) and per-card actions (real Gmail draft from per@gotcosy.com, or a compose link).
// START-HERE targets sort to the top of every column.
import Kanban, { type KanbanCard, type KanbanColumn } from "./Kanban";
import GmailDraftButton from "@/components/GmailDraftButton";
import { gmailComposeUrl } from "@/lib/outreachTemplates";

export type PrRow = {
  id: string; outlet: string; type: string; fit: string; email: string;
  contactRoute: string; region: string; notes: string; rec?: string; status: string;
};

const COLUMNS: KanbanColumn[] = [
  { id: "queued", title: "Queued", hint: "New targets land here.", advanceLabel: "Mark contacted" },
  { id: "contacted", title: "Contacted", hint: "Nothing waiting — drafts you've sent appear here.", advanceLabel: "Mark replied" },
  { id: "replied", title: "Replied", hint: "They wrote back — move here.", advanceLabel: "Mark won" },
  { id: "won", title: "Won", hint: "Backlinks landed 🔥" },
  { id: "declined", title: "Declined", hint: "No thanks / no fit.", discard: true },
];
const recRank = (r?: string) => (({ "start-here": 0, "if-budget": 2, skip: 3 }) as Record<string, number>)[r ?? ""] ?? 1;
const recChip = (r?: string) =>
  r === "start-here" ? { label: "★ start here", color: "var(--sage)" }
  : r === "if-budget" ? { label: "if budget", color: "var(--gold)" }
  : r === "skip" ? { label: "skip", color: "var(--muted)" }
  : null;
const fitAngle: Record<string, string> = {
  "data-study": "Pitch the cosiness data study — citable stats they can quote.",
  "hotelier-asset": "Offer the “make your hotel look cosy” guide for their audience.",
  "listicle": "Offer a “best cosy hotels for X” round-up angle.",
  "expert-source": "Offer yourself as an expert source on cosy / boutique travel.",
};

export default function PrBoard({ rows, gmailOn }: { rows: PrRow[]; gmailOn: boolean }) {
  async function onMove(id: string, status: string) {
    const r = await fetch("/api/admin/outreach", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, status }) });
    return r.ok;
  }

  const cards: KanbanCard[] = rows.map((o) => {
    const rc = recChip(o.rec);
    const chips = [
      ...(rc ? [rc] : []),
      { label: o.type, color: "var(--muted)" as const },
      { label: o.fit, color: "var(--muted)" as const },
      ...(o.region ? [{ label: o.region, color: "var(--muted)" as const }] : []),
    ];
    const body = (
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, fontSize: 12 }}>
        {o.email ? (
          <>
            {gmailOn
              ? <GmailDraftButton outlet={o.outlet} fit={o.fit} email={o.email} />
              : <a href={gmailComposeUrl(o)} target="_blank" rel="noreferrer" style={{ fontWeight: 700, color: "#fff", background: "var(--sage)", borderRadius: 6, padding: "4px 10px", textDecoration: "none" }}>✉ Draft in Gmail ↗</a>}
          </>
        ) : /^https?:/.test(o.contactRoute)
          ? <a href={o.contactRoute} target="_blank" rel="noreferrer" style={{ color: "var(--sage)" }}>contact ↗</a>
          : <span style={{ color: "var(--muted)" }}>{o.contactRoute}</span>}
      </div>
    );
    return {
      id: o.id, status: o.status || "queued", title: o.outlet,
      subtitle: [o.notes, fitAngle[o.fit] ? `→ ${fitAngle[o.fit]}` : ""].filter(Boolean).join("  ") || undefined,
      chips, body, sortKey: recRank(o.rec),
    };
  });

  return <Kanban columns={COLUMNS} cards={cards} onMove={onMove} />;
}
