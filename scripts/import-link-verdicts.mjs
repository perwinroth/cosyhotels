// Import the automated hotel-link verdicts (Haiku pass, die-validation
// data/hotel-link-verdicts.json) into hotel_verifications, so the founder eyeball-verification
// board (/growth/verify) has something to review. FOUNDER RUNS THIS AFTER sql/hotel-verifications.sql.
//
//   node --env-file=.env.local scripts/import-link-verdicts.mjs             # dry-run
//   node --env-file=.env.local scripts/import-link-verdicts.mjs --execute   # writes
//
// Verdicts JSON path defaults to the sibling die-validation checkout (both repos sit side by side
// under the same parent directory); override with VERDICTS_PATH if that's not where it lives.
//
// IDEMPOTENT / RESUMABLE: this is a plain upsert keyed on hotel_id, and the payload NEVER includes
// founder_status: PostgREST's merge-duplicates upsert only writes the columns present in the
// payload, so an existing row's founder_status (a human decision) is left completely untouched on
// every re-run; a brand-new row gets the table's own DEFAULT 'pending'. A failed batch mid-run can
// simply be re-run: already-upserted rows just get the same auto_* facts written again.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE;
if (!url || !key) {
  console.error("✗ missing SUPABASE url/service key. Run with: node --env-file=.env.local scripts/import-link-verdicts.mjs");
  process.exit(1);
}
const EXECUTE = process.argv.includes("--execute");
const headers = { apikey: key, authorization: `Bearer ${key}`, "content-type": "application/json" };

const VERDICTS_PATH = process.env.VERDICTS_PATH || resolve(process.cwd(), "../die-validation/data/hotel-link-verdicts.json");
const BATCH = 300;
const PAGE = 1000;

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

console.log(`reading verdicts from ${VERDICTS_PATH}`);
let verdictsBySlug;
try {
  verdictsBySlug = JSON.parse(readFileSync(VERDICTS_PATH, "utf8"));
} catch (e) {
  console.error(`✗ could not read/parse verdicts JSON at ${VERDICTS_PATH}: ${e.message}`);
  console.error("  set VERDICTS_PATH=/full/path/to/hotel-link-verdicts.json if it lives somewhere else.");
  process.exit(1);
}
const slugs = Object.keys(verdictsBySlug);
console.log(`${slugs.length} verdicts to import`);

// Resolve slug → hotel_id, chunked (12k+ slugs would overflow a single .in() URL).
const idBySlug = new Map();
for (let i = 0; i < slugs.length; i += 150) {
  const chunk = slugs.slice(i, i + 150).map((s) => `"${s.replace(/"/g, '\\"')}"`).join(",");
  const rows = await fetchAll(`hotels?select=id,slug&slug=in.(${chunk})`);
  for (const r of rows) idBySlug.set(r.slug, r.id);
  if ((i / 150) % 10 === 0) console.log(`  resolved slugs: ${idBySlug.size}/${Math.min(i + 150, slugs.length)}`);
}
const unresolved = slugs.filter((s) => !idBySlug.has(s));
console.log(`resolved ${idBySlug.size}/${slugs.length} slugs to hotel_id; ${unresolved.length} unresolved (skipped: hotel not in this DB, or slug changed since the verdict was captured)`);
if (unresolved.length) console.log(`  sample unresolved: ${unresolved.slice(0, 5).join(", ")}`);

const rows = slugs
  .filter((s) => idBySlug.has(s))
  .map((s) => {
    const v = verdictsBySlug[s] || {};
    return {
      hotel_id: idBySlug.get(s),
      slug: s,
      auto_verdict: v.verdict ?? null,
      auto_confidence: typeof v.confidence === "number" ? v.confidence : null,
      auto_evidence: v.evidence ?? null,
      auto_at: v.at ? new Date(v.at).toISOString() : new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  });

const byVerdict = rows.reduce((m, r) => { const k = r.auto_verdict || "(none)"; m[k] = (m[k] || 0) + 1; return m; }, {});
console.log(`by verdict: ${JSON.stringify(byVerdict, null, 2)}`);

if (!EXECUTE) {
  console.log(`\nDRY-RUN: nothing written. Re-run with --execute to upsert ${rows.length} rows into hotel_verifications.`);
  if (rows[0]) console.log(`sample row: ${JSON.stringify(rows[0])}`);
  process.exit(0);
}

let upserted = 0;
for (let i = 0; i < rows.length; i += BATCH) {
  const batch = rows.slice(i, i + BATCH);
  const r = await fetch(`${url}/rest/v1/hotel_verifications?on_conflict=hotel_id`, {
    method: "POST",
    headers: { ...headers, Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(batch),
  });
  if (!r.ok) {
    console.error(`✗ UPSERT batch ${i / BATCH + 1} → ${r.status}: ${await r.text()}`);
    console.error(`aborting: ${upserted} rows upserted before failure. Re-run is safe (idempotent): it will simply redo this batch.`);
    process.exit(1);
  }
  upserted += batch.length;
  console.log(`  upserted ${upserted}/${rows.length}`);
}
console.log(`\n✓ done: upserted ${upserted} rows (auto_* fields only; founder_status is never touched by this script).`);
console.log(`Next: work the board at https://gotcosy.com/growth/verify`);
