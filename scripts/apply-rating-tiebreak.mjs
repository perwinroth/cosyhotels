#!/usr/bin/env node
// Rating tiebreak for score granularity. Temp-0 LLM scoring is honest but quantized (16 distinct
// values; 34% of live hotels on one value) — a credibility tell for a ranking site. Guest rating
// adds no accuracy vs owner grades (corr 0.520 -> 0.522, fitted on the 58 graded hotels with both
// signals) but its OLS coefficient is positive (+0.214), so it is directionally valid as a
// TIEBREAK: among equally-cosy-profiled hotels, the better-loved one edges ahead.
//   score = llm_calibrated + clamp(0.08 * (guest_rating10 - live_median), -0.2, +0.2)
// Bounded ±0.2 so it can only ever reorder within an LLM bucket, never jump one. No rating -> 0.
//   node --env-file=.env.local scripts/apply-rating-tiebreak.mjs             # dry-run + distribution preview
//   node --env-file=.env.local scripts/apply-rating-tiebreak.mjs --execute   # write (backs up)
import { createClient } from "@supabase/supabase-js";
import { appendFileSync } from "fs";

const EXECUTE = process.argv.includes("--execute");
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE);
const BACKUP = `scripts/backups/rating-tiebreak-${new Date().toISOString().replace(/[:.]/g, "-")}.jsonl`;

// live v3 rows (both review- and vision-scored)
const rows = []; let off = 0;
for (;;) { const { data } = await db.from("cosy_scores").select("hotel_id,score,score_final,score_100,notes,scored_at").gte("score", 5).in("notes", ["review-scored:v3", "vision-scored:v3"]).range(off, off + 999); if (!data?.length) break; rows.push(...data); if (data.length < 1000) break; off += 1000; }
const ids = rows.map((r) => String(r.hotel_id));
const rating = new Map();
for (let i = 0; i < ids.length; i += 300) { const { data } = await db.from("hotels").select("id,rating").in("id", ids.slice(i, i + 300)); for (const h of data || []) if (typeof h.rating === "number") rating.set(String(h.id), Number(h.rating)); }
const rs = [...rating.values()].sort((a, b) => a - b);
const median = rs.length ? rs[Math.floor(rs.length / 2)] : 8.6;
console.log(`live v3 rows: ${rows.length} · with guest rating: ${rating.size} · median rating ${median.toFixed(1)}`);

const tb = (id) => { const r = rating.get(String(id)); return r == null ? 0 : Math.max(-0.2, Math.min(0.2, 0.08 * (r - median))); };
const newScore = (r) => Math.max(0, Math.min(10, Math.round((Number(r.score_final ?? r.score) + tb(r.hotel_id)) * 10) / 10));

// distribution preview
const before = new Map(), after = new Map();
for (const r of rows) { const b = Number(r.score_final ?? r.score); before.set(b, (before.get(b) || 0) + 1); const a = newScore(r); after.set(a, (after.get(a) || 0) + 1); }
const share = (m) => Math.round(1000 * Math.max(...m.values()) / rows.length) / 10;
console.log(`distinct values: ${before.size} -> ${after.size} · top-value share: ${share(before)}% -> ${share(after)}%`);
const drops = rows.filter((r) => newScore(r) < 5).length;
console.log(`rows that would drop below the 5.0 floor: ${drops} (below-median-satisfaction borderliners — honest)`);
if (!EXECUTE) { console.log("dry-run — add --execute to write (backs up)"); process.exit(0); }

let updated = 0, failed = 0;
for (const r of rows) {
  const s = newScore(r);
  if (s === Number(r.score_final ?? r.score)) { continue; }
  appendFileSync(BACKUP, JSON.stringify(r) + "\n");
  const { error } = await db.from("cosy_scores").update({ score: s, score_final: s, score_100: Math.round(s * 10) }).eq("hotel_id", r.hotel_id);
  if (error) failed++; else updated++;
  if (updated % 500 === 0 && updated) console.log(`  ${updated} updated…`);
}
try { await db.from("job_runs").insert({ job: "rating-tiebreak:v3", status: "done", finished_at: new Date().toISOString(), details: { rows: rows.length, updated, failed, distinctBefore: before.size, distinctAfter: after.size } }); } catch {}
console.log(`DONE · updated ${updated} · failed ${failed} · backup ${BACKUP}`);
