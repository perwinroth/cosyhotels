"use client";
// Reddit-opportunities board. Wraps <Kanban> with the reddit move path (POST /api/admin/reddit-status
// { id, status }). Reply like a human, then advance new → replied; the ⋯ menu can dismiss a thread
// (its own collapsed pile). Dismissed threads are fetched too so they stay a visible pile, not a hole.
import Kanban, { type KanbanCard, type KanbanColumn } from "./Kanban";

export type RedditRow = {
  id: string; subreddit: string | null; title: string | null; url: string;
  snippet: string | null; city: string | null; status: string; found_at: string | null;
};

const COLUMNS: KanbanColumn[] = [
  { id: "new", title: "New", hint: "Nothing waiting; new leads land here.", advanceLabel: "Mark replied" },
  { id: "replied", title: "Replied", hint: "Threads you've genuinely helped on." },
  { id: "dismissed", title: "Dismissed", hint: "Not a fit / too old.", discard: true },
];

function ageOf(iso: string | null): string {
  if (!iso) return "";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (isNaN(days)) return "";
  return days <= 0 ? "today" : days === 1 ? "1d ago" : `${days}d ago`;
}

export default function RedditBoard({ rows }: { rows: RedditRow[] }) {
  async function onMove(id: string, status: string) {
    const r = await fetch("/api/admin/reddit-status", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, status }) });
    return r.ok;
  }

  const cards: KanbanCard[] = rows.map((r) => {
    const age = ageOf(r.found_at);
    return {
      id: r.id, status: r.status || "new", title: r.title || r.url, href: r.url,
      subtitle: r.snippet || undefined,
      chips: [
        ...(r.subreddit ? [{ label: `r/${r.subreddit}`, color: "var(--muted)" as const }] : []),
        ...(r.city ? [{ label: r.city, color: "var(--muted)" as const }] : []),
        ...(age ? [{ label: age, color: "var(--muted)" as const }] : []),
      ],
    };
  });

  return <Kanban columns={COLUMNS} cards={cards} onMove={onMove} />;
}
