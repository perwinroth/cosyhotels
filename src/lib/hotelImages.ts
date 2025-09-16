import { searchText, photoUrl } from "@/lib/places";
import { getServerSupabase } from "@/lib/supabase/server";

const cache = new Map<string, string>();

export async function getImageForHotel(name: string, city?: string, maxWidth = 800, slug?: string, hotelId?: string): Promise<string | null> {
  const key = `${name}|${city || ""}|${maxWidth}`.toLowerCase();
  if (cache.has(key)) return cache.get(key)!;
  // Try Supabase cache first
  try {
    const supabase = getServerSupabase();
    if (supabase && hotelId) {
      const { data } = await supabase
        .from('hotel_images')
        .select('url')
        .eq('hotel_id', hotelId)
        .order('created_at', { ascending: false })
        .limit(1);
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
    if (supabase && hotelId) {
      await supabase.from('hotel_images').insert({ hotel_id: hotelId, url, width: maxWidth }).throwOnError();
    }
  } catch {}
  return url;
}
