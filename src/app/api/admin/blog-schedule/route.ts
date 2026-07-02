import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";

// Set a journal post's release state. Auth: middleware gates /api/admin/* (accepts the panel login
// cookie), so a logged-in /growth user can reschedule from their phone. Writes with service-role.
export async function POST(req: Request) {
  const { slug, status, publish_at } = await req.json().catch(() => ({}));
  const allowed = ["draft", "scheduled", "live"];
  if (!slug || typeof slug !== "string" || !allowed.includes(status)) {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  let pub: string | null = null;
  if (publish_at != null) {
    const t = new Date(publish_at);
    if (isNaN(t.getTime())) return NextResponse.json({ error: "bad publish_at" }, { status: 400 });
    pub = t.toISOString();
  }
  if (status === "scheduled" && !pub) {
    return NextResponse.json({ error: "scheduled needs a publish date" }, { status: 400 });
  }
  const db = getServerSupabase();
  if (!db) return NextResponse.json({ error: "db not configured" }, { status: 500 });
  const { error } = await db
    .from("blog_schedule")
    .upsert({ slug, status, publish_at: pub, updated_at: new Date().toISOString() }, { onConflict: "slug" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
