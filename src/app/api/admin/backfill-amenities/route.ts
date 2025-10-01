import { NextResponse, after } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";

export const runtime = 'nodejs';
export const maxDuration = 180;

type HotelRow = { id: string; amenities: string[] | null; description: string | null };

const KEYWORDS = {
  rooftop: [/\brooftop\b/i, /\broof terrace\b/i, /\bdachterrasse\b/i, /\btoit-terrasse\b/i, /\bazotea\b/i, /\bterrazza sul tetto\b/i],
  spa: [/\bspa\b/i],
  sauna: [/\bsauna\b/i],
  pet: [/\bpet[- ]?friendly\b/i, /\bpets? allowed\b/i, /\bdogs?\b/i, /\bmascotas\b/i, /\bchiens?\b/i, /\bhunde\b/i],
};

const CANON: Record<string, string> = {
  'spa': 'Spa',
  'sauna': 'Sauna',
  'rooftop': 'Rooftop',
  'roof terrace': 'Rooftop',
  'dachterrasse': 'Rooftop',
  'toit-terrasse': 'Rooftop',
  'azotea': 'Rooftop',
  'pet-friendly': 'Pet-friendly',
  'pets allowed': 'Pet-friendly',
  'dog': 'Pet-friendly',
  'dogs': 'Pet-friendly',
  'mascotas': 'Pet-friendly',
};

function inferAmenities(desc: string | null | undefined): string[] {
  const d = (desc || '').toLowerCase();
  const add: string[] = [];
  const test = (re: RegExp) => re.test(d);
  if (KEYWORDS.rooftop.some(test)) add.push('Rooftop');
  if (KEYWORDS.spa.some(test)) add.push('Spa');
  if (KEYWORDS.sauna.some(test)) add.push('Sauna');
  if (KEYWORDS.pet.some(test)) add.push('Pet-friendly');
  // dedupe
  return Array.from(new Set(add));
}

function normalizeAmenityValues(list: string[] | null | undefined): string[] {
  if (!Array.isArray(list)) return [];
  const out = new Set<string>();
  for (const raw of list) {
    if (!raw) continue;
    const lc = String(raw).toLowerCase();
    const canon = CANON[lc];
    if (canon) out.add(canon);
    else out.add(raw); // keep unknowns as-is
  }
  return Array.from(out);
}

async function backfill(loopLimit = 5000, pageSize = 500) {
  const db = getServerSupabase();
  if (!db) return { error: 'Supabase not configured' } as const;
  let processed = 0, updated = 0;
  for (let from = 0; from < loopLimit; from += pageSize) {
    const to = from + pageSize - 1;
    const { data, error } = await db
      .from('hotels')
      .select('id, amenities, description')
      .range(from, to);
    if (error || !data || data.length === 0) break;
    const rows = data as unknown as HotelRow[];
    for (const row of rows) {
      processed++;
      const current = normalizeAmenityValues(row.amenities);
      const adds = inferAmenities(row.description);
      if (adds.length === 0) continue;
      const next = Array.from(new Set([...current, ...adds]));
      if (next.length !== current.length) {
        await db.from('hotels').update({ amenities: next }).eq('id', row.id);
        updated++;
      }
    }
    if (data.length < pageSize) break;
  }
  return { processed, updated } as const;
}

export async function GET() {
  after(async () => { try { await backfill(); } catch (e) { try { console.error('backfill_amenities_error', e); } catch {} } });
  return NextResponse.json({ scheduled: true }, { status: 202 });
}

export async function POST() {
  const res = await backfill();
  if ('error' in res) return NextResponse.json(res, { status: 500 });
  return NextResponse.json(res);
}
