// PR outreach, action-plan edition. Merges the live `outreach` table (fallback: the committed
// outreach.json snapshot) with the classified action plan in src/data/prActions.ts by row id, then
// hands the sorted result to the client <PrBoard>. Order: priority desc, then the plan's Monday
// top-10 order for ties, then plan order. DB rows carry status (moved via POST /api/admin/outreach);
// the plan carries action type, priority, instructions and the Challenger-approved pitches.
import type { Metadata } from "next";
import { getServerSupabase } from "@/lib/supabase/server";
import outreachData from "@/data/outreach.json";
import { gmailConfigured } from "@/lib/gmail";
import { PR_ACTIONS, TOP10_ORDER } from "@/data/prActions";
import PrBoard, { type PrBoardRow } from "@/components/growth/PrBoard";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata: Metadata = { title: "PR outreach", robots: { index: false, follow: false } };

type DbRow = { id: string; outlet: string; email: string; contactRoute: string; notes: string; status: string };

const snapshot: DbRow[] = (outreachData as unknown as Array<Record<string, string>>).map((r) => ({
  id: r.id, outlet: r.outlet, email: r.email || "", contactRoute: r.contactRoute || "", notes: r.notes || "", status: r.status || "queued",
}));

const planIds = Object.keys(PR_ACTIONS);
const planIndex = new Map(planIds.map((id, i) => [id, i]));
const top10Index = new Map(TOP10_ORDER.map((id, i) => [id, i]));

function compareRows(a: PrBoardRow, b: PrBoardRow): number {
  if (a.priority !== b.priority) return b.priority - a.priority;
  const ta = top10Index.get(a.id) ?? 99;
  const tb = top10Index.get(b.id) ?? 99;
  if (ta !== tb) return ta - tb;
  return (planIndex.get(a.id) ?? 999) - (planIndex.get(b.id) ?? 999);
}

export default async function GrowthPrPage() {
  const db = getServerSupabase();
  let dbRows: DbRow[] = snapshot;
  if (db) {
    try {
      const { data } = await db.from("outreach").select("id,outlet,email,contact_route,notes,status");
      if (data && data.length) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        dbRows = data.map((r: any) => ({ id: r.id, outlet: r.outlet, email: r.email || "", contactRoute: r.contact_route || "", notes: r.notes || "", status: r.status || "queued" }));
      }
    } catch { /* table not created yet; use snapshot */ }
  }

  const byId = new Map(dbRows.map((r) => [r.id, r]));
  // Every classified row renders even if the DB row is missing (the snapshot lacks the bl-* rows);
  // any DB row the plan does not know is appended so nothing silently disappears.
  const rows: PrBoardRow[] = planIds.map((id) => {
    const a = PR_ACTIONS[id];
    const d = byId.get(id);
    return {
      id, outlet: d?.outlet || a.outlet, status: d?.status || "queued",
      email: d?.email || "", contactRoute: d?.contactRoute || "", notes: d?.notes || "",
      actionType: a.actionType, priority: a.priority, priorityWhy: a.priorityWhy,
      instructions: a.instructions, pitch: a.pitch, inPlan: true,
    };
  });
  for (const d of dbRows) {
    if (planIndex.has(d.id)) continue;
    rows.push({
      id: d.id, outlet: d.outlet, status: d.status, email: d.email, contactRoute: d.contactRoute, notes: d.notes,
      actionType: "form", priority: 1, priorityWhy: "Unclassified row from the outreach table.", inPlan: false,
    });
  }
  rows.sort(compareRows);

  const gmailOn = gmailConfigured();

  return (
    <div>
      <header style={{ marginBottom: 18 }}>
        <h1 style={{ fontFamily: "Fraunces, serif", fontSize: 22, fontWeight: 600, margin: 0 }}>PR outreach</h1>
        <p style={{ color: "var(--muted)", fontSize: 13.5, marginTop: 5 }}>
          All 105 targets classified and prioritised from the 2026-07-08 action plan. Start with today&apos;s best 3, work each section top down, and move the status pills as you go. Pitch emails are Challenger-approved; send them as they are.
        </p>
      </header>
      <PrBoard rows={rows} gmailOn={gmailOn} />
    </div>
  );
}
