"use client";
// Journal board. Wraps <Kanban> with the blog-schedule move path (POST /api/admin/blog-schedule
// { slug, status, publish_at }). Moving to "scheduled" needs a publish_at, so each card carries a
// date input; advancing to Scheduled with no date set defaults it to today (the API rejects a null
// publish_at on a scheduled post). Per-post feedback (reused BlogFeedback) sits behind a disclosure.
import { useRef, useState } from "react";
import Kanban, { type KanbanCard, type KanbanColumn, useKanbanMove } from "./Kanban";
import BlogFeedback from "@/components/BlogFeedback";

export type BlogRow = {
  slug: string; title: string; eyebrow: string;
  status: string; publish_at: string | null; feedback: string;
};

const COLUMNS: KanbanColumn[] = [
  { id: "draft", title: "Draft", hint: "Hidden — not published.", advanceLabel: "Schedule" },
  { id: "scheduled", title: "Scheduled", hint: "Auto-publishes on its date.", advanceLabel: "Publish now" },
  { id: "live", title: "Live", hint: "Public on the site now." },
];

function toDateInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}
const dateToIso = (d: string) => new Date(`${d}T00:00:00.000Z`).toISOString();
const todayInput = () => new Date().toISOString().slice(0, 10);

async function post(slug: string, status: string, publish_at: string | null) {
  const r = await fetch("/api/admin/blog-schedule", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ slug, status, publish_at }) });
  return r.ok;
}

// The date field lives inside the Kanban tree so it can drive the SAME optimistic move path: picking a
// date on a draft/live card routes through move() → the card visibly jumps to Scheduled on success. If
// the card is already Scheduled, it's not a column move, so it just re-saves the new date (mirrors the
// old BlogScheduleRow). The chosen date is stashed in a ref the board's onMove reads back.
function BlogDateField({ slug, value, onPick }: { slug: string; value: string; onPick: (slug: string, d: string) => void }) {
  const { move, statusOf } = useKanbanMove();
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 11.5, color: "var(--muted)" }}>
      Publish
      <input type="date" value={value}
        onChange={(e) => {
          const d = e.target.value;
          onPick(slug, d);
          if (!d) return;
          if (statusOf(slug) === "scheduled") post(slug, "scheduled", dateToIso(d)); // already scheduled — just re-date it
          else move(slug, "scheduled"); // draft/live → scheduled, through the optimistic path
        }}
        style={{ background: "var(--surface-2)", color: "var(--foreground)", border: "1px solid var(--line)", borderRadius: 6, padding: "3px 7px", fontSize: 12 }} />
    </label>
  );
}

export default function BlogBoard({ rows }: { rows: BlogRow[] }) {
  const [dates, setDates] = useState<Record<string, string>>(() =>
    Object.fromEntries(rows.map((r) => [r.slug, toDateInput(r.publish_at)])));
  const datesRef = useRef(dates); // kept in sync so onMove reads the freshly-picked date synchronously
  const pick = (slug: string, d: string) => { datesRef.current = { ...datesRef.current, [slug]: d }; setDates(datesRef.current); };

  async function onMove(slug: string, status: string) {
    if (status !== "scheduled") return post(slug, status, null);
    // Scheduled needs a date; default to today if none picked yet, and reflect it in the input.
    let d = datesRef.current[slug];
    if (!d) { d = todayInput(); pick(slug, d); }
    return post(slug, status, dateToIso(d));
  }

  const cards: KanbanCard[] = rows.map((r) => {
    const body = (
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <BlogDateField slug={r.slug} value={dates[r.slug] ?? ""} onPick={pick} />
        <details>
          <summary style={{ cursor: "pointer", fontSize: 11.5, color: "var(--muted)", listStyle: "none" }}>✎ Feedback for Claude</summary>
          <BlogFeedback slug={r.slug} initial={r.feedback} />
        </details>
      </div>
    );
    return { id: r.slug, status: r.status || "draft", title: r.title, href: `/en/blog/${r.slug}`, subtitle: r.eyebrow || undefined, body };
  });

  return <Kanban columns={COLUMNS} cards={cards} onMove={onMove} />;
}
