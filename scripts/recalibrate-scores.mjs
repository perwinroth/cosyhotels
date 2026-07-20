// One-time honest re-normalization of the cosy display scores. Re-anchors the percentile
// curve from the inflating p50→7.0 / p90→9.0 / p99→9.8 to honest p50→5.0 / p90→6.5 / p99→8.5
// (T50/T90/T99 below — this comment previously drifted to 5.5/7.5/9.0; the CODE is the truth,
// verify against T50/T90/T99 directly if this comment ever goes stale again, per
// SCORING-TRUST-CORRECTIONS.md F6/A2),
// backfills raw_score for never-normalized rows, and writes score/score_final/calibrated_score
// so every surface shows the same honest number. FREE — pure math on stored scores, no API.
// DRY-RUN by default; --execute writes a reversible backup first.
import { createClient } from "@supabase/supabase-js";
import { writeFileSync, mkdirSync } from "fs";

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE,
);
const EXECUTE = process.argv.includes("--execute");

// New honest anchors (the "pins"). Median hotel reads 5.0, top 10% reads 6.5, top 1% reads 8.5.
const T50 = 5.0, T90 = 6.5, T99 = 8.5;

const PAGE = 1000; let off = 0; const rows = [];
for (;;) {
  const { data, error } = await db.from("cosy_scores").select("hotel_id, raw_score, score, score_final, calibrated_score").range(off, off + PAGE - 1);
  if (error) { console.error(error.message); process.exit(1); }
  if (!data || !data.length) break;
  rows.push(...data);
  if (data.length < PAGE) break; off += PAGE;
}
console.log("rows:", rows.length);

// Effective raw: raw_score if present, else the current score (never-normalized rows — their
// score IS effectively the raw Claude output), else 0. Same 0–10 basis either way.
const eff = (r) => typeof r.raw_score === "number" ? r.raw_score : (typeof r.score === "number" ? r.score : 0);
const sorted = rows.map(eff).sort((a, b) => a - b);
const q = (p) => sorted[Math.max(0, Math.min(sorted.length - 1, Math.floor(p * (sorted.length - 1))))];
const p50 = q(0.5), p90 = q(0.9), p99 = q(0.99);
console.log(`effective-raw percentiles: p50 ${p50.toFixed(2)}  p90 ${p90.toFixed(2)}  p99 ${p99.toFixed(2)}`);

function calibrate(raw) {
  let c;
  if (raw <= p90) { const t = (raw - p50) / Math.max(0.0001, p90 - p50); c = T50 + t * (T90 - T50); }
  else { const t = (raw - p90) / Math.max(0.0001, p99 - p90); c = T90 + t * (T99 - T90); }
  return Math.max(0, Math.min(10, Math.round(c * 10) / 10));
}

const updates = rows.map((r) => ({ hotel_id: r.hotel_id, raw: eff(r), cal: calibrate(eff(r)), oldScore: r.score }));

const disp = rows.map((r) => typeof r.score_final === "number" ? r.score_final : (typeof r.score === "number" ? r.score : 0)).sort((a, b) => a - b);
const dq = (p) => disp[Math.floor(p * (disp.length - 1))];
const nl = updates.map((u) => u.cal).sort((a, b) => a - b);
const nq = (p) => nl[Math.floor(p * (nl.length - 1))];
console.log(`DISPLAY now : p10 ${dq(.1).toFixed(1)}  p50 ${dq(.5).toFixed(1)}  p90 ${dq(.9).toFixed(1)}  p99 ${dq(.99).toFixed(1)}  (>=7: ${(100 * disp.filter((x) => x >= 7).length / disp.length).toFixed(0)}%)`);
console.log(`DISPLAY new : p10 ${nq(.1).toFixed(1)}  p50 ${nq(.5).toFixed(1)}  p90 ${nq(.9).toFixed(1)}  p99 ${nq(.99).toFixed(1)}  (>=7: ${(100 * nl.filter((x) => x >= 7).length / nl.length).toFixed(0)}%)`);
console.log("sample (effective-raw → new display):");
updates.slice(0, 8).forEach((u) => console.log(`  raw ${u.raw.toFixed(1)} -> ${u.cal}   (was ${u.oldScore})`));

if (!EXECUTE) { console.log("\nDRY-RUN — no writes. Add --execute to apply (backup written first)."); process.exit(0); }

mkdirSync("scripts/backups", { recursive: true });
const stamp = process.env.STAMP || "manual";
const backup = `scripts/backups/recalibrate-${stamp}.json`;
writeFileSync(backup, JSON.stringify(rows.map((r) => ({ hotel_id: r.hotel_id, raw_score: r.raw_score, score: r.score, score_final: r.score_final, calibrated_score: r.calibrated_score })), null, 2));
console.log(`backup written: ${backup} (${rows.length} rows)`);

let done = 0; const CH = 500;
for (let i = 0; i < updates.length; i += CH) {
  const batch = updates.slice(i, i + CH).map((u) => ({ hotel_id: u.hotel_id, raw_score: u.raw, score: u.cal, score_final: u.cal, calibrated_score: u.cal }));
  const { error } = await db.from("cosy_scores").upsert(batch, { onConflict: "hotel_id" });
  if (error) { console.error("batch err:", error.message); continue; }
  done += batch.length; if (done % 2000 === 0) console.log(`  ${done}/${updates.length}`);
}
console.log(`done — ${done} scores recalibrated.`);
