// Journo queries — inbound journalist source-requests parsed from the Source of Sources / HARO /
// Featured digests (see /api/cron/journo-queries), triaged for GotCosy fit, and drafted where the
// fit is good. Per reviews each draft in Gmail before sending — nothing here auto-sends.
import type { Metadata } from "next";
import { getServerSupabase } from "@/lib/supabase/server";
import JornoBoard, { type JournoRow } from "@/components/growth/JornoBoard";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata: Metadata = { title: "Journo queries", robots: { index: false, follow: false } };

// Same heuristic as journoDigest.ts's isIndexBlock (the parser now skips these going forward) — used
// here only to sweep rows inserted before that fix landed.
const STALE_INDEX_PATTERN = /^\**\s*(QUERIES FROM|INDEX)/i;

export default async function GrowthJournoPage() {
  const db = getServerSupabase();
  let rows: JournoRow[] = [];
  if (db) {
    const { data } = await db
      .from("journo_queries")
      .select("id,source,received_at,outlet,journalist,deadline,category,query_text,fit_score,fit_reason,status,draft_id,draft_link,reply_to,created_at")
      .order("received_at", { ascending: false, nullsFirst: false })
      .limit(60);
    rows = (data || []) as JournoRow[];

    // One-time cleanup: digest navigation/index blocks that landed as regular "new" rows before the
    // parser fix (journoDigest.ts isIndexBlock) shipped. Guarded to status="new" so a row a human
    // already triaged (drafted/sent/skipped/expired) is never touched.
    const stale = rows.filter((r) => r.status === "new" && STALE_INDEX_PATTERN.test(r.query_text.trim()));
    if (stale.length) {
      await db.from("journo_queries").update({ status: "skipped" }).in("id", stale.map((r) => r.id));
      const staleIds = new Set(stale.map((r) => r.id));
      rows = rows.map((r) => (staleIds.has(r.id) ? { ...r, status: "skipped" } : r));
    }

    // One-time cleanup (same pattern as the index-block sweep above): low-fit rows that landed as
    // "new" before the cron started auto-skipping fit < 0.35 at triage time. Guarded to
    // status="new" (in the query AND the UPDATE filter) so nothing a human already triaged is
    // touched; auto-skipped rows stay recoverable in the board's Auto-skipped section.
    const lowFit = rows.filter((r) => r.status === "new" && r.fit_score != null && r.fit_score < 0.35);
    if (lowFit.length) {
      await db.from("journo_queries").update({ status: "skipped" }).in("id", lowFit.map((r) => r.id)).eq("status", "new");
      const lowFitIds = new Set(lowFit.map((r) => r.id));
      rows = rows.map((r) => (lowFitIds.has(r.id) ? { ...r, status: "skipped" } : r));
    }
  }

  return (
    <div>
      <header style={{ marginBottom: 18 }}>
        <h1 style={{ fontFamily: "Fraunces, serif", fontSize: 22, fontWeight: 600, margin: 0 }}>Journo queries</h1>
        <p style={{ color: "var(--muted)", fontSize: 13.5, marginTop: 5 }}>
          Parsed from PR digests, triaged for fit, and drafted in Gmail (From per@gotcosy.com) where GotCosy has something real to add. Drafts appear in your Gmail Drafts; every one is Per&apos;s to edit and send, nothing here sends itself.
        </p>
      </header>
      <JornoBoard rows={rows} />
    </div>
  );
}
