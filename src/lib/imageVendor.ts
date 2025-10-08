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
    const res = await fetch(base, {
      redirect: 'follow',
      next: { revalidate: 86400 },
      headers: {
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123 Safari/537.36',
        'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'accept-language': 'en-US,en;q=0.9'
      }
    });
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
    const res = await fetch(u.toString(), {
      redirect: 'follow',
      next: { revalidate: 86400 },
      headers: {
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123 Safari/537.36',
        'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'accept-language': 'en-US,en;q=0.9'
      }
    });
    if (!res.ok) return null;
    const html = await res.text();
    // Robust meta extraction: og:image, og:image:secure_url, twitter:image, and JSON-LD image
    const patterns = [
      /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)/i,
      /<meta[^>]+property=["']og:image:secure_url["'][^>]+content=["']([^"']+)/i,
      /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)/i,
    ];
    let img: string | null = null;
    for (const re of patterns) { const m = html.match(re); if (m && m[1]) { img = m[1]; break; } }
    if (!img) {
      const ld = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i);
      if (ld && ld[1]) {
        try {
          const json = JSON.parse(ld[1]);
          const i = (json && (json.image || (json.images && json.images[0]))) as string | undefined;
          if (i) img = i;
        } catch {}
      }
    }
    if (img && img.startsWith('//')) img = 'https:' + img;
    const supabase = getServerSupabase();
    if (img && supabase) {
      try { await supabase.from('hotel_images').insert({ hotel_id: id, url: img }); } catch {}
    }
    return img;
  } catch { return null; }
}
