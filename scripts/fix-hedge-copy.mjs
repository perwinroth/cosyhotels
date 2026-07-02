#!/usr/bin/env node
// Fix the residual self-defeating / speculative / closed-venue descriptions among live v2 hotels.
// Regenerate from cached reviews with a strict "describe only what guests concretely say, never
// meta-comment on the reviews, never speculate" prompt. If it still can't produce clean specific
// copy (or the place is closed / has too few reviews), HIDE it. Backed up, reversible.
//   node --env-file=.env.local scripts/fix-hedge-copy.mjs --execute
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";
import { readFileSync, existsSync, appendFileSync } from "fs";

const EXECUTE = process.argv.includes("--execute");
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const ai = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const cache = existsSync("scripts/backups/review-cache.json") ? JSON.parse(readFileSync("scripts/backups/review-cache.json", "utf8")) : {};
const BACKUP = `scripts/backups/fix-hedge-${new Date().toISOString().replace(/[:.]/g, "-")}.jsonl`;
const cleanRevs = (a) => [...new Set((a || []).map((r) => String(r).replace(/\s+/g, " ").trim()).filter((s) => s.length > 15))].slice(0, 20);
const clean = (s) => String(s || "").trim().replace(/^["'\s]+|["'\s]+$/g, "").replace(/\s+/g, " ");
// A description is unacceptable if it hedges, speculates, meta-comments on the reviews, or is a tic/empty.
const BAD = /(little detail|details? (are|is)? ?(limited|scarce|sparse)|limited (data|detail|information)|not much (is )?known|name suggest|based on (its |the )?name|hard to (say|assess)|difficult to assess|impossible to assess|few details|offer no concrete|no concrete detail|offer minimal concrete|offer scant detail|offer little sense|offer limited concrete|entirely unclear|prevents a higher|limited positive detail|sparse reviews|no mention of|reviews (offer|focus|don|mention)|appears to|seems to (offer|be|have)|promise of|carries the promise|promising the kind|hints? at|\bgenuine(ly)?\b|closed its doors|now closed|permanently closed|current closure|has closed)/i;
const isBad = (s) => !s || s.trim().length < 40 || BAD.test(s);
const CLOSED = /(closed its doors|now closed|permanently closed|current closure|has closed|no longer operating|out of business)/i;

const all = [];
for (let off = 0; ; off += 999) {
  const { data, error } = await db.from("cosy_scores").select("hotel_id,description,score_100,score,score_final,notes,hotel:hotel_id!inner(name,name_en,city,country)").gte("score", 5).eq("notes", "review-scored:v2").range(off, off + 998);
  if (error) { console.error(error.message); break; }
  if (!data?.length) break; all.push(...data); if (data.length < 999) break;
}
const rows = all.filter((r) => BAD.test(r.description || ""));
console.log(`${EXECUTE ? "EXECUTE" : "DRY-RUN"} · scanned ${all.length} live v2 · ${rows.length} need fixing`);
let fixed = 0, hidden = 0, skipped = 0;
for (const r of rows || []) {
  const h = r.hotel; const name = h.name_en || h.name;
  const revs = cleanRevs(cache[String(r.hotel_id)]);
  const prev = { score: r.score, score_final: r.score_final, score_100: r.score_100, description: r.description, notes: r.notes };
  // Closed venue, or too few reviews to ground -> hide.
  if (revs.length < 3 || CLOSED.test(r.description || "")) {
    if (EXECUTE) { appendFileSync(BACKUP, JSON.stringify({ hotel_id: r.hotel_id, prev }) + "\n"); await db.from("cosy_scores").update({ score: 0, score_final: null, score_100: null, notes: "hidden:no-findings" }).eq("hotel_id", r.hotel_id); }
    hidden++; continue;
  }
  const prompt = `Write ONE warm, specific sentence describing this hotel for a traveller, using ONLY concrete things guests actually state in these reviews (service, staff names, breakfast, rooms, location, specific touches). STRICT RULES: Never mention "reviews", "details", or that information is limited/lacking/unclear. Never use "appears to", "seems to", "promise", "hints at". Never say "genuine". Do not speculate. If guests mainly praise practical things (cleanliness, location, service, breakfast), describe THOSE specifically and honestly. Return ONLY the sentence.\nHOTEL: ${[name, h.city, h.country].filter(Boolean).join(", ")}\nREVIEWS:\n${revs.map((x, i) => `${i + 1}. ${x}`).join("\n")}`;
  let desc = "";
  for (let a = 0; a < 3 && isBad(desc); a++) {
    try { const resp = await ai.messages.create({ model: "claude-sonnet-4-6", max_tokens: 220, temperature: 0.4, messages: [{ role: "user", content: prompt }] }); desc = clean(resp.content.find((b) => b.type === "text")?.text || ""); } catch { await new Promise((z) => setTimeout(z, 1500)); }
  }
  if (isBad(desc)) { // couldn't produce clean grounded copy -> hide rather than keep hedge
    if (EXECUTE) { appendFileSync(BACKUP, JSON.stringify({ hotel_id: r.hotel_id, prev }) + "\n"); await db.from("cosy_scores").update({ score: 0, score_final: null, score_100: null, notes: "hidden:no-findings" }).eq("hotel_id", r.hotel_id); }
    hidden++; continue;
  }
  if (EXECUTE) { appendFileSync(BACKUP, JSON.stringify({ hotel_id: r.hotel_id, prev }) + "\n"); await db.from("cosy_scores").update({ description: desc }).eq("hotel_id", r.hotel_id); }
  fixed++;
  if ((fixed + hidden) % 10 === 0) console.log(`  fixed ${fixed} · hidden ${hidden}`);
}
console.log(`\n${EXECUTE ? "DONE" : "DRY-RUN"} · fixed ${fixed} · hidden ${hidden} · skipped ${skipped}${EXECUTE ? ` · backup ${BACKUP}` : ""}`);
