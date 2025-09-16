import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";
import { generateHotelSlug } from "@/lib/slug";

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function POST() {
  const db = getServerSupabase();
  if (!db) return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });

  // Fetch all hotels
  const { data, error } = await db
    .from("hotels")
    .select("id, slug, name, city, country")
    .order("created_at", { ascending: true });
  if (error || !data) return NextResponse.json({ error: "fetch_hotels_failed" }, { status: 500 });

  const rows = data as Array<{ id: string; slug: string | null; name: string; city: string | null; country: string | null }>;
  const reserved = new Set<string>(rows.map((r) => String(r.slug || "").toLowerCase()).filter(Boolean));

  let updated = 0;
  const redirects: Array<{ old_slug: string; new_slug: string; hotel_id: string }> = [];

  for (const r of rows) {
    const current = String(r.slug || "").toLowerCase();
    const next = await generateHotelSlug(db, r.name, r.city, r.country, { reserved, exclude: current });
    if (!current || next !== current) {
      // Update hotel slug
      const { error: upErr } = await db.from("hotels").update({ slug: next, updated_at: new Date().toISOString() }).eq("id", r.id);
      if (!upErr) {
        updated++;
        if (current) redirects.push({ old_slug: current, new_slug: next, hotel_id: r.id });
        reserved.add(next);
      }
    }
  }

  // Store redirects mapping for optional use later
  if (redirects.length) {
    await db.from("hotel_slug_redirects").upsert(redirects, { onConflict: "old_slug" });
  }

  return NextResponse.json({ total: rows.length, updated }, { status: 200 });
}

export async function GET() { return NextResponse.json({ ok: true }); }
