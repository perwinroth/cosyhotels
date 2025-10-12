import { NextResponse, after } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";
import { getImageForHotel } from "@/lib/hotelImages";

export const runtime = 'nodejs';
export const maxDuration = 180;

type HotelBasic = { id: string; slug: string; name: string; city: string | null };

async function run(limit = 200, timeBudgetMs = 8000) {
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
  const deadline = Date.now() + Math.max(2000, timeBudgetMs);
  for (const r of rows) {
    if (processed >= limit) break;
    if (Date.now() > deadline) break;
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

export async function GET(req: Request) {
  const url = new URL(req.url);
  const limitParam = url.searchParams.get('limit');
  const limit = limitParam ? Math.max(1, Math.min(500, Number(limitParam))) : undefined;
  after(async () => { try { await run(limit || 200); } catch (e) { try { console.error('backfill_images_error', e); } catch {} } });
  return NextResponse.json({ scheduled: true, limit: limit || 200 }, { status: 202 });
}

export async function POST(req: Request) {
  const url = new URL(req.url);
  const limitParam = url.searchParams.get('limit');
  const limit = limitParam ? Math.max(1, Math.min(200, Number(limitParam))) : 50;
  const res = await run(limit, 8000);
  if ('error' in res) return NextResponse.json(res, { status: 500 });
  return NextResponse.json({ ...res, limit });
}
