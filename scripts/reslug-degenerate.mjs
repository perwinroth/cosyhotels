// Reslug the 5 residual postcode-led / degenerate hotel slugs that the bulk reslug (reslug-clean.ts)
// skipped because their `name` is non-Latin or their `city` is junk (a postcode / "Japan" / a street).
// Each has a clean English `name_en`, so we assign a clean slug from name_en + a country prefix, and
// 301 the old URL → new via hotel_slug_redirects (the hotel page already consults it on a miss).
//
// SAFE-MIGRATION rules (same as reslug-clean.ts): dry-run by default, backup BEFORE any write,
// verify each old slug is still current + owned by the expected id, verify the new slug is free,
// reversible from the backup.
//
//   node --env-file=.env.local scripts/reslug-degenerate.mjs            # DRY-RUN (no writes)
//   node --env-file=.env.local scripts/reslug-degenerate.mjs --execute  # write
//
// NOTE: 602-8381- and 602-8381--2 are the SAME hotel (identical name_en, lat/lng, score) — a genuine
// DUPLICATE that escaped the geo-dedup. This script only cleans their slugs; it does NOT merge them.
// The duplicate (…-oku-2) is flagged below for the geo-dedup pipeline to resolve properly.
import { createClient } from "@supabase/supabase-js";
import { writeFileSync, mkdirSync } from "node:fs";

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE;
if (!SB_URL || !SB_KEY) { console.error("✗ need SUPABASE_URL + SERVICE_ROLE key"); process.exit(1); }
const db = createClient(SB_URL, SB_KEY);
const EXECUTE = process.argv.includes("--execute");
const VALID_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// Predetermined mapping (id pins the row so we can never touch the wrong hotel).
const TARGETS = [
  { id: "6de42282-f8aa-44fb-b1be-d631a4060049", old: "3300-hungary-1552-boutique-hotel", new: "hungary-1552-boutique-hotel" },
  { id: "49cc1727-83d9-43c2-98e0-34d66e5040a9", old: "601-8044-japan-hotel-anteroom-kyoto", new: "japan-hotel-anteroom-kyoto" },
  { id: "3dca3049-c5ef-41d6-9846-6ad233d913fb", old: "602-8381-", new: "japan-kamishichiken-oku" },
  { id: "6ce270cf-09c8-4bfc-b3f2-282ed22da798", old: "602-8381--2", new: "japan-kamishichiken-oku-2", dupe: true },
  { id: "0cab7243-693b-43c5-b049-1bf46e3967fc", old: "606-8397-japan-ryokan-sawaya-honten", new: "japan-ryokan-sawaya-honten" },
];

(async () => {
  console.log(`${EXECUTE ? "EXECUTE" : "DRY-RUN"} · reslug ${TARGETS.length} degenerate slugs\n`);

  // 1) Validate every target against live data BEFORE any write.
  const plan = [];
  for (const t of TARGETS) {
    if (!VALID_SLUG.test(t.new)) { console.error(`✗ ${t.old}: computed slug "${t.new}" is not a valid slug — abort`); process.exit(1); }
    const { data: row } = await db.from("hotels").select("id, slug, name, name_en").eq("id", t.id).maybeSingle();
    if (!row) { console.error(`✗ ${t.old}: id ${t.id} not found — abort`); process.exit(1); }
    if (row.slug !== t.old) { console.error(`✗ ${t.id}: current slug is "${row.slug}", expected "${t.old}" — data changed since planning, abort`); process.exit(1); }
    const { data: taken } = await db.from("hotels").select("id").eq("slug", t.new).maybeSingle();
    if (taken && taken.id !== t.id) { console.error(`✗ new slug "${t.new}" already owned by ${taken.id} — abort`); process.exit(1); }
    plan.push({ ...t, name_en: row.name_en });
    console.log(`  ${t.old}  →  ${t.new}   (${row.name_en})${t.dupe ? "   ⚠ DUPLICATE — flag for dedup" : ""}`);
  }

  // 2) Backup current slugs + any existing redirect rows for these old slugs (reversibility).
  mkdirSync("scripts/backups", { recursive: true });
  const { data: existingRedirects } = await db.from("hotel_slug_redirects").select("old_slug,new_slug").in("old_slug", TARGETS.map((t) => t.old));
  const backup = { at: "reslug-degenerate", hotels: plan.map((p) => ({ id: p.id, old_slug: p.old, new_slug: p.new })), existingRedirects: existingRedirects || [] };
  const backupPath = "scripts/backups/reslug-degenerate.json";
  writeFileSync(backupPath, JSON.stringify(backup, null, 2));
  console.log(`\nbackup written → ${backupPath} (reverse: restore hotels.slug from old_slug)`);

  if (!EXECUTE) { console.log(`\nDRY-RUN complete — re-run with --execute to write.`); return; }

  // 3) Write: update slug, then insert old→new 301 redirect. Sequential so uniqueness holds.
  let slugsDone = 0, redirectsDone = 0, redirectsFailed = 0;
  for (const p of plan) {
    const { error: uErr } = await db.from("hotels").update({ slug: p.new }).eq("id", p.id).eq("slug", p.old);
    if (uErr) { console.error(`✗ update ${p.id}: ${uErr.message}`); continue; }
    slugsDone++;
    const { error: rErr } = await db.from("hotel_slug_redirects").upsert({ old_slug: p.old, new_slug: p.new }, { onConflict: "old_slug" });
    if (rErr) { redirectsFailed++; console.error(`  ⚠ redirect insert ${p.old}: ${rErr.message} (slug updated; old URL will 404 until redirect exists)`); }
    else redirectsDone++;
    console.log(`  ✓ ${p.old} → ${p.new}${rErr ? " (redirect FAILED)" : ""}`);
  }
  console.log(`\n✓ slugs reslugged ${slugsDone}/${plan.length}; redirects ${redirectsDone} ok, ${redirectsFailed} failed. Sitemap is DB-driven; redeploy to refresh its ISR cache.`);
  const dupe = plan.find((p) => p.dupe);
  if (dupe) console.log(`⚠ DUPLICATE remains: "${dupe.new}" is the same hotel as "japan-kamishichiken-oku" — run through the geo-dedup pipeline to merge.`);
})();
