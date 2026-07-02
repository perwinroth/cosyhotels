// Full-coverage singleton mismatch audit: for every LIVE review-scored hotel that has a resolved
// Google place, compare the place TITLE to the hotel NAME. Low overlap = the reviews likely came
// from the wrong place, even if no collision. Report-only.
import { readFileSync, writeFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE);
const pid = JSON.parse(readFileSync("scripts/backups/review-cache.json", "utf8")); // has reviews?
const places = JSON.parse(readFileSync("scripts/backups/place-id-cache.json", "utf8"));

const norm = (s) => String(s || "").toLowerCase().normalize("NFKD").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
const STOP = new Set(["the","hotel","hostal","bed","and","breakfast","guest","house","guesthouse","inn","pension","b&b","casa","villa","het","der","die","das","les","la","le","el","los"]);
const toks = (s) => new Set(norm(s).split(" ").filter((t) => t.length > 2 && !STOP.has(t)));
const overlap = (a, b) => { const A = toks(a), B = toks(b); if (!A.size || !B.size) return 1; let n = 0; for (const t of A) if (B.has(t)) n++; return n / Math.min(A.size, B.size); };

// live review-scored hotels
const rows = []; let off = 0;
for (;;) { const { data } = await db.from("cosy_scores").select("hotel_id,score").gte("score", 5).eq("notes", "review-scored:v2").range(off, off + 999); if (!data?.length) break; rows.push(...data); if (data.length < 1000) break; off += 1000; }
const ids = rows.map((r) => String(r.hotel_id));
const meta = new Map();
for (let i = 0; i < ids.length; i += 300) { const { data } = await db.from("hotels").select("id,name,name_en,city").in("id", ids.slice(i, i + 300)); for (const h of data || []) meta.set(String(h.id), h); }

let checked = 0, suspect = 0; const sus = [];
for (const id of ids) {
  const h = meta.get(id), p = places[id];
  if (!h || !p?.title) continue; // no resolved place stored -> can't verify offline
  checked++;
  const ov = overlap(h.name_en || h.name, p.title);
  if (ov < 0.34) { suspect++; sus.push({ id, name: h.name_en || h.name, city: h.city, placeTitle: p.title, ov: +ov.toFixed(2) }); }
}
console.log(`live review-scored: ${ids.length} · offline-verifiable (place title stored): ${checked} · SUSPECT (name≁place): ${suspect}`);
sus.slice(0, 15).forEach((s) => console.log(`  ${s.name} (${s.city})  →  place: ${s.placeTitle}`));
writeFileSync(process.env.OUT || "/tmp/singleton-suspects.json", JSON.stringify(sus, null, 2));
console.log("full list written");
