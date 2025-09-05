import { searchText, photoUrl } from "@/lib/places";
import { getServerSupabase } from "@/lib/supabase/server";

const cache = new Map<string, string>();

export async function getImageForHotel(name: string, city?: string, maxWidth = 1200, slug?: string, hotelId?: string): Promise<string | null> {
  const key = `${name}|${city || ""}|${maxWidth}`.toLowerCase();
  if (cache.has(key)) return cache.get(key)!;
  // Try Supabase cache first
  try {
    const supabase = getServerSupabase();
    if (supabase && (slug || hotelId)) {
      let q = supabase.from('hotel_images').select('url').order('created_at', { ascending: false }).limit(1);
      if (slug) q = q.eq('slug', slug);
      else if (hotelId) q = q.eq('hotel_id', hotelId);
      const { data } = await q;
      const url = data?.[0]?.url as string | undefined;
      if (url) {
        cache.set(key, url);
        return url;
      }
    }
  } catch {}
  const q = city ? `${name} ${city}` : name;
  const res = await searchText(q);
  const ref = res.results?.[0]?.photos?.[0]?.photo_reference;
  if (!ref) return null;
  const url = photoUrl(ref, maxWidth);
  cache.set(key, url);
  // Save resolved image to Supabase cache
  try {
    const supabase = getServerSupabase();
    if (supabase && (slug || hotelId)) {
      await supabase.from('hotel_images').insert({ slug: slug || null, hotel_id: hotelId || null, url, width: maxWidth }).throwOnError();
    }
  } catch {}
  return url;
}
