#!/usr/bin/env node
// Audit: hotels sharing an ENTIRE distinctive review set in review-cache.json. Same physical
// hotel listed twice (pre-dedup) legitimately shares reviews; DIFFERENT hotels sharing them means
// the cache mapped the wrong place (the wrong-reviews bug). Classifies each group by name/city
// similarity and reports live poisoned hotels.
//   node --env-file=.env.local scripts/audit-review-mismatch.mjs                   # report only
//   node --env-file=.env.local scripts/audit-review-mismatch.mjs --purge --execute # purge poisoned cache + hide live poisoned rows
import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync, appendFileSync } from "fs";
import crypto from "crypto";

const EXECUTE = process.argv.includes("--execute") && process.argv.includes("--purge");
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE);
const CACHE = "scripts/backups/review-cache.json";
const BACKUP = `scripts/backups/mismatch-hide-${new Date().toISOString().replace(/[:.]/g, "-")}.jsonl`;
const cache = JSON.parse(readFileSync(CACHE, "utf8"));

// group by full distinctive-review-set signature
const sig = (revs) => {
  const d = revs.filter((r) => String(r).length > 60).sort();
  return d.length >= 2 ? crypto.createHash("md5").update(d.join("|")).digest("hex") : null;
};
const bySig = new Map();
for (const [id, revs] of Object.entries(cache)) {
  if (!Array.isArray(revs) || revs.length < 3) continue;
  const s = sig(revs);
  if (!s) continue;
  (bySig.get(s) || bySig.set(s, []).get(s)).push(id);
}
const groups = [...bySig.values()].filter((g) => g.length > 1);
const ids = groups.flat();

// hotel metadata
const meta = new Map();
for (let i = 0; i < ids.length; i += 300) {
  const { data } = await db.from("hotels").select("id,name,name_en,city,country").in("id", ids.slice(i, i + 300));
  for (const h of data || []) meta.set(String(h.id), h);
}
// live rows for those ids
const live = new Map();
for (let i = 0; i < ids.length; i += 300) {
  const { data } = await db.from("cosy_scores").select("hotel_id,score,score_final,score_100,review_sentiment,description,signals,confidence,score_model,notes,scored_at").in("hotel_id", ids.slice(i, i + 300)).gte("score", 5);
  for (const r of data || []) live.set(String(r.hotel_id), r);
}

const norm = (s) => String(s || "").toLowerCase().normalize("NFKD").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
const toks = (s) => new Set(norm(s).split(" ").filter((t) => t.length > 2 && !["the", "hotel", "bed", "and", "breakfast", "guest", "house", "guesthouse", "inn"].includes(t)));
const jac = (a, b) => { const A = toks(a), B = toks(b); if (!A.size || !B.size) return 0; let n = 0; for (const t of A) if (B.has(t)) n++; return n / (A.size + B.size - n); };

let benign = 0, poison = 0; const poisonIds = new Set(); const examples = [];
for (const g of groups) {
  const hs = g.map((id) => ({ id, h: meta.get(id) })).filter((x) => x.h);
  if (hs.length < 2) continue;
  // benign if every pair shares similar names OR same city (duplicate listing / annex)
  let allSimilar = true;
  for (let i = 0; i < hs.length && allSimilar; i++)
    for (let j = i + 1; j < hs.length && allSimilar; j++) {
      const a = hs[i].h, b = hs[j].h;
      const nameSim = jac(a.name_en || a.name, b.name_en || b.name);
      const sameCity = norm(a.city) && norm(a.city) === norm(b.city);
      if (nameSim < 0.34 && !sameCity) allSimilar = false;
    }
  if (allSimilar) { benign++; continue; }
  poison++;
  for (const x of hs) poisonIds.add(x.id);
  if (examples.length < 10) examples.push(hs.map((x) => `${(x.h.name_en || x.h.name).slice(0, 30)} (${x.h.city || "?"})`).join("  ~  "));
}
const livePoison = [...poisonIds].filter((id) => live.has(id));
console.log(`groups: ${groups.length} · benign(same hotel/city): ${benign} · POISON(different hotels): ${poison}`);
console.log(`poisoned hotel ids: ${poisonIds.size} · of which LIVE (score>=5): ${livePoison.length}`);
console.log("\nexample poison groups:"); examples.forEach((e) => console.log("  " + e));

if (!EXECUTE) { console.log("\nreport only — add --purge --execute to purge cache + hide live poisoned rows (backed up)"); process.exit(0); }
let hidden = 0, purged = 0;
for (const id of poisonIds) { if (cache[id]) { delete cache[id]; purged++; } }
writeFileSync(CACHE, JSON.stringify(cache));
for (const id of livePoison) {
  appendFileSync(BACKUP, JSON.stringify(live.get(id)) + "\n");
  const { error } = await db.from("cosy_scores").update({ score: 0, score_final: null, score_100: null, notes: "hidden:wrong-reviews", scored_at: new Date().toISOString() }).eq("hotel_id", id);
  if (!error) hidden++;
}
console.log(`\npurged ${purged} poisoned cache entries · hid ${hidden} live rows · backup ${BACKUP}`);
