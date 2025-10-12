import { NextResponse, after } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";
import { getImageForHotel } from "@/lib/hotelImages";

export const runtime = 'nodejs';
export const maxDuration = 180;

type RowImg = { hotel_id: string; url: string | null };
type RowHotel = { id: string; slug: string; name: string; city: string | null };

async function run(limit = 100) {
  const db = getServerSupabase();
  if (!db) return { error: 'Supabase not configured' } as const;

  // 1) Replace hotel_images URLs that point to /api/places/photo with a scraped vendor/website image
  const { data: rows } = await db
    .from('hotel_images')
    .select('hotel_id,url')
    .ilike('url', '/api/places/photo%')
    .order('created_at', { ascending: false })
    .limit(limit * 2);
  const list = (rows || []) as RowImg[];
  let processed = 0, updated = 0;
  for (const r of list) {
    if (processed >= limit) break;
    const hid = String(r.hotel_id || '');
    if (!hid) continue;
    processed++;
    try {
      const { data: h } = await db
        .from('hotels')
        .select('slug,name,city')
        .eq('id', hid)
        .maybeSingle();
      if (!h) continue;
      const fresh = await getImageForHotel(String(h.name), String(h.city || ''), String(h.slug), String(hid));
      if (fresh && fresh !== r.url) {
        await db.from('hotel_images').insert({ hotel_id: hid, url: fresh });
        updated++;
      }
    } catch {}
  }

  // 2) Update featured_top.image_url if it still points to Places
  let ftUpdated = 0;
  try {
    const { data: fRows } = await db
      .from('featured_top')
      .select('position,hotel_id,image_url')
      .ilike('image_url', '/api/places/photo%')
      .limit(Math.max(10, limit));
    for (const fr of (fRows || []) as Array<{ position: number; hotel_id: string | null; image_url: string | null }>) {
      if (!fr.hotel_id) continue;
      const { data: h } = await db
        .from('hotels')
        .select('slug,name,city')
        .eq('id', fr.hotel_id)
        .maybeSingle();
      if (!h) continue;
      const fresh = await getImageForHotel(String(h.name), String(h.city || ''), String(h.slug), String(fr.hotel_id));
      if (fresh && fresh !== fr.image_url) {
        await db.from('featured_top').update({ image_url: fresh }).eq('position', fr.position);
        ftUpdated++;
      }
    }
  } catch {}

  return { processed, updated, featuredUpdated: ftUpdated } as const;
}

export async function POST(req: Request) {
  const url = new URL(req.url);
  const limit = Number(url.searchParams.get('limit') || '50');
  const res = await run(Math.max(1, Math.min(500, limit)));
  if ('error' in res) return NextResponse.json(res, { status: 500 });
  return NextResponse.json(res);
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const limit = Number(url.searchParams.get('limit') || '200');
  after(async () => { try { await run(Math.max(1, Math.min(500, limit))); } catch (e) { try { console.error('migrate_places_images_error', e); } catch {} } });
  return NextResponse.json({ scheduled: true, limit }, { status: 202 });
}

