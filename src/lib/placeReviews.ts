// Fetch a hotel's guest-review SNIPPETS from Google Places (New) to feed the cosy scorer.
// We pass the review TEXT to Claude at scoring time and store ONLY the derived cosy
// score/signals — never the raw review text (keeps us out of ToS/copyright trouble).
//
// One billed call per hotel: places:searchText with a field mask that includes reviews
// (Atmosphere SKU). Location-biased by the hotel's coords for accuracy. Returns [] on any
// error / missing key / Places-not-enabled, so scoring continues without reviews.
const KEY = process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY || "";

export function reviewsEnabled(): boolean {
  return !!KEY;
}

export async function fetchPlaceReviews(
  name: string,
  city: string,
  lat?: number | null,
  lng?: number | null,
): Promise<string[]> {
  if (!KEY) return [];
  try {
    const body: Record<string, unknown> = { textQuery: `${name} ${city} hotel`, maxResultCount: 1 };
    if (lat != null && lng != null) {
      body.locationBias = { circle: { center: { latitude: lat, longitude: lng }, radius: 1000 } };
    }
    const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": KEY,
        // Tight field mask = only the Atmosphere fields we need (controls cost).
        "X-Goog-FieldMask": "places.reviews.text,places.reviews.rating",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const json = (await res.json()) as {
      places?: Array<{ reviews?: Array<{ text?: { text?: string }; rating?: number }> }>;
    };
    const reviews = json.places?.[0]?.reviews || [];
    return reviews
      .map((r) => (r.text?.text || "").replace(/\s+/g, " ").trim())
      .filter((t) => t.length > 0)
      .slice(0, 5);
  } catch {
    return [];
  }
}
