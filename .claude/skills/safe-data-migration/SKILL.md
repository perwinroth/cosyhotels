---
name: safe-data-migration
description: Scaffold and run a reversible Supabase data migration the cosyhotels way — dry-run by default, snapshot backup before writes, batched, reversible. Use when you need to bulk-update hotels / cosy_scores / hotel_images or any prod table.
disable-model-invocation: true
---

# Safe Data Migration

The repo's proven pattern for touching the live DB (see `scripts/dedup-hotels.mjs`, `normalize-cities.mjs`, `recalibrate-scores.mjs`). Never write to prod without it.

## Template

Create `scripts/<name>.mjs`:

```js
import { createClient } from "@supabase/supabase-js";
import { writeFileSync, mkdirSync } from "fs";
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE);
const EXECUTE = process.argv.includes("--execute");

// 1) Page through ALL rows (Supabase caps at ~1000/query — never trust a single select).
const PAGE = 1000; let off = 0, rows = [];
for (;;) {
  const { data, error } = await db.from("<table>").select("<cols>").range(off, off + PAGE - 1);
  if (error) { console.error(error.message); process.exit(1); }
  if (!data?.length) break; rows.push(...data);
  if (data.length < PAGE) break; off += PAGE;
}

// 2) Compute changes in memory; print before/after + samples.
const changes = rows.map(/* ... */).filter(/* only real changes */);
console.log(`would change ${changes.length}/${rows.length}`);
changes.slice(0, 15).forEach(c => console.log("  ", c.from, "->", c.to));

// 3) Dry-run gate.
if (!EXECUTE) { console.log("DRY-RUN — no writes. --execute to apply."); process.exit(0); }

// 4) Backup BEFORE writing.
mkdirSync("scripts/backups", { recursive: true });
const stamp = process.env.STAMP || "manual";
writeFileSync(`scripts/backups/<name>-${stamp}.json`, JSON.stringify(/* original rows */, null, 2));

// 5) Batched writes (500/batch), targeted by id.
for (let i = 0; i < changes.length; i += 500) {
  const batch = changes.slice(i, i + 500).map(c => ({ /* pk + changed cols */ }));
  const { error } = await db.from("<table>").upsert(batch, { onConflict: "<pk>" });
  if (error) console.error("batch err", error.message);
}
```

## Run

```bash
set -a && . ./.env.local && set +a          # load service-role creds
node scripts/<name>.mjs                       # DRY-RUN — always look first
STAMP=$(date +%Y%m%d-%H%M%S) node scripts/<name>.mjs --execute   # apply (backup written first)
```

## Rules

- **Always dry-run and eyeball the before/after first.** A "would change 18000/18000" means a bug.
- **Backup is non-negotiable** for any overwrite/delete. Inserts are additive (lower risk) but still log what was added.
- Targeted writes only — never a blind table-wide update.
- `scripts/backups/` and `scripts/_*.mjs` are gitignored; commit the migration script itself.
- For risky migrations, have the `data-migration-guard` agent review before `--execute`.
