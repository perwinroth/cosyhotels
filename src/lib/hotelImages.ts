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
  // Do not query Google Places for images. If not cached in Supabase, return null.
  return null;
}
