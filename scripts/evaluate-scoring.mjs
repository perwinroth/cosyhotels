#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js'
import { cosyParts } from '../src/lib/scoring/cosy.js'

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
if (!url || !key) {
  console.error('Missing SUPABASE_* envs')
  process.exit(2)
}
const db = createClient(url, key)

const fs = await import('node:fs/promises')
const path = new URL('./benchmarks.json', import.meta.url)
const benchmarks = JSON.parse(await fs.readFile(path).then(r => r.toString()))

function fmt(n) { return Number(n).toFixed(2) }

let failures = 0
for (const b of benchmarks) {
  const { data: row } = await db.from('hotels').select('id,slug,name,city,country,rating,reviews_count').eq('slug', b.slug).maybeSingle()
  if (!row) { console.log(`MISS ${b.slug}: not found`); failures++; continue }
  const parts = cosyParts({ rating: row.rating ?? undefined, reviewsCount: row.reviews_count ?? undefined, city: row.city ?? undefined, country: row.country ?? undefined, description: `${row.name}. ${row.city ?? ''}` })
  const s = parts.raw
  const ok = s >= b.min
  console.log(`${ok ? 'OK' : 'LOW'} ${row.slug} cosy=${fmt(s)} expected>=${fmt(b.min)}`)
  if (!ok) failures++
}

process.exit(failures ? 1 : 0)

