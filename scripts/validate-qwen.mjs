// Validate the FREE local vision model (qwen2.5vl:7b) against the 74 hotels I hand-scored
// in-session (the golden reference). For each, compare Qwen's image read to my verdict:
//   - junk detection: did Qwen say is_hotel_space=false on the ones I flagged junk, and
//     is_hotel_space=true on the real photos? (this is the Haiku-replacement job)
//   - warmth: for real-space photos, does Qwen's warmth track the warmth I assigned?
// If it tracks, Qwen can be the autonomous vision stage — free, unattended. Read-only.
//   node --env-file=.env.local scripts/validate-qwen.mjs [--model qwen2.5vl:7b]
import { createClient } from "@supabase/supabase-js";
import { readFileSync, readdirSync } from "fs";
import sharp from "sharp";

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE);
const args = process.argv.slice(2);
const MODEL = args.includes("--model") ? args[args.indexOf("--model") + 1] : "qwen2.5vl:7b";
const OLLAMA = process.env.OLLAMA_URL || "http://localhost:11434";

// preflight
const tags = await fetch(`${OLLAMA}/api/tags`).then((r) => r.json()).catch(() => null);
if (!tags || !(tags.models || []).some((m) => m.name === MODEL || m.name.startsWith(MODEL.split(":")[0]))) {
  console.error(`✗ ${MODEL} not available on Ollama. Pull it / start ollama serve.`); process.exit(1);
}

// 1) my verdicts from the apply-here backups
const dir = "scripts/backups";
const mine = new Map();
for (const f of readdirSync(dir).filter((f) => f.startsWith("here-scores-") && f.endsWith(".json"))) {
  const j = JSON.parse(readFileSync(`${dir}/${f}`, "utf8"));
  for (const r of j.results || []) mine.set(String(r.hotel_id), { name: r.name, warmth: r.warmth, junk: !!r.junk_url, junk_url: r.junk_url, next: r.next });
}
const ids = [...mine.keys()];
console.log(`Validating ${MODEL} against ${ids.length} hand-scored hotels\n`);

// 2) image per hotel: the junk_url I judged for junk ones; most-recent stored image otherwise
const urlOf = new Map();
for (let i = 0; i < ids.length; i += 200) {
  const { data } = await db.from("hotel_images").select("hotel_id,url,created_at").in("hotel_id", ids.slice(i, i + 200)).order("created_at", { ascending: false });
  for (const im of data || []) { const k = String(im.hotel_id); if (!urlOf.has(k)) urlOf.set(k, im.url); }
}
for (const [id, v] of mine) if (v.junk && v.junk_url) urlOf.set(id, v.junk_url);

const PROMPT = `You assess a HOTEL photo for COSINESS. Cosy = warmth, intimacy, character: warm lighting, natural wood/stone/textiles, soft furnishings, fireplaces, plants, intimate human-scale spaces. Judge ANY genuine hotel space — a guest room, lounge, restaurant, bar, library, lobby, garden, courtyard, terrace, spa, OR the building/setting itself (a warm glowing exterior counts). NOT cosy = cold/corporate/sterile, big bright impersonal lobbies, generic business spaces. JUNK = not a usable photo of the hotel at all: a logo, icon, map, blank/placeholder, marketing collage with text overlay, screenshot, or a bare portrait of a person. (An exterior, restaurant, lobby, garden or amenity is NOT junk — rate how cosy it looks.) Reply ONLY JSON: {"warmth": <0-10>, "is_hotel_space": <true if any real hotel space/setting; false only for logo/icon/map/blank/collage/screenshot/portrait>, "note":"<max 6 words>"}`;

async function toB64(url) {
  const r = await fetch(url, { signal: AbortSignal.timeout(15000), headers: { "user-agent": "Mozilla/5.0" } });
  if (!r.ok) throw new Error(`img ${r.status}`);
  const jpeg = await sharp(Buffer.from(await r.arrayBuffer())).resize(768, 768, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 80 }).toBuffer();
  return jpeg.toString("base64");
}
async function vision(b64) {
  const r = await fetch(`${OLLAMA}/api/chat`, { method: "POST", body: JSON.stringify({ model: MODEL, format: "json", stream: false, options: { temperature: 0 }, messages: [{ role: "user", content: PROMPT, images: [b64] }] }) });
  const p = JSON.parse((await r.json()).message.content);
  return { warmth: Math.max(0, Math.min(10, Number(p.warmth) || 0)), is_hotel_space: p.is_hotel_space !== false, note: String(p.note || "").slice(0, 30) };
}

// 3) run + compare
let n = 0;
const rows = [];
for (const id of ids) {
  n++;
  const m = mine.get(id), url = urlOf.get(id);
  if (!url) { console.log(`${String(n).padStart(2)} SKIP (no url) ${m.name?.slice(0,28)}`); continue; }
  try {
    const q = await vision(await toB64(url));
    rows.push({ name: m.name, my_junk: m.junk, my_warmth: m.warmth, q_space: q.is_hotel_space, q_warmth: q.warmth, q_note: q.note });
    const agree = m.junk ? (q.is_hotel_space ? "✗ MISS" : "✓ junk") : (q.is_hotel_space ? "✓ real" : "✗ FALSE-JUNK");
    const wcol = m.warmth != null ? `me ${m.warmth} / qwen ${q.warmth}` : "(junk)";
    console.log(`${String(n).padStart(2)} ${agree.padEnd(13)} ${wcol.padEnd(18)} ${(m.name||"").slice(0,30).padEnd(30)} ${q.note}`);
  } catch (e) { console.log(`${String(n).padStart(2)} ERR ${(m.name||"").slice(0,28)} — ${String(e.message).slice(0,30)}`); }
}

// 4) scorecard
const junkRows = rows.filter((r) => r.my_junk);
const realRows = rows.filter((r) => !r.my_junk);
const junkCaught = junkRows.filter((r) => !r.q_space).length;          // Qwen agreed it's junk
const realKept = realRows.filter((r) => r.q_space).length;            // Qwen agreed it's real
const warmthPairs = realRows.filter((r) => r.my_warmth != null);
const mae = warmthPairs.length ? warmthPairs.reduce((s, r) => s + Math.abs(r.my_warmth - r.q_warmth), 0) / warmthPairs.length : null;
console.log(`\n── SCORECARD ─────────────────────────────`);
console.log(`junk detection (recall):   ${junkCaught}/${junkRows.length} of my junk flags caught by Qwen`);
console.log(`real-photo specificity:    ${realKept}/${realRows.length} of my real photos kept by Qwen`);
console.log(`warmth MAE (real photos):  ${mae == null ? "n/a" : mae.toFixed(2)} points (0-10 scale), n=${warmthPairs.length}`);
console.log(`verdict: ${junkRows.length && junkCaught/junkRows.length >= 0.8 && mae != null && mae <= 1.5 ? "✓ Qwen-7B tracks — usable as the free vision stage" : "✗ gaps — review before trusting it unattended"}`);
