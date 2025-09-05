import { searchText, photoUrl } from "@/lib/places";

const cache = new Map<string, string>();

export async function getImageForHotel(name: string, city?: string, maxWidth = 1200): Promise<string | null> {
  const key = `${name}|${city || ""}|${maxWidth}`.toLowerCase();
  if (cache.has(key)) return cache.get(key)!;
  const q = city ? `${name} ${city}` : name;
  const res = await searchText(q);
  const ref = res.results?.[0]?.photos?.[0]?.photo_reference;
  if (!ref) return null;
  const url = photoUrl(ref, maxWidth);
  cache.set(key, url);
  return url;
}

