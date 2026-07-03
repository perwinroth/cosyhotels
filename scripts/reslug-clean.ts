// Re-slug hotels whose slug carries a leaked postcode ("75005-paris-…", "110-00-praha-…") to a clean
// slug from the CLEANED city + name, and 301 the old URL → new via hotel_slug_redirects (which the
// hotel page already consults on a miss). SAFE-MIGRATION rules: dry-run by default, backup (both
// hotels.slug AND the affected redirect rows) before any write, sequential (so uniqueness holds),
// reversible from the backup, --limit for a pilot.
//
//   node --env-file=.env.local --import tsx scripts/reslug-clean.ts                 # DRY-RUN (no writes)
//   node --env-file=.env.local --import tsx scripts/reslug-clean.ts --limit 50      # dry-run, 50 rows
//   node --env-file=.env.local --import tsx scripts/reslug-clean.ts --execute --limit 50   # pilot write
//   node --env-file=.env.local --import tsx scripts/reslug-clean.ts --execute       # full run
import { createClient } from "@supabase/supabase-js";
import { writeFileSync, mkdirSync } from "node:fs";
import { generateHotelSlug } from "@/lib/slug";

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE;
if (!SB_URL || !SB_KEY) { console.error("✗ need SUPABASE_URL + SERVICE_ROLE key"); process.exit(1); }
const db = createClient(SB_URL, SB_KEY);

const EXECUTE = process.argv.includes("--execute");
const li = process.argv.indexOf("--limit");
const LIMIT = li >= 0 ? parseInt(process.argv[li + 1], 10) : Infinity;
const VALID_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/; // no leading/trailing/double dashes, lowercase alnum

type Row = { id: string; slug: string; name: string; city: string | null; country: string | null };
const PAGE = 1000;

(async () => {
  // Target slugs led by a POSTCODE = 3+ leading digits ("30123-venezia-…", "118-00-praha-…"). This
  // deliberately excludes name-numbers ("5-vintage", "25hours-…") so we don't churn legitimate slugs.
  // Filter in JS (a server-side `LIKE '[0-9]%'` does NOT work — LIKE has no char classes) while
  // paginating the FULL table.
  const isPostcodeLed = (slug: string) => /^\d{3}/.test(slug);
  const targets: Row[] = [];
  for (let from = 0; from < 60000 && targets.length < LIMIT; from += PAGE) {
    const { data, error } = await db.from("hotels").select("id,slug,name,city,country")
      .order("id", { ascending: true }).range(from, from + PAGE - 1);
    if (error) { console.error("fetch error:", error.message); process.exit(1); }
    if (!data || data.length === 0) break;
    for (const r of data as Row[]) {
      if (isPostcodeLed(String(r.slug || ""))) { targets.push(r); if (targets.length >= LIMIT) break; }
    }
    if (data.length < PAGE) break;
  }
  console.log(`${EXECUTE ? "EXECUTE" : "DRY-RUN"} · ${targets.length} postcode-led slugs to consider\n`);

  // Reserve EVERY existing slug (paginated — an unpaginated select silently caps at 1000) so new
  // slugs stay globally unique across the whole run.
  const reserved = new Set<string>();
  for (let from = 0; ; from += PAGE) {
    const { data } = await db.from("hotels").select("slug").order("id", { ascending: true }).range(from, from + PAGE - 1);
    if (!data || data.length === 0) break;
    for (const r of data as Array<{ slug: string | null }>) if (r.slug) reserved.add(String(r.slug).toLowerCase());
    if (data.length < PAGE) break;
  }
  console.log(`reserved ${reserved.size} existing slugs for uniqueness`);

  const changes: Array<{ id: string; old_slug: string; new_slug: string }> = [];
  const skipped: Array<{ id: string; old_slug: string; would_be: string }> = [];
  for (const r of targets) {
    const current = String(r.slug).toLowerCase();
    const next = await generateHotelSlug(db, r.name, r.city, r.country, { reserved, exclude: current });
    if (!next || next === current) continue;
    if (!VALID_SLUG.test(next)) { skipped.push({ id: String(r.id), old_slug: current, would_be: next }); continue; } // never write a degenerate slug
    reserved.add(next);
    changes.push({ id: String(r.id), old_slug: current, new_slug: next });
  }
  console.log(`${changes.length} slugs will change${skipped.length ? `, ${skipped.length} skipped (degenerate — logged)` : ""}. Sample:`);
  for (const c of changes.slice(0, 25)) console.log(`  ${c.old_slug}\n    → ${c.new_slug}`);
  for (const s of skipped.slice(0, 10)) console.log(`  SKIP ${s.old_slug} → "${s.would_be}"`);

  if (!EXECUTE) { console.log(`\nDRY-RUN — no writes. Re-run with --execute to apply.`); return; }
  if (!changes.length) { console.log("\nnothing to change."); return; }

  // Snapshot the affected redirect rows too (so a rollback restores BOTH tables). Any redirect whose
  // old_slug or new_slug touches a slug we're about to change could be created/overwritten below.
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
  const backup = `scripts/backups/reslug-clean-${stamp}.json`;
  writeFileSync(backup, JSON.stringify({ changes, redirect_preimage: redirPre, skipped }, null, 0));
  console.log(`\nbacked up ${changes.length} slug changes + ${redirPre.length} redirect pre-images → ${backup}\napplying…`);

  let done = 0;
  for (const c of changes) {
    const { error: upErr } = await db.from("hotels").update({ slug: c.new_slug, updated_at: new Date().toISOString() }).eq("id", c.id);
    if (upErr) { console.error(`  ✗ ${c.old_slug}: ${upErr.message}`); continue; }
    // 301 map: old → new. Also re-point any existing redirect chain that ended at old_slug.
    await db.from("hotel_slug_redirects").upsert({ old_slug: c.old_slug, new_slug: c.new_slug, hotel_id: c.id }, { onConflict: "old_slug" });
    await db.from("hotel_slug_redirects").update({ new_slug: c.new_slug }).eq("new_slug", c.old_slug);
    done++;
    if (done % 100 === 0) console.log(`  …${done}/${changes.length}`);
  }
  console.log(`\n✓ re-slugged ${done}/${changes.length}. Old URLs 301 → new via hotel_slug_redirects. Backup: ${backup}`);
})();
