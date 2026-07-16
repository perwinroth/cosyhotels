// Import the real-browser Stay22 "Check availability" link sweep (die-validation
// data/stay22-verdicts.json) into stay22_checks, so src/lib/ctaPolicy.ts getStay22WrongSlugs can
// gate the CTA swap. FOUNDER RUNS THIS AFTER sql/stay22-checks.sql. The sweep is ongoing, so this
// script is safe (and expected) to re-run as new verdicts land — it is a plain upsert keyed on slug.
//
//   node --env-file=.env.local scripts/import-stay22-verdicts.mjs             # dry-run
//   node --env-file=.env.local scripts/import-stay22-verdicts.mjs --execute   # writes
//
// Verdicts JSON path defaults to the sibling die-validation checkout (both repos sit side by side
// under the same parent directory); override with VERDICTS_PATH if that's not where it lives.
//
// IDEMPOTENT / RESUMABLE: keyed on slug directly (stay22_checks.slug is the primary key — no
// hotel_id resolution needed, unlike scripts/import-link-verdicts.mjs). checked_at is deliberately
// NEVER included in the payload: PostgREST's merge-duplicates upsert only writes the columns
// present in the payload, so a re-run never bumps an already-imported row's checked_at; a brand-new
// row gets the table's own DEFAULT now(). A failed batch mid-run can simply be re-run.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE;
if (!url || !key) {
  console.error("✗ missing SUPABASE url/service key. Run with: node --env-file=.env.local scripts/import-stay22-verdicts.mjs");
  process.exit(1);
}
const EXECUTE = process.argv.includes("--execute");
const headers = { apikey: key, authorization: `Bearer ${key}`, "content-type": "application/json" };

const VERDICTS_PATH = process.env.VERDICTS_PATH || resolve(process.cwd(), "../die-validation/data/stay22-verdicts.json");
const BATCH = 500;

console.log(`reading verdicts from ${VERDICTS_PATH}`);
let verdictsBySlug;
try {
  verdictsBySlug = JSON.parse(readFileSync(VERDICTS_PATH, "utf8"));
} catch (e) {
  console.error(`✗ could not read/parse verdicts JSON at ${VERDICTS_PATH}: ${e.message}`);
  console.error("  set VERDICTS_PATH=/full/path/to/stay22-verdicts.json if it lives somewhere else.");
  process.exit(1);
}
const slugs = Object.keys(verdictsBySlug);
console.log(`${slugs.length} verdicts to import`);

const rows = slugs.map((slug) => {
  const v = verdictsBySlug[slug] || {};
  return {
    slug,
    verdict: v.v ?? null,
    note: v.note ?? null,
  };
});

const byVerdict = rows.reduce((m, r) => { const k = r.verdict || "(none)"; m[k] = (m[k] || 0) + 1; return m; }, {});
console.log(`by verdict: ${JSON.stringify(byVerdict, null, 2)}`);

if (!EXECUTE) {
  console.log(`\nDRY-RUN: nothing written. Re-run with --execute to upsert ${rows.length} rows into stay22_checks.`);
  if (rows[0]) console.log(`sample row: ${JSON.stringify(rows[0])}`);
  process.exit(0);
}

let upserted = 0;
for (let i = 0; i < rows.length; i += BATCH) {
  const batch = rows.slice(i, i + BATCH);
  const r = await fetch(`${url}/rest/v1/stay22_checks?on_conflict=slug`, {
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
console.log(`\n✓ done: upserted ${upserted} rows. getStay22WrongSlugs() picks these up within ~10 minutes (its cache window).`);
