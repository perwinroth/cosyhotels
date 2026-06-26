#!/usr/bin/env node
// Dedupe duplicate hotel rows by GEOGRAPHIC IDENTITY (same coordinates + compatible name) — the
// single source of truth in src/lib/hotelIdentity.ts, NOT the old name|city string key that was
// blind to geography and let cross-source twins (OSM vs Google Places) through.
// Keeper = best data: vetted photo > review count > amenities > cosy score > has website.
// Children (images, reviews, grades) are RE-POINTED to the keeper, slug redirects are added so
// old URLs don't 404, then the redundant hotel rows are deleted.
//
// STRONG clusters (very close + strong name match) auto-merge. BORDERLINE clusters (40–80m apart
// or partial-name) are written to a review file and NOT merged until a human approves them.
//
// FULLY REVERSIBLE: --execute writes a complete snapshot to scripts/backups/<ts>.json BEFORE
// any destructive write. --restore <file> puts everything back exactly (rows, children, redirects).
// Runs via tsx so it can import the TypeScript identity module (one source of truth, no drift):
//
//   node --import tsx --env-file=.env.local scripts/dedup-hotels.mjs                     # dry run
//   node --import tsx --env-file=.env.local scripts/dedup-hotels.mjs --execute --limit 5 # rehearse 5
//   node --import tsx --env-file=.env.local scripts/dedup-hotels.mjs --execute           # full merge
//   node --import tsx --env-file=.env.local scripts/dedup-hotels.mjs --restore scripts/backups/<ts>.json
import { createClient } from '@supabase/supabase-js'
import { writeFileSync, readFileSync, mkdirSync } from 'fs'
import { sameHotel } from '../src/lib/hotelIdentity.ts'

const args = process.argv.slice(2)
const EXECUTE = args.includes('--execute')
const RESTORE = args.includes('--restore') ? args[args.indexOf('--restore') + 1] : null
const BACKFILL = args.includes('--backfill-keys')
const LIMIT = args.includes('--limit') ? Number(args[args.indexOf('--limit') + 1]) : Infinity
// --borderline merges the REVIEW tier instead of the strong tier (after a human has eyeballed it).
// --reject <keeperId,keeperId,…> holds specific clusters back (the ones you decided are NOT dupes).
const BORDERLINE = args.includes('--borderline')
const REJECT = new Set(args.includes('--reject') ? String(args[args.indexOf('--reject') + 1]).split(',').map((s) => s.trim()).filter(Boolean) : [])

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
// Tolerant variant for OPTIONAL cache tables that may not exist in this DB (price_snapshots /
// featured_top / city_top live in the schema SQL but aren't always created). A missing table
// returns [] instead of crashing; any other error still throws.
async function rowsInOpt(table, col, ids, cols = '*') {
  try { return await rowsIn(table, col, ids, cols) }
  catch (e) { if (/Could not find the table|does not exist|schema cache/i.test(String(e.message))) { console.log(`  (skip ${table} — table not present)`); return [] } throw e }
}

// ---------------- RESTORE ----------------
if (RESTORE) {
  const b = JSON.parse(readFileSync(RESTORE, 'utf8'))
  console.log(`=== RESTORE from ${RESTORE} (${b.hotels.length} hotels, ${b.scores.length} scores, ${b.repoints.length} child re-points) ===`)
  for (const part of chunk(b.hotels, 200)) { const { error } = await db.from('hotels').upsert(part, { onConflict: 'id' }); if (error) throw new Error('restore hotels: ' + error.message) }
  for (const part of chunk(b.scores, 200)) { const { error } = await db.from('cosy_scores').upsert(part, { onConflict: 'hotel_id' }); if (error) throw new Error('restore scores: ' + error.message) }
  if (b.grades?.length) for (const part of chunk(b.grades, 200)) { const { error } = await db.from('hotel_grades').upsert(part, { onConflict: 'hotel_id' }); if (error) throw new Error('restore grades: ' + error.message) }
  // Cascade-deleted children (votes/price snapshots/featured/city_top): re-insert the full rows we
  // snapshotted. Hotels were restored first (above) so the hotel_id FK is satisfied. Votes upsert
  // on id (full row carries the ORIGINAL hotel_id, which also undoes any repoint of survivors).
  if (b.votes?.length) for (const part of chunk(b.votes, 200)) { const { error } = await db.from('cosy_votes').upsert(part, { onConflict: 'id' }); if (error) throw new Error('restore votes: ' + error.message) }
  if (b.snapshots?.length) for (const part of chunk(b.snapshots, 200)) { const { error } = await db.from('price_snapshots').upsert(part); if (error) throw new Error('restore price_snapshots: ' + error.message) }
  if (b.featured?.length) for (const part of chunk(b.featured, 200)) { const { error } = await db.from('featured_top').upsert(part, { onConflict: 'position' }); if (error) throw new Error('restore featured_top: ' + error.message) }
  if (b.cityTop?.length) for (const part of chunk(b.cityTop, 200)) { const { error } = await db.from('city_top').upsert(part); if (error) throw new Error('restore city_top: ' + error.message) }
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

// ---- GEO CLUSTERING: identity = geography + name (src/lib/hotelIdentity.ts) ----
// Bucket hotels into ~78m cells, then union any pair that sameHotel() calls the same property,
// scanning each cell + its 8 neighbours so a pair straddling a cell boundary still links.
const CELL = 0.0007
const cells = new Map()
for (const h of hotels) { if (h.lat == null || h.lng == null) continue; const k = `${Math.round(h.lat / CELL)}:${Math.round(h.lng / CELL)}`; (cells.get(k) || cells.set(k, []).get(k)).push(h) }
const parent = new Map(hotels.map((h) => [h.id, h.id]))
const find = (x) => { while (parent.get(x) !== x) { parent.set(x, parent.get(parent.get(x))); x = parent.get(x) } return x }
const union = (a, b) => { const ra = find(a), rb = find(b); if (ra !== rb) parent.set(ra, rb) }
for (const h of hotels) {
  if (h.lat == null || h.lng == null) continue
  const ci = Math.round(h.lat / CELL), cj = Math.round(h.lng / CELL)
  for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) {
    const arr = cells.get(`${ci + di}:${cj + dj}`); if (!arr) continue
    for (const o of arr) { if (o.id <= h.id) continue; if (sameHotel(h, o).same) union(h.id, o.id) } // each unordered pair once
  }
}
const clusters = new Map()
for (const h of hotels) { const r = find(h.id); (clusters.get(r) || clusters.set(r, []).get(r)).push(h) }
const allClusters = [...clusters.values()].filter((g) => g.length > 1)
// A cluster auto-merges only if EVERY same-hotel edge in it is strong; any borderline edge → review.
const isStrong = (g) => { for (let i = 0; i < g.length; i++) for (let j = i + 1; j < g.length; j++) { const r = sameHotel(g[i], g[j]); if (r.same && !r.strong) return false } return true }
const strongClusters = allClusters.filter(isStrong)
const borderlineClusters = allClusters.filter((g) => !isStrong(g))

// Merge the strong tier by default; --borderline merges the review tier instead. Clusters are
// keyed by their keeper id so --reject is stable across runs (positional indices are not).
const sourceClusters = BORDERLINE ? borderlineClusters : strongClusters
let plan = sourceClusters
  .map((g) => { g.sort((a, b) => keepScore(b) - keepScore(a) || String(a.id).localeCompare(String(b.id))); return { keep: g[0], drop: g.slice(1) } })
  .filter((p) => !REJECT.has(String(p.keep.id)))
  .sort((a, b) => b.drop.length - a.drop.length)
if (REJECT.size) console.log(`(--reject held back ${REJECT.size} cluster(s) by keeper id)`)
if (LIMIT < Infinity) plan = plan.slice(0, LIMIT)

const dropIds = plan.flatMap((p) => p.drop.map((d) => d.id))
const dist = (a, b) => { const R = 6371000, t = Math.PI / 180, dLat = (b.lat - a.lat) * t, dLng = (b.lng - a.lng) * t; return Math.round(2 * R * Math.asin(Math.sqrt(Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * t) * Math.cos(b.lat * t) * Math.sin(dLng / 2) ** 2))) }
const tier = BORDERLINE ? 'BORDERLINE (approved)' : 'STRONG (auto-merge)'
console.log(`\n${tier}:   clusters=${plan.length} hotelsToDelete=${dropIds.length}`)
if (!BORDERLINE) console.log(`BORDERLINE (review):   clusters=${borderlineClusters.length} hotels=${borderlineClusters.reduce((s, g) => s + g.length, 0)}`)
console.log(`\n${BORDERLINE ? 'Will merge' : 'Strong sample'}:`); for (const { keep, drop } of plan.slice(0, 12)) console.log(`  keep "${keep.name}" (${keep.city}) [${(scores.get(keep.id) || 0).toFixed(1)}] ← ${drop.map((d) => `"${d.name}" (${dist(keep, d)}m)`).join(', ')}`)

// Always write the borderline review file so a human can approve/reject each before it's ever merged.
mkdirSync('scripts/backups', { recursive: true })
const reviewFile = `scripts/backups/dedup-borderline-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
const review = borderlineClusters.map((g) => {
  const sorted = [...g].sort((a, b) => keepScore(b) - keepScore(a) || String(a.id).localeCompare(String(b.id)))
  const keeper = sorted[0] // SAME keeper logic the merge uses, so reject-by-keeperId stays consistent
  return { keeperId: keeper.id, members: sorted.map((h) => ({ id: h.id, name: h.name, city: h.city, lat: h.lat, lng: h.lng, website: h.website || null, slug: h.slug, score: Number((scores.get(h.id) || 0).toFixed(1)), dist: dist(keeper, h), keeper: h.id === keeper.id })) }
})
writeFileSync(reviewFile, JSON.stringify(review, null, 1))
console.log(`\nBorderline review list → ${reviewFile} (${borderlineClusters.length} clusters; NOT merged)`)
console.log('Borderline sample:'); for (const g of borderlineClusters.slice(0, 12)) console.log(`  ${g.map((h) => `"${h.name}" (${dist(g[0], h)}m)`).join('  ⇆  ')}`)

if (!EXECUTE) { console.log(`\nDRY RUN — nothing written. --execute merges the ${BORDERLINE ? 'BORDERLINE (review)' : 'STRONG'} tier (snapshots first); --reject <keeperIds> to hold clusters back; --limit N to rehearse.`); process.exit(0) }

// ---------------- SNAPSHOT (before any write) ----------------
console.log('\nSnapshotting before any delete...')
const keepOf = new Map(); for (const p of plan) for (const d of p.drop) keepOf.set(d.id, p.keep.id)
const backup = { ts: new Date().toISOString(), hotels: [], scores: [], repoints: [], grades: [], redirects: [], votes: [], snapshots: [], featured: [], cityTop: [] }
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
// FULL-ROW backup of every other on-delete-cascade child so the merge is truly reversible. Friend
// votes (cosy_votes) get repointed to the keeper below (so they stay live); price_snapshots /
// featured_top / city_top are caches/series — backed up here, allowed to cascade, restored on undo.
backup.votes = await rowsIn('cosy_votes', 'hotel_id', dropIds, '*') // strict — friend votes are precious
backup.snapshots = await rowsInOpt('price_snapshots', 'hotel_id', dropIds, '*')
backup.featured = await rowsInOpt('featured_top', 'hotel_id', dropIds, '*')
backup.cityTop = await rowsInOpt('city_top', 'hotel_id', dropIds, '*')
for (const p of plan) for (const d of p.drop) if (d.slug && d.slug !== p.keep.slug) backup.redirects.push(d.slug)
mkdirSync('scripts/backups', { recursive: true })
const file = `scripts/backups/dedup-${backup.ts.replace(/[:.]/g, '-')}.json`
writeFileSync(file, JSON.stringify(backup))
console.log(`Backup written: ${file}`)
console.log(`  hotels=${backup.hotels.length} scores=${backup.scores.length} childRepoints=${backup.repoints.length} grades=${backup.grades.length} votes=${backup.votes.length} snapshots=${backup.snapshots.length} featured=${backup.featured.length} cityTop=${backup.cityTop.length} redirects=${backup.redirects.length}`)
if (backup.hotels.length !== dropIds.length) { console.error('ABORT: backup hotel count != planned deletes. Nothing was deleted.'); process.exit(1) }

// ---------------- EXECUTE ----------------
console.log('\nMerging...')
const groupByTo = new Map(); for (const r of backup.repoints) { const k = r.table + '|' + r.to; (groupByTo.get(k) || groupByTo.set(k, []).get(k)).push(r.id) }
for (const [k, ids] of groupByTo) { const [table, to] = k.split('|'); for (const part of chunk(ids, 200)) { const { error } = await db.from(table).update({ hotel_id: to }).in('id', part); if (error) throw new Error(`repoint ${table}: ` + error.message) } }
// cosy_votes has a UNIQUE(grader, hotel_id) — a blind repoint would throw when the keeper already
// holds a vote from the same grader. So repoint only non-colliding votes; colliding dupe votes
// cascade-delete with their hotel (keeper's own vote wins, and the dupe is in backup.votes for undo).
{
  const keeperIds = [...new Set(plan.map((p) => p.keep.id))]
  const existing = new Set((await rowsIn('cosy_votes', 'hotel_id', keeperIds, 'grader,hotel_id')).map((v) => `${v.grader}|${v.hotel_id}`))
  const moveByTo = new Map(); let voteSkips = 0
  for (const v of backup.votes) { const to = keepOf.get(v.hotel_id); const k = `${v.grader}|${to}`; if (existing.has(k)) { voteSkips++; continue } existing.add(k); (moveByTo.get(to) || moveByTo.set(to, []).get(to)).push(v.id) }
  for (const [to, ids] of moveByTo) for (const part of chunk(ids, 200)) { const { error } = await db.from('cosy_votes').update({ hotel_id: to }).in('id', part); if (error) throw new Error('repoint cosy_votes: ' + error.message) }
  console.log(`  cosy_votes: repointed ${backup.votes.length - voteSkips}, ${voteSkips} dupe-grader votes left to cascade (backed up)`)
}
for (const p of plan) for (const d of p.drop) if (d.slug && d.slug !== p.keep.slug) await db.from('hotel_slug_redirects').upsert({ old_slug: d.slug, new_slug: p.keep.slug, hotel_id: p.keep.id }, { onConflict: 'old_slug' })
for (const part of chunk(dropIds, 200)) { const { error } = await db.from('cosy_scores').delete().in('hotel_id', part); if (error) throw new Error('delete scores: ' + error.message) }
for (const part of chunk(dropIds, 200)) { const { error } = await db.from('hotels').delete().in('id', part); if (error) throw new Error('delete hotels: ' + error.message) }
console.log(`\nDone. Removed ${dropIds.length} duplicate hotels, kept ${plan.length} canonical rows.`)
console.log('\nBackfilling dedup_key on survivors...')
await backfillKeys()
console.log(`\nReverse anytime: node --env-file=.env.local scripts/dedup-hotels.mjs --restore ${file}`)
console.log('Next: apply supabase/2026_hotel_dedup_key.sql to add the unique index (prevents future dupes).')
