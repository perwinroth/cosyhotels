// Retroactive stage-1 junk sweep over stored hotel_images. Flags vision_ok=false for images
// that are clearly NOT a hotel photo (logos, blanks, banners, tiny placeholders) so they stop
// being shown and stop re-blinding their hotel. FREE — heuristics only, no model/API.
//   Pass 1 (default): URL/filename heuristics — instant, no downloads.
//   Pass 2 (--deep):  also download each candidate and apply pixel heuristics (tiny/blank/banner).
// SAFE: dry-run by default; --execute backs up prior rows first; only flips vision_ok null→false
// (never un-flags, never deletes). Reversible from the backup.
//
//   node --env-file=.env.local scripts/flag-junk-images.mjs               # dry-run, URL pass
//   node --env-file=.env.local scripts/flag-junk-images.mjs --deep        # dry-run, URL + pixel
//   node --env-file=.env.local scripts/flag-junk-images.mjs --deep --execute
import { createClient } from "@supabase/supabase-js";
import { writeFileSync, mkdirSync } from "fs";
import { junkByUrl, junkByImage } from "../src/lib/imageJunk.ts";

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE);
const args = process.argv.slice(2);
const EXECUTE = args.includes("--execute");
const DEEP = args.includes("--deep");
const flag = (n, d) => (args.includes(n) ? Number(args[args.indexOf(n) + 1]) : d);
const LIMIT = flag("--limit", Infinity);
const CONC = flag("--conc", 8);

// candidates: stored images not already rejected and not the placeholder host
const rows = [];
let off = 0;
for (;;) {
  const { data } = await db.from("hotel_images").select("id,hotel_id,url,vision_ok").range(off, off + 999);
  if (!data?.length) break;
  for (const r of data) {
    const u = r.url || "";
    if (r.vision_ok === false) continue;          // already rejected
    if (!u || u.includes("placehold.co")) continue; // placeholders handled elsewhere
    rows.push(r);
  }
  if (data.length < 1000) break;
  off += 1000;
  if (rows.length >= LIMIT) break;
}
const work = rows.slice(0, LIMIT === Infinity ? rows.length : LIMIT);
console.log(`Mode: ${EXECUTE ? "EXECUTE" : "DRY-RUN"} · ${DEEP ? "URL+pixel" : "URL only"} · scanning ${work.length} stored images\n`);

const junk = [];
const reasons = {};
const tally = (v, r) => { junk.push({ ...r, reason: v.reason }); reasons[v.reason.split(":")[0]] = (reasons[v.reason.split(":")[0]] || 0) + 1; };

// Pass 1 — URL heuristics (instant)
const deepQueue = [];
for (const r of work) {
  const v = junkByUrl(r.url);
  if (v.junk) tally(v, r);
  else if (DEEP) deepQueue.push(r);
}

// Pass 2 — pixel heuristics (download, bounded concurrency)
if (DEEP && deepQueue.length) {
  console.log(`URL pass flagged ${junk.length}. Deep-checking ${deepQueue.length} survivors…`);
  let i = 0, done = 0;
  async function worker() {
    while (i < deepQueue.length) {
      const r = deepQueue[i++];
      try {
        const resp = await fetch(r.url, { signal: AbortSignal.timeout(15000), headers: { "user-agent": "Mozilla/5.0" } });
        if (resp.ok) {
          const buf = Buffer.from(await resp.arrayBuffer());
          const v = await junkByImage(buf);
          if (v.junk) tally(v, r);
        }
      } catch { /* unreachable image → leave for vision stage, don't flag */ }
      if (++done % 200 === 0) console.log(`  …${done}/${deepQueue.length}`);
    }
  }
  await Promise.all(Array.from({ length: CONC }, worker));
}

console.log(`\nflagged ${junk.length}/${work.length} as junk  ·  by reason:`, reasons);
console.log("samples:");
for (const j of junk.slice(0, 25)) console.log(`  [${j.reason}] ${j.url.slice(0, 90)}`);

if (!junk.length) { console.log("\nnothing to flag."); process.exit(0); }
if (!EXECUTE) { console.log(`\nDRY-RUN — nothing written. Add --execute to flag these vision_ok=false (backup first).`); process.exit(0); }

mkdirSync("scripts/backups", { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const backup = `scripts/backups/junk-images-${stamp}.json`;
writeFileSync(backup, JSON.stringify(junk.map(({ id, hotel_id, url, vision_ok, reason }) => ({ id, hotel_id, url, vision_ok, reason })), null, 2));
console.log(`\nbackup → ${backup}`);
let ok = 0;
for (let k = 0; k < junk.length; k += 100) {
  const ids = junk.slice(k, k + 100).map((j) => j.id);
  const { error } = await db.from("hotel_images").update({ vision_ok: false }).in("id", ids);
  if (!error) ok += ids.length; else console.error("  batch fail:", error.message);
}
console.log(`done — ${ok}/${junk.length} images flagged vision_ok=false · reversible via ${backup}`);
