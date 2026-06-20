#!/usr/bin/env node
// Ingest lodging POIs from Overture Maps Places (free, CDLA-permissive, ~60M POIs) into the
// Supabase `hotels` table for a given city/bounding box. World coverage, no per-record cost.
//
// WHY: OSM is sparse outside big cities; Overture conflates OSM + Foursquare + Meta. We
// ingest hotels broadly + free here; they are inserted UNSCORED and get picked up by the
// recompute-scores cron (which scores them once, with vision). Coverage is grown lazily per
// city — do NOT bulk-ingest the planet (scoring cost is the real constraint, not data).
//
// SETUP:
//   npm i -D @duckdb/node-api
//   export $(grep -v '^#' .env.local | xargs)   # needs NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
// RUN:
//   node scripts/ingest-overture.mjs "Stockholm"            # geocodes the city to a bbox
//   node scripts/ingest-overture.mjs 17.9 59.2 18.2 59.4    # explicit bbox: west south east north
//
// Overture release pinned below — bump periodically.
import { DuckDBInstance } from "@duckdb/node-api";
import { createClient } from "@supabase/supabase-js";

const OVERTURE_RELEASE = "2026-06-17.0";
const PLACES_PATH = `s3://overturemaps-us-west-2/release/${OVERTURE_RELEASE}/theme=places/type=place/*`;
// Overture categories.primary values that denote bookable lodging.
const LODGING = ["accommodation", "hotel", "motel", "hostel", "bed_and_breakfast", "guest_house", "inn", "resort", "lodge", "cottage", "chalet"];

const UA = "cosyhotels/1.0 (+https://www.cosyhotelroom.com; ingest)";

async function geocodeBbox(city) {
  const u = new URL("https://nominatim.openstreetmap.org/search");
  u.searchParams.set("q", city);
  u.searchParams.set("format", "jsonv2");
  u.searchParams.set("limit", "1");
  const r = await fetch(u, { headers: { "User-Agent": UA } });
  const a = await r.json();
  if (!Array.isArray(a) || !a[0]?.boundingbox) throw new Error(`could not geocode ${city}`);
  const bb = a[0].boundingbox.map(Number); // [south, north, west, east]
  return { west: bb[2], south: bb[0], east: bb[3], north: bb[1], country: String(a[0].display_name).split(",").pop()?.trim() || null };
}

async function main() {
  const args = process.argv.slice(2);
  let box, country = null;
  if (args.length === 4) {
    const [west, south, east, north] = args.map(Number);
    box = { west, south, east, north };
  } else if (args.length === 1) {
    const g = await geocodeBbox(args[0]);
    box = g; country = g.country;
  } else {
    console.error("usage: ingest-overture.mjs <city> | <west south east north>");
    process.exit(1);
  }

  const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPA_URL || !SUPA_KEY) throw new Error("Supabase env not set");
  const db = createClient(SUPA_URL, SUPA_KEY, { auth: { persistSession: false } });

  const cats = LODGING.map((c) => `'${c}'`).join(",");
  const sql = `
    INSTALL httpfs; LOAD httpfs; INSTALL spatial; LOAD spatial;
    SET s3_region='us-west-2';
    SELECT id,
           names.primary AS name,
           ST_X(geometry) AS lng, ST_Y(geometry) AS lat,
           categories.primary AS category,
           websites[1] AS website,
           addresses[1].freeform AS address,
           addresses[1].locality AS city,
           addresses[1].country AS country
    FROM read_parquet('${PLACES_PATH}', filename=false, hive_partitioning=1)
    WHERE bbox.xmin > ${box.west} AND bbox.xmax < ${box.east}
      AND bbox.ymin > ${box.south} AND bbox.ymax < ${box.north}
      AND categories.primary IN (${cats})
      AND names.primary IS NOT NULL;
  `;

  console.log(`Querying Overture ${OVERTURE_RELEASE} for bbox`, box, "…");
  const instance = await DuckDBInstance.create(":memory:");
  const conn = await instance.connect();
  const reader = await conn.runAndReadAll(sql);
  const rows = reader.getRowObjects();
  console.log(`Overture returned ${rows.length} lodging POIs.`);

  // Duplicate-prevention gate: load every existing hotel's dedup_key once, then skip any
  // incoming POI we already have (same normalized name+city). Keeps the catalogue from refilling.
  const dkey = (name, city) => { const n = (s) => String(s || "").toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, " ").trim(); const nm = n(name); return nm ? `${nm}|${n(city)}` : ""; };
  const known = new Set();
  for (let from = 0; ; from += 1000) {
    const { data } = await db.from("hotels").select("dedup_key").not("dedup_key", "is", null).range(from, from + 999);
    for (const r of data || []) known.add(r.dedup_key);
    if (!data || data.length < 1000) break;
  }
  console.log(`Known dedup keys: ${known.size}`);

  let inserted = 0, skipped = 0;
  for (let i = 0; i < rows.length; i += 200) {
    const chunk = [];
    for (const r of rows.slice(i, i + 200)) {
      const key = dkey(r.name, r.city);
      if (key && known.has(key)) { skipped++; continue; } // already in catalogue
      if (key) known.add(key); // also dedupe within this run
      chunk.push({
        source: "overture", source_id: String(r.id), name: String(r.name),
        lat: Number(r.lat), lng: Number(r.lng),
        city: r.city ? String(r.city) : null,
        country: r.country ? String(r.country) : country,
        website: r.website ? String(r.website) : null,
        address: r.address ? String(r.address) : null,
        dedup_key: key || null,
      });
    }
    if (!chunk.length) continue;
    const { error } = await db.from("hotels").upsert(chunk, { onConflict: "source,source_id", ignoreDuplicates: true });
    if (error) console.error("upsert error:", error.message);
    else inserted += chunk.length;
  }
  console.log(`Upserted ~${inserted} new hotels, skipped ${skipped} already-known duplicates (source=overture). New ones are UNSCORED — run recompute-scores.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
