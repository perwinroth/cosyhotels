#!/usr/bin/env node
// LLM judge for singleton place-mismatch suspects (name ≁ resolved Google place title).
// Token overlap flags transliterations/translations/rebrands of the SAME property as suspects, so
// a Haiku structured-output call decides same-vs-different per pair (~$0.001 each). Only
// confirmed-DIFFERENT rows get their cache purged + live row hidden (backed up, reversible).
//   node --env-file=.env.local scripts/judge-singleton-suspects.mjs <suspects.json>            # judge + report
//   node --env-file=.env.local scripts/judge-singleton-suspects.mjs <suspects.json> --execute  # + purge/hide
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";
import { readFileSync, writeFileSync, appendFileSync, existsSync } from "fs";

const EXECUTE = process.argv.includes("--execute");
const FILE = process.argv[2];
const suspects = JSON.parse(readFileSync(FILE, "utf8"));
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE);
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const places = JSON.parse(readFileSync("scripts/backups/place-id-cache.json", "utf8"));
const CACHE = "scripts/backups/review-cache.json";
const cache = JSON.parse(readFileSync(CACHE, "utf8"));
const BACKUP = `scripts/backups/singleton-hide-${new Date().toISOString().replace(/[:.]/g, "-")}.jsonl`;

const SCHEMA = { type: "object", additionalProperties: false, properties: { same_property: { type: "boolean" }, reason: { type: "string" } }, required: ["same_property", "reason"] };

async function judge(s) {
  const p = places[s.id] || {};
  const prompt = `Are these the SAME lodging property? Consider transliteration, translation (e.g. Finnish "Majakkahotelli" = "Lighthouse Hotel"), rebranding, and partial names. Answer strictly.
A: "${s.name}" in ${s.city || "?"}
B (Google Maps place): "${s.placeTitle}" at ${p.address || "?"}
JSON: {"same_property": true|false, "reason": "<short>"}`;
  for (let a = 0; a < 3; a++) {
    try {
      const r = await anthropic.messages.create({ model: "claude-haiku-4-5", max_tokens: 200, temperature: 0, messages: [{ role: "user", content: prompt }], output_config: { format: { type: "json_schema", schema: SCHEMA } } });
      const t = r.content.find((b) => b.type === "text")?.text;
      return JSON.parse(t);
    } catch (e) { if (e?.status === 429 || e?.status >= 500) { await new Promise((r) => setTimeout(r, 1500 * (a + 1))); continue; } return null; }
  }
  return null;
}

let same = 0, diff = 0, unknown = 0; const different = [];
let i = 0;
async function worker() {
  while (i < suspects.length) {
    const s = suspects[i++];
    const v = await judge(s);
    if (!v) { unknown++; continue; }
    if (v.same_property) same++;
    else { diff++; different.push({ ...s, reason: v.reason }); }
    if ((same + diff + unknown) % 40 === 0) console.log(`  ${same + diff + unknown}/${suspects.length} · same ${same} · DIFFERENT ${diff} · unknown ${unknown}`);
  }
}
await Promise.all(Array.from({ length: 8 }, worker));
console.log(`\njudged ${suspects.length}: same-property ${same} · DIFFERENT ${diff} · unknown ${unknown}`);
different.slice(0, 12).forEach((d) => console.log(`  ✗ ${d.name} (${d.city}) ≠ ${d.placeTitle} — ${d.reason.slice(0, 60)}`));
writeFileSync(FILE.replace(/\.json$/, "-different.json"), JSON.stringify(different, null, 2));

if (!EXECUTE) { console.log("\nreport only — rerun with --execute to purge cache + hide the DIFFERENT rows"); process.exit(0); }
let hidden = 0, purged = 0;
for (const d of different) {
  if (cache[d.id]) { delete cache[d.id]; purged++; }
  const { data: rows } = await db.from("cosy_scores").select("hotel_id,score,score_final,score_100,review_sentiment,description,signals,confidence,score_model,notes,scored_at").eq("hotel_id", d.id).gte("score", 5);
  for (const r of rows || []) {
    appendFileSync(BACKUP, JSON.stringify(r) + "\n");
    const { error } = await db.from("cosy_scores").update({ score: 0, score_final: null, score_100: null, notes: "hidden:wrong-reviews", scored_at: new Date().toISOString() }).eq("hotel_id", d.id);
    if (!error) hidden++;
  }
}
writeFileSync(CACHE, JSON.stringify(cache));
console.log(`purged ${purged} cache entries · hid ${hidden} live rows · backup ${BACKUP}`);
