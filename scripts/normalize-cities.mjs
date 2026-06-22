// Normalize polluted `hotels.city` values — strip postcodes + province/state codes so the
// city is a clean name ("75100 Matera MT" → "Matera"). DRY-RUN by default: prints what would
// change and never writes. Pass --execute to apply (snapshots to scripts/backups first).
//
//   node scripts/normalize-cities.mjs            # dry-run, full impact report
//   node scripts/normalize-cities.mjs --execute  # apply (writes a backup first)
import { createClient } from "@supabase/supabase-js";
import { writeFileSync, mkdirSync } from "fs";

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE,
);
const EXECUTE = process.argv.includes("--execute");

// Local-language → canonical English city name, so cleaned cities match the KNOWN city list
// (src/lib/citySlug.ts) and group onto the right /guides page + rank for English SEO.
const ALIAS = {
  "Roma": "Rome", "Venezia": "Venice", "Firenze": "Florence", "Milano": "Milan",
  "Napoli": "Naples", "Torino": "Turin", "Genova": "Genoa", "Padova": "Padua",
  "Venezia Mestre": "Venice", "Roma Capitale": "Rome",
  "München": "Munich", "Köln": "Cologne", "Nürnberg": "Nuremberg", "Wien": "Vienna",
  "Praha": "Prague", "Lisboa": "Lisbon", "Porto": "Porto",
  "Sevilla": "Seville", "Cádiz": "Cadiz", "Córdoba": "Cordoba",
  "Bruxelles": "Brussels", "Brussel": "Brussels", "Antwerpen": "Antwerp", "Gent": "Ghent",
  "Den Haag": "The Hague", "København": "Copenhagen", "Göteborg": "Gothenburg",
  "Warszawa": "Warsaw", "Kraków": "Krakow", "Wrocław": "Wroclaw", "Gdańsk": "Gdansk",
  "Moskva": "Moscow", "Genève": "Geneva", "Zürich": "Zurich", "Athína": "Athens",
  "Lëtzebuerg": "Luxembourg", "Reykjavík": "Reykjavik",
};
function canonical(s) { return ALIAS[s] || s; }

// Returns { clean, how }. `how` buckets the outcome so we can see recoverable vs needs-geocode.
function cleanCity(raw) {
  if (!raw) return { clean: "", how: "empty" };
  let s = String(raw).trim();
  const orig = s;
  // US "NY 10001" / "CA 92651" — state + zip, NO city present → not recoverable by stripping.
  if (/^[A-Z]{2}\s+\d{3,}$/.test(s)) return { clean: "", how: "us_state_zip_nocity" };
  // Strip leading postcode forms (order matters — specific split/hyphen forms before generic):
  s = s.replace(/^\d{3}\s+\d{2}\s+/, "");       // SE split "113 48 Stockholm" → "Stockholm"
  s = s.replace(/^\d{2}-\d{3}\s+/, "");         // PL "00-001 Warszawa"
  s = s.replace(/^\d{4}-\d{3}\s+/, "");         // PT "1000-001 Lisboa"
  s = s.replace(/^\d{3,6}\s+[A-Z]{2}\s+/, "");  // NL "1017 SV Amsterdam" → "Amsterdam"
  s = s.replace(/^\d{3,6}\s+/, "");             // generic "75004 Paris" → "Paris"
  s = s.replace(/\s+[A-Z]{1,3}$/, "");          // trailing province/state code (MT, RM, BR, NA…)
  s = s.replace(/\s{2,}/g, " ").trim();
  if (!s) return { clean: "", how: "emptied" };
  if (s === orig) return { clean: s, how: "unchanged" };
  return { clean: s, how: "stripped" };
}

// Pull every hotel (paged) so the report covers the whole catalog, not just featured.
const PAGE = 1000;
let from = 0, all = [];
for (;;) {
  const { data, error } = await db.from("hotels").select("id,name,city,address,lat,lng").range(from, from + PAGE - 1);
  if (error) { console.error("query error:", error.message); process.exit(1); }
  if (!data || !data.length) break;
  all.push(...data);
  if (data.length < PAGE) break;
  from += PAGE;
}
console.log(`catalog hotels: ${all.length}`);

const buckets = {};
const changes = [];
for (const h of all) {
  let { clean, how } = cleanCity(h.city);
  // No city in the field (US "NY 10001", or stripped to empty) → recover it from the full
  // address: "184 N Glade Rd, Swanton, MD 21561, USA" → "Swanton".
  if ((how === "us_state_zip_nocity" || how === "emptied" || how === "empty") && h.address) {
    const m = String(h.address).match(/,\s*([^,]+?),\s*[A-Z]{2}\s+\d{3,}/);
    if (m) { clean = m[1].trim(); how = "from_address"; }
  }
  // Canonicalize local→English (Venezia→Venice) on whatever we ended with.
  const canon = clean ? canonical(clean) : clean;
  if (canon !== clean) { how = how === "unchanged" ? "aliased" : `${how}+aliased`; clean = canon; }
  buckets[how] = (buckets[how] || 0) + 1;
  if (clean && clean !== h.city) changes.push({ id: h.id, from: h.city, to: clean });
}
console.log("\noutcome buckets:");
for (const [k, v] of Object.entries(buckets).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${k.padEnd(22)} ${v} (${(100 * v / all.length).toFixed(0)}%)`);
}
console.log(`\nwould REWRITE (stripped → clean): ${changes.length}`);
console.log("sample changes:");
changes.slice(0, 20).forEach((c) => console.log(`   ${JSON.stringify(c.from)}  →  ${JSON.stringify(c.to)}`));
const needGeocode = (buckets.us_state_zip_nocity || 0) + (buckets.emptied || 0);
console.log(`\nNOT recoverable by stripping (need lat/lng reverse-geocode against local cities): ${needGeocode}`);

if (!EXECUTE) {
  console.log("\nDRY-RUN — no writes. Re-run with --execute to apply (a backup is written first).");
  process.exit(0);
}

// --execute: snapshot the originals, then write in batches.
mkdirSync("scripts/backups", { recursive: true });
const stamp = process.env.STAMP || "manual";
const backup = `scripts/backups/city-normalize-${stamp}.json`;
writeFileSync(backup, JSON.stringify(changes, null, 2));
console.log(`\nbackup written: ${backup} (${changes.length} rows) — restore by re-applying .from`);
let done = 0;
for (const c of changes) {
  const { error } = await db.from("hotels").update({ city: c.to }).eq("id", c.id);
  if (error) { console.error(`  FAIL ${c.id}: ${error.message}`); continue; }
  if (++done % 200 === 0) console.log(`  updated ${done}/${changes.length}`);
}
console.log(`done — ${done} cities normalized.`);
