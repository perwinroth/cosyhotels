import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";

// Update an outreach target's status. Auth: middleware gates /api/admin/* (accepts the panel login
// cookie), so a logged-in /growth user can edit from their phone. Writes with the service-role key.
export async function POST(req: Request) {
  const { id, status } = await req.json().catch(() => ({}));
  const allowed = ["queued", "contacted", "replied", "won", "won_confirmed", "declined"];
  if (!id || !allowed.includes(status)) return NextResponse.json({ error: "bad request" }, { status: 400 });
  const db = getServerSupabase();
  if (!db) return NextResponse.json({ error: "db not configured" }, { status: 500 });
  const { error } = await db.from("outreach").update({ status, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
