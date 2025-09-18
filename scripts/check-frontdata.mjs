#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!url || !key) {
  console.error('Missing SUPABASE_URL and/or SUPABASE_*_KEY in CI secrets.')
  process.exit(2)
}

const db = createClient(url, key)

function asList(val) {
  if (!val) return []
  return String(val).split(',').map(s => s.trim()).filter(Boolean)
}

function fail(msg) {
  console.error(`Guard failed: ${msg}`)
  process.exit(1)
}

try {
  // Check featured_top has >= 9 and scores >= 7
  const { count: ftCount, error: ftErr } = await db
    .from('featured_top')
    .select('*', { count: 'exact', head: true })
  if (ftErr) throw ftErr
  if ((ftCount || 0) < 9) fail(`featured_top rows < 9 (got ${ftCount || 0})`)

  const { data: ftRows } = await db
    .from('featured_top')
    .select('score')
    .order('position', { ascending: true })
    .limit(9)
  const low = (ftRows || []).some(r => typeof r.score === 'number' && r.score < 7)
  if (low) fail('featured_top contains scores < 7')

  // Determine which cities to validate
  let cities = asList(process.env.GUIDE_CITIES)
  if (!cities.length) {
    const { data: ctCities, error: cErr } = await db
      .from('city_top')
      .select('city')
      .limit(1000)
    if (cErr) throw cErr
    const seen = new Set()
    for (const r of ctCities || []) if (r.city) seen.add(String(r.city))
    cities = Array.from(seen)
  }

  for (const city of cities) {
    const { count, error } = await db
      .from('city_top')
      .select('*', { count: 'exact', head: true })
      .eq('city', city)
      .gte('score', 7)
    if (error) throw error
    if ((count || 0) < 9) fail(`city_top for "${city}" has < 9 cosy≥7 (got ${count || 0})`)
  }

  console.log('Frontpage/Guides guard passed: featured_top≥9 and city_top≥9 for cities.')
  process.exit(0)
} catch (e) {
  console.error('Guard exception:', e)
  process.exit(1)
}

