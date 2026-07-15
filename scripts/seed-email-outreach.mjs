// Seed + backfill the EMAIL badge-outreach lane (prereg Amendment 5, 2026-07-15). Two phases,
// DRY-RUN by default (prints the full impact, writes nothing), --execute to write.
//
//   node --env-file=.env.local scripts/seed-email-outreach.mjs            # dry-run
//   node --env-file=.env.local scripts/seed-email-outreach.mjs --execute  # writes
//
// PHASE 1 — BACKFILL: the tier-honest email copy needs the stamped percentile, but the existing
//   queued email rows are UNSTAMPED (only the IG seed stamped its rows), so the new copy would skip
//   them and the drip would halt. This stamps every queued email row that has a null stamped_pct
//   (score/pct/total, same rank math as the IG seed). Reversible: set those stamped_* back to null.
// PHASE 2 — SEED: inserts the never-contacted, score_final >= 6.0 (FLOOR 6.0), email-reachable hotels
//   as queued/channel=email rows, stamped at queue time. Excludes control markets (exact match) and
//   anyone already in hotel_outreach on ANY channel (one cold contact per hotel EVER). INSERT-ONLY,
//   no upsert (a conflict means the exclusion missed one — abort loudly). Reviewed by data-migration-guard.
//
// The stamped_* columns already exist (added by the IG seed's founder SQL, #66) — no founder SQL needed.
import { pctTopFor, isIgControlCity } from "./seed-ig-outreach.mjs";
import { writeFileSync, mkdirSync } from "node:fs";

const BATCH = 500;
const PAGE = 1000;
const FLOOR = 6.0;

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE;
if (!url || !key) { console.error("✗ missing SUPABASE url/service key"); process.exit(1); }
const EXECUTE = process.argv.includes("--execute");
const headers = { apikey: key, authorization: `Bearer ${key}`, "content-type": "application/json" };

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

// percentile universe
const allScores = (await fetchAll("cosy_scores?select=score_final&score_final=not.is.null")).map((r) => Number(r.score_final)).sort((a, b) => a - b);
const totalScored = allScores.length;
console.log(`scored universe (score_final not null): ${totalScored}\n`);

// ── PHASE 1: backfill stamps on existing queued email rows that lack them ─────────────────────────
const unstamped = await fetchAll("hotel_outreach?select=hotel_id&status=eq.queued&stamped_pct=is.null&or=(channel.eq.email,channel.is.null)");
const unstampedIds = unstamped.map((r) => String(r.hotel_id));
const scoreById = new Map();
for (let i = 0; i < unstampedIds.length; i += 150) {
  const ids = unstampedIds.slice(i, i + 150).map((x) => `"${x}"`).join(",");
  const rows = await fetchAll(`cosy_scores?select=hotel_id,score,score_final&hotel_id=in.(${ids})`);
  for (const r of rows) scoreById.set(String(r.hotel_id), Number(r.score_final ?? r.score));
}
const backfill = unstampedIds
  .filter((id) => Number.isFinite(scoreById.get(id)) && scoreById.get(id) >= FLOOR) // never stamp a below-floor row for proactive email
  .map((id) => ({ hotel_id: id, sf: scoreById.get(id) }));
console.log(`PHASE 1 — backfill: ${unstampedIds.length} unstamped queued email rows; ${backfill.length} at/above floor ${FLOOR} to stamp (below-floor rows left unstamped → they stay skipped by the drip).`);
if (backfill[0]) { const b = backfill[0]; console.log(`  sample: hotel ${b.hotel_id} score ${b.sf} → stamped_pct ${pctTopFor(b.sf, allScores)}`); }

// ── PHASE 2: seed never-contacted, email-reachable, score_final >= 6.0 ─────────────────────────────
const candidates = await fetchAll(
  `cosy_scores?select=hotel_id,score_final,hotel:hotel_id!inner(id,slug,city,email)&score_final=gte.${FLOOR}&hotel.email=not.is.null`,
);
const already = new Set((await fetchAll("hotel_outreach?select=hotel_id")).map((r) => String(r.hotel_id)));
let exControl = 0, exAlready = 0, exNoEmail = 0;
const seed = [];
for (const c of candidates) {
  const h = c.hotel;
  if (!h) continue;
  if (!(h.email && String(h.email).includes("@"))) { exNoEmail++; continue; }
  if (isIgControlCity(h.city)) { exControl++; continue; }
  if (already.has(String(c.hotel_id))) { exAlready++; continue; }
  const sf = Number(c.score_final);
  seed.push({ hotel_id: String(c.hotel_id), status: "queued", channel: "email", stamped_score: sf, stamped_pct: pctTopFor(sf, allScores), stamped_total: totalScored });
}
console.log(`\nPHASE 2 — seed: ${candidates.length} scored+email candidates ≥${FLOOR}`);
console.log(`  excluded control market (exact): ${exControl} · already in outreach (any channel): ${exAlready} · malformed email: ${exNoEmail}`);
console.log(`  to insert (never-contacted, email, ≥${FLOOR}): ${seed.length}`);
if (seed[0]) console.log(`  sample: ${JSON.stringify(seed[0])}`);
const byTier = seed.reduce((m, r) => { const t = r.stamped_score >= 7 ? "7.0+" : r.stamped_score >= 6.5 ? "6.5-6.9" : "6.0-6.4"; m[t] = (m[t] || 0) + 1; return m; }, {});
console.log(`  by tier: ${JSON.stringify(byTier)}`);

if (!EXECUTE) {
  console.log(`\nDRY-RUN — nothing written. --execute will: stamp ${backfill.length} existing rows + insert ${seed.length} new email rows.`);
  process.exit(0);
}

// Backup-before-write (data-migration-guard): snapshot the exact rows PHASE 1 will change (pre-null
// values = the reversal target) + the PHASE 2 insert ids (delete target) so the whole write is
// mechanically reversible.
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
mkdirSync("scripts/backups", { recursive: true });
const preRows = await fetchAll(`hotel_outreach?select=hotel_id,channel,status,stamped_score,stamped_pct,stamped_total&status=eq.queued&stamped_pct=is.null&or=(channel.eq.email,channel.is.null)`);
const backupPath = `scripts/backups/email-outreach-${stamp}.json`;
writeFileSync(backupPath, JSON.stringify({ phase1_affected: preRows, phase2_insert_ids: seed.map((s) => s.hotel_id) }, null, 2));
console.log(`✓ snapshot → ${backupPath} (${preRows.length} pre-change rows + ${seed.length} insert ids). Reverse: null the stamps for phase1_affected, delete the phase2 ids.`);

// writes
let stamped = 0;
for (const b of backfill) {
  const r = await fetch(`${url}/rest/v1/hotel_outreach?hotel_id=eq.${encodeURIComponent(b.hotel_id)}&status=eq.queued&or=(channel.eq.email,channel.is.null)`, {
    method: "PATCH", headers: { ...headers, Prefer: "return=minimal" },
    body: JSON.stringify({ stamped_score: b.sf, stamped_pct: pctTopFor(b.sf, allScores), stamped_total: totalScored }),
  });
  if (!r.ok) { console.error(`✗ backfill PATCH ${b.hotel_id} → ${r.status}: ${await r.text()}`); process.exit(1); }
  if (++stamped % 50 === 0) console.log(`  stamped ${stamped}/${backfill.length}`);
}
console.log(`✓ backfilled ${stamped} rows`);

let inserted = 0;
for (let i = 0; i < seed.length; i += BATCH) {
  const batch = seed.slice(i, i + BATCH);
  const r = await fetch(`${url}/rest/v1/hotel_outreach`, { method: "POST", headers: { ...headers, Prefer: "return=minimal" }, body: JSON.stringify(batch) });
  if (!r.ok) { console.error(`✗ INSERT batch ${i / BATCH + 1} → ${r.status}: ${await r.text()}\naborting: ${inserted} inserted before failure.`); process.exit(1); }
  inserted += batch.length;
  console.log(`  inserted ${inserted}/${seed.length}`);
}
console.log(`\n✓ done — backfilled ${stamped}, inserted ${inserted} queued email rows.`);
