// OSM-tuned cosy scoring.
//
// WHY a separate scorer: the original cosyScore() leans heavily on star rating,
// review counts and tagged amenities. OSM lodging data has almost none of those
// (no reviews, rare amenities). Fed into that scorer, results collapse into a
// plain "sort by stars" — which surfaces 5-star GRAND hotels, the very opposite
// of cosy. This scorer instead models how PEOPLE perceive cosiness from the
// signals OSM actually provides: property type, independence, size, name
// character, star band (cosiness peaks mid-range), and physical setting.

import type { OSMHotel } from '../vendors/osm';
import type { ContextSignals } from './cosy';

// 1) Property TYPE — the single strongest cosy signal in OSM.
//    A guest house / chalet / B&B is inherently cosier than a big hotel.
const TYPE_SCORE: Record<string, number> = {
  guest_house: 2.4,
  bed_and_breakfast: 2.4,
  chalet: 2.2,
  apartment: 1.0,
  hotel: 0.8,
  motel: -1.0,
  hostel: -1.6,
};

// 2) STAR band — cosiness is an inverted-U. 2–3 stars is the sweet spot
//    (intimate, characterful). 5 stars usually means grand/formal, not cosy.
function starBand(stars?: number | null): number {
  if (stars == null || !Number.isFinite(stars) || stars <= 0) return 0.3; // untagged: mild positive (often small indies)
  switch (Math.round(stars)) {
    case 1: return 0.4;
    case 2: return 1.4;
    case 3: return 1.6;
    case 4: return 0.8;
    case 5: return -0.6; // grand/formal penalty
    default: return 0;
  }
}

// 3) Name CHARACTER — words humans read as warm/independent/charming.
const NAME_COSY = [
  'maison', 'manoir', 'villa', 'cottage', 'lodge', 'auberge', 'logis', 'chambre',
  'cabin', 'casa', 'locanda', 'pension', 'guest', 'gasthaus', 'gasthof', 'landhaus',
  'boutique', 'charme', 'charming', 'cosy', 'cozy', 'hygge', 'mysig', 'gemütlich',
  'jardin', 'garden', 'cour', 'courtyard', 'petit', 'petite', 'vieux', 'vieille',
  'atelier', 'residenza', 'palazzo', 'borgo', 'masseria', 'finca', 'mas', 'moulin',
  'ferme', 'farmhouse', 'barn', 'hof', 'haus', 'ryokan', 'machiya',
];
const NAME_GRAND = [
  'grand', 'palace', 'palais', 'royal', 'regency', 'imperial', 'plaza', 'majestic',
  'international', 'business', 'convention', 'conference', 'airport', 'express',
  'tower', 'towers', 'resort', 'spa resort', 'metropol', 'central station',
];

function nameCharacter(name: string): number {
  const n = name.toLowerCase();
  let s = 0;
  for (const k of NAME_COSY) if (n.includes(k)) { s += 0.6; break; } // cap one cosy hit
  for (const k of NAME_GRAND) if (n.includes(k)) { s -= 0.8; break; }
  return s;
}

// 4) INDEPENDENCE — a brand/chain tag is a strong cosy-killer.
const CHAIN_HINTS = [
  'ibis', 'mercure', 'novotel', 'accor', 'marriott', 'hilton', 'hyatt', 'radisson',
  'sheraton', 'holiday inn', 'best western', 'wyndham', 'premier inn', 'travelodge',
  'b&b hotel', 'campanile', 'kyriad', 'tapestry', 'doubletree', 'hampton', 'moxy',
  'kempinski', 'intercontinental', 'sofitel', 'pullman', 'autograph', 'curio',
];
function independence(h: OSMHotel): number {
  if (h.brand && h.brand.trim()) return -1.6;
  const hay = `${h.name} ${h.website ?? ''}`.toLowerCase();
  if (CHAIN_HINTS.some((c) => hay.includes(c))) return -1.4;
  return 0.3; // independent bonus
}

// 5) SIZE — small = cosy. OSM `rooms` is rarely tagged but valuable when present.
function sizeScore(rooms?: number | null): number {
  if (rooms == null || !Number.isFinite(rooms) || rooms <= 0) return 0;
  if (rooms <= 10) return 1.0;
  if (rooms <= 25) return 0.5;
  if (rooms <= 50) return 0;
  if (rooms <= 100) return -0.6;
  return -1.2;
}

// 6) SETTING — physical context from Overpass geo (nature, quiet, walkable).
function settingScore(ctx: ContextSignals): number {
  const nature = Math.min(1.4, (ctx.natureProximity ?? 0) * 1.4); // leafy/water nearby = very cosy
  const quiet = -Math.min(0.8, (ctx.nightlifeDensity ?? 0) * 0.8);  // bars/clubs = un-cosy
  const walk = Math.min(0.5, (ctx.walkability ?? 0) * 0.5);         // walkable lanes = cosy
  return nature + quiet + walk;
}

export type OSMCosyBreakdown = {
  cosy: number;
  parts: {
    type: number; stars: number; name: number; independence: number; size: number; setting: number;
  };
};

// Final score on a 0..10 scale, centered so a plain independent small hotel
// lands around 6 and a grand chain lands around 2–3.
export function osmCosyScore(h: OSMHotel, ctx: ContextSignals = {}): OSMCosyBreakdown {
  const tType = TYPE_SCORE[h.type] ?? 0.5;
  const tStars = starBand(h.stars);
  const tName = nameCharacter(h.name);
  const tIndep = independence(h);
  const tSize = sizeScore(h.rooms);
  const tSetting = settingScore(ctx);

  // Baseline 5.5 so the cosy/un-cosy signals push clearly above/below midpoint.
  let raw = 5.5 + tType + tStars + tName + tIndep + tSize + tSetting;
  raw = Math.max(0, Math.min(10, raw));
  return {
    cosy: raw,
    parts: { type: tType, stars: tStars, name: tName, independence: tIndep, size: tSize, setting: tSetting },
  };
}
