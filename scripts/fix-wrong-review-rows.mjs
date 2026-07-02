#!/usr/bin/env node
// Containment for the wrong-reviews bug: live hotels whose description ADMITS the reviews belong
// to a different property (cache mapped wrong place). These published the model's refusal as
// public copy with a confident score derived from another hotel's reviews.
//   node --env-file=.env.local scripts/fix-wrong-review-rows.mjs            # dry-run (list only)
//   node --env-file=.env.local scripts/fix-wrong-review-rows.mjs --execute  # backup + hide + purge cache
// Hidden rows get notes='hidden:wrong-reviews' so a later verified re-scrape can specifically
// re-target them. Fully reversible via the backup jsonl.
import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync, existsSync, appendFileSync } from "fs";

const EXECUTE = process.argv.includes("--execute");
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE);
const CACHE = "scripts/backups/review-cache.json";
const BACKUP = `scripts/backups/wrong-reviews-${new Date().toISOString().replace(/[:.]/g, "-")}.jsonl`;

// Same detector verified against the live DB (38 rows as of 2026-07-02).
const RX = "reviews? (provided|are for|relate|were for|are entirely)|no information whatsoever|cannot be written|no accurate|nothing guest-reported|no review content|no usable details|contain no information|not (the|this) (property|hotel)";

const { data: rows, error } = await db
  .from("cosy_scores")
  .select("hotel_id,score,score_final,score_100,review_sentiment,description,signals,confidence,score_model,notes,scored_at")
  .gte("score", 5)
  .filter("description", "imatch", RX);
if (error) { console.error("query error:", error.message); process.exit(1); }
console.log(`${EXECUTE ? "EXECUTE" : "DRY-RUN"} · ${rows.length} live rows with wrong-hotel review copy`);

const cache = existsSync(CACHE) ? JSON.parse(readFileSync(CACHE, "utf8")) : {};
let hidden = 0, purged = 0;
for (const r of rows) {
  console.log(`  ${String(r.hotel_id).slice(0, 8)} · ${Number(r.score).toFixed(1)} · ${String(r.description).slice(0, 70)}`);
  if (!EXECUTE) continue;
  appendFileSync(BACKUP, JSON.stringify(r) + "\n");
  const { error: e } = await db.from("cosy_scores").update({
    score: 0, score_final: null, score_100: null,
    notes: "hidden:wrong-reviews", scored_at: new Date().toISOString(),
  }).eq("hotel_id", r.hotel_id);
  if (e) { console.log(`    db err: ${e.message}`); continue; }
  hidden++;
  if (cache[String(r.hotel_id)]) { delete cache[String(r.hotel_id)]; purged++; } // poisoned reviews
}
if (EXECUTE && purged) writeFileSync(CACHE, JSON.stringify(cache));
console.log(EXECUTE ? `hidden ${hidden} · cache purged ${purged} · backup ${BACKUP}` : "dry-run only — nothing written");
