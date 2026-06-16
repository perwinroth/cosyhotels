// Standalone test harness: OSM hotel discovery + OSM-tuned cosy scoring.
// Run: node --experimental-strip-types scripts/test-osm-cosy.ts <City> [--context]
// No build step, no API keys. Proves search returns hotels AND that they are
// ranked by genuine cosiness (small/independent/charming), not just by stars.

import { osmSearchHotels, type OSMHotel } from '../src/lib/vendors/osm.ts';
import { osmCosyScore } from '../src/lib/scoring/osmCosy.ts';
import { getOSMContext } from '../src/lib/context/osm.ts';
import type { ContextSignals } from '../src/lib/scoring/cosy.ts';

async function main() {
  const city = process.argv[2] || 'Paris';
  const enrich = process.argv.includes('--context'); // per-hotel geo context (slower)
  console.error(`\nSearching OSM for lodging in: ${city}${enrich ? ' (with geo-context)' : ''}`);
  const hotels = await osmSearchHotels(city);
  console.error(`OSM returned ${hotels.length} lodging places.`);
  if (!hotels.length) {
    console.error('NO RESULTS — geocoding or Overpass failed for this city.');
    process.exit(2);
  }

  type Scored = { h: OSMHotel; cosy: number; parts: Record<string, number> };
  const scored: Scored[] = [];
  for (const h of hotels) {
    let ctx: ContextSignals = {};
    const { cosy, parts } = osmCosyScore(h, ctx);
    scored.push({ h, cosy, parts });
  }

  // Optional: enrich geo-context only for the top candidates (polite to Overpass)
  if (enrich) {
    scored.sort((a, b) => b.cosy - a.cosy);
    const topN = scored.slice(0, 25);
    for (const s of topN) {
      const ctx = await getOSMContext(s.h.lat, s.h.lng);
      const { cosy, parts } = osmCosyScore(s.h, ctx);
      s.cosy = cosy; s.parts = parts;
    }
  }

  scored.sort((a, b) => b.cosy - a.cosy);

  const fmt = (n: number) => n.toFixed(2);
  const tag = (h: OSMHotel) => {
    const f: string[] = [h.type];
    if (h.stars) f.push(`${h.stars}*`);
    if (h.brand) f.push(`chain:${h.brand}`);
    if (h.rooms) f.push(`${h.rooms}rm`);
    if (h.website) f.push('web');
    return f.join(', ');
  };

  console.log(`\n=== TOP 15 COSIEST in ${city} (of ${scored.length}) ===`);
  for (const s of scored.slice(0, 15)) {
    console.log(`${fmt(s.cosy).padStart(5)}  ${s.h.name}  [${tag(s.h)}]`);
  }

  console.log(`\n=== BOTTOM 8 (should be chains / hostels / grand / motels) ===`);
  for (const s of scored.slice(-8)) {
    console.log(`${fmt(s.cosy).padStart(5)}  ${s.h.name}  [${tag(s.h)}]`);
  }

  const scores = scored.map((s) => s.cosy);
  const max = Math.max(...scores), min = Math.min(...scores);
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  const spread = max - min;
  // How many "cosy" (>=7) vs the type mix at the top
  const top15 = scored.slice(0, 15);
  const grandAtTop = top15.filter((s) => s.h.stars === 5 || /grand|palace|palais|royal/i.test(s.h.name)).length;
  const chainAtTop = top15.filter((s) => s.h.brand).length;
  const indieGuestAtTop = top15.filter((s) => ['guest_house', 'chalet', 'bed_and_breakfast'].includes(s.h.type) || (!s.h.brand && (s.h.stars == null || s.h.stars <= 3))).length;
  console.log(`\nSTATS city=${city} count=${scored.length} max=${fmt(max)} avg=${fmt(avg)} min=${fmt(min)} spread=${fmt(spread)}`);
  console.log(`QUALITY top15: grand/palace=${grandAtTop} (want 0)  chains=${chainAtTop} (want 0)  indie-small/guesthouse=${indieGuestAtTop} (want high)`);
  console.log(`ASSERT ${JSON.stringify({ city, count: scored.length, max, avg, min, spread, grandAtTop, chainAtTop, indieGuestAtTop })}`);
}

main().catch((e) => { console.error('FATAL', e); process.exit(1); });
