// One-off migration: strip em dashes from cosy_scores.description (founder copy rule 2026-07-08 —
// no em dashes in reader-facing copy). The score is NOT changed, so this stays review-grounded; it is
// a punctuation edit of the existing copy only.
//
//   node --env-file=.env.local scripts/clean-emdash-descriptions.mjs            # DRY RUN (default)
//   node --env-file=.env.local scripts/clean-emdash-descriptions.mjs --execute  # writes, after backup
//
// SAFETY: dry-run by default; on --execute it writes a full backup of every affected row's PRIOR
// description to scripts/backups/ BEFORE any write (reversible); only rows whose text actually changes
// are touched; en dashes (ranges) are never touched; idempotent (re-running is a no-op). Reviewed by
// the data-migration-guard before first --execute.
import { createClient } from "@supabase/supabase-js";
import { writeFileSync, mkdirSync } from "node:fs";
import { stripEmDashes } from "./lib/copyClean.mjs";

const EXECUTE = process.argv.includes("--execute");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error("missing Supabase env"); process.exit(1); }
const db = createClient(url, key);

// Fetch every row carrying an em dash (paged), compute the cleaned text, keep only real changes.
const affected = [];
const pageSize = 1000;
for (let from = 0; ; from += pageSize) {
  const { data, error } = await db
    .from("cosy_scores")
    .select("hotel_id, description")
    .like("description", "%—%")
    .order("hotel_id") // deterministic pagination — guarantees the full set across pages
    .range(from, from + pageSize - 1);
  if (error) { console.error("fetch error:", error.message); process.exit(1); }
  if (!data || data.length === 0) break;
  for (const r of data) {
    const next = stripEmDashes(r.description);
    if (next !== r.description) affected.push({ hotel_id: r.hotel_id, old: r.description, next });
  }
  if (data.length < pageSize) break;
}

console.log(`Rows with an em dash to fix: ${affected.length}`);
console.log("\n--- sample (first 6) ---");
for (const a of affected.slice(0, 6)) { console.log("\nBEFORE:", a.old); console.log("AFTER :", a.next); }

if (!EXECUTE) {
  console.log(`\nDRY RUN — no writes. Re-run with --execute to update ${affected.length} rows (a backup is written first).`);
  process.exit(0);
}

// Backup BEFORE writing (reversible): prior description of every affected row.
mkdirSync("scripts/backups", { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const backupPath = `scripts/backups/emdash-descriptions-${stamp}.json`;
writeFileSync(backupPath, JSON.stringify(affected.map((a) => ({ hotel_id: a.hotel_id, description: a.old })), null, 2));
console.log(`\nBackup written: ${backupPath} (${affected.length} rows). Restore = update description from this file.`);

// Batched writes: one UPDATE per row, guarded by hotel_id; progress every 500.
let done = 0, errs = 0;
for (const a of affected) {
  const { error } = await db.from("cosy_scores").update({ description: a.next }).eq("hotel_id", a.hotel_id);
  if (error) { errs++; if (errs <= 5) console.error("update error", a.hotel_id, error.message); }
  else { done++; if (done % 500 === 0) console.log(`  ${done}/${affected.length}…`); }
}
console.log(`\nDONE: updated ${done}, errors ${errs}. Reversible via ${backupPath}.`);
