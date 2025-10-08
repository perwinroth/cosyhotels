import { getServerSupabase } from "@/lib/supabase/server";
import { bookingSearchUrl } from "@/lib/affiliates";

async function fetchHtml(url: string) {
  const res = await fetch(url, {
    redirect: 'follow',
    next: { revalidate: 86400 },
    headers: {
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123 Safari/537.36',
      'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'accept-language': 'en-US,en;q=0.9'
    }
  });
  if (!res.ok) return null;
  return await res.text();
}

async function bookingPropertyOg(name: string, city?: string, country?: string) {
  try {
    const searchUrl = bookingSearchUrl({ name, city: city || '', country: country || '' });
    const html = await fetchHtml(searchUrl);
    if (!html) return null;
    const m = html.match(/href=\"(\/hotel\/[^\"]+\.html[^\"]*)\"/i);
    const rel = m ? m[1] : null;
    if (!rel) return null;
    const propUrl = new URL(rel, 'https://www.booking.com').toString();
    const propHtml = await fetchHtml(propUrl);
    if (!propHtml) return null;
    const og = propHtml.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)/i);
    const url = og ? og[1] : null;
    if (url && url.startsWith('//')) return 'https:' + url;
    return url;
  } catch { return null; }
}

async function expediaPropertyOg(name: string, city?: string, country?: string) {
  try {
    const u = new URL('https://www.expedia.com/Hotel-Search');
    const dest = [city || '', country || ''].filter(Boolean).join(', ');
    if (dest) u.searchParams.set('destination', dest);
    if (name) u.searchParams.set('keyword', name);
    const html = await fetchHtml(u.toString());
    if (!html) return null;
    const m = html.match(/href=\"(\/Hotel-Information[^\"]*)\"/i) || html.match(/href=\"(\/Hotel-Detail[^\"]*)\"/i);
    const rel = m ? m[1] : null;
    if (!rel) return null;
    const propUrl = new URL(rel, 'https://www.expedia.com').toString();
    const propHtml = await fetchHtml(propUrl);
    if (!propHtml) return null;
    const og = propHtml.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)/i);
    let url = og ? og[1] : null;
    if (!url) {
      const tw = propHtml.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)/i);
      url = tw ? tw[1] : null;
    }
    if (url && url.startsWith('//')) return 'https:' + url;
    return url;
  } catch { return null; }
}

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
  // Try Booking property page OG first (more specific)
  const bk = await bookingPropertyOg(name, city, country);
  if (bk) {
    try { const supa = getServerSupabase(); if (supa) await supa.from('hotel_images').insert({ hotel_id: id, url: bk }); } catch {}
    return bk;
  }
  // Try Expedia property OG as secondary
  try {
    const img = await expediaPropertyOg(name, city, country);
    const supabase = getServerSupabase();
    if (img && supabase) {
      try { await supabase.from('hotel_images').insert({ hotel_id: id, url: img }); } catch {}
    }
    return img;
  } catch { return null; }
}
