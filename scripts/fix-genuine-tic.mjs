#!/usr/bin/env node
// Targeted cleanup: rewrite the descriptions of live hotels whose copy still contains the "genuine(ly)"
// tic, using Sonnet grounded in the same cached reviews. Description-only, backed up, reversible.
//   node --env-file=.env.local scripts/fix-genuine-tic.mjs            # dry-run
//   node --env-file=.env.local scripts/fix-genuine-tic.mjs --execute  # write
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";
import { readFileSync, existsSync, appendFileSync } from "fs";

const EXECUTE = process.argv.includes("--execute");
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const cache = existsSync("scripts/backups/review-cache.json") ? JSON.parse(readFileSync("scripts/backups/review-cache.json", "utf8")) : {};
const BACKUP = `scripts/backups/fix-genuine-${new Date().toISOString().replace(/[:.]/g, "-")}.jsonl`;
const cleanRevs = (a) => [...new Set((a || []).map((r) => String(r).replace(/\s+/g, " ").trim()).filter((s) => s.length > 15))].slice(0, 20);
const clean = (s) => String(s || "").trim().replace(/^["'\s]+|["'\s]+$/g, "").replace(/\s+/g, " ");
const HEDGE = /(little detail|details? (are|is)? ?(limited|scarce|sparse)|limited (data|detail|information)|not much (is )?known|name suggest|based on (its |the )?name|hard to (say|assess)|few details)/i;
const tic = (s) => /\bgenuine(ly)?\b/i.test(s);
const bad = (s) => !s || s.trim().length < 40 || HEDGE.test(s);

const rows = [];
for (let off = 0; ; off += 999) {
  const { data } = await db.from("cosy_scores").select("hotel_id,description,hotel:hotel_id!inner(name,name_en,city,country)").gte("score", 5).ilike("description", "%genuine%").range(off, off + 998);
  if (!data?.length) break; rows.push(...data); if (data.length < 999) break;
}
console.log(`${EXECUTE ? "EXECUTE" : "DRY-RUN"} · ${rows.length} live hotels with the "genuine" tic`);
let fixed = 0, skipped = 0;
for (const r of rows) {
  const h = r.hotel; const name = h.name_en || h.name;
  const revs = cleanRevs(cache[String(r.hotel_id)]);
  if (revs.length < 3) { skipped++; continue; }
  const prompt = `Write ONE warm, specific sentence describing this hotel's cosy character, grounded ONLY in these guest reviews. British English. Name concrete details guests mention. The words "genuine" and "genuinely" are BANNED. Do not speculate or mention data/reviews/limitations. Return ONLY the sentence.\nHOTEL: ${[name, h.city, h.country].filter(Boolean).join(", ")}\nREVIEWS:\n${revs.map((x, i) => `${i + 1}. ${x}`).join("\n")}`;
  let desc = "";
  for (let a = 0; a < 3 && (bad(desc) || tic(desc)); a++) {
    try { const resp = await anthropic.messages.create({ model: "claude-sonnet-4-6", max_tokens: 300, temperature: 0.3, messages: [{ role: "user", content: prompt }] }); desc = clean(resp.content.find((b) => b.type === "text")?.text || ""); } catch { await new Promise((z) => setTimeout(z, 1500)); }
  }
  if (bad(desc) || tic(desc)) { skipped++; continue; }
  if (EXECUTE) { appendFileSync(BACKUP, JSON.stringify({ hotel_id: r.hotel_id, prev_description: r.description }) + "\n"); const { error } = await db.from("cosy_scores").update({ description: desc }).eq("hotel_id", r.hotel_id); if (error) { skipped++; continue; } }
  fixed++;
  if (fixed % 10 === 0) console.log(`  fixed ${fixed}/${rows.length}`);
}
console.log(`\n${EXECUTE ? "DONE" : "DRY-RUN"} · fixed ${fixed} · skipped ${skipped}${EXECUTE ? ` · backup ${BACKUP}` : ""}`);
