#!/usr/bin/env node
// TRAVELLER FIT inference — assign 3–6 public "Traveller Fit" concepts to every live hotel
// (cosy_scores.score_final >= 5, ~6,345), each with a confidence + a one-line evidence string, into
// the `hotel_traveller_fit` table. Mirrors scripts/score-and-describe.mjs (the proven batch template):
// concurrency pool, USD budget guard via token accounting, retry w/ backoff, resume checkpoint,
// per-row reversible backup, structured JSON output, batched metadata hydration, job_runs audit.
//
//   node --env-file=.env.local --import tsx scripts/infer-traveller-fit.ts               # DRY-RUN (no writes)
//   node --env-file=.env.local --import tsx scripts/infer-traveller-fit.ts --limit 8     # dry-run pilot
//   node --env-file=.env.local --import tsx scripts/infer-traveller-fit.ts --execute     # real run (backs up first)
//   flags: --limit N  --conc 6  --budget 25 (USD hard cap)  --force (re-infer hotels that already have rows)
//
// TWO-LAYER assignment (see src/lib/travellerFit.ts): an LLM (Haiku) proposes concepts grounded in
// real evidence, then CODE-ENFORCED gates run — HARD concepts (physical/factual: pool, sauna, spa…)
// are kept ONLY when the deterministic regex actually matches real evidence (the model alone can never
// grant them), and every HARD concept whose regex DOES match is rule-backfilled even if the model
// missed it. SOFT concepts (experiential) may come from the model above their minConfidence floor.
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";
import { writeFileSync, readFileSync, existsSync, appendFileSync } from "node:fs";
import {
  CONCEPTS,
  CONCEPT_BY_SLUG,
  hardEvidenceOk,
  deterministicMatch,
  type TravellerFitConcept,
  type FitMatchInput,
} from "@/lib/travellerFit";

// ---- flags -------------------------------------------------------------------------------------
const args = process.argv.slice(2);
const EXECUTE = args.includes("--execute");
const FORCE = args.includes("--force");
const flag = (n: string, d?: string) => (args.includes(n) ? args[args.indexOf(n) + 1] : d);
const LIMIT = Number(flag("--limit", "0")) || 0;
const CONC = Number(flag("--conc", "6"));
const BUDGET = Number(flag("--budget", "25"));
const MIN = Number(flag("--min", "5")); // live-hotel score floor (score_final)
const CAP = 8; // stored per hotel (page shows 6 via displayFits; keep a couple extra)

const ANTHRO = process.env.ANTHROPIC_API_KEY;
if (!ANTHRO) { console.error("✗ need ANTHROPIC_API_KEY"); process.exit(1); }
const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE;
if (!SB_URL || !SB_KEY) { console.error("✗ need SUPABASE_URL + SERVICE_ROLE key"); process.exit(1); }
const db = createClient(SB_URL, SB_KEY);

const HAIKU = "claude-haiku-4-5";
const CACHE = "scripts/backups/review-cache.json";
const STATE = "scripts/backups/traveller-fit-progress.json";
const BACKUP = `scripts/backups/traveller-fit-${new Date().toISOString().replace(/[:.]/g, "-")}.jsonl`;
const cache: Record<string, string[]> = existsSync(CACHE) ? JSON.parse(readFileSync(CACHE, "utf8")) : {};

// ---- token cost accounting (same price table shape as score-and-describe) ----------------------
const PRICE: Record<string, { in: number; out: number }> = { [HAIKU]: { in: 1 / 1e6, out: 5 / 1e6 } };
const cost: Record<string, { in: number; out: number }> = { [HAIKU]: { in: 0, out: 0 } };
const usd = () => Object.entries(cost).reduce((s, [m, t]) => s + t.in * PRICE[m].in + t.out * PRICE[m].out, 0);

const anthropic = new Anthropic({ apiKey: ANTHRO });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// SDK call with structured JSON output (guarantees valid JSON) + retry/backoff on 429/5xx.
async function claude(model: string, content: string, maxTok: number, schema: object): Promise<string | null> {
  for (let a = 0; a < 4; a++) {
    try {
      const params: Record<string, unknown> = { model, max_tokens: maxTok, temperature: 0, messages: [{ role: "user", content }] };
      params.output_config = { format: { type: "json_schema", schema } };
      const resp = await anthropic.messages.create(params as never);
      cost[model].in += resp.usage?.input_tokens || 0; cost[model].out += resp.usage?.output_tokens || 0;
      const tb = resp.content.find((b: { type: string }) => b.type === "text") as { text?: string } | undefined;
      return tb?.text ?? "";
    } catch (e: unknown) {
      const st = (e as { status?: number })?.status;
      if (st === 429 || (st != null && st >= 500 && st < 600) || st == null) { await sleep(1500 * (a + 1)); continue; }
      return null; // 4xx won't fix on retry
    }
  }
  return null;
}
const parseJson = (t: string | null) => { try { return JSON.parse(t || ""); } catch { try { const m = (t || "").match(/\{[\s\S]*\}/); return m ? JSON.parse(m[0]) : null; } catch { return null; } } };

const FIT_SCHEMA = {
  type: "object", additionalProperties: false,
  properties: {
    assignments: {
      type: "array",
      items: {
        type: "object", additionalProperties: false,
        properties: { concept_id: { type: "string" }, confidence: { type: "number" }, evidence: { type: "string" } },
        required: ["concept_id", "confidence", "evidence"],
      },
    },
  },
  required: ["assignments"],
} as const;

// ---- reviews (same source + cleaning as score-and-describe; capped lower for this prompt) -------
const cleanRevs = (arr: string[] | undefined) =>
  [...new Set((arr || []).map((r) => String(r).replace(/\s+/g, " ").trim()).filter((s) => s.length > 15))].slice(0, 12);
const cleanText = (s: unknown) => String(s || "").trim().replace(/^["'\s]+|["'\s]+$/g, "").replace(/\s+/g, " ");
const trim140 = (s: string) => (s.length > 140 ? s.slice(0, 137).trimEnd() + "…" : s);
// Evidence must never leak internal scoring/AI language.
const LEAK = /\b(cosy score|cosiness score|our score|the score|scored|ai\b|algorithm|model|dataset|our data)\b/i;

// ---- concept catalogue shown to the model (slug + one-line traveller-facing description) --------
const CONCEPT_CATALOG = CONCEPTS.map((c) => `- ${c.slug}: ${c.description}`).join("\n");
const KNOWN = new Set(CONCEPTS.map((c) => c.slug));

function fitPrompt(h: HotelInput, revs: string[]): string {
  const facts: string[] = [];
  if (h.signals?.length) facts.push(`Review signals: ${h.signals.join("; ")}`);
  if (h.description) facts.push(`Summary: ${h.description}`);
  if (h.amenities?.length) facts.push(`Listed amenities: ${h.amenities.join(", ")}`);
  if (h.rooms_count != null) facts.push(`Room count: ${h.rooms_count}`);
  return `You classify a hotel into public "Traveller Fit" concepts — the ways a real traveller searches ("quiet hotel", "hotel with a bathtub", "dog-friendly stay"). You are given real guest reviews and factual notes. Assign ONLY the concepts clearly supported by that evidence.

CONCEPTS (use the exact slug on the left):
${CONCEPT_CATALOG}

RULES:
- Assign a concept ONLY when the reviews or amenities clearly support it. Returning zero assignments is a valid, correct answer.
- NEVER invent a physical amenity (pool, sauna, spa, bathtub, rooftop, garden, fireplace, waterfront…). Assign these ONLY if the reviews or amenities actually mention them.
- confidence is 0-1: how strongly the evidence supports the concept.
- evidence is ONE short sentence that paraphrases or cites what guests actually said (or a listed amenity). Never mention scores, ratings, AI, algorithms, data or this task.
- Do not assign the same concept twice.

HOTEL: ${[h.name, h.city, h.country].filter(Boolean).join(", ")}
${facts.join("\n")}
GUEST REVIEWS:
${revs.length ? revs.map((r, i) => `${i + 1}. ${r}`).join("\n") : "(none available)"}

Reply ONLY JSON: {"assignments":[{"concept_id":"<slug>","confidence":<0-1>,"evidence":"<one short grounded sentence>"}]}`;
}

// ---- deterministic evidence string for a rule-backfilled hard concept --------------------------
function ruleEvidence(c: TravellerFitConcept, input: FitMatchInput): string {
  for (const s of input.signals || []) if (c.re.test(s)) return trim140(cleanText(s));
  if (input.description && c.re.test(input.description)) {
    const m = input.description.match(c.re);
    if (m && m.index != null) { const start = Math.max(0, m.index - 40); return trim140(cleanText(input.description.slice(start, start + 140))); }
    return trim140(cleanText(input.description));
  }
  if (c.amenityRe) for (const a of input.amenities || []) if (c.amenityRe.test(a)) return trim140(cleanText(a));
  return trim140(`${c.noun}`);
}

// ---- types -------------------------------------------------------------------------------------
interface HotelInput { id: string; name: string; city: string | null; country: string | null; amenities: string[] | null; rooms_count: number | null; signals: string[] | null; description: string | null; }
interface FitRow { hotel_id: string; concept_id: string; confidence: number; evidence_text: string; source: "llm" | "rule"; }

// ─────────────────────────────────────────────────────────────────────────────
// Wrapped in main(): tsx compiles scripts as CJS (no package "type"), which
// disallows top-level await — same pattern as scripts/reslug-*.ts.
// ─────────────────────────────────────────────────────────────────────────────
type ScoreRow = { hotel_id: string; signals: string[] | null; description: string | null };

async function main() {
// ---- load targets: live hotels + which already have fit rows ------------------------------------
console.log("loading live hotels…");
const scoreRows: ScoreRow[] = []; let off = 0;
for (;;) {
  const { data, error } = await db.from("cosy_scores").select("hotel_id,signals,description").gte("score_final", MIN).range(off, off + 999);
  if (error) { console.error("✗ cosy_scores load:", error.message); process.exit(1); }
  if (!data?.length) break; scoreRows.push(...(data as ScoreRow[])); if (data.length < 1000) break; off += 1000;
}

// hotels that already have fit rows (skip unless --force); also snapshot their prior rows for reversibility.
const existingByHotel = new Map<string, FitRow[]>();
{
  off = 0;
  for (;;) {
    const { data } = await db.from("hotel_traveller_fit").select("hotel_id,concept_id,confidence,evidence_text,source").range(off, off + 999);
    if (!data?.length) break;
    for (const r of data as FitRow[]) { const k = String(r.hotel_id); const a = existingByHotel.get(k) || []; a.push(r); existingByHotel.set(k, a); }
    if (data.length < 1000) break; off += 1000;
  }
}

let target = scoreRows.filter((r) => FORCE || !existingByHotel.has(String(r.hotel_id)));
if (LIMIT) target = target.slice(0, LIMIT);
const ids = target.map((r) => String(r.hotel_id));

// batched metadata hydration
const meta = new Map<string, { name: string; name_en: string | null; city: string | null; country: string | null; amenities: string[] | null; rooms_count: number | null }>();
for (let i = 0; i < ids.length; i += 300) {
  const { data } = await db.from("hotels").select("id,name,name_en,city,country,amenities,rooms_count").in("id", ids.slice(i, i + 300));
  for (const h of data || []) meta.set(String(h.id), h as never);
}
const scoreById = new Map(scoreRows.map((r) => [String(r.hotel_id), r]));
console.log(`${EXECUTE ? "EXECUTE" : "DRY-RUN"} · ${target.length} live hotels (of ${scoreRows.length}) · conc ${CONC} · budget $${BUDGET}\n`);

// ---- run ---------------------------------------------------------------------------------------
let processed = 0, assignedHotels = 0, noEvidence = 0, failed = 0, llmCount = 0, ruleCount = 0, totalAssign = 0, stopped = false;
const sampleOut: { name: string; fits: { c: string; conf: number; src: string; ev: string }[] }[] = [];
const startedAt = Date.now();
const save = (finished = false) => writeFileSync(STATE, JSON.stringify({
  job: "infer-traveller-fit", total: target.length, processed, assignedHotels, noEvidence, failed,
  llmAssignments: llmCount, ruleAssignments: ruleCount, totalAssignments: totalAssign,
  haikuTokens: cost[HAIKU].in + cost[HAIKU].out, estCostUSD: +usd().toFixed(4), budgetUSD: BUDGET,
  perHotelUSD: processed ? +(usd() / processed).toFixed(6) : 0,
  projectedFullUSD: processed ? +((usd() / processed) * scoreRows.length).toFixed(2) : 0,
  startedAt, updatedAt: Date.now(), execute: EXECUTE, finished, stopped,
}, null, 2));
save();

async function writeRows(hotel_id: string, rows: FitRow[]) {
  if (!EXECUTE) return true;
  // reversible backup: snapshot this hotel's PRIOR fit rows (empty array if none) before writing.
  appendFileSync(BACKUP, JSON.stringify({ hotel_id, prior: existingByHotel.get(hotel_id) || [] }) + "\n");
  if (!rows.length) return true;
  const now = new Date().toISOString();
  const payload = rows.map((r) => ({ ...r, updated_at: now }));
  const { error } = await db.from("hotel_traveller_fit").upsert(payload, { onConflict: "hotel_id,concept_id" });
  if (error) { console.log(`  db err ${hotel_id}: ${error.message.slice(0, 70)}`); return false; }
  return true;
}

async function handle(sr: ScoreRow) {
  const id = String(sr.hotel_id);
  const m = meta.get(id); if (!m) { failed++; return; }
  const name = m.name_en || m.name;
  const h: HotelInput = { id, name, city: m.city, country: m.country, amenities: m.amenities, rooms_count: m.rooms_count, signals: sr.signals, description: sr.description };
  const revs = cleanRevs(cache[id]);
  const matchInput: FitMatchInput = { signals: sr.signals, description: sr.description, amenities: m.amenities };

  // Skip hotels with no cached reviews AND no signals: nothing to ground an assignment in.
  if (!revs.length && !(sr.signals?.length)) { noEvidence++; return; }

  let modelAssign: { concept_id: string; confidence: number; evidence: string }[] = [];
  // Only call the model when there are reviews to read (signals-only hotels still get rule backfill).
  if (revs.length) {
    const j = parseJson(await claude(HAIKU, fitPrompt(h, revs), 1200, FIT_SCHEMA));
    if (j && Array.isArray(j.assignments)) modelAssign = j.assignments;
    else if (j == null) { failed++; return; } // hard failure (null after retries)
  }

  // ── code-enforced gates (never trust the model) ──
  const kept = new Map<string, FitRow>();
  for (const a of modelAssign) {
    const slug = String(a?.concept_id || "");
    if (!KNOWN.has(slug)) continue;                         // drop unknown concept_ids
    const c = CONCEPT_BY_SLUG[slug];
    const conf = Math.max(0, Math.min(1, Number(a?.confidence)));
    if (!Number.isFinite(conf)) continue;
    if (!hardEvidenceOk(c, matchInput)) continue;           // HARD: regex must actually match real evidence
    if (c.evidence === "soft" && conf < c.minConfidence) continue; // drop soft below floor
    let ev = cleanText(a?.evidence);
    if (!ev || LEAK.test(ev)) ev = ruleEvidence(c, matchInput); // reject leaky/empty evidence → deterministic fallback
    const prev = kept.get(slug);
    if (!prev || conf > prev.confidence) kept.set(slug, { hotel_id: id, concept_id: slug, confidence: conf, evidence_text: trim140(ev), source: "llm" });
  }

  // ── rule backfill: every HARD concept whose deterministic regex matches but the model missed ──
  for (const c of CONCEPTS) {
    if (c.evidence !== "hard") continue;
    if (kept.has(c.slug)) continue;
    if (!deterministicMatch(c, matchInput)) continue;
    kept.set(c.slug, { hotel_id: id, concept_id: c.slug, confidence: c.minConfidence, evidence_text: ruleEvidence(c, matchInput), source: "rule" });
  }

  // cap at CAP, keep highest confidence (stable)
  const rows = [...kept.values()].sort((a, b) => b.confidence - a.confidence).slice(0, CAP);
  for (const r of rows) { if (r.source === "llm") llmCount++; else ruleCount++; }
  totalAssign += rows.length;
  if (rows.length) assignedHotels++; else noEvidence++;

  const ok = await writeRows(id, rows);
  if (!ok) { failed++; return; }
  if (sampleOut.length < 10) sampleOut.push({ name, fits: rows.map((r) => ({ c: r.concept_id, conf: r.confidence, src: r.source, ev: r.evidence_text })) });
}

// concurrency pool with budget guard + periodic checkpoint
let cursor = 0;
async function worker() {
  while (cursor < target.length) {
    if (usd() >= BUDGET) { stopped = true; return; }
    const sr = target[cursor++];
    await handle(sr);
    processed++;
    if (processed % 5 === 0) save();
    if (processed % 25 === 0) console.log(`  ${processed}/${target.length} · assigned ${assignedHotels} · noEv ${noEvidence} · fail ${failed} · llm ${llmCount} rule ${ruleCount} · $${usd().toFixed(3)}`);
  }
}
await Promise.all(Array.from({ length: CONC }, worker));
save(true);

// ---- dry-run sample + projection ---------------------------------------------------------------
if (!EXECUTE) {
  console.log("\n── sample (first %d hotels) ──", sampleOut.length);
  for (const s of sampleOut) {
    console.log(`\n${s.name}`);
    if (!s.fits.length) console.log("   (no assignments)");
    for (const f of s.fits) console.log(`   • ${f.c.padEnd(16)} ${f.conf.toFixed(2)} [${f.src}]  ${f.ev}`);
  }
}
const perHotel = processed ? usd() / processed : 0;
console.log(`\n${EXECUTE ? "DONE" : "DRY-RUN COMPLETE"}${stopped ? " (BUDGET STOP)" : ""} · processed ${processed} · assigned ${assignedHotels} · noEvidence ${noEvidence} · failed ${failed}`);
console.log(`assignments: ${totalAssign} (llm ${llmCount} · rule ${ruleCount}) · avg ${assignedHotels ? (totalAssign / assignedHotels).toFixed(1) : 0}/assigned-hotel`);
console.log(`cost: $${usd().toFixed(4)} over ${processed} · $${perHotel.toFixed(6)}/hotel · projected full (${scoreRows.length}): $${(perHotel * scoreRows.length).toFixed(2)}`);

// ---- durable audit record ----------------------------------------------------------------------
if (EXECUTE) {
  try {
    await db.from("job_runs").insert({ job: "infer-traveller-fit", status: stopped ? "budget-stop" : "done", finished_at: new Date().toISOString(), details: { total: target.length, processed, assignedHotels, noEvidence, failed, llmAssignments: llmCount, ruleAssignments: ruleCount, totalAssignments: totalAssign, estCostUSD: +usd().toFixed(2) } });
    console.log("job_runs audit record written");
  } catch (e: unknown) { console.log("job_runs write failed:", String((e as Error).message).slice(0, 60)); }
  console.log(`backup: ${BACKUP} (per-hotel prior fit rows; restore = re-insert each line's prior[])`);
}
} // end main

main().catch((e) => { console.error(e); process.exit(1); });
