// Re-source a cosy photo for high-scoring hotels left imageless after the cosy re-vet. Reuses the
// app's own resolveHotelImage (hotel website og:image / Wikimedia) + the cosy-aware classifyHotelImage.
//   npx tsx scripts/backfill-images-cosy.mts                  # dry-run, score>=8
//   npx tsx scripts/backfill-images-cosy.mts --execute        # write recovered images
//   flags: --min-score 8  --limit N  --execute
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolveHotelImage } from "@/lib/hotelImageFree";
import { classifyHotelImage } from "@/lib/imageVision";

try { for (const line of readFileSync(".env.local", "utf8").split("\n")) { const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m && process.env[m[1]] == null) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, ""); } } catch {}

const args = process.argv.slice(2);
const EXECUTE = args.includes("--execute");
const flag = (n: string, d: string) => (args.includes(n) ? args[args.indexOf(n) + 1] : d);
const MIN = Number(flag("--min-score", "8"));
const LIMIT = Number(flag("--limit", "0")) || 0;
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const { data: scores } = await db.from("cosy_scores").select("hotel_id,score,score_final").gte("score", MIN).order("score", { ascending: false }).limit(500);
const ids = (scores || []).map((r: any) => String(r.hotel_id));
const withTrue = new Set<string>();
for (let i = 0; i < ids.length; i += 150) { const { data } = await db.from("hotel_images").select("hotel_id").in("hotel_id", ids.slice(i, i + 150)).eq("vision_ok", true); for (const r of data || []) withTrue.add(String((r as any).hotel_id)); }
const need = ids.filter((id: string) => !withTrue.has(id));
const work = LIMIT ? need.slice(0, LIMIT) : need;
const det = new Map<string, any>();
for (let i = 0; i < work.length; i += 150) { const { data } = await db.from("hotels").select("id,name,website,city,country,lat,lng").in("id", work.slice(i, i + 150)); for (const h of data || []) det.set(String((h as any).id), h); }
console.log(`${work.length} imageless hotels score>=${MIN} to backfill · ${EXECUTE ? "EXECUTE" : "DRY-RUN"}\n`);

let recovered = 0, failed = 0, n = 0;
for (const id of work) {
  n++;
  const h = det.get(id); if (!h) { failed++; continue; }
  const exclude: string[] = []; let saved = false;
  for (let a = 0; a < 3 && !saved; a++) {
    let r: any; try { r = await resolveHotelImage({ name: h.name, website: h.website, lat: h.lat, lng: h.lng, city: h.city, exclude }); } catch { break; }
    if (!r || r.source === "placeholder" || !r.url) break;
    exclude.push(r.url);
    let v: any; try { v = await classifyHotelImage(r.url); } catch { continue; }
    if (v.ok) {
      if (EXECUTE) {
        const { data: ex } = await db.from("hotel_images").select("id").eq("hotel_id", id).eq("url", r.url).maybeSingle();
        const row = { vision_ok: true, vision_label: v.label, vision_checked_at: new Date().toISOString(), attributions: r.attribution ?? null };
        if (ex) await db.from("hotel_images").update(row).eq("id", (ex as any).id);
        else await db.from("hotel_images").insert({ hotel_id: id, url: r.url, ...row });
      }
      recovered++; saved = true;
      console.log(`  ✓ ${h.name} [${v.label}] ${String(r.url).slice(0, 66)}`);
    } else {
      console.log(`  ✗ ${h.name} — candidate not cosy (${v.label})`);
    }
  }
  if (!saved) failed++;
  if (n % 10 === 0) console.log(`${n}/${work.length} · recovered ${recovered} · no-cosy-image ${failed}`);
}
console.log(`\ndone — recovered ${recovered}/${work.length} cosy images · ${failed} with no usable cosy image`);
