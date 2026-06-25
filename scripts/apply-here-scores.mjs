// Apply the in-session human-verified scores (scripts/_score_batch/results.json) back to
// cosy_scores, and flag junk images. SAFE BY DESIGN:
//   • DRY-RUN by default — prints every before→after, writes nothing.
//   • Backup-before-write — always snapshots the full prior cosy_scores + hotel_images rows.
//   • Downward-only guard — refuses to RAISE a score (these are over-score corrections).
//   • Reversible — the backup JSON contains every prior value.
//
//   node --env-file=.env.local scripts/apply-here-scores.mjs            # dry-run
//   node --env-file=.env.local scripts/apply-here-scores.mjs --execute  # writes (after backup)
import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync, mkdirSync } from "fs";

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE);
const EXECUTE = process.argv.includes("--execute");
const RESULTS = JSON.parse(readFileSync("scripts/_score_batch/results.json", "utf8"));
const ids = RESULTS.map((r) => r.hotel_id);

// --- fetch current state (for diff + backup) ------------------------------------------------
const { data: scNow } = await db.from("cosy_scores").select("hotel_id, score, score_final, imagery_warmth, confidence").in("hotel_id", ids);
const scBy = new Map((scNow || []).map((r) => [String(r.hotel_id), r]));
const junkUrls = RESULTS.filter((r) => r.junk_url).map((r) => ({ hotel_id: r.hotel_id, url: r.junk_url }));
const imgBackup = [];
for (const j of junkUrls) {
  const { data } = await db.from("hotel_images").select("id, hotel_id, url, vision_ok").eq("hotel_id", j.hotel_id).eq("url", j.url);
  imgBackup.push(...(data || []));
}

// --- guard: downward-only -------------------------------------------------------------------
let bad = 0;
for (const r of RESULTS) {
  const cur = scBy.get(r.hotel_id);
  const curDisp = cur ? (typeof cur.score_final === "number" ? cur.score_final : cur.score) : null;
  if (curDisp != null && r.next > curDisp + 1e-9) { console.error(`✗ REFUSE raise: ${r.name} ${curDisp} → ${r.next}`); bad++; }
}
if (bad) { console.error(`\n${bad} would-raise rows — aborting (these are over-score corrections, downward-only).`); process.exit(1); }

// --- show the diff --------------------------------------------------------------------------
console.log(`Mode: ${EXECUTE ? "EXECUTE" : "DRY-RUN"} · ${RESULTS.length} scores · ${junkUrls.length} junk images to hide\n`);
for (const r of RESULTS) {
  const cur = scBy.get(r.hotel_id);
  const curDisp = cur ? (typeof cur.score_final === "number" ? cur.score_final : cur.score) : "—";
  const w = r.warmth != null ? `warmth ${r.warmth}` : (r.junk_url ? "junk photo" : "no photo");
  console.log(`  ${String(curDisp).padStart(4)} → ${String(r.next).padEnd(4)}  ${w.padEnd(11)}  ${r.name.slice(0, 32).padEnd(32)} ${r.note}`);
}

if (!EXECUTE) {
  console.log(`\nDRY-RUN — nothing written. Re-run with --execute to apply (a backup is taken first).`);
  process.exit(0);
}

// --- backup, then write ---------------------------------------------------------------------
mkdirSync("scripts/backups", { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const backupFile = `scripts/backups/here-scores-${stamp}.json`;
writeFileSync(backupFile, JSON.stringify({ cosy_scores: scNow, hotel_images: imgBackup, results: RESULTS }, null, 2));
console.log(`\nbackup → ${backupFile}`);

let scoreOk = 0, imgOk = 0;
for (const r of RESULTS) {
  const patch = { score: r.next, score_final: r.next };
  if (r.warmth != null) patch.imagery_warmth = r.warmth; // real-space photo assessed → leaves the blind pool
  const { error } = await db.from("cosy_scores").update(patch).eq("hotel_id", r.hotel_id);
  if (!error) scoreOk++; else console.error(`  score fail ${r.name}: ${error.message}`);
}
for (const j of junkUrls) {
  const { error } = await db.from("hotel_images").update({ vision_ok: false }).eq("hotel_id", j.hotel_id).eq("url", j.url);
  if (!error) imgOk++; else console.error(`  image fail ${j.hotel_id}: ${error.message}`);
}
console.log(`\ndone — ${scoreOk}/${RESULTS.length} scores corrected · ${imgOk}/${junkUrls.length} junk images hidden · reversible via ${backupFile}`);
