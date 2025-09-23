// Minimal Overpass/OSM context fetcher with simple heuristics and caching hints
export type OSMContext = {
  natureProximity: number;   // 0..1 (forest/park/water within ~400m)
  nightlifeDensity: number;  // 0..1 (bars/clubs within 250m)
  walkability: number;       // 0..1 (pedestrian POIs within 500m)
};

function clamp01(x: number) { return Math.max(0, Math.min(1, x)); }

export async function getOSMContext(lat?: number | null, lng?: number | null): Promise<OSMContext> {
  if (lat == null || lng == null) return { natureProximity: 0, nightlifeDensity: 0, walkability: 0 };
  const radiusNight = 250; // m
  const radiusNature = 400;
  const radiusWalk = 500;
  const endpoint = 'https://overpass-api.de/api/interpreter';
  // Build Overpass QL — keep it compact to be polite
  const q = `
    [out:json][timeout:10];
    (
      node(around:${radiusNight},${lat},${lng})[amenity=bar];
      node(around:${radiusNight},${lat},${lng})[amenity=nightclub];
      way(around:${radiusNight},${lat},${lng})[amenity=bar];
      way(around:${radiusNight},${lat},${lng})[amenity=nightclub];
    )->.night;
    (
      way(around:${radiusNature},${lat},${lng})[leisure=park];
      way(around:${radiusNature},${lat},${lng})[natural=wood];
      way(around:${radiusNature},${lat},${lng})[natural=forest];
      way(around:${radiusNature},${lat},${lng})[natural=water];
    )->.nature;
    (
      node(around:${radiusWalk},${lat},${lng})[highway=pedestrian];
      way(around:${radiusWalk},${lat},${lng})[highway=pedestrian];
      node(around:${radiusWalk},${lat},${lng})[shop];
      node(around:${radiusWalk},${lat},${lng})[amenity=cafe];
      node(around:${radiusWalk},${lat},${lng})[amenity=restaurant];
    )->.walk;
    out count ::night; out count ::nature; out count ::walk;
  `;
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ data: q }),
      // Cache gently to avoid rate limits during cron runs
      next: { revalidate: 86400 },
      cache: 'force-cache',
    });
    if (!res.ok) return { natureProximity: 0, nightlifeDensity: 0, walkability: 0 };
    const json = await res.json() as { elements?: Array<{ tags?: { total?: string } }> };
    // Overpass returns an array of objects with type "count"
    const counts: number[] = (json.elements || []).map((e) => (typeof e.tags?.total === 'string' ? Number(e.tags.total) : 0));
    const [night = 0, nature = 0, walk = 0] = counts;
    // Map counts to 0..1 via soft saturating curves
    const nightlifeDensity = clamp01(night / 10);   // >10 bars/clubs nearby is saturated busy
    const natureProximity = clamp01(nature / 2);    // any nature polygons nearby saturate quickly
    const walkability = clamp01(walk / 30);         // many pedestrian/shops/cafes within 500m
    return { natureProximity, nightlifeDensity, walkability };
  } catch {
    return { natureProximity: 0, nightlifeDensity: 0, walkability: 0 };
  }
}
