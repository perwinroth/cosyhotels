// Standalone Claude Haiku vision-QA sweep over stored hotel images — the same classifier as
// src/lib/imageVision.ts + src/app/api/cron/vision-qa/route.ts, run directly (no cron secret).
// It answers, per image: "is this a pin-worthy real hotel photo, or junk?" and writes the verdict
// to hotel_images.vision_* — so a hotel page / carousel never shows a logo, badge, person, or
// marketing collage (e.g. the Hermitage "Sparkling Friday" champagne shot).
//
// SAFETY: DRY-RUN by default (no writes). --execute writes, after snapshotting every in-scope row's
// current vision_* to scripts/backups/ for reversibility. Resumable + idempotent: it only touches
// rows with vision_checked_at IS NULL and stamps each as it goes, so reruns advance and never
// re-spend on a row already judged. Incremental per-image writes — a crash loses at most one row.
// NO replacement re-resolve (the route's replace path is intentionally omitted here to keep cost
// predictable; recovering a fresh photo for a junked hotel is a separate, later step).
//
//   node --env-file=.env.local scripts/vision-qa-haiku.mjs                       # dry-run, scope=all
//   node --env-file=.env.local scripts/vision-qa-haiku.mjs --scope null          # only never-verdicted
//   node --env-file=.env.local scripts/vision-qa-haiku.mjs --limit 50 --execute  # 50-image sample
//   node --env-file=.env.local scripts/vision-qa-haiku.mjs --execute             # full run
//   flags: --scope all|null|qwen   --limit N   --execute   --model claude-haiku-4-5
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";
import { writeFileSync, mkdirSync } from "fs";

const args = process.argv.slice(2);
const EXECUTE = args.includes("--execute");
const flag = (n, d) => (args.includes(n) ? args[args.indexOf(n) + 1] : d);
const SCOPE = flag("--scope", "all"); // all = every vision_checked_at IS NULL; null = only vision_ok null; qwen = only vision_ok false (Qwen junk, re-grade under Claude)
const LIMIT = Number(flag("--limit", 0)) || 0; // 0 = no cap
const MODEL = flag("--model", process.env.IMAGE_QA_MODEL || "claude-haiku-4-5");
const COST_PER_CALL = 0.0017;
const CONC = 8;
const BASE = process.env.NEXT_PUBLIC_SITE_URL || "https://gotcosy.com";
const PROGRESS = "scripts/backups/vision-haiku-progress.json"; // read by scripts/vision-qa-monitor.mjs
const hostOf = (u) => { try { return new URL(u.replace(/&amp;/g, "&")).host; } catch { return u.slice(0, 40); } };

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE);

// ---- restore: revert a run from its backup snapshot --------------------------------------------
//   node --env-file=.env.local scripts/vision-qa-haiku.mjs --restore scripts/backups/vision-haiku-<ts>-all.json
const restorePath = flag("--restore", "");
if (restorePath) {
  const { readFileSync } = await import("fs");
  const snap = JSON.parse(readFileSync(restorePath, "utf8"));
  console.log(`restoring ${snap.length} rows from ${restorePath} …`);
  let ok = 0;
  for (const r of snap) {
    const { error } = await db.from("hotel_images").update({ vision_ok: r.vision_ok, vision_label: r.vision_label, vision_checked_at: r.vision_checked_at }).eq("id", r.id);
    if (!error) ok++;
  }
  console.log(`restored ${ok}/${snap.length} rows to their pre-run vision_* state.`);
  process.exit(0);
}

const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) { console.error("✗ ANTHROPIC_API_KEY not set"); process.exit(1); }
const anthropic = new Anthropic({ apiKey });

// ---- classifier: byte-for-byte the policy of src/lib/imageVision.ts -------------------------------
const GOOD = new Set(["room", "interior", "exterior", "amenity", "view"]);
const SYSTEM = `You classify ONE hotel photo for "Got Cosy", a site that ranks hotels by cosiness. The photo is shown and SHARED as the face of the hotel. Keep genuine, attractive photos of the hotel; reject only images that are clearly NOT cosy or not appealing as a hotel's face.

pin_worthy = true: a normal, pleasant, real photo of the hotel — a guest room, a warm or characterful interior (lounge, bar, restaurant, library, spa), the building/facade/garden/terrace/courtyard/pool, an inviting amenity, or a nice view. It need NOT be maximally cosy — a clean, pleasant room or an attractive exterior counts.

pin_worthy = false ONLY for clearly cold, corporate, utilitarian or non-hotel images:
- conference & meeting rooms, banquet / event / function / wedding halls, big empty corporate lobbies, sterile convention-style spaces
- a bathroom on its own, corridors, lifts, stairwells, gyms, car parks, reception desks, a totally bare/utilitarian room
- detail crops (a single pillow/tap), public landmarks/streets that are NOT the hotel, logos, review badges, maps/floorplans, food close-ups, people/portraits, placeholders, text/ads, screenshots, marketing collages, anything not the hotel

Default to KEEP for a normal, pleasant photo of the hotel. Use the closest label even when rejecting (a banquet hall = "interior" with pin_worthy=false).

Reply ONLY with JSON: {"label": "<single best category>", "pin_worthy": <true unless it matches a reject case above>}.`;
const SCHEMA = { type: "object", additionalProperties: false, properties: {
  label: { type: "string", enum: ["room", "interior", "exterior", "amenity", "view", "detail", "landmark", "logo", "badge", "map", "food", "person", "placeholder", "text", "unrelated", "unloadable"] },
  pin_worthy: { type: "boolean" },
}, required: ["label", "pin_worthy"] };
const toAbs = (u) => { const d = u.replace(/&amp;/g, "&"); return d.startsWith("/") ? BASE + d : d; };

async function classify(url) {
  if (!/^https?:\/\//i.test(url)) return { ok: false, label: "unloadable" };
  const resp = await anthropic.messages.create({
    model: MODEL, max_tokens: 256, temperature: 0, thinking: { type: "disabled" },
    system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
    output_config: { format: { type: "json_schema", schema: SCHEMA } },
    messages: [{ role: "user", content: [{ type: "image", source: { type: "url", url } }] }],
  });
  if (resp.stop_reason === "refusal") return { ok: false, label: "unloadable" };
  const tb = resp.content.find((b) => b.type === "text");
  if (!tb) return { ok: false, label: "unloadable" };
  const p = JSON.parse(tb.text);
  const label = String(p.label || "unloadable");
  return { ok: p.pin_worthy === true && GOOD.has(label), label };
}

// ---- gather scope --------------------------------------------------------------------------------
function scoped(q) {
  q = q.is("vision_checked_at", null).not("url", "like", "%placehold.co%");
  if (SCOPE === "null") q = q.is("vision_ok", null);
  else if (SCOPE === "qwen") q = q.eq("vision_ok", false);
  return q;
}
const rows = [];
for (let off = 0; ; off += 1000) {
  const { data, error } = await scoped(db.from("hotel_images").select("id,hotel_id,url,vision_ok,vision_label,vision_checked_at")).order("id", { ascending: true }).range(off, off + 999);
  if (error) { console.error("✗ query:", error.message); process.exit(1); }
  if (!data?.length) break;
  rows.push(...data);
  if (data.length < 1000) break;
  if (LIMIT && rows.length >= LIMIT) break;
}
const work = LIMIT ? rows.slice(0, LIMIT) : rows;
console.log(`scope=${SCOPE} · ${work.length} images to classify · model ${MODEL} · est ≤ $${(work.length * COST_PER_CALL).toFixed(2)} · mode ${EXECUTE ? "EXECUTE" : "DRY-RUN"}\n`);

mkdirSync("scripts/backups", { recursive: true });
const recent = []; // rolling feed of last verdicts for the monitor
let kept = 0, rejected = 0, transient = 0, calls = 0, n = 0;
const startedAt = Date.now();
function writeProgress(extra = {}) {
  try {
    writeFileSync(PROGRESS, JSON.stringify({
      mode: EXECUTE ? "execute" : "dry", scope: SCOPE, model: MODEL,
      total: work.length, done: n, kept, rejected, transient, calls,
      estCostUsd: +(work.length * COST_PER_CALL).toFixed(2), spentUsd: +(calls * COST_PER_CALL).toFixed(2),
      startedAt, updatedAt: Date.now(), recent: recent.slice(-16).reverse(), ...extra,
    }, null, 2));
  } catch {}
}

if (!work.length) { writeProgress({ finished: true }); console.log("nothing to do."); process.exit(0); }

if (!EXECUTE) {
  // Seed the monitor with the dry-run scope so the page shows what WOULD run (no writes, no spend).
  for (const r of work.slice(0, 16)) recent.push({ host: hostOf(r.url), prior: r.vision_ok, label: null, ok: null });
  writeProgress({ finished: true });
  console.log("DRY-RUN — no writes, no spend. Sample of what WOULD be classified:");
  for (const r of work.slice(0, 12)) console.log(`  [${r.vision_ok === null ? "null" : r.vision_ok}] ${r.url.slice(0, 110)}`);
  console.log(`\nProgress page seeded → ${PROGRESS}. Re-run with --execute to classify & write (snapshots first). Total ${work.length}.`);
  process.exit(0);
}

// ---- execute: snapshot, then classify + write incrementally --------------------------------------
const stampFile = process.env.STAMP || new Date().toISOString().replace(/[:.]/g, "-"); // unique per run — never clobber a prior backup
const backupPath = `scripts/backups/vision-haiku-${stampFile}-${SCOPE}.json`;
writeFileSync(backupPath, JSON.stringify(work.map((r) => ({ id: r.id, vision_ok: r.vision_ok, vision_label: r.vision_label, vision_checked_at: r.vision_checked_at })), null, 2));
console.log(`backup of ${work.length} rows → ${backupPath}\n`);
writeProgress();

const stamp = new Date().toISOString();
function note(img, ok, label) { recent.push({ host: hostOf(img.url), prior: img.vision_ok, ok, label }); }
for (let i = 0; i < work.length; i += CONC) {
  await Promise.all(work.slice(i, i + CONC).map(async (img) => {
    n++;
    const abs = toAbs(img.url);
    try {
      if (!/^https:\/\//i.test(abs)) { // Anthropic only fetches HTTPS
        await db.from("hotel_images").update({ vision_ok: false, vision_label: "unfetchable", vision_checked_at: stamp }).eq("id", img.id);
        rejected++; note(img, false, "unfetchable"); return;
      }
      const v = await classify(abs); calls++;
      await db.from("hotel_images").update({ vision_ok: v.ok, vision_label: v.label, vision_checked_at: stamp }).eq("id", img.id);
      if (v.ok) kept++; else rejected++;
      note(img, v.ok, v.label);
      if (n % 50 === 0) console.log(`${String(n).padStart(5)}/${work.length}  kept ${kept} · rejected ${rejected} · ~$${(calls * COST_PER_CALL).toFixed(2)}`);
    } catch (err) {
      const status = err?.status;
      if (status === 400 || status === 404 || status === 403) { // ~terminal: Anthropic can't load it
        await db.from("hotel_images").update({ vision_ok: false, vision_label: "unfetchable", vision_checked_at: stamp }).eq("id", img.id);
        rejected++; note(img, false, "unfetchable");
      } else { transient++; } // leave null so a later run retries
    }
  }));
  writeProgress();
}
writeProgress({ finished: true });
console.log(`\ndone — ${kept} kept (vision_ok=true) · ${rejected} rejected · ${transient} transient (left null for retry) · ${calls} Claude calls · ~$${(calls * COST_PER_CALL).toFixed(2)} (backup: ${backupPath}).`);
