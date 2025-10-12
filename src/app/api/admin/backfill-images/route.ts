import { NextResponse, after } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";
import { getImageForHotel } from "@/lib/hotelImages";

export const runtime = 'nodejs';
export const maxDuration = 180;

type HotelBasic = { id: string; slug: string; name: string; city: string | null };

async function run(limit = 200) {
  const db = getServerSupabase();
  if (!db) return { error: 'Supabase not configured' } as const;
  // Hotels without any cached image
  const { data, error } = await db
    .from('hotels')
    .select('id,slug,name,city, hotel_images ( url )')
    .limit(limit * 2); // over-select; filter client-side
  if (error || !data) return { processed: 0, updated: 0 } as const;
  const rows = (data as Array<HotelBasic & { hotel_images: Array<{ url: string | null }> }>);
  let processed = 0, updated = 0;
  for (const r of rows) {
    if (processed >= limit) break;
    const has = Array.isArray(r.hotel_images) && r.hotel_images.some((x) => !!x?.url);
    if (has) continue;
    processed++;
    try {
      const url = await getImageForHotel(String(r.name), String(r.city || ''), String(r.slug), String(r.id));
      if (url) { await db.from('hotel_images').insert({ hotel_id: r.id, url }); updated++; }
    } catch {}
  }
  return { processed, updated } as const;
}

export async function GET() {
  after(async () => { try { await run(); } catch (e) { try { console.error('backfill_images_error', e); } catch {} } });
  return NextResponse.json({ scheduled: true }, { status: 202 });
}

export async function POST() {
  const res = await run();
  if ('error' in res) return NextResponse.json(res, { status: 500 });
  return NextResponse.json(res);
}
