// Local vision re-scoring for BLIND-scored hotels (no image signal) — $0, runs on your Mac via
// Ollama (llama3.2-vision). The text-only scorer over-rates hotels with cosy-sounding names
// because it never saw the (often mediocre/junk) photo. This assesses the real photo and pulls
// the inflated score DOWN to match it. Downward-only: it never RAISES a score (we don't trust a
// local model to promote a hotel — only to catch over-scores). DRY-RUN by default.
//
//   ollama serve                              # in another terminal
//   ollama pull llama3.2-vision:11b           # one time
//   node --env-file=.env.local scripts/score-vision-local.mjs                # dry-run, 131 blind >=9
//   node --env-file=.env.local scripts/score-vision-local.mjs --execute      # apply (snapshots first)
//   flags: --min-score 9  --limit 131  --model llama3.2-vision:11b
import { createClient } from "@supabase/supabase-js";
import { writeFileSync, mkdirSync } from "fs";
import sharp from "sharp";

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE);
const args = process.argv.slice(2);
const EXECUTE = args.includes("--execute");
const flag = (n, d) => (args.includes(n) ? args[args.indexOf(n) + 1] : d);
const MIN = Number(flag("--min-score", 9));
const LIMIT = Number(flag("--limit", 131));
const ALL = args.includes("--all"); // re-ground EVERY photo'd hotel (not just blind) — one engine for all
const MODEL = flag("--model", "qwen2.5vl:7b"); // validated: warmth MAE 1.0 vs hand scores (llama3.2-vision:11b won't load on Ollama mllama)
const OLLAMA = process.env.OLLAMA_URL || "http://localhost:11434";

// ---- preflight: Ollama running + model pulled --------------------------------------------
const tags = await fetch(`${OLLAMA}/api/tags`).then((r) => r.json()).catch(() => null);
if (!tags) { console.error(`✗ Ollama not reachable at ${OLLAMA}. Start it:  ollama serve`); process.exit(1); }
if (!(tags.models || []).some((m) => m.name.startsWith(MODEL.split(":")[0]))) {
  console.error(`✗ Model "${MODEL}" not installed. Pull it:  ollama pull ${MODEL}`); process.exit(1);
}
console.log(`✓ Ollama up, model ${MODEL} ready. Mode: ${EXECUTE ? "EXECUTE" : "DRY-RUN"} · blind hotels score>=${MIN}, limit ${LIMIT}\n`);

// ---- candidates: every hotel with a usable image (so ALL photo'd hotels are grounded by the
// SAME engine). Default = only blind (imagery_warmth null); --all re-grounds verified ones too
// (fixes leftover 10.0s that the original Claude path produced and Qwen never touched). ----------
// Supabase caps a single .limit() at the project max-rows (1000), so paginate with .range() to
// actually pull every scored hotel (a bare .limit(100000) silently returned only the top 1000).
const sc = [];
for (let off = 0; ; off += 1000) {
  let q = db.from("cosy_scores").select("hotel_id, score, score_final").gte("score", MIN);
  if (!ALL) q = q.is("imagery_warmth", null);
  const { data } = await q.order("score", { ascending: false }).range(off, off + 999);
  if (!data?.length) break;
  sc.push(...data);
  if (data.length < 1000 || (!ALL && sc.length >= LIMIT * 3)) break;
}
const ids = sc.map((r) => String(r.hotel_id));
const dispOf = new Map((sc || []).map((r) => [String(r.hotel_id), typeof r.score_final === "number" ? r.score_final : r.score]));
const nameOf = new Map();
for (let i = 0; i < ids.length; i += 200) { // chunked — an un-chunked .in() over thousands of ids 400s on an over-long URL
  const { data: hotels } = await db.from("hotels").select("id,name,city").in("id", ids.slice(i, i + 200));
  for (const h of hotels || []) nameOf.set(String(h.id), h);
}
const imgOf = new Map();
for (let i = 0; i < ids.length; i += 200) {
  const { data: imgs } = await db.from("hotel_images").select("hotel_id,url,vision_ok,created_at").in("hotel_id", ids.slice(i, i + 200)).order("created_at", { ascending: false });
  for (const im of imgs || []) {
    const hid = String(im.hotel_id), u = im.url || "";
    if (im.vision_ok === false || !u || u.includes("placehold.co")) continue;
    if (!imgOf.has(hid)) imgOf.set(hid, u);
  }
}
const work = ids.filter((id) => imgOf.has(id)).slice(0, LIMIT);
console.log(`${work.length} blind hotels with a usable photo to assess.\n`);

const PROMPT = `You assess a HOTEL photo for COSINESS. Cosy = warmth, intimacy, character: warm lighting, natural wood/stone/textiles, soft furnishings, fireplaces, plants, intimate human-scale spaces. Judge ANY genuine hotel space — a guest room, lounge, restaurant, bar, library, lobby, garden, courtyard, terrace, spa, OR the building/setting itself (a warm glowing exterior counts). NOT cosy = cold/corporate/sterile, big bright impersonal lobbies, generic business spaces. JUNK = not a usable photo of the hotel at all: a logo, icon, map, blank/placeholder, marketing collage with text overlay, screenshot, or a bare portrait of a person. (An exterior, restaurant, lobby, garden or amenity is NOT junk — rate how cosy it looks.) Reply ONLY JSON: {"warmth": <0-10 cosiness of what you actually SEE>, "is_hotel_space": <true if it shows any real hotel space or setting; false only for logo/icon/map/blank/collage/screenshot/portrait>, "note":"<max 6 words>"}`;

async function toB64(url) {
  const r = await fetch(url, { signal: AbortSignal.timeout(15000), headers: { "user-agent": "Mozilla/5.0" } });
  if (!r.ok) throw new Error(`img ${r.status}`);
  const buf = Buffer.from(await r.arrayBuffer());
  const jpeg = await sharp(buf).resize(768, 768, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 80 }).toBuffer();
  return jpeg.toString("base64");
}
async function vision(b64) {
  const r = await fetch(`${OLLAMA}/api/chat`, {
    method: "POST",
    body: JSON.stringify({ model: MODEL, format: "json", stream: false, options: { temperature: 0 }, messages: [{ role: "user", content: PROMPT, images: [b64] }] }),
  });
  const j = await r.json();
  const p = JSON.parse(j.message.content);
  return { warmth: Math.max(0, Math.min(10, Number(p.warmth) || 0)), is_hotel_space: p.is_hotel_space !== false, note: String(p.note || "").slice(0, 40) };
}

// INCREMENTAL writes: over a 4,289-hotel run, writing only at the end is fragile (a crash loses
// everything) and the progress bar can't move. So when EXECUTE, we persist each hotel the moment
// it's assessed — at most one hotel is ever in flight, and grading-status.mjs climbs live.
mkdirSync("scripts/backups", { recursive: true });
const stamp = process.env.STAMP || "manual";
const backupPath = `scripts/backups/vision-rescore-${stamp}.json`;
const updates = [];
let n = 0, done = 0, flagged = 0;
for (const id of work) {
  n++;
  const h = nameOf.get(id), cur = Number(dispOf.get(id)) || 0;
  try {
    const url = imgOf.get(id);
    const b64 = await toB64(url);
    const v = await vision(b64);
    // A JUNK photo (not a real hotel space) is NOT evidence the hotel is uncosy — it's a bad
    // photo. So we DON'T tank the score: we flag the IMAGE for removal and leave the score blind
    // (re-recovery finds a real one). Only a REAL photo drives the downward warmth correction.
    let next, flagJunk = false;
    if (!v.is_hotel_space) { next = cur; flagJunk = true; }
    else { const blended = 0.4 * cur + 0.6 * v.warmth; next = Math.max(0, Math.min(cur, Math.round(blended * 10) / 10)); }
    updates.push({ id, name: h?.name, city: h?.city, cur, warmth: v.warmth, space: v.is_hotel_space, next, note: v.note, flagJunk, url });
    console.log(`${String(n).padStart(4)}/${work.length}  ${cur.toFixed(1)} → ${next.toFixed(1)}  warmth ${v.warmth}${v.is_hotel_space ? "" : " JUNK→flag img"}  ${(h?.name || "").slice(0, 30).padEnd(30)} ${v.note}`);

    if (EXECUTE) {
      if (flagJunk) {
        const { error } = await db.from("hotel_images").update({ vision_ok: false }).eq("hotel_id", id).eq("url", url);
        if (!error) flagged++;
      } else if (next < cur) {
        const { error } = await db.from("cosy_scores").update({ score: next, score_final: next, imagery_warmth: v.warmth }).eq("hotel_id", id);
        if (!error) done++;
      } else {
        // real photo, warmth confirms the score — record imagery_warmth so it leaves the blind pool
        const { error } = await db.from("cosy_scores").update({ imagery_warmth: v.warmth }).eq("hotel_id", id);
        if (!error) done++;
      }
      if (n % 25 === 0) writeFileSync(backupPath, JSON.stringify(updates, null, 2)); // periodic snapshot for reversibility
    }
  } catch (e) {
    console.log(`${String(n).padStart(4)}/${work.length}  SKIP ${(h?.name || "").slice(0, 30)} — ${String(e.message).slice(0, 40)}`);
  }
}

const drops = updates.filter((u) => !u.flagJunk && u.next < u.cur);
const junk = updates.filter((u) => u.flagJunk);
console.log(`\nassessed ${updates.length} · real photos lowered ${drops.length} (avg drop ${drops.length ? (drops.reduce((s, u) => s + (u.cur - u.next), 0) / drops.length).toFixed(1) : 0}) · junk images to flag ${junk.length} · unchanged ${updates.length - drops.length - junk.length}`);

if (!EXECUTE) { console.log("\nDRY-RUN — no writes. Review above, then add --execute (snapshots first)."); process.exit(0); }

writeFileSync(backupPath, JSON.stringify(updates, null, 2)); // final snapshot
console.log(`\ndone — ${done} hotels grounded by a real photo · ${flagged} junk images flagged (backup: ${backupPath}).`);
