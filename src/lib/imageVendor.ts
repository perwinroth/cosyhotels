import { getServerSupabase } from "@/lib/supabase/server";
import { bookingSearchUrl } from "@/lib/affiliates";

export async function getVendorImageCached(id: string, name: string, city?: string, country?: string): Promise<string | null> {
  const supabase = getServerSupabase();
  const hid = id; // e.g., am-<hotelId>
  try {
    if (supabase) {
      const { data } = await supabase.from('hotel_images').select('url').eq('hotel_id', hid).order('created_at', { ascending: false }).limit(1);
      const url = data?.[0]?.url as string | undefined;
      if (url) return url;
    }
  } catch {}
  // Try fetching OG image from Booking search page
  try {
    const base = bookingSearchUrl({ name, city: city || '', country: country || '' });
    const res = await fetch(base, { redirect: 'follow', next: { revalidate: 86400 } });
    if (!res.ok) return null;
    const html = await res.text();
    const m = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)/i);
    const img = m ? m[1] : null;
    if (img && supabase) {
      try { await supabase.from('hotel_images').insert({ hotel_id: hid, url: img }); } catch {}
    }
    return img;
  } catch { return null; }
}

