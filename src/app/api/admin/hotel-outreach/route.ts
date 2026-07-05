import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";

// Update a hotel's badge-outreach status. Auth: middleware gates /api/admin/* (panel cookie), so a
// logged-in /badge-outreach user can edit from their phone. Upserts with the service-role key —
// the row may not exist yet (the list is derived live; status is created on first change).
export async function POST(req: Request) {
  const { hotel_id, status, channel } = await req.json().catch(() => ({}));
  const allowed = ["queued", "contacted", "replied", "won", "won_confirmed", "declined"];
  if (!hotel_id || !allowed.includes(status)) return NextResponse.json({ error: "bad request" }, { status: 400 });
  const db = getServerSupabase();
  if (!db) return NextResponse.json({ error: "db not configured" }, { status: 500 });
  const now = new Date().toISOString();
  const row: Record<string, unknown> = { hotel_id: String(hotel_id), status, updated_at: now };
  if (channel) row.channel = String(channel);
  if (status === "contacted") row.contacted_at = now;
  const { error } = await db.from("hotel_outreach").upsert(row, { onConflict: "hotel_id" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
