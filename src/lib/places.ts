const API = "https://maps.googleapis.com/maps/api/place";

export type PlaceSearchResult = {
  place_id: string;
  name: string;
  formatted_address?: string;
  rating?: number;
  user_ratings_total?: number;
  photos?: { photo_reference: string; width: number; height: number }[];
};

export type PlaceSearchResponse = {
  results: PlaceSearchResult[];
  next_page_token?: string;
};

type GPhoto = { photo_reference?: string; width?: number; height?: number };
type GResult = {
  place_id?: string;
  name?: string;
  formatted_address?: string;
  rating?: number;
  user_ratings_total?: number;
  photos?: GPhoto[];
};

export async function searchText(query: string, pagetoken?: string): Promise<PlaceSearchResponse> {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) return { results: [] };
  const params = new URLSearchParams({ query, key });
  if (pagetoken) params.set("pagetoken", pagetoken);
  const url = `${API}/textsearch/json?${params.toString()}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return { results: [] };
  const json = await res.json();
  const resultsSrc: GResult[] = (json.results || []) as GResult[];
  return {
    results: resultsSrc.map((r) => ({
      place_id: r.place_id as string,
      name: (r.name as string) || "",
      formatted_address: r.formatted_address,
      rating: r.rating,
      user_ratings_total: r.user_ratings_total,
      photos: (r.photos || []).map((p: GPhoto) => ({
        photo_reference: p.photo_reference as string,
        width: (p.width as number) || 0,
        height: (p.height as number) || 0,
      })),
    })),
    next_page_token: json.next_page_token as string | undefined,
  };
}

export type PlaceDetails = {
  place_id: string;
  name: string;
  formatted_address?: string;
  geometry?: { location: { lat: number; lng: number } };
  rating?: number;
  user_ratings_total?: number;
  website?: string;
  international_phone_number?: string;
  types?: string[];
  price_level?: number;
  photos?: { photo_reference: string; width: number; height: number }[];
  editorial_summary?: { overview: string };
};

export async function getDetails(placeId: string): Promise<PlaceDetails | null> {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) return null;
  const fields = [
    "place_id",
    "name",
    "formatted_address",
    "geometry/location",
    "rating",
    "user_ratings_total",
    "website",
    "international_phone_number",
    "types",
    "price_level",
    "photos",
    "editorial_summary",
  ].join(",");
  const url = `${API}/details/json?${new URLSearchParams({ place_id: placeId, fields, key }).toString()}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return null;
  const json = await res.json();
  return (json.result as PlaceDetails | undefined) || null;
}

export function photoUrl(ref: string, maxwidth = 800) {
  // If no API key, return placeholder to avoid broken images in production
  if (!process.env.GOOGLE_MAPS_API_KEY) return "/logo-seal.svg";
  // Use our proxy endpoint so the API key stays server-side
  return `/api/places/photo?ref=${encodeURIComponent(ref)}&maxwidth=${maxwidth}`;
}
