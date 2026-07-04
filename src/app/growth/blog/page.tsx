// Journal — kanban board of blog posts by release state (draft → scheduled → live). Ports the
// schedule + feedback queries from the old /growth monolith and hands them to the client <BlogBoard>.
// Renders inside the /growth shell layout: heading + board.
import type { Metadata } from "next";
import { getServerSupabase } from "@/lib/supabase/server";
import { getScheduleForPanel } from "@/lib/blogSchedule";
import BlogBoard, { type BlogRow } from "@/components/growth/BlogBoard";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata: Metadata = { title: "Journal", robots: { index: false, follow: false } };

export default async function GrowthBlogPage() {
  const schedule = await getScheduleForPanel();
  const feedback = new Map<string, string>();
  const db = getServerSupabase();
  if (db) {
    try {
      const { data } = await db.from("blog_feedback").select("slug,note");
      for (const r of (data || []) as Array<{ slug: string; note: string | null }>) if (r.note) feedback.set(r.slug, r.note);
    } catch { /* table not created yet */ }
  }

  const rows: BlogRow[] = schedule.map((b) => ({
    slug: b.slug, title: b.title, eyebrow: b.eyebrow, status: b.status, publish_at: b.publish_at, feedback: feedback.get(b.slug) || "",
  }));

  return (
    <div>
      <header style={{ marginBottom: 18 }}>
        <h1 style={{ fontFamily: "Fraunces, serif", fontSize: 22, fontWeight: 600, margin: 0 }}>Journal</h1>
        <p style={{ color: "var(--muted)", fontSize: 13.5, marginTop: 5 }}>Read each post (↗), leave feedback, and set its release stage. Scheduled auto-publishes on its date; picking a date schedules it.</p>
      </header>
      <BlogBoard rows={rows} />
    </div>
  );
}
