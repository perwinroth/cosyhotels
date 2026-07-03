import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";

// Save per-post blog feedback from /growth. Auth: middleware gates /api/admin/* (panel cookie).
// Upserts one note per slug (empty note clears it).
export async function POST(req: Request) {
  const { slug, note } = await req.json().catch(() => ({}));
  if (!slug) return NextResponse.json({ error: "bad request" }, { status: 400 });
  const db = getServerSupabase();
  if (!db) return NextResponse.json({ error: "db not configured" }, { status: 500 });
  const { error } = await db.from("blog_feedback").upsert({ slug: String(slug), note: note ? String(note) : null, updated_at: new Date().toISOString() }, { onConflict: "slug" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
