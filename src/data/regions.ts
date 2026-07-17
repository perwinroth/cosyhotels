// Curated famous travel "areas" (Amalfi Coast, Tuscany, Cotswolds…) resolved GEOGRAPHICALLY by a
// bounding box — no per-town maintenance, catches every village inside the box. This is the region
// analogue of the country hubs: one page per area, ranking the cosiest live hotels within it.
//
// bbox = [minLng, minLat, maxLng, maxLat] (GeoJSON order = [west, south, east, north]).
// Boxes are kept TIGHT so they don't bleed into neighbouring areas (Amalfi excludes Sorrento/Naples).
// The trailing count is the live-hotel tally (score ≥ 5) verified at authoring time — only areas that
// clear the hub bar are seeded. To add one: pick a tight box, confirm the count via loadRegionHotels.
export type Region = {
  name: string;
  slug: string;
  country: string; // display country, for copy + schema
  the: boolean;    // whether the name takes a definite article ("the Amalfi Coast" vs "Tuscany")
  bbox: [number, number, number, number];
  blurb: string;
};

export const REGIONS: Region[] = [
  { name: "Tuscany", slug: "tuscany", country: "Italy", the: false, bbox: [9.7, 42.2, 12.4, 44.5], blurb: "Rolling vineyards, cypress-lined lanes and hilltop towns, the cosiest agriturismi and boutique boltholes across Tuscany." }, // 281
  { name: "Bavaria", slug: "bavaria", country: "Germany", the: false, bbox: [9.0, 47.3, 13.8, 50.5], blurb: "Alpine lakes, beer gardens and storybook villages, warm, characterful stays across Bavaria, from Munich to the mountains." }, // 195
  { name: "Andalusia", slug: "andalusia", country: "Spain", the: false, bbox: [-7.5, 36.0, -1.6, 38.7], blurb: "Moorish courtyards, white villages and sun-warmed patios, the most intimate places to stay across southern Spain." }, // 120
  { name: "Scottish Highlands", slug: "scottish-highlands", country: "Scotland", the: true, bbox: [-6.3, 56.6, -3.4, 58.7], blurb: "Lochs, glens and fireside drams, the cosiest inns and country houses across the Scottish Highlands." }, // 67
  { name: "Amalfi Coast", slug: "amalfi-coast", country: "Italy", the: true, bbox: [14.45, 40.58, 14.65, 40.68], blurb: "Cliffside villages tumbling to the sea, the warmest, most intimate stays in Positano, Amalfi, Ravello and beyond." }, // 52
  { name: "Provence", slug: "provence", country: "France", the: false, bbox: [4.6, 43.2, 6.6, 44.4], blurb: "Lavender fields, stone farmhouses and market towns, the cosiest mas and boutique hotels across Provence." }, // 35
  { name: "Lake District", slug: "lake-district", country: "England", the: true, bbox: [-3.35, 54.35, -2.85, 54.75], blurb: "Fells, tarns and slate-roofed villages, snug inns and country houses at the heart of England's Lake District." }, // 28
  { name: "Dolomites", slug: "dolomites", country: "Italy", the: true, bbox: [11.2, 46.2, 12.4, 46.8], blurb: "Jagged peaks, timber chalets and mountain warmth, the cosiest stays across the Italian Dolomites." }, // 15
  { name: "Cotswolds", slug: "cotswolds", country: "England", the: true, bbox: [-2.2, 51.6, -1.6, 52.1], blurb: "Honey-stone cottages, log fires and rolling hills, the most charming small hotels and inns across the Cotswolds." }, // 8
];

export const regionBySlug = (slug: string): Region | undefined => REGIONS.find((r) => r.slug === slug);

// "in the Amalfi Coast" vs "in Tuscany" — build the article-aware place phrase used across copy.
export const regionLabel = (r: { name: string; the: boolean }): string => (r.the ? `the ${r.name}` : r.name);
