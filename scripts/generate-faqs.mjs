// Bespoke per-hotel FAQ for hotels we have real guest reviews for (cached Serper reviews). Generates
// 4–6 question/answer pairs that reflect THIS hotel's actual strengths (breakfast, spa, location,
// romance…) drawn ONLY from its reviews/amenities/score — never invented. Writes to a committed
// JSON file (src/data/hotelFaqs.json) keyed by hotel_id; the hotel detail page uses the bespoke set
// when present, else the data-tailored template. No DB schema change.
//
//   node --env-file=.env.local scripts/generate-faqs.mjs                 # dry-run, sample 6
//   node --env-file=.env.local scripts/generate-faqs.mjs --limit 5 --execute
//   node --env-file=.env.local scripts/generate-faqs.mjs --execute       # full run (review-cached set)
//   flags: --min-score 5  --limit N  --execute  --model claude-haiku-4-5
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";

const args = process.argv.slice(2);
const EXECUTE = args.includes("--execute");
const flag = (n, d) => (args.includes(n) ? args[args.indexOf(n) + 1] : d);
const MIN = Number(flag("--min-score", 5));
const LIMIT = Number(flag("--limit", 0)) || 0;
const MODEL = flag("--model", process.env.FAQ_MODEL || "claude-haiku-4-5");
const CONC = 6;
const OUT = "src/data/hotelFaqs.json";
const PROGRESS = "scripts/backups/generate-faqs-progress.json";

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE);
const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) { console.error("✗ ANTHROPIC_API_KEY not set"); process.exit(1); }
const anthropic = new Anthropic({ apiKey });

const SYSTEM = `You write the FAQ for ONE hotel's page — for SEO and AI answer engines (Google, ChatGPT, etc.). Output 4–6 question/answer pairs about THIS hotel.

HONESTY (the brand is built on trustworthy scores — a single invented detail breaks it):
- Ground EVERY answer ONLY in the data provided: the cosy score, the guest rating + review count, the listed amenities, the city, and the real guest review snippets. NEVER invent features, prices, history, or facts not present.
- Choose FEATURE questions from what guests actually praise in the reviews — e.g. if they rave about breakfast → "Is breakfast good at X?"; a spa is mentioned → "Does X have a spa?"; staff warmth → "Is the service good at X?"; romance → "Is X good for couples?". Only ask a feature question you can answer truthfully from the data.

ALWAYS include: (1) one cosiness question that states the cosy score, and (2) one "Where is X?" location question.

STYLE: put the hotel's name in every question. Answers 1–2 sentences, warm, specific, British English, no hype, no clichés. Lead answers with the genuine, concrete thing — paraphrase guests, don't quote at length.

Reply ONLY with JSON: {"faqs":[{"q":"...","a":"..."}]}`;

const SCHEMA = { type: "object", additionalProperties: false, properties: {
  faqs: { type: "array", items: { type: "object", additionalProperties: false, properties: { q: { type: "string" }, a: { type: "string" } }, required: ["q", "a"] } },
}, required: ["faqs"] };

function payload(h) {
  const lines = [`Hotel: ${h.name}`, `City / location: ${[h.city, h.country].filter(Boolean).join(", ") || "unknown"}`, `Cosy score: ${Number(h.score).toFixed(1)}/10`];
  if (h.rating != null) lines.push(`Guest rating: ${(Number(h.rating) / 2).toFixed(1)}/5${h.reviews ? ` from ${h.reviews.toLocaleString()} reviews` : ""}`);
  if (h.amenities?.length) lines.push(`Listed amenities: ${h.amenities.join(", ")}`);
  lines.push(`Real guest review snippets (your source for specific, truthful detail):`);
  for (const r of h.reviewTexts) lines.push(`  • ${String(r).replace(/\s+/g, " ").slice(0, 320)}`);
  return lines.join("\n");
}

async function gen(h) {
  const resp = await anthropic.messages.create({
    model: MODEL, max_tokens: 900, temperature: 0.5,
    system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
    output_config: { format: { type: "json_schema", schema: SCHEMA } },
    messages: [{ role: "user", content: payload(h) }],
  });
  const tb = resp.content.find((b) => b.type === "text");
  const faqs = tb ? JSON.parse(tb.text).faqs : [];
  return (faqs || []).filter((f) => f && f.q && f.a).slice(0, 6);
}

// ---- gather: hotels with cached reviews + score>=MIN ---------------------------------------------
const reviewCache = JSON.parse(readFileSync("scripts/backups/review-cache.json", "utf8"));
const reviewIds = Object.entries(reviewCache).filter(([, v]) => Array.isArray(v) && v.length >= 2).map(([k]) => k);
const out = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : {};

// The FAQ universe = all shown hotels (score>=MIN). Progress is reported against this global target
// so the monitor climbs toward "all" (~9,700) instead of resetting to each run's available batch.
const { count: shownCount } = await db.from("cosy_scores").select("*", { count: "exact", head: true }).gte("score", MIN);
const GLOBAL = shownCount || 0;
const writeProg = (written, failed) => { try { writeFileSync(PROGRESS, JSON.stringify({ total: GLOBAL, done: Object.keys(out).length, written, failed, updatedAt: Date.now() }, null, 2)); } catch {} };

const work = [];
for (let i = 0; i < reviewIds.length; i += 200) {
  const slice = reviewIds.slice(i, i + 200);
  const { data: scores } = await db.from("cosy_scores").select("hotel_id, score, score_final").in("hotel_id", slice).gte("score", MIN);
  const ok = new Map((scores || []).map((r) => [String(r.hotel_id), (r.score_final ?? r.score) || 0]));
  const ids = [...ok.keys()];
  const { data: hotels } = ids.length ? await db.from("hotels").select("id,name,name_en,city,country,amenities,rating,reviews_count").in("id", ids) : { data: [] };
  for (const h of hotels || []) {
    const id = String(h.id);
    if (out[id]) continue; // resumable: already generated
    const name = (h.name_en || h.name || "").trim();
    if (!name) continue;
    work.push({ hotel_id: id, name, city: h.city || "", country: h.country || "", score: ok.get(id), rating: h.rating ?? null, reviews: h.reviews_count ?? null, amenities: Array.isArray(h.amenities) ? h.amenities : [], reviewTexts: (reviewCache[id] || []).filter(Boolean).slice(0, 8) });
  }
  if (LIMIT && work.length >= LIMIT) break;
}
const todo = LIMIT ? work.slice(0, LIMIT) : work;
console.log(`${todo.length} hotels to FAQ (review-cached, score>=${MIN}, not yet done) · ${Object.keys(out).length} already in ${OUT} · model ${MODEL} · ${EXECUTE ? "EXECUTE" : "DRY-RUN"}\n`);
if (!todo.length) { writeProg(0, 0); console.log("nothing to do (waiting on more reviews)."); process.exit(0); }

if (!EXECUTE) {
  for (const h of todo.slice(0, 6)) {
    try { const faqs = await gen(h); console.log(`• ${h.name} (${h.city}, ${Number(h.score).toFixed(1)})`); for (const f of faqs) console.log(`    Q ${f.q}\n    A ${f.a}`); console.log(""); }
    catch (e) { console.log(`• ${h.name} — ERROR ${String(e.message).slice(0, 60)}\n`); }
  }
  console.log(`Sample above. Full scope: ${todo.length}. Re-run with --execute to write ${OUT}.`);
  process.exit(0);
}

mkdirSync("src/data", { recursive: true });
mkdirSync("scripts/backups", { recursive: true });
let n = 0, done = 0, failed = 0;
for (let i = 0; i < todo.length; i += CONC) {
  await Promise.all(todo.slice(i, i + CONC).map(async (h) => {
    n++;
    try { const faqs = await gen(h); if (faqs.length >= 3) { out[h.hotel_id] = faqs; done++; } else failed++; }
    catch { failed++; }
  }));
  writeFileSync(OUT, JSON.stringify(out, null, 0)); // compact; written incrementally for crash-safety
  writeProg(done, failed); // progress vs the GLOBAL shown-hotel target
  if (n % 30 === 0) console.log(`${String(n).padStart(4)}/${todo.length}  written ${done} · failed ${failed} · total ${Object.keys(out).length}/${GLOBAL}`);
}
console.log(`\ndone — ${done} hotels given bespoke FAQs · ${failed} failed · total in file: ${Object.keys(out).length} → ${OUT}`);
