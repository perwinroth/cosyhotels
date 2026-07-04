// Reddit opportunities — kanban board. Threads asking for cosy/boutique hotel recs (from
// find-reddit-threads.mjs). Unlike the old monolith this fetches dismissed leads too, so Dismissed is
// a visible (collapsed) pile rather than a hole. Renders inside the /growth shell: heading + board.
import type { Metadata } from "next";
import { getServerSupabase } from "@/lib/supabase/server";
import RedditBoard, { type RedditRow } from "@/components/growth/RedditBoard";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata: Metadata = { title: "Reddit leads", robots: { index: false, follow: false } };

export default async function GrowthRedditPage() {
  const db = getServerSupabase();
  let leads: RedditRow[] = [];
  if (db) {
    try {
      const { data } = await db.from("reddit_leads").select("id,subreddit,title,url,snippet,city,status,found_at").order("found_at", { ascending: false }).limit(200);
      leads = (data || []) as RedditRow[];
    } catch { /* table not created yet */ }
  }

  return (
    <div>
      <header style={{ marginBottom: 18 }}>
        <h1 style={{ fontFamily: "Fraunces, serif", fontSize: 22, fontWeight: 600, margin: 0 }}>Reddit opportunities</h1>
        <p style={{ color: "var(--muted)", fontSize: 13.5, marginTop: 5 }}>Open a thread, reply like a human — never a bare link — then advance it to Replied. Refresh leads with <code>scripts/find-reddit-threads.mjs --execute</code>.</p>
      </header>
      <RedditBoard rows={leads} />
    </div>
  );
}
