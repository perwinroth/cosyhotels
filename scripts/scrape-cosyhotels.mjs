#!/usr/bin/env node
// Scrape CosyHotels listings, match to Amadeus hotelId, persist to Supabase, and
// generate accessible hotel pages (via slug in Next.js). No Google Places.

import { createClient } from '@supabase/supabase-js'
import slugify from 'slugify'

// ---------- Env & Config ----------
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL and service key (SUPABASE_SERVICE_ROLE or *_ANON_KEY)')
  process.exit(1)
}
const COSY_LIST_URLS = (process.env.COSY_LIST_URLS || '').split(',').map(s=>s.trim()).filter(Boolean)
const COSY_SITEMAP_URL = process.env.COSY_SITEMAP_URL || ''
const PLACEHOLDER = process.env.HOTEL_IMAGE_PLACEHOLDER_URL || 'https://placehold.co/800x600?text=Hotel+Image'

const AMADEUS_BASE = process.env.AMADEUS_API_BASE || 'https://test.api.amadeus.com'
const AMADEUS_API_KEY = process.env.AMADEUS_API_KEY
const AMADEUS_API_SECRET = process.env.AMADEUS_API_SECRET

const TIMEOUT_MS = parseInt(process.env.HOTEL_IMAGE_TIMEOUT_MS || '8000', 10)

// ---------- Helpers ----------
function sleep(ms){ return new Promise(r=>setTimeout(r, ms)) }
function withTimeout(resource, options={}, ms=TIMEOUT_MS){
  const controller = new AbortController()
  const id = setTimeout(()=>controller.abort(), ms)
  return fetch(resource, { ...options, signal: controller.signal }).finally(()=>clearTimeout(id))
}
function normalize(s){
  return String(s||'').toLowerCase().normalize('NFKD').replace(/[^a-z0-9\s]/g,' ').replace(/\s+/g,' ').trim()
}
function tokenSetSimilarity(a,b){
  const A = new Set(normalize(a).split(' ').filter(Boolean))
  const B = new Set(normalize(b).split(' ').filter(Boolean))
  let inter=0
  for (const t of A) if (B.has(t)) inter++
  const union = new Set([...A,...B]).size || 1
  return inter/union
}
function cleanSlugPart(s){ return slugify(String(s||'').trim(), { lower:true, strict:true }) }

async function ensureUniqueSlug(db, base){
  const lower = base.toLowerCase()
  const { data } = await db.from('hotels').select('slug').ilike('slug', `${lower}%`).limit(200)
  const existing = new Set((data||[]).map(r => String(r.slug||'').toLowerCase()))
  if (!existing.has(lower)) return lower
  for (let i=2;i<1000;i++){
    const cand = `${lower}-${i}`
    if (!existing.has(cand)) return cand
  }
  return `${lower}-${Date.now()}`
}

async function generateHotelSlug(db, name, city, country){
  const n = cleanSlugPart(name)
  const c = cleanSlugPart(city)
  const k = cleanSlugPart(country)
  let base = c ? `${c}-${n}` : n
  // keep simple; could add ambiguity check
  if (!c && k) base = `${k}-${base}`
  return ensureUniqueSlug(db, base)
}

// ---------- Amadeus ----------
let cachedToken = null
let cachedExp = 0
async function getAmadeusToken(){
  const now = Math.floor(Date.now()/1000)
  if (cachedToken && cachedExp > now+30) return cachedToken
  if (!AMADEUS_API_KEY || !AMADEUS_API_SECRET) return null
  const url = `${AMADEUS_BASE}/v1/security/oauth2/token`
  const body = new URLSearchParams({ grant_type:'client_credentials', client_id: AMADEUS_API_KEY, client_secret: AMADEUS_API_SECRET })
  const res = await withTimeout(url, { method:'POST', headers:{'content-type':'application/x-www-form-urlencoded'}, body })
  if (!res.ok) return null
  const j = await res.json()
  cachedToken = j.access_token
  cachedExp = now + (j.expires_in || 0)
  return cachedToken
}

async function amadeusGetCityCode(city){
  const t = await getAmadeusToken(); if (!t) return null
  const url = new URL(`${AMADEUS_BASE}/v1/reference-data/locations`)
  url.searchParams.set('subType','CITY')
  url.searchParams.set('keyword', city)
  const res = await withTimeout(url.toString(), { headers:{ authorization:`Bearer ${t}` } })
  if (!res.ok) return null
  const j = await res.json()
  return (j?.data?.[0]?.iataCode) || null
}

async function amadeusSearchHotels(city){
  const t = await getAmadeusToken(); if (!t) return []
  const code = await amadeusGetCityCode(city); if (!code) return []
  const url = new URL(`${AMADEUS_BASE}/v1/reference-data/locations/hotels/by-city`)
  url.searchParams.set('cityCode', code)
  const res = await withTimeout(url.toString(), { headers:{ authorization:`Bearer ${t}` } })
  if (!res.ok) return []
  const j = await res.json()
  return (Array.isArray(j?.data) ? j.data : []).map(h => ({ id: String(h.hotelId||''), name: String(h.name||''), city }))
}

async function amadeusGetPhotos(hotelId){
  const t = await getAmadeusToken(); if (!t) return []
  const url = new URL(`${AMADEUS_BASE}/v2/reference-data/locations/hotels/photos`)
  url.searchParams.set('hotelIds', hotelId)
  url.searchParams.set('view', 'FULL')
  const res = await withTimeout(url.toString(), { headers:{ authorization:`Bearer ${t}` } })
  if (!res.ok) return []
  const j = await res.json()
  const arr = Array.isArray(j?.data) ? j.data : []
  const media = arr.flatMap(d => d?.media || d?.photos || [])
  return media.map(m => m?.uri || m?.url).filter(Boolean)
}

// ---------- Scraping (CosyHotels listings) ----------
async function discoverListingUrls(){
  const urls = new Set()
  for (const u of COSY_LIST_URLS) urls.add(u)
  if (COSY_SITEMAP_URL) {
    try {
      const res = await withTimeout(COSY_SITEMAP_URL)
      if (res.ok) {
        const xml = await res.text()
        for (const m of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) urls.add(m[1])
      }
    } catch {}
  }
  return Array.from(urls)
}

function parseListings(html, baseUrl){
  const out = []
  // Try article cards with hotel anchors
  const cardRe = /<article[\s\S]*?<a[^>]+href=\"([^\"]+)\"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<\/article>/gi
  let m
  while ((m = cardRe.exec(html)) !== null) {
    const href = new URL(m[1], baseUrl).toString()
    const text = m[2].replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim()
    const name = text
    out.push({ url: href, name })
  }
  // Fallback: any /hotels/ links
  if (!out.length) {
    for (const a of html.matchAll(/<a[^>]+href=\"([^\"]*\/hotels\/[^\"]+)\"[^>]*>([\s\S]*?)<\/a>/gi)) {
      const href = new URL(a[1], baseUrl).toString()
      const name = a[2].replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim()
      out.push({ url: href, name })
    }
  }
  return out
}

function extractNameAddress(html){
  const name = (html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || '').replace(/<[^>]+>/g,' ').trim()
  const addrMeta = html.match(/<meta[^>]+property=["']og:locale:alternate["'][^>]*>/i) // bait to look around
  const addrLd = html.match(/\"address\"\s*:\s*\{[\s\S]*?\}/i)
  let address = ''
  if (addrLd) address = addrLd[0].replace(/\s+/g,' ').slice(0, 300)
  const cityGuess = (html.match(/<meta[^>]+property=["']og:locale["'][^>]+content=["']([a-z]+_[A-Z]+)["']/i)?.[1] || '').split('_')[0]
  return { name, address, city: cityGuess || '' }
}

function extractImagesFromHtml(html, base){
  const urls = new Set()
  const og = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i)
  if (og?.[1]) urls.add(new URL(og[1], base).toString())
  const linkImg = html.match(/<link[^>]+rel=["']image_src["'][^>]+href=["']([^"']+)["']/i)
  if (linkImg?.[1]) urls.add(new URL(linkImg[1], base).toString())
  for (const m of html.matchAll(/<img[^>]+src=["']([^"']+)["'][^>]*>/gi)) {
    try {
      const u = new URL(m[1], base).toString()
      if (/\.(jpe?g|png|webp|avif)(\?|$)/i.test(u) && !/(logo|icon|sprite|thumb|mini)/i.test(u)) urls.add(u)
    } catch {}
  }
  return Array.from(urls)
}

async function validateImage(u){
  try {
    const r = await withTimeout(u, { method:'HEAD' })
    if (r.ok) return r.headers.get('content-type') || 'image/jpeg'
  } catch {}
  try {
    const r = await withTimeout(u, { method:'GET' })
    if (r.ok) return r.headers.get('content-type') || 'image/jpeg'
  } catch {}
  return null
}

async function getBestImages({ hotelId, name, city, website }){
  // 1) Amadeus media
  if (hotelId) {
    const am = await amadeusGetPhotos(hotelId)
    const out = []
    for (const u of am) {
      const type = await validateImage(u)
      if (type) out.push({ url: u, source:'amadeus', type })
      if (out.length >= 6) break
    }
    if (out.length) return out
  }
  // 2) Website
  if (website) {
    try {
      const res = await withTimeout(website, { headers: { 'User-Agent':'Mozilla/5.0 (compatible; cosyhotels-bot/1.0)'} })
      if (res.ok) {
        const html = await res.text()
        const imgs = extractImagesFromHtml(html, website)
        const out = []
        for (const u of imgs) {
          const type = await validateImage(u)
          if (type) out.push({ url: u, source:'website', type })
          if (out.length >= 6) break
        }
        if (out.length) return out
      }
    } catch {}
  }
  // 3) Placeholder
  return [{ url: PLACEHOLDER, source:'placeholder', type:'image/png' }]
}

async function matchAmadeusId(name, city){
  const list = await amadeusSearchHotels(city)
  if (!list.length) return null
  let best = null
  let bestScore = 0
  for (const h of list) {
    const s = tokenSetSimilarity(name, h.name)
    if (s > bestScore) { best = h; bestScore = s }
  }
  return (bestScore >= 0.4 && best) ? best.id : null // conservative threshold
}

// ---------- Persist & generate pages ----------
async function upsertHotel(db, row){
  // row: { name, city, country, address, website, amadeusId }
  // Strategy: store as source='amadeus' with source_id=amadeusId; keep website from Cosy listing.
  // Slug: city-name (unique).
  const source = 'amadeus'
  const source_id = row.amadeusId || null
  // If exists by source_id, update; else insert new with slug
  let slug = null
  if (!source_id) {
    slug = await generateHotelSlug(db, row.name, row.city, row.country)
  }
  const payload = {
    source, source_id,
    name: row.name,
    address: row.address || null,
    city: row.city || null,
    country: row.country || null,
    website: row.website || null,
    slug,
    updated_at: new Date().toISOString(),
  }
  // If source_id present, upsert by (source, source_id); else by slug
  if (source_id) {
    const { data: existing } = await db.from('hotels').select('id,slug').eq('source','amadeus').eq('source_id', source_id).maybeSingle()
    if (existing) {
      const { data, error } = await db.from('hotels').update(payload).eq('id', existing.id).select('id,slug').maybeSingle()
      if (error) throw error
      return data
    }
  }
  if (!slug) {
    slug = await generateHotelSlug(db, row.name, row.city, row.country)
  }
  payload.slug = slug
  const { data, error } = await db.from('hotels').insert(payload).select('id,slug').maybeSingle()
  if (error) throw error
  return data
}

async function upsertImages(db, hotelId, images){
  if (!images?.length) return
  const top = images.slice(0, 6)
  for (const img of top) {
    await db.from('hotel_images').insert({ hotel_id: hotelId, url: img.url }).then(()=>sleep(50))
  }
}

// ---------- Main ----------
async function main(){
  const db = createClient(SUPABASE_URL, SUPABASE_KEY)
  const job = { job: 'scrape_cosyhotels', started_at: new Date().toISOString(), status: 'started' }
  const { data: jobRow } = await db.from('job_runs').insert(job).select('id').maybeSingle()
  const jobId = jobRow?.id

  try {
    const listPages = await discoverListingUrls()
    if (!listPages.length) {
      console.warn('No listing URLs discovered (set COSY_LIST_URLS or COSY_SITEMAP_URL).')
    }
    const listings = []
    for (const url of listPages) {
      try {
        const res = await withTimeout(url)
        if (!res.ok) continue
        const html = await res.text()
        const items = parseListings(html, url)
        for (const it of items) listings.push(it)
      } catch {}
      await sleep(200)
    }

    console.log(`Discovered ${listings.length} listing candidate pages`)
    let success = 0
    for (const it of listings) {
      try {
        const res = await withTimeout(it.url, { headers: { 'User-Agent':'Mozilla/5.0 (compatible; cosyhotels-bot/1.0)'} })
        if (!res.ok) continue
        const html = await res.text()
        const meta = extractNameAddress(html)
        const name = meta.name || it.name || 'Hotel'
        const city = meta.city || ''
        const address = meta.address || ''
        const amadeusId = city ? (await matchAmadeusId(name, city)) : null

        const saved = await upsertHotel(db, { name, city, country: '', address, website: it.url, amadeusId })
        const hotelId = saved?.id
        if (!hotelId) continue
        const images = await getBestImages({ hotelId: amadeusId, name, city, website: it.url })
        await upsertImages(db, hotelId, images)
        console.log(`Saved ${name} (${saved.slug}) → ${images.length} images ${amadeusId ? ' [AMADEUS]' : ''}`)
        success++
      } catch (e) {
        console.warn('Failed for', it.url, e?.message || e)
      }
      await sleep(200)
    }
    console.log(`Completed: ${success}/${listings.length} listings saved`)
    if (jobId) await db.from('job_runs').update({ status:'ok', finished_at: new Date().toISOString(), details: { saved: success, total: listings.length } }).eq('id', jobId)
  } catch (e) {
    console.error('Job failed', e)
    if (jobId) await db.from('job_runs').update({ status:'error', finished_at: new Date().toISOString(), details: { error: String(e?.message || e) } }).eq('id', jobId)
    process.exit(1)
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}

