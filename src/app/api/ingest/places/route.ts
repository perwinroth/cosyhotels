import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";
import slugify from "slugify";

type IncomingPlace = {
  source_id?: string;
  name: string;
  address?: string;
  city?: string;
  country?: string;
  lat?: number;
  lng?: number;
  rating?: number;
  reviews_count?: number;
  rooms_count?: number;
  amenities?: string[];
  description?: string;
  website?: string;
  affiliate_url?: string;
  images?: { url: string; width?: number; height?: number; attributions?: string }[];
};

export async function POST(req: Request) {
  const supabase = getServerSupabase();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  try {
    const body = (await req.json()) as { source: string; items: IncomingPlace[] };
    if (!body?.source || !Array.isArray(body.items)) {
      return NextResponse.json({ error: "Expected { source, items[] }" }, { status: 400 });
    }
    let upserted = 0;
    for (const p of body.items) {
      const slug = slugify(p.name, { lower: true, strict: true });
      const { data: hotel, error } = await supabase
        .from("hotels")
        .upsert({
          source: body.source,
          source_id: p.source_id || null,
          slug,
          name: p.name,
          address: p.address || null,
          city: p.city || null,
          country: p.country || null,
          lat: p.lat ?? null,
          lng: p.lng ?? null,
          rating: p.rating ?? null,
          reviews_count: p.reviews_count ?? null,
          rooms_count: p.rooms_count ?? null,
          amenities: p.amenities ?? null,
          description: p.description ?? null,
          website: p.website ?? null,
          affiliate_url: p.affiliate_url ?? null,
          updated_at: new Date().toISOString(),
        }, { onConflict: "slug" })
        .select("id, slug")
        .single();
      if (error) throw error;

      if (p.images?.length) {
        const imgs = p.images.map((i) => ({ hotel_id: hotel.id, url: i.url, width: i.width ?? null, height: i.height ?? null, attributions: i.attributions ?? null }));
        await supabase.from("hotel_images").insert(imgs).throwOnError();
      }
      upserted++;
    }
    return NextResponse.json({ upserted });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Bad Request";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
