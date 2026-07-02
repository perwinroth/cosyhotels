// Blog release schedule — decides which journal posts are publicly visible, and when.
// Backed by the `blog_schedule` Supabase table (see supabase/2026_blog_schedule.sql), edited from
// /growth. Read at ISR render/revalidate time, so a `scheduled` post appears within one revalidate
// window of its publish_at. Fail-OPEN: if the table/Supabase is unreachable we show all posts, so a
// DB hiccup can never blank the blog. Once the table loads, a post with no row is hidden (a post
// must be explicitly scheduled/lived to publish — that is the point of a release schedule).
import { getServerSupabase } from "@/lib/supabase/server";
import { BLOG_POSTS, type BlogPost } from "@/data/blogPosts";

export type BlogStatus = "draft" | "scheduled" | "live";
export type BlogScheduleRow = { slug: string; status: BlogStatus; publish_at: string | null };

async function fetchSchedule(): Promise<Map<string, BlogScheduleRow> | null> {
  const db = getServerSupabase();
  if (!db) return null;
  try {
    const { data, error } = await db.from("blog_schedule").select("slug,status,publish_at");
    if (error) return null;
    const m = new Map<string, BlogScheduleRow>();
    for (const r of (data || []) as BlogScheduleRow[]) m.set(r.slug, r);
    return m;
  } catch {
    return null;
  }
}

function isVisible(row: BlogScheduleRow | undefined, now: number): boolean {
  if (!row) return false;
  if (row.status === "live") return true;
  if (row.status === "scheduled" && row.publish_at) return new Date(row.publish_at).getTime() <= now;
  return false;
}

/** Public journal posts, filtered by the schedule. Fail-open (all posts) on DB error/missing. */
export async function getVisibleBlogPosts(): Promise<BlogPost[]> {
  const schedule = await fetchSchedule();
  if (!schedule) return BLOG_POSTS;
  const now = Date.now();
  return BLOG_POSTS.filter((p) => isVisible(schedule.get(p.slug), now));
}

/** Is a single post publicly visible right now? Fail-open (true) on DB error/missing. */
export async function isBlogPostVisible(slug: string): Promise<boolean> {
  const schedule = await fetchSchedule();
  if (!schedule) return true;
  return isVisible(schedule.get(slug), Date.now());
}

export type PanelScheduleItem = {
  slug: string; title: string; eyebrow: string; updated: string;
  status: BlogStatus; publish_at: string | null; visible: boolean;
};

/** Every post joined with its schedule state, for the /growth panel. */
export async function getScheduleForPanel(): Promise<PanelScheduleItem[]> {
  const schedule = await fetchSchedule();
  const now = Date.now();
  return BLOG_POSTS.map((p) => {
    const row = schedule?.get(p.slug);
    return {
      slug: p.slug,
      title: p.title,
      eyebrow: p.eyebrow,
      updated: p.updated,
      status: row?.status ?? "draft",
      publish_at: row?.publish_at ?? null,
      visible: schedule ? isVisible(row, now) : true,
    };
  });
}
