// FINAL slug migration: strip the trailing Google Place ID from hotel slugs
// ("italy-venice-hotel-sanders-12537171074" → "italy-venice-hotel-sanders") and 301 the old URL →
// new via hotel_slug_redirects (the hotel page + /go already consult it on a miss).
//
// The Place ID was scrape residue used only for uniqueness; 99.2% of slugs strip to a unique value.
// Collisions (all measured as same-name-different-city) are resolved deterministically:
//   base  →  base-{city}  →  base-{city}-{country}  →  base-{city}-{n}
// Never random, never a timestamp, never the Place ID.
//
// SAFE-MIGRATION rules (same as reslug-clean.ts): dry-run by default, backup BOTH hotels.slug AND
// affected redirect rows, sequential writes (uniqueness holds), reversible from the backup, --limit
// for a pilot. Re-points any existing redirect chain that ended at an old slug (no chains).
//
//   node --env-file=.env.local --import tsx scripts/reslug-strip-placeid.ts                  # DRY-RUN
//   node --env-file=.env.local --import tsx scripts/reslug-strip-placeid.ts --limit 30       # dry-run, 30
//   RESLUG_STAMP=pilot node --env-file=.env.local --import tsx scripts/reslug-strip-placeid.ts --execute --limit 30
//   RESLUG_STAMP=full  node --env-file=.env.local --import tsx scripts/reslug-strip-placeid.ts --execute
import { createClient } from "@supabase/supabase-js";
import { writeFileSync, mkdirSync } from "node:fs";
import slugify from "slugify";
import { displayCity } from "@/lib/placeText";
import { canonicalCountry } from "@/lib/country";

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE;
if (!SB_URL || !SB_KEY) { console.error("✗ need SUPABASE_URL + SERVICE_ROLE key"); process.exit(1); }
const db = createClient(SB_URL, SB_KEY);

const EXECUTE = process.argv.includes("--execute");
const li = process.argv.indexOf("--limit");
const LIMIT = li >= 0 ? parseInt(process.argv[li + 1], 10) : Infinity;
const VALID_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const PLACEID_RE = /-[0-9]{8,}$/; // trailing 8+ digit run = the Google Place ID (name-numbers are shorter/leading)
const PAGE = 1000;

const cleanPart = (s: string | null | undefined) => slugify(String(s || "").trim(), { lower: true, strict: true });

type Row = { id: string; slug: string; city: string | null; country: string | null };

(async () => {
  // 1) Targets: every hotel whose slug ends in a Place ID (all hotels, so old URLs anywhere redirect).
  const targets: Row[] = [];
  for (let from = 0; from < 60000 && targets.length < LIMIT; from += PAGE) {
    const { data, error } = await db.from("hotels").select("id,slug,city,country")
      .order("id", { ascending: true }).range(from, from + PAGE - 1);
    if (error) { console.error("fetch error:", error.message); process.exit(1); }
    if (!data || data.length === 0) break;
    for (const r of data as Row[]) {
      if (PLACEID_RE.test(String(r.slug || ""))) { targets.push(r); if (targets.length >= LIMIT) break; }
    }
    if (data.length < PAGE) break;
  }
  console.log(`${EXECUTE ? "EXECUTE" : "DRY-RUN"} · ${targets.length} place-id slugs to consider\n`);

  // 2) Reserve EVERY existing slug (paginated) so new slugs stay globally unique across the run.
  const reserved = new Set<string>();
  for (let from = 0; ; from += PAGE) {
    const { data } = await db.from("hotels").select("slug").order("id", { ascending: true }).range(from, from + PAGE - 1);
    if (!data || data.length === 0) break;
    for (const r of data as Array<{ slug: string | null }>) if (r.slug) reserved.add(String(r.slug).toLowerCase());
    if (data.length < PAGE) break;
  }
  console.log(`reserved ${reserved.size} existing slugs for uniqueness`);

  // 3) Compute new slugs with the deterministic collision ladder.
  const changes: Array<{ id: string; old_slug: string; new_slug: string }> = [];
  const skipped: Array<{ id: string; old_slug: string; would_be: string }> = [];
  let collided = 0;
  for (const r of targets) {
    const current = String(r.slug).toLowerCase();
    const base = current.replace(PLACEID_RE, "");
    if (!VALID_SLUG.test(base) || base === current) { skipped.push({ id: String(r.id), old_slug: current, would_be: base }); continue; }
    let next = base;
    if (reserved.has(next)) {
      collided++;
      const city = cleanPart(displayCity(r.city, ""));
      const cc = canonicalCountry(r.country);
      const country = cc ? cc.slug : cleanPart(r.country);
      const candidates = [
        city ? `${base}-${city}` : "",
        city && country ? `${base}-${city}-${country}` : (country ? `${base}-${country}` : ""),
      ].filter(Boolean);
      next = "";
      for (const c of candidates) { if (VALID_SLUG.test(c) && !reserved.has(c)) { next = c; break; } }
      if (!next) { // deterministic numeric fallback
        const stem = city ? `${base}-${city}` : base;
        for (let n = 2; n < 1000; n++) { const c = `${stem}-${n}`; if (!reserved.has(c)) { next = c; break; } }
      }
    }
    if (!next || !VALID_SLUG.test(next) || next === current) { skipped.push({ id: String(r.id), old_slug: current, would_be: next }); continue; }
    reserved.add(next);
    changes.push({ id: String(r.id), old_slug: current, new_slug: next });
  }
  console.log(`${changes.length} slugs will change (${collided} needed a collision suffix)${skipped.length ? `, ${skipped.length} skipped` : ""}. Sample:`);
  for (const c of changes.slice(0, 20)) console.log(`  ${c.old_slug}\n    → ${c.new_slug}`);
  for (const s of skipped.slice(0, 10)) console.log(`  SKIP ${s.old_slug} → "${s.would_be}"`);
  console.log(`\ncollision suffixes used on ${collided} of ${changes.length} (${((collided / Math.max(changes.length, 1)) * 100).toFixed(1)}%)`);

  if (!EXECUTE) { console.log(`\nDRY-RUN — no writes. Re-run with --execute to apply.`); return; }
  if (!changes.length) { console.log("\nnothing to change."); return; }

  // 4) Snapshot affected redirect rows too, so a rollback restores BOTH tables.
  const touched = new Set<string>(changes.flatMap((c) => [c.old_slug, c.new_slug]));
  const redirPre: Array<{ old_slug: string; new_slug: string; hotel_id: string | null }> = [];
  const touchedArr = [...touched];
  for (let i = 0; i < touchedArr.length; i += 150) {
    const chunk = touchedArr.slice(i, i + 150);
    const { data: a } = await db.from("hotel_slug_redirects").select("old_slug,new_slug,hotel_id").in("old_slug", chunk);
    const { data: b } = await db.from("hotel_slug_redirects").select("old_slug,new_slug,hotel_id").in("new_slug", chunk);
    for (const r of [...(a || []), ...(b || [])] as typeof redirPre) redirPre.push(r);
  }
  mkdirSync("scripts/backups", { recursive: true });
  const stamp = process.env.RESLUG_STAMP || "run";
  const backup = `scripts/backups/reslug-strip-placeid-${stamp}.json`;
  writeFileSync(backup, JSON.stringify({ changes, redirect_preimage: redirPre, skipped }, null, 0));
  console.log(`\nbacked up ${changes.length} slug changes + ${redirPre.length} redirect pre-images → ${backup}\napplying…`);

  // 5) Apply: update slug, upsert old→new 301, re-point any chain ending at old_slug.
  let done = 0;
  for (const c of changes) {
    const { error: upErr } = await db.from("hotels").update({ slug: c.new_slug, updated_at: new Date().toISOString() }).eq("id", c.id).eq("slug", c.old_slug);
    if (upErr) { console.error(`  ✗ ${c.old_slug}: ${upErr.message}`); continue; }
    await db.from("hotel_slug_redirects").upsert({ old_slug: c.old_slug, new_slug: c.new_slug, hotel_id: c.id }, { onConflict: "old_slug" });
    await db.from("hotel_slug_redirects").update({ new_slug: c.new_slug }).eq("new_slug", c.old_slug);
    done++;
    if (done % 200 === 0) console.log(`  …${done}/${changes.length}`);
  }
  console.log(`\n✓ re-slugged ${done}/${changes.length}. Old URLs 301 → new via hotel_slug_redirects. Backup: ${backup}`);
  console.log(`Sitemap is DB-driven — redeploy to refresh its ISR cache, then regenerate blogPicks.json + run scripts/seo-audit.mjs.`);
})();
