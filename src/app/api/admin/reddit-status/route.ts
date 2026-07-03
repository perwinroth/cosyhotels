import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";

// Update a Reddit lead's status. Auth: middleware gates /api/admin/* (panel cookie), so /growth can
// edit from the phone. Writes with the service-role key.
export async function POST(req: Request) {
  const { id, status } = await req.json().catch(() => ({}));
  const allowed = ["new", "replied", "dismissed"];
  if (!id || !allowed.includes(status)) return NextResponse.json({ error: "bad request" }, { status: 400 });
  const db = getServerSupabase();
  if (!db) return NextResponse.json({ error: "db not configured" }, { status: 500 });
  const { error } = await db.from("reddit_leads").update({ status, updated_at: new Date().toISOString() }).eq("id", String(id));
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
