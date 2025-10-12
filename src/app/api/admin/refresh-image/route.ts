import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";
import { getImageForHotel } from "@/lib/hotelImages";

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: Request) {
  const url = new URL(req.url);
  const slug = url.searchParams.get('slug') || undefined;
  const id = url.searchParams.get('id') || undefined;
  const force = url.searchParams.get('force') === '1';

  const db = getServerSupabase();
  if (!db) return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });

  let hotel: { id: string; slug: string; name: string; city: string | null } | null = null;
  if (id) {
    const { data } = await db.from('hotels').select('id,slug,name,city').eq('id', id).maybeSingle();
    hotel = (data as typeof hotel) || null;
  } else if (slug) {
    const { data } = await db.from('hotels').select('id,slug,name,city').eq('slug', slug).maybeSingle();
    hotel = (data as typeof hotel) || null;
  } else {
    return NextResponse.json({ error: 'Provide slug or id' }, { status: 400 });
  }
  if (!hotel) return NextResponse.json({ error: 'Hotel not found' }, { status: 404 });

  if (!force) {
    const { data: has } = await db
      .from('hotel_images')
      .select('url')
      .eq('hotel_id', hotel.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    const existing = (has?.url as string | undefined) || '';
    if (existing && !existing.startsWith('/api/places/photo')) {
      return NextResponse.json({ ok: true, url: existing, skipped: true });
    }
  }

  const fresh = await getImageForHotel(String(hotel.name), String(hotel.city || ''), String(hotel.slug), String(hotel.id));
  if (fresh) {
    await db.from('hotel_images').insert({ hotel_id: hotel.id, url: fresh });
    return NextResponse.json({ ok: true, url: fresh });
  }
  return NextResponse.json({ ok: false, url: null });
}

export async function GET(req: Request) {
  // Convenience wrapper to allow triggering via browser
  return POST(req);
}

