// Live review-grounding loop. Runs the (resumable) review-scorer in passes — grounding whatever
// un-grounded hotels currently have cached reviews — and keeps going as the scrape adds more, until
// the scrape is finished and nothing new remains. Maintains a CUMULATIVE progress file the command
// center renders (progress bar + ETA + real spend). When fully done, regenerates the blog picks.
//   nohup node --env-file=.env.local scripts/rescore-live.mjs > log 2>&1 & disown
import { readFileSync, writeFileSync, existsSync } from "fs";
import { spawn } from "child_process";
import { createClient } from "@supabase/supabase-js";
for (const line of readFileSync(".env.local", "utf8").split("\n")) { const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m && process.env[m[1]] == null) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, ""); }
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE);
const PROG = "scripts/backups/review-grounding-progress.json";
const SCRAPE = "scripts/backups/apify-scrape-progress.json";
const RS_STATE = "scripts/backups/review-scoring-state.json";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const readJson = (p) => { try { return JSON.parse(readFileSync(p, "utf8")); } catch { return null; } };
const startedAt = Date.now();
let cumCost = 0;

// usable-photo hotels are stable for this run — compute once
const usable = new Set();
for (let off = 0; ; off += 1000) { const { data } = await db.from("hotel_images").select("hotel_id,url,vision_ok").range(off, off + 999); if (!data?.length) break; for (const im of data) { const u = im.url || ""; if (im.vision_ok !== false && u && !u.includes("placehold.co") && !u.startsWith("/api/places")) usable.add(String(im.hotel_id)); } if (data.length < 1000) break; }

async function counts() {
  const cache = readJson("scripts/backups/review-cache.json") || {};
  const haveRev = new Set(Object.keys(cache).filter((k) => Array.isArray(cache[k]) && cache[k].length >= 3));
  const sc = [];
  for (let off = 0; ; off += 1000) { const { data } = await db.from("cosy_scores").select("hotel_id,score_final,imagery_warmth,review_sentiment").gte("score_final", 5).range(off, off + 999); if (!data?.length) break; sc.push(...data); if (data.length < 1000) break; }
  const ung = sc.filter((r) => !(r.imagery_warmth > 0) && !usable.has(String(r.hotel_id)));
  const withRev = ung.filter((r) => haveRev.has(String(r.hotel_id)));
  return { total: withRev.length, done: withRev.filter((r) => r.review_sentiment != null).length };
}
const writeProg = (c, extra = {}) => { const dt = (Date.now() - startedAt) / 1000; const rate = c.done > 0 && dt > 0 ? c.done / (dt / 60) : 0; writeFileSync(PROG, JSON.stringify({ job: "rescore", total: c.total, done: c.done, processed: c.done, estCostUSD: +cumCost.toFixed(3), costUsd: +cumCost.toFixed(3), startedAt, updatedAt: Date.now(), ...extra }, null, 2)); };
const pass = () => new Promise((res) => { const p = spawn("node", ["--env-file=.env.local", "scripts/score-reviews-prod.mjs", "--execute"], { stdio: "inherit" }); p.on("exit", () => res()); p.on("error", () => res()); });

for (;;) {
  writeProg(await counts());
  await pass();
  cumCost += (readJson(RS_STATE)?.estCostUSD || 0); // accumulate this pass's real (token-based) cost
  const after = await counts();
  writeProg(after);
  const scrape = readJson(SCRAPE);
  const scrapeDone = scrape && (scrape.finished === true || (scrape.done >= scrape.total));
  if (scrapeDone && after.done >= after.total) { writeProg(after, { finished: true }); break; }
  await sleep(60000);
}
// rescore complete → regenerate blog picks against the new scores
await new Promise((res) => { const p = spawn("npx", ["tsx", "scripts/generate-blog-picks.mts", "--execute"], { stdio: "inherit" }); p.on("exit", () => res()); p.on("error", () => res()); });
writeProg(await counts(), { finished: true, blogpicks: true });
console.log("grounding loop complete.");
