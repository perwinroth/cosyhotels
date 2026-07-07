// Journo queries — inbound journalist source-requests parsed from the Source of Sources / HARO /
// Featured digests (see /api/cron/journo-queries), triaged for GotCosy fit, and drafted where the
// fit is good. Per reviews each draft in Gmail before sending — nothing here auto-sends.
import type { Metadata } from "next";
import { getServerSupabase } from "@/lib/supabase/server";
import JornoBoard, { type JournoRow } from "@/components/growth/JornoBoard";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata: Metadata = { title: "Journo queries", robots: { index: false, follow: false } };

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
  }

  return (
    <div>
      <header style={{ marginBottom: 18 }}>
        <h1 style={{ fontFamily: "Fraunces, serif", fontSize: 22, fontWeight: 600, margin: 0 }}>Journo queries</h1>
        <p style={{ color: "var(--muted)", fontSize: 13.5, marginTop: 5 }}>
          Parsed from PR digests, triaged for fit, and drafted in Gmail (From per@gotcosy.com) where GotCosy has something real to add. Drafts appear in your Gmail Drafts — every one is Per&apos;s to edit and send, nothing here sends itself.
        </p>
      </header>
      <JornoBoard rows={rows} />
    </div>
  );
}
