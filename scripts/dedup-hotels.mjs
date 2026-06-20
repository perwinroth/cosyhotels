#!/usr/bin/env node
// Dedupe duplicate hotel rows (same normalized name+city, ~99% geo-coherent = true re-inserts).
// Keeper = best data: vetted photo > review count > amenities > cosy score > has website.
// Children (images, reviews, grades) are RE-POINTED to the keeper, slug redirects are added so
// old URLs don't 404, then the redundant hotel rows are deleted.
//
// FULLY REVERSIBLE: --execute writes a complete snapshot to scripts/backups/<ts>.json BEFORE
// any destructive write. --restore <file> puts everything back exactly (rows, children, redirects).
//
//   node --env-file=.env.local scripts/dedup-hotels.mjs                       # dry run (no writes)
//   node --env-file=.env.local scripts/dedup-hotels.mjs --execute --limit 5   # rehearse on 5 clusters
//   node --env-file=.env.local scripts/dedup-hotels.mjs --execute             # full merge (snapshots first)
//   node --env-file=.env.local scripts/dedup-hotels.mjs --restore scripts/backups/<ts>.json
import { createClient } from '@supabase/supabase-js'
import { writeFileSync, readFileSync, mkdirSync } from 'fs'

const args = process.argv.slice(2)
const EXECUTE = args.includes('--execute')
const RESTORE = args.includes('--restore') ? args[args.indexOf('--restore') + 1] : null
const BACKFILL = args.includes('--backfill-keys')
const LIMIT = args.includes('--limit') ? Number(args[args.indexOf('--limit') + 1]) : Infinity

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE
if (!url || !key) { console.error('Need SUPABASE_URL + SUPABASE_SERVICE_ROLE(_KEY).'); process.exit(2) }
const db = createClient(url, key, { auth: { persistSession: false } })
const norm = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, ' ').trim()
const chunk = (a, n) => { const o = []; for (let i = 0; i < a.length; i += n) o.push(a.slice(i, i + n)); return o }

async function pageAll(table, cols, extra = (q) => q) {
  const out = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await extra(db.from(table).select(cols).range(from, from + 999))
    if (error) throw new Error(`${table}: ${error.message}`)
    out.push(...data); if (data.length < 1000) break
  }
  return out
}
async function rowsIn(table, col, ids, cols = '*') {
  const out = []
  for (const part of chunk(ids, 200)) {
    const { data, error } = await db.from(table).select(cols).in(col, part)
    if (error) throw new Error(`${table} select: ${error.message}`)
    out.push(...data)
  }
  return out
}

// ---------------- RESTORE ----------------
if (RESTORE) {
  const b = JSON.parse(readFileSync(RESTORE, 'utf8'))
  console.log(`=== RESTORE from ${RESTORE} (${b.hotels.length} hotels, ${b.scores.length} scores, ${b.repoints.length} child re-points) ===`)
  for (const part of chunk(b.hotels, 200)) { const { error } = await db.from('hotels').upsert(part, { onConflict: 'id' }); if (error) throw new Error('restore hotels: ' + error.message) }
  for (const part of chunk(b.scores, 200)) { const { error } = await db.from('cosy_scores').upsert(part, { onConflict: 'hotel_id' }); if (error) throw new Error('restore scores: ' + error.message) }
  if (b.grades?.length) for (const part of chunk(b.grades, 200)) { const { error } = await db.from('hotel_grades').upsert(part, { onConflict: 'hotel_id' }); if (error) throw new Error('restore grades: ' + error.message) }
  // Move re-pointed children back: group by (table, originalHotelId) and update by child id.
  const byTarget = new Map()
  for (const r of b.repoints) { const k = r.table + '|' + r.from; (byTarget.get(k) || byTarget.set(k, []).get(k)).push(r.id) }
  for (const [k, ids] of byTarget) {
    const [table, from] = k.split('|')
    for (const part of chunk(ids, 200)) { const { error } = await db.from(table).update({ hotel_id: from }).in('id', part); if (error) throw new Error(`restore ${table}: ` + error.message) }
  }
  if (b.redirects?.length) for (const part of chunk(b.redirects, 200)) await db.from('hotel_slug_redirects').delete().in('old_slug', part)
  console.log('Restore complete — catalog returned to pre-dedup state.')
  process.exit(0)
}

// ---------------- BACKFILL KEYS ----------------
// Set hotels.dedup_key = norm(name)|norm(city) for every row (chunked). Run after a merge so
// the unique index can be created and future imports can upsert-on-conflict.
async function backfillKeys() {
  const all = await pageAll('hotels', 'id,name,city')
  let updated = 0
  for (const part of chunk(all, 300)) {
    await Promise.all(part.map((h) => {
      const k = norm(h.name); if (!k) return null
      return db.from('hotels').update({ dedup_key: `${k}|${norm(h.city)}` }).eq('id', h.id)
    }).filter(Boolean))
    updated += part.length
    if (updated % 3000 < 300) console.log(`  ...${updated}/${all.length} keys set`)
  }
  console.log(`dedup_key backfilled for ${all.length} hotels.`)
}
if (BACKFILL && !EXECUTE) { console.log('=== Backfill dedup_key ==='); await backfillKeys(); process.exit(0) }

// ---------------- PLAN ----------------
console.log(`=== Hotel dedup — ${EXECUTE ? `EXECUTE${LIMIT < Infinity ? ` (limit ${LIMIT})` : ''}` : 'DRY RUN'} ===`)
const hotels = await pageAll('hotels', 'id,name,city,country,lat,lng,website,slug,amenities,reviews_count,rating')
const scores = new Map((await pageAll('cosy_scores', 'hotel_id,score')).map((r) => [r.hotel_id, Number(r.score) || 0]))
const vetted = new Set((await pageAll('hotel_images', 'hotel_id', (q) => q.eq('vision_ok', true))).map((r) => r.hotel_id))
const anyImg = new Set((await pageAll('hotel_images', 'hotel_id')).map((r) => r.hotel_id))
const reviews = new Map(); for (const r of await pageAll('hotel_reviews', 'hotel_id')) reviews.set(r.hotel_id, (reviews.get(r.hotel_id) || 0) + 1)
const grades = new Set((await pageAll('hotel_grades', 'hotel_id')).map((r) => r.hotel_id))
console.log(`hotels=${hotels.length} scored=${scores.size} withVettedPhoto=${vetted.size}`)

const keepScore = (h) => (vetted.has(h.id) ? 1e6 : 0) + (anyImg.has(h.id) ? 1e5 : 0)
  + (reviews.get(h.id) || Number(h.reviews_count) || 0) * 100
  + (Array.isArray(h.amenities) ? h.amenities.length : 0) * 10 + (scores.get(h.id) || 0) + (h.website ? 5 : 0)

const groups = new Map()
for (const h of hotels) { const k = norm(h.name) + '|' + norm(h.city); if (k.startsWith('|')) continue; (groups.get(k) || groups.set(k, []).get(k)).push(h) }
let plan = [...groups.values()].filter((g) => g.length > 1)
  .map((g) => { g.sort((a, b) => keepScore(b) - keepScore(a) || String(a.id).localeCompare(String(b.id))); return { keep: g[0], drop: g.slice(1) } })
  .sort((a, b) => b.drop.length - a.drop.length)
if (LIMIT < Infinity) plan = plan.slice(0, LIMIT)

const dropIds = plan.flatMap((p) => p.drop.map((d) => d.id))
console.log(`clusters=${plan.length} keepers=${plan.length} hotelsToDelete=${dropIds.length}`)
console.log('Sample:'); for (const { keep, drop } of plan.slice(0, 10)) console.log(`  keep "${keep.name}" (${keep.city}) [score ${(scores.get(keep.id) || 0).toFixed(1)}] ← +${drop.length}`)

if (!EXECUTE) { console.log('\nDRY RUN — nothing written. --execute to merge (snapshots first), --limit N to rehearse.'); process.exit(0) }

// ---------------- SNAPSHOT (before any write) ----------------
console.log('\nSnapshotting before any delete...')
const keepOf = new Map(); for (const p of plan) for (const d of p.drop) keepOf.set(d.id, p.keep.id)
const backup = { ts: new Date().toISOString(), hotels: [], scores: [], repoints: [], grades: [], redirects: [] }
backup.hotels = await rowsIn('hotels', 'id', dropIds, '*')
backup.scores = await rowsIn('cosy_scores', 'hotel_id', dropIds, '*')
// Re-point id-keyed children (images, reviews) to the keeper; record old owner for restore.
for (const table of ['hotel_images', 'hotel_reviews']) {
  const kids = await rowsIn(table, 'hotel_id', dropIds, 'id,hotel_id')
  for (const r of kids) backup.repoints.push({ table, id: r.id, from: r.hotel_id, to: keepOf.get(r.hotel_id) })
}
// hotel_grades is keyed by hotel_id (no id col) — back the rows up and let them cascade-delete
// with the dupe hotel (the owner re-grades keepers during grading; restore re-inserts these).
backup.grades = await rowsIn('hotel_grades', 'hotel_id', dropIds, '*')
for (const p of plan) for (const d of p.drop) if (d.slug && d.slug !== p.keep.slug) backup.redirects.push(d.slug)
mkdirSync('scripts/backups', { recursive: true })
const file = `scripts/backups/dedup-${backup.ts.replace(/[:.]/g, '-')}.json`
writeFileSync(file, JSON.stringify(backup))
console.log(`Backup written: ${file}`)
console.log(`  hotels=${backup.hotels.length} scores=${backup.scores.length} childRepoints=${backup.repoints.length} grades=${backup.grades.length} redirects=${backup.redirects.length}`)
if (backup.hotels.length !== dropIds.length) { console.error('ABORT: backup hotel count != planned deletes. Nothing was deleted.'); process.exit(1) }

// ---------------- EXECUTE ----------------
console.log('\nMerging...')
const groupByTo = new Map(); for (const r of backup.repoints) { const k = r.table + '|' + r.to; (groupByTo.get(k) || groupByTo.set(k, []).get(k)).push(r.id) }
for (const [k, ids] of groupByTo) { const [table, to] = k.split('|'); for (const part of chunk(ids, 200)) { const { error } = await db.from(table).update({ hotel_id: to }).in('id', part); if (error) throw new Error(`repoint ${table}: ` + error.message) } }
for (const p of plan) for (const d of p.drop) if (d.slug && d.slug !== p.keep.slug) await db.from('hotel_slug_redirects').upsert({ old_slug: d.slug, new_slug: p.keep.slug, hotel_id: p.keep.id }, { onConflict: 'old_slug' })
for (const part of chunk(dropIds, 200)) { const { error } = await db.from('cosy_scores').delete().in('hotel_id', part); if (error) throw new Error('delete scores: ' + error.message) }
for (const part of chunk(dropIds, 200)) { const { error } = await db.from('hotels').delete().in('id', part); if (error) throw new Error('delete hotels: ' + error.message) }
console.log(`\nDone. Removed ${dropIds.length} duplicate hotels, kept ${plan.length} canonical rows.`)
console.log('\nBackfilling dedup_key on survivors...')
await backfillKeys()
console.log(`\nReverse anytime: node --env-file=.env.local scripts/dedup-hotels.mjs --restore ${file}`)
console.log('Next: apply supabase/2026_hotel_dedup_key.sql to add the unique index (prevents future dupes).')
