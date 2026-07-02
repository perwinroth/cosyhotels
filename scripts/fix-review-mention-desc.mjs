#!/usr/bin/env node
// Regenerate live descriptions that meta-reference "reviews"/"guests say" instead of describing
// the hotel directly ("earns its rapturous reviews through…"). Description+signals only — scores
// are owned by the concurrent dims pass. Postgres \y word-boundary in the SELECT (the JS \b vs \y
// mixup is why the v3 run only redescribed 29 of these).
//   node --env-file=.env.local scripts/fix-review-mention-desc.mjs             # dry-run
//   node --env-file=.env.local scripts/fix-review-mention-desc.mjs --execute   # write (backs up)
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";
import { readFileSync, existsSync, appendFileSync } from "fs";

const EXECUTE = process.argv.includes("--execute");
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE);
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const CACHE = "scripts/backups/review-cache.json";
const cache = existsSync(CACHE) ? JSON.parse(readFileSync(CACHE, "utf8")) : {};
const BACKUP = `scripts/backups/fix-review-mention-${new Date().toISOString().replace(/[:.]/g, "-")}.jsonl`;

const RX = String.raw`\yreviews?\y|guests? (say|report|mention|note)`;
const { data: rows, error } = await db.from("cosy_scores").select("hotel_id,description,signals").gte("score", 5).filter("description", "imatch", RX);
if (error) { console.error(error.message); process.exit(1); }
console.log(`${EXECUTE ? "EXECUTE" : "DRY-RUN"} · ${rows.length} live rows meta-referencing reviews`);
const ids = rows.map((r) => String(r.hotel_id));
const meta = new Map();
for (let i = 0; i < ids.length; i += 300) { const { data } = await db.from("hotels").select("id,name,name_en,city,country").in("id", ids.slice(i, i + 300)); for (const h of data || []) meta.set(String(h.id), h); }

const STYLE = `Write in warm, specific British English, exactly ONE sentence describing this hotel's cosy character, grounded ONLY in what guests concretely mention. Name concrete details. NEVER use "genuine"/"genuinely". NEVER mention "reviews", "guests say", or comment on the evidence — describe the hotel itself directly. NEVER speculate or hedge.`;
const cleanRevs = (arr) => [...new Set((arr || []).map((r) => String(r).replace(/\s+/g, " ").trim()).filter((s) => s.length > 15))].slice(0, 20);
const cleanSentence = (s) => String(s || "").trim().replace(/^["'\s]+|["'\s]+$/g, "").replace(/\s+/g, " ");
const BAD = /(\breviews?\b|guests? (say|report|mention|note)|\bgenuine(ly)?\b|little detail|limited (data|detail)|appears to|seems to)/i;

let fixed = 0, failed = 0, i = 0;
async function worker() {
  while (i < rows.length) {
    const r = rows[i++];
    const id = String(r.hotel_id);
    const h = meta.get(id); if (!h) { failed++; continue; }
    const revs = cleanRevs(cache[id]);
    if (revs.length < 3) { failed++; continue; }
    const prompt = `${STYLE} Return ONLY the sentence.\nHOTEL: ${[h.name_en || h.name, h.city, h.country].filter(Boolean).join(", ")}\nREVIEWS:\n${revs.map((x, k) => `${k + 1}. ${x}`).join("\n")}`;
    try {
      const resp = await anthropic.messages.create({ model: "claude-sonnet-4-6", max_tokens: 200, temperature: 0, messages: [{ role: "user", content: prompt }] });
      const s = cleanSentence(resp.content.find((b) => b.type === "text")?.text);
      if (!s || s.length < 40 || BAD.test(s)) { failed++; continue; }
      if (EXECUTE) {
        appendFileSync(BACKUP, JSON.stringify({ hotel_id: id, description: r.description, signals: r.signals }) + "\n");
        const { error: e } = await db.from("cosy_scores").update({ description: s }).eq("hotel_id", id);
        if (e) { failed++; continue; }
      }
      fixed++;
      if (fixed <= 5) console.log(`  ✓ ${(h.name_en || h.name).slice(0, 30)}: ${s.slice(0, 90)}`);
    } catch { failed++; }
  }
}
await Promise.all(Array.from({ length: 6 }, worker));
console.log(`${EXECUTE ? "DONE" : "DRY-RUN"} · fixed ${fixed} · failed ${failed}`);
if (EXECUTE) console.log(`backup: ${BACKUP}`);
