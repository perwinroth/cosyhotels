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

export async function getVendorImageAny(id: string, name: string, city?: string, country?: string): Promise<string | null> {
  // First try cached
  const cached = await getVendorImageCached(id, name, city, country);
  if (cached) return cached;
  // Try Expedia OG as secondary
  try {
    const u = new URL('https://www.expedia.com/Hotel-Search');
    const dest = [city || '', country || ''].filter(Boolean).join(', ');
    if (dest) u.searchParams.set('destination', dest);
    if (name) u.searchParams.set('keyword', name);
    const res = await fetch(u.toString(), { redirect: 'follow', next: { revalidate: 86400 } });
    if (!res.ok) return null;
    const html = await res.text();
    const m = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)/i);
    const img = m ? m[1] : null;
    const supabase = getServerSupabase();
    if (img && supabase) {
      try { await supabase.from('hotel_images').insert({ hotel_id: id, url: img }); } catch {}
    }
    return img;
  } catch { return null; }
}
