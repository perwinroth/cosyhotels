// Seed the Instagram badge-wave outreach queue (Challenger-passed 2026-07-11). INSERT-ONLY:
// selects hotels with an Instagram handle, NO email, and a cosy score_final >= 6.0, excludes
// control markets and anyone already in hotel_outreach (any channel/status), stamps each row with
// the score/percentile/total AT QUEUE TIME (the DM must never recompute these live), and inserts
// status=queued / channel=instagram rows.
//
// SAFE BY DESIGN:
//   • DRY-RUN by default — prints the full impact report, writes nothing.
//   • --execute to actually insert.
//   • Plain INSERT (Prefer: return=minimal), batched 500/request, NO upsert — any conflict with an
//     existing row aborts loudly (it means the exclusion query missed something; investigate).
//
//   node --env-file=.env.local scripts/seed-ig-outreach.mjs            # dry-run
//   node --env-file=.env.local scripts/seed-ig-outreach.mjs --execute  # inserts
//
// THE FOUNDER MUST RUN THE PRINTED SQL (below) IN THE SUPABASE SQL EDITOR FIRST — the stamped_*
// columns do not exist yet. Until then, /growth falls back to the v1 pitch for IG rows (by design).

// ---------------------------------------------------------------------------------------------
// Pure, exported bits (imported by tests/ig-wave.test.ts — keep this module side-effect free on
// import; everything that touches the network runs behind the isMain guard at the bottom).
// ---------------------------------------------------------------------------------------------

// Control markets for the IG wave — the union of every declared, never-treat control across the
// die-validation experiments: York + Venice-historic (Bruges pilot), Fez (Marrakech 001),
// Savannah (GSC treated-vs-control). Superset of src/lib/controlMarkets.ts (savannah/york only).
// EXACT match on the normalised city string, NEVER substring — substring matching is the known
// hazard that would swallow "New York" via "york" (see isControlMarket's scrub workaround; here we
// avoid the hazard entirely instead of patching around it).
export const IG_CONTROL_CITIES = ["savannah", "york", "fez", "venice-historic"];

export function isIgControlCity(city) {
  if (!city) return false;
  const norm = String(city).toLowerCase().trim().replace(/\s+/g, "-");
  return IG_CONTROL_CITIES.includes(norm);
}

// Takedown mechanism (trust fix, 2026-07-16): mirrors src/lib/delisted.ts DELISTED_SLUGS — a hotel
// that asked for removal (brae-lodge) must never be seeded into ANY outreach lane. Duplicated here
// (same convention as IG_CONTROL_CITIES/controlMarkets.ts above) because these scripts are plain
// node .mjs, not compiled from src/lib.
export const DELISTED_SLUGS = new Set(["brae-lodge"]);

// True if the hotel embed (id/slug/…/delisted_at) is delisted — Set match, or a truthy delisted_at
// when the caller's select included that column (it's read defensively by callers: the column may
// not exist yet, pre-migration, in which case delisted_at is simply absent/undefined here).
export function isDelistedHotel(hotel) {
  if (!hotel) return false;
  if (DELISTED_SLUGS.has(String(hotel.slug || ""))) return true;
  return !!hotel.delisted_at;
}

// Founder eyeball-verification gate (2026-07-16): shared fail-closed fetch of every hotel_id with
// founder_status='verified', re-exported here so scripts/seed-email-outreach.mjs (which already
// imports from this module) gets it for free without a second import line.
export { fetchVerifiedHotelIds } from "./verification-gate.mjs";

// "top {pct}%" for one hotel: share of scored hotels at-or-above its score_final, rounded UP
// (mirrors roundPctUp in src/lib/badgePitch.ts — the claim may only ever understate).
// sortedAsc: ALL score_final values, ascending. Binary search for the first index >= score.
export function pctTopFor(scoreFinal, sortedAsc) {
  let lo = 0, hi = sortedAsc.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (sortedAsc[mid] < scoreFinal) lo = mid + 1; else hi = mid;
  }
  const atOrAbove = sortedAsc.length - lo;
  return Math.ceil((100 * atOrAbove) / sortedAsc.length);
}

export const FOUNDER_SQL = `-- RUN THIS IN THE SUPABASE SQL EDITOR BEFORE SEEDING (idempotent):
alter table hotel_outreach add column if not exists stamped_score numeric;
alter table hotel_outreach add column if not exists stamped_pct int;
alter table hotel_outreach add column if not exists stamped_total int;
alter table hotel_outreach drop constraint if exists hotel_outreach_status_check;
-- NOTE for the founder: statuses used by the app today are queued / contacted / replied / won /
-- won_confirmed / declined, and the IG board now also writes 'undeliverable' (the "Couldn't send"
-- action). If you prefer to KEEP a status check constraint instead of dropping it, recreate it
-- with 'undeliverable' included, e.g.:
--   alter table hotel_outreach add constraint hotel_outreach_status_check
--     check (status in ('queued','contacted','replied','won','won_confirmed','declined','undeliverable'));`;

// ---------------------------------------------------------------------------------------------
// Script body (runs only when executed directly, never on import)
// ---------------------------------------------------------------------------------------------

const BATCH = 500;
const PAGE = 1000;

async function main() {
  console.log(FOUNDER_SQL + "\n");

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE;
  if (!url || !key) {
    console.error("✗ missing SUPABASE url/service key — run with: node --env-file=.env.local scripts/seed-ig-outreach.mjs");
    process.exit(1);
  }
  const EXECUTE = process.argv.includes("--execute");
  const headers = { apikey: key, authorization: `Bearer ${key}`, "content-type": "application/json" };

  // Founder eyeball-verification gate (2026-07-16): only hotels a human has confirmed via
  // /growth/verify may be seeded into outreach. FAIL-CLOSED: if the gate itself is unavailable
  // (hotel_verifications missing/erroring), treat it as ZERO verified hotels and refuse to write
  // anything. Never fall back to "couldn't check, so seed everyone".
  const verifyGate = await fetchVerifiedHotelIds(url, headers);
  if (!verifyGate.ok) {
    console.error("═".repeat(72));
    console.error("✗ FAIL-CLOSED: founder verification gate unavailable. hotel_verifications is");
    console.error("  missing or errored. Refusing to seed ANY hotel (deliberate: the founder demands");
    console.error("  only-verified outreach). Run sql/hotel-verifications.sql, then");
    console.error("  node --env-file=.env.local scripts/import-link-verdicts.mjs --execute, then retry.");
    console.error("═".repeat(72));
    if (EXECUTE) process.exit(1);
  }
  const verifiedIds = verifyGate.ids;

  // Paged GET against PostgREST. Uses Range headers so we never silently truncate at 1000.
  async function fetchAll(pathAndQuery) {
    const out = [];
    for (let from = 0; ; from += PAGE) {
      const r = await fetch(`${url}/rest/v1/${pathAndQuery}`, { headers: { ...headers, Range: `${from}-${from + PAGE - 1}` } });
      if (!r.ok) { console.error(`✗ GET ${pathAndQuery} → ${r.status}: ${await r.text()}`); process.exit(1); }
      const rows = await r.json();
      out.push(...rows);
      if (rows.length < PAGE) return out;
    }
  }

  // Same as fetchAll but returns null (instead of exiting) on the FIRST failed request — used only
  // for the defensive delisted_at probe below, so a pre-migration "column does not exist" error
  // falls back to the Set-only exclusion rather than aborting the whole seed run.
  async function fetchAllOrNull(pathAndQuery) {
    const out = [];
    for (let from = 0; ; from += PAGE) {
      const r = await fetch(`${url}/rest/v1/${pathAndQuery}`, { headers: { ...headers, Range: `${from}-${from + PAGE - 1}` } });
      if (!r.ok) return null;
      const rows = await r.json();
      out.push(...rows);
      if (rows.length < PAGE) return out;
    }
  }

  // 1. Existing statuses (informs the founder-SQL constraint note; best-effort discovery).
  const statusRows = await fetchAll("hotel_outreach?select=status");
  const distinctStatuses = [...new Set(statusRows.map((r) => r.status))].sort();
  console.log(`existing hotel_outreach statuses in the DB: ${distinctStatuses.join(", ") || "(table empty)"}`);

  // 2. Every score_final (the percentile universe), sorted ascending for the rank binary-search.
  const allScores = (await fetchAll("cosy_scores?select=score_final&score_final=not.is.null"))
    .map((r) => Number(r.score_final))
    .sort((a, b) => a - b);
  const totalScored = allScores.length;
  console.log(`scored universe (score_final not null): ${totalScored}`);

  // 3. Candidates: instagram present, NO email (email-reachable hotels stay in the email lane),
  //    score_final >= 6.0. Embedded !inner join filters on the hotels side. Also probes delisted_at
  //    (takedown mechanism, trust fix 2026-07-16) — falls back without it if the column doesn't
  //    exist yet, so a pre-migration run never aborts (DELISTED_SLUGS still excludes brae-lodge).
  const candidatesWithDelisted = await fetchAllOrNull(
    "cosy_scores?select=hotel_id,score_final,hotel:hotel_id!inner(id,slug,city,instagram,email,delisted_at)" +
    "&score_final=gte.6&hotel.instagram=not.is.null&hotel.email=is.null",
  );
  const candidates = candidatesWithDelisted !== null ? candidatesWithDelisted : await fetchAll(
    "cosy_scores?select=hotel_id,score_final,hotel:hotel_id!inner(id,slug,city,instagram,email)" +
    "&score_final=gte.6&hotel.instagram=not.is.null&hotel.email=is.null",
  );

  // 4. Anyone already in hotel_outreach — ANY channel, ANY status — is excluded (never re-queue
  //    someone the email lane already touched, and never double-insert).
  const already = new Set((await fetchAll("hotel_outreach?select=hotel_id")).map((r) => String(r.hotel_id)));

  let excludedControl = 0;
  let excludedAlready = 0;
  let excludedDelisted = 0;
  let excludedUnverified = 0;
  const rows = [];
  for (const c of candidates) {
    const h = c.hotel;
    if (!h) continue;
    if (isDelistedHotel(h)) { excludedDelisted++; continue; }
    if (isIgControlCity(h.city)) { excludedControl++; continue; }
    if (already.has(String(c.hotel_id))) { excludedAlready++; continue; }
    // Founder eyeball-verification gate (2026-07-16): never seed a hotel that hasn't been human-
    // confirmed at /growth/verify. verifiedIds is EMPTY (never "everyone") when the gate itself
    // failed above.
    if (!verifiedIds.has(String(c.hotel_id))) { excludedUnverified++; continue; }
    const scoreFinal = Number(c.score_final);
    rows.push({
      hotel_id: String(c.hotel_id),
      status: "queued",
      channel: "instagram",
      stamped_score: scoreFinal,
      stamped_pct: pctTopFor(scoreFinal, allScores),
      stamped_total: totalScored,
    });
  }

  console.log(`eligible (instagram, no email, score_final >= 6.0): ${candidates.length}`);
  console.log(`excluded — delisted (takedown Set/delisted_at): ${excludedDelisted}`);
  console.log(`excluded — control market (${IG_CONTROL_CITIES.join("/")}, exact match): ${excludedControl}`);
  console.log(`excluded — already in hotel_outreach (any channel/status): ${excludedAlready}`);
  console.log(`excluded: not founder-verified yet (/growth/verify): ${excludedUnverified}`);
  console.log(`to insert: ${rows.length}`);
  if (rows.length) console.log(`sample row: ${JSON.stringify(rows[0])}`);

  if (!EXECUTE) {
    console.log("\nDRY-RUN — nothing written. Re-run with --execute to insert (founder SQL must be run first).");
    return;
  }

  let inserted = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    // Plain INSERT — no on_conflict, no upsert. A 409 here means a row appeared since the exclusion
    // query ran (or the exclusion missed one): abort loudly, nothing is silently overwritten.
    const r = await fetch(`${url}/rest/v1/hotel_outreach`, {
      method: "POST",
      headers: { ...headers, Prefer: "return=minimal" },
      body: JSON.stringify(batch),
    });
    if (!r.ok) {
      console.error(`✗ INSERT batch ${i / BATCH + 1} FAILED → ${r.status}: ${await r.text()}`);
      console.error(`aborting: ${inserted} rows were inserted before the failure; investigate before re-running.`);
      process.exit(1);
    }
    inserted += batch.length;
    console.log(`inserted ${inserted}/${rows.length}`);
  }
  console.log(`\n✓ done — inserted ${inserted} queued instagram rows.`);
}

// Run only when executed directly (tests import the pure exports above without side effects).
// No top-level await: tsx compiles importing tests to CJS, which can't ingest one.
import { pathToFileURL } from "node:url";
const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
