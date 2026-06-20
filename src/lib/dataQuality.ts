// Automated data-quality checks — deterministic, no Claude. Two questions:
//  (1) Are we LINKING RIGHT? → the hotel must actually sit in the city it's shown under.
//  (2) Is the RATING RIGHT? → it must have been scored on real data, not just its name.
import { bboxFor } from "@/data/cityCoords";

export type HotelQA = {
  id?: string; name?: string | null; city?: string | null;
  lat?: number | null; lng?: number | null;
  website?: string | null; reviews_count?: number | null;
  amenities?: string[] | null; rooms_count?: number | null; rating?: number | null;
};

// Geo: if we have coordinates and a known bbox for the named city, the hotel must sit inside it
// (with a metro-spread pad). Catches "Oxford hotel shown under Sunderland" at the data level.
export function geoConsistent(h: HotelQA): { ok: boolean; checked: boolean } {
  if (h.lat == null || h.lng == null || !h.city) return { ok: true, checked: false };
  const bb = bboxFor(h.city);
  if (!bb) return { ok: true, checked: false };
  const pad = 0.4; // ~30–45 km tolerance for greater-metro spread
  const ok = h.lat >= bb.minLat - pad && h.lat <= bb.maxLat + pad && h.lng >= bb.minLng - pad && h.lng <= bb.maxLng + pad;
  return { ok, checked: true };
}

// Rating trust: did the hotel have ANY real signal to score on, or only a name + city?
// A name-only score (e.g. "Arden Lodge — the lodge-style name suggests…") is low-confidence.
export function ratingHasRealData(h: HotelQA): boolean {
  if (h.website && /^https?:\/\//i.test(h.website)) return true;
  if (typeof h.reviews_count === "number" && h.reviews_count > 0) return true;
  if (Array.isArray(h.amenities) && h.amenities.length > 0) return true;
  if (typeof h.rooms_count === "number" && h.rooms_count > 0) return true;
  if (typeof h.rating === "number" && h.rating > 0) return true;
  return false;
}

export function validateHotel(h: HotelQA): { ok: boolean; geoOk: boolean; geoChecked: boolean; ratingOk: boolean; issues: string[] } {
  const geo = geoConsistent(h);
  const ratingOk = ratingHasRealData(h);
  const issues: string[] = [];
  if (geo.checked && !geo.ok) issues.push("geo_outside_city");
  if (!ratingOk) issues.push("rating_name_only");
  return { ok: issues.length === 0, geoOk: geo.ok, geoChecked: geo.checked, ratingOk, issues };
}
