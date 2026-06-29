// Copywriter descriptions for hotels that currently fall back to the generic buildCosySnippet
// template ("Searching for a cosy hotel in X? Y stands out. Guest rating…"). Generates a short,
// vivid, GROUNDED, conversion-focused description per hotel and writes it to cosy_scores.description.
// Grounded = only uses the hotel's real cosy signals + city/score; never invents amenities.
//
// SAFETY: DRY-RUN by default. --execute writes, after snapshotting prior descriptions to
// scripts/backups/ for reversibility. Resumable + idempotent: only rows with an empty description
// (and score>=MIN) are touched, and each is filled as it goes, so reruns advance and never re-spend.
//
//   node --env-file=.env.local scripts/generate-copy.mjs                      # dry-run, sample 8
//   node --env-file=.env.local scripts/generate-copy.mjs --limit 8 --execute  # write 8 (eyeball quality)
//   node --env-file=.env.local scripts/generate-copy.mjs --execute            # full run (shown set)
//   flags: --min-score 5  --limit N  --execute  --model claude-haiku-4-5  --restore <file>
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";
import { writeFileSync, mkdirSync, readFileSync } from "fs";

const args = process.argv.slice(2);
const EXECUTE = args.includes("--execute");
const flag = (n, d) => (args.includes(n) ? args[args.indexOf(n) + 1] : d);
const MIN = Number(flag("--min-score", 5));
const LIMIT = Number(flag("--limit", 0)) || 0;
const MODEL = flag("--model", process.env.COPY_MODEL || "claude-haiku-4-5");
const CONC = 6;
const PROGRESS = "scripts/backups/generate-copy-progress.json";

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE);

// ---- restore ------------------------------------------------------------------------------------
const restorePath = flag("--restore", "");
if (restorePath) {
  const snap = JSON.parse(readFileSync(restorePath, "utf8"));
  let ok = 0;
  for (const r of snap) { const { error } = await db.from("cosy_scores").update({ description: r.description }).eq("hotel_id", r.hotel_id); if (!error) ok++; }
  console.log(`restored ${ok}/${snap.length} descriptions.`); process.exit(0);
}

const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) { console.error("✗ ANTHROPIC_API_KEY not set"); process.exit(1); }
const anthropic = new Anthropic({ apiKey });

const SYSTEM = `You are a travel copywriter for "Got Cosy", a site that ranks hotels by COSINESS — warmth, intimacy and character, not stars. Write a short description that makes a traveller want to book THIS hotel.

CRITICAL — HONESTY (the brand is built on trustworthy scores; a single invented detail breaks it):
- Use ONLY the facts provided below. NEVER invent physical features, decor, cuisine, history, views, room details, fireplaces, "stone walls", "wooden beams", etc. If it isn't in the data, you do not know it — do not imply it.
- The things you CAN state as fact: the city/location, the cosy score, the guest rating + review count, any listed amenities, and ANYTHING GUESTS ACTUALLY SAY in the provided review snippets (these are real — you may draw specific, vivid details straight from them, even paraphrased).
- When real guest reviews are provided, lead with the genuine, specific thing guests loved. When they aren't, build desire from the city + cosy score + social proof only — never fabricated specifics.

Style:
- Voice: warm, confident, human. Never hyperbolic, salesy, templated, or generic.
- Lead with the hotel's name and city. Weave in the social proof (a strong guest rating from real reviews) naturally where it helps — it's persuasive AND true.
- 2 sentences, ~30–40 words. British English. No clichés ("nestled", "whether you're a…", "home away from home", "hidden gem"). Mind your articles (a/an).
- Vary the OPENING across hotels — sometimes the city, sometimes what guests loved, sometimes an amenity, sometimes the feeling. NEVER start with the score, and don't follow a template.

Reply ONLY with JSON: {"description": "<the copy>"}`;

const SCHEMA = { type: "object", additionalProperties: false, properties: { description: { type: "string" } }, required: ["description"] };

function payload(h) {
  const lines = [`Hotel: ${h.name}`, `City / location: ${[h.city, h.country].filter(Boolean).join(", ") || "unknown"}`, `Cosy score: ${Number(h.score).toFixed(1)}/10 (how cosy/warm/intimate it is — high is good)`];
  if (h.rating != null) lines.push(`Guest rating: ${(Number(h.rating) / 2).toFixed(1)}/5${h.reviews ? ` from ${h.reviews.toLocaleString()} reviews` : ""} (real, use as social proof)`);
  if (h.amenities?.length) lines.push(`Listed amenities: ${h.amenities.join(", ")}`);
  if (h.reviewTexts?.length) {
    lines.push(`Real guest review snippets (your richest, truthful source — draw the specific cosy detail from here):`);
    for (const r of h.reviewTexts) lines.push(`  • ${String(r).replace(/\s+/g, " ").slice(0, 320)}`);
  } else if (!h.amenities?.length) {
    lines.push(`No reviews or amenities provided — do NOT mention any specific facility, room feature, decor, or view. Keep it to the city + the cosy promise + social proof.`);
  }
  return lines.join("\n");
}

async function writeCopy(h) {
  const resp = await anthropic.messages.create({
    model: MODEL, max_tokens: 256, temperature: 0.6,
    system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
    output_config: { format: { type: "json_schema", schema: SCHEMA } },
    messages: [{ role: "user", content: payload(h) }],
  });
  const tb = resp.content.find((b) => b.type === "text");
  const d = tb ? JSON.parse(tb.text).description : "";
  return String(d || "").trim();
}

// Cached Serper guest reviews from the review-scoring run — the richest, most honest grounding.
let reviewCache = {};
try { reviewCache = JSON.parse(readFileSync("scripts/backups/review-cache.json", "utf8")); } catch {}

// ---- gather: shown hotels (score>=MIN) with an EMPTY description -----------------------------------
const rows = [];
for (let off = 0; ; off += 1000) {
  const { data, error } = await db
    .from("cosy_scores")
    .select("hotel_id, score, score_final, signals, description, hotel:hotel_id!inner(name, name_en, city, country, amenities, rating, reviews_count)")
    .gte("score", MIN).or("description.is.null,description.eq.")
    .order("score", { ascending: false }).range(off, off + 999);
  if (error) { console.error("✗ query:", error.message); process.exit(1); }
  if (!data?.length) break;
  rows.push(...data);
  if (data.length < 1000) break;
  if (LIMIT && rows.length >= LIMIT) break;
}
const work = (LIMIT ? rows.slice(0, LIMIT) : rows)
  .map((r) => ({
    hotel_id: r.hotel_id,
    name: (r.hotel?.name_en || r.hotel?.name || "").trim(),
    city: r.hotel?.city || "", country: r.hotel?.country || "",
    score: (r.score_final ?? r.score) || 0,
    rating: r.hotel?.rating ?? null, reviews: r.hotel?.reviews_count ?? null,
    amenities: Array.isArray(r.hotel?.amenities) ? r.hotel.amenities : [],
    reviewTexts: (reviewCache[r.hotel_id] || []).filter(Boolean).slice(0, 8),
    oldDescription: r.description ?? null,
  }))
  .filter((h) => h.name);
console.log(`${work.length} hotels need copy (score>=${MIN}, empty description) · model ${MODEL} · ${EXECUTE ? "EXECUTE" : "DRY-RUN"}\n`);
if (!work.length) { console.log("nothing to do."); process.exit(0); }

mkdirSync("scripts/backups", { recursive: true });
const recent = []; let n = 0, done = 0, failed = 0;
const startedAt = Date.now();
const writeProgress = (extra = {}) => { try { writeFileSync(PROGRESS, JSON.stringify({ mode: EXECUTE ? "execute" : "dry", model: MODEL, total: work.length, done: n, written: done, failed, startedAt, updatedAt: Date.now(), recent: recent.slice(-12).reverse(), ...extra }, null, 2)); } catch {} };

if (!EXECUTE) {
  // Generate a handful so you can judge the copy quality before committing the run.
  const withR = work.filter((h) => h.reviewTexts.length);
  const without = work.filter((h) => !h.reviewTexts.length);
  const sample = [...withR.slice(0, 5), ...without.slice(0, 3)];
  console.log(`DRY-RUN — sample (${withR.length} of ${work.length} have cached reviews). Eyeball quality, no DB writes:\n`);
  for (const h of sample) {
    try { const d = await writeCopy(h); console.log(`• ${h.name} (${h.city}, ${Number(h.score).toFixed(1)}) ${h.reviewTexts.length ? "[reviews]" : "[no reviews]"}\n  ${d}\n`); recent.push({ name: h.name, city: h.city, description: d }); n++; }
    catch (e) { console.log(`• ${h.name} — ERROR ${String(e.message).slice(0, 60)}\n`); }
  }
  writeProgress({ finished: true });
  console.log(`Sample done. Full scope: ${work.length} hotels. Re-run with --execute to write all (snapshots first).`);
  process.exit(0);
}

const backupPath = `scripts/backups/generate-copy-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
writeFileSync(backupPath, JSON.stringify(work.map((h) => ({ hotel_id: h.hotel_id, description: h.oldDescription })), null, 2));
console.log(`backup of ${work.length} prior descriptions → ${backupPath}\n`);
writeProgress();

for (let i = 0; i < work.length; i += CONC) {
  await Promise.all(work.slice(i, i + CONC).map(async (h) => {
    n++;
    try {
      const d = await writeCopy(h);
      if (d && d.length > 20) {
        const { error } = await db.from("cosy_scores").update({ description: d }).eq("hotel_id", h.hotel_id);
        if (error) { failed++; return; }
        done++; recent.push({ name: h.name, city: h.city, description: d });
      } else { failed++; }
    } catch { failed++; }
  }));
  writeProgress();
  if (n % 60 === 0) console.log(`${String(n).padStart(5)}/${work.length}  written ${done} · failed ${failed}`);
}
writeProgress({ finished: true });
console.log(`\ndone — ${done} descriptions written · ${failed} failed/skipped (backup: ${backupPath}).`);
