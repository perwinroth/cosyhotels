// Free image sweep for EVERY hotel that lacks a usable photo (no image, placeholder-only, or
// junk-only). Uses the free resolver (website og:image → Wikidata → name-matched Wikimedia geo
// → Instagram profile og:image → placeholder). Inserts a vision_ok=null row. $0, idempotent
// (re-runs skip hotels that already have a usable photo). DRY-RUN by default.
//
//   set -a && . ./.env.local && set +a
//   npx tsx scripts/resolve-missing.ts                 # dry-run: counts + previews 8
//   npx tsx scripts/resolve-missing.ts --execute       # full sweep (backs up inserted rows)
//   flags: --limit N
import { createClient } from "@supabase/supabase-js";
import { writeFileSync, mkdirSync } from "fs";
import { resolveHotelImage } from "../src/lib/hotelImageFree.ts";
import { junkByUrl } from "../src/lib/imageJunk.ts";

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE!);
const args = process.argv.slice(2);
const EXECUTE = args.includes("--execute");
const LIMIT = args.includes("--limit") ? Number(args[args.indexOf("--limit") + 1]) : Infinity;
const CONC = 6;

type H = { id: string; name: string; website: string | null; city: string | null; lat: number | null; lng: number | null; instagram: string | null };

let off = 0; const hotels: H[] = [];
for (;;) { const { data, error } = await db.from("hotels").select("id,name,website,city,lat,lng,instagram").range(off, off + 999);
  if (error) { console.error(error.message); process.exit(1); } if (!data?.length) break; hotels.push(...(data as H[])); if (data.length < 1000) break; off += 1000; }

const usable = new Set<string>();
off = 0; for (;;) { const { data } = await db.from("hotel_images").select("hotel_id,url,vision_ok").range(off, off + 999);
  if (!data?.length) break; for (const im of data) { const u = im.url || ""; if (u && !u.includes("placehold.co") && im.vision_ok !== false) usable.add(String(im.hotel_id)); } if (data.length < 1000) break; off += 1000; }

let missing = hotels.filter((h) => !usable.has(String(h.id)));
if (Number.isFinite(LIMIT)) missing = missing.slice(0, LIMIT);
console.log(`hotels ${hotels.length} · already have a usable photo ${usable.size} · MISSING to resolve ${missing.length}\n`);

if (!EXECUTE) {
  console.log("DRY-RUN. Previewing the resolver on 8 missing hotels (which source wins):");
  for (const h of missing.slice(0, 8)) {
    const r = await resolveHotelImage({ name: h.name, website: h.website, lat: h.lat, lng: h.lng, city: h.city, instagram: h.instagram });
    console.log(`  ${r.source.padEnd(11)} ${(h.name || "").slice(0, 30).padEnd(30)} ${(r.url || "").slice(0, 52)}`);
  }
  console.log("\nAdd --execute to sweep all of them (background recommended).");
  process.exit(0);
}

mkdirSync("scripts/backups", { recursive: true });
const stamp = process.env.STAMP || "manual";
const added: Array<{ hotel_id: string; url: string }> = [];
let done = 0, found = 0; const bySource: Record<string, number> = {};
async function worker(h: H) {
  try {
    const r = await resolveHotelImage({ name: h.name, website: h.website, lat: h.lat, lng: h.lng, city: h.city, instagram: h.instagram });
    bySource[r.source] = (bySource[r.source] || 0) + 1;
    if (r.source !== "placeholder") {
      // Stage-1 junk gate: never STORE a logo / blank / banner / share-card. If the best
      // candidate is junk-by-URL, treat the hotel as still-missing (don't insert) rather than
      // poison it with a non-photo. Pixel/vision junk is caught downstream.
      const jv = junkByUrl(r.url);
      if (jv.junk) { bySource[`junk:${jv.reason.split(":")[0]}`] = (bySource[`junk:${jv.reason.split(":")[0]}`] || 0) + 1; }
      else { found++; added.push({ hotel_id: h.id, url: r.url }); await db.from("hotel_images").insert({ hotel_id: h.id, url: r.url, attributions: r.attribution ?? null, vision_ok: null }); }
    }
  } catch { /* skip */ } finally { done++; if (done % 250 === 0) console.log(`  ${done}/${missing.length} · found ${found} · ${JSON.stringify(bySource)}`); }
}
let idx = 0;
async function pool() { while (idx < missing.length) { const h = missing[idx++]; await worker(h); } }
await Promise.all(Array.from({ length: CONC }, () => pool()));
writeFileSync(`scripts/backups/resolve-missing-${stamp}.json`, JSON.stringify(added, null, 2));
console.log(`\ndone — ${found} real photos added across ${missing.length} hotels. sources: ${JSON.stringify(bySource)}`);
console.log(`backup (inserted rows, for rollback): scripts/backups/resolve-missing-${stamp}.json`);
