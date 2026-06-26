#!/usr/bin/env node
// THE "NO DUPES EVER" GUARD. Scans the whole catalogue and FAILS (exit 1) if any two hotels are
// the same physical property by geographic identity (src/lib/hotelIdentity.ts: same coordinates +
// compatible name). This is what makes the fix permanent: if an ingest path ever regresses and
// re-introduces a duplicate, this test goes red. Run it in CI and after every merge.
//   node --import tsx --env-file=.env.local scripts/test-no-dupes.mjs
//   flags: --strong-only (only count strong/auto-merge dupes, ignore borderline)
import { createClient } from '@supabase/supabase-js'
import { sameHotel } from '../src/lib/hotelIdentity.ts'

const args = process.argv.slice(2)
const STRONG_ONLY = args.includes('--strong-only')
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE, { auth: { persistSession: false } })

const hotels = []
for (let from = 0; ; from += 1000) {
  const { data, error } = await db.from('hotels').select('id,name,city,lat,lng').range(from, from + 999)
  if (error) { console.error('query failed:', error.message); process.exit(2) }
  hotels.push(...data); if (data.length < 1000) break
}

// Bucket into ~78m cells, compare each hotel against its cell + 8 neighbours (same algorithm the
// merge uses, so the test and the cleanup agree on what "the same hotel" means).
const CELL = 0.0007
const cells = new Map()
for (const h of hotels) { if (h.lat == null || h.lng == null) continue; const k = `${Math.round(h.lat / CELL)}:${Math.round(h.lng / CELL)}`; (cells.get(k) || cells.set(k, []).get(k)).push(h) }
const dupes = []
for (const h of hotels) {
  if (h.lat == null || h.lng == null) continue
  const ci = Math.round(h.lat / CELL), cj = Math.round(h.lng / CELL)
  for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) {
    const arr = cells.get(`${ci + di}:${cj + dj}`); if (!arr) continue
    for (const o of arr) { if (o.id <= h.id) continue; const r = sameHotel(h, o); if (r.same && (!STRONG_ONLY || r.strong)) dupes.push({ a: h, b: o, strong: r.strong, dist: Math.round(r.dist) }) }
  }
}

console.log(`Scanned ${hotels.length} hotels. Duplicate pairs found: ${dupes.length}${STRONG_ONLY ? ' (strong only)' : ''}`)
if (dupes.length) {
  console.log('\nFAIL — these are the same property and must not coexist:')
  for (const d of dupes.slice(0, 40)) console.log(`  "${d.a.name}" ⇆ "${d.b.name}"  (${d.dist}m, ${d.strong ? 'strong' : 'borderline'})`)
  if (dupes.length > 40) console.log(`  …and ${dupes.length - 40} more`)
  process.exit(1)
}
console.log('PASS — no duplicate hotels in the catalogue.')
process.exit(0)
