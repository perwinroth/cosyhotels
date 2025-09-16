import { getServerSupabase } from "@/lib/supabase/server";

type ScoreRow = { score: number; city: string | null; country: string | null };

function median(values: number[]) {
  if (!values.length) return 0;
  const arr = [...values].sort((a, b) => a - b);
  const mid = Math.floor(arr.length / 2);
  return arr.length % 2 === 0 ? (arr[mid - 1] + arr[mid]) / 2 : arr[mid];
}

function iqr(values: number[]) {
  if (values.length < 4) return 1; // guard
  const arr = [...values].sort((a, b) => a - b);
  const q1 = arr[Math.floor(arr.length * 0.25)];
  const q3 = arr[Math.floor(arr.length * 0.75)];
  const i = q3 - q1;
  return i > 0 ? i : 1;
}

export async function computeAndPersistNormalizerStats() {
  const db = getServerSupabase();
  if (!db) return { cities: 0, countries: 0 };
  const { data, error } = await db
    .from("cosy_scores")
    .select("score, hotel:hotel_id (city,country)");
  if (error || !data) return { cities: 0, countries: 0 };
  const rows = (data as unknown as { score: number; hotel: { city: string | null; country: string | null } | null }[])
    .map((r) => ({ score: Number(r.score) || 0, city: (r.hotel?.city || '') as string, country: (r.hotel?.country || '') as string }));

  const byCity = new Map<string, number[]>();
  const byCountry = new Map<string, number[]>();
  for (const r of rows) {
    const c = (r.city || '').trim();
    const k = (r.country || '').trim();
    if (c) { const a = byCity.get(c) || []; a.push(r.score); byCity.set(c, a); }
    if (k) { const a = byCountry.get(k) || []; a.push(r.score); byCountry.set(k, a); }
  }

  const cityRecords = Array.from(byCity.entries()).map(([key, vals]) => ({ scope: 'city', key, median: median(vals), iqr: iqr(vals), n: vals.length }));
  const countryRecords = Array.from(byCountry.entries()).map(([key, vals]) => ({ scope: 'country', key, median: median(vals), iqr: iqr(vals), n: vals.length }));

  // Replace all stats (best-effort)
  await db.from("normalizer_stats").delete().neq("key", "");
  if (cityRecords.length) await db.from("normalizer_stats").insert(cityRecords);
  if (countryRecords.length) await db.from("normalizer_stats").insert(countryRecords);
  return { cities: cityRecords.length, countries: countryRecords.length };
}

export function normalizedScore(base: number, medianVal: number, iqrVal: number, k = 1.4) {
  const denom = (iqrVal / 1.349) || 1;
  const z = (base - medianVal) / denom;
  const sig = 1 / (1 + Math.exp(-k * z));
  return Math.max(0, Math.min(10, sig * 10));
}
