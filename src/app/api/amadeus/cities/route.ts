import { NextResponse } from "next/server";

export const runtime = 'nodejs';

async function getToken(): Promise<string | null> {
  const base = process.env.AMADEUS_API_BASE || 'https://test.api.amadeus.com';
  const key = process.env.AMADEUS_API_KEY;
  const secret = process.env.AMADEUS_API_SECRET;
  if (!key || !secret) return null;
  const res = await fetch(`${base}/v1/security/oauth2/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'client_credentials', client_id: key, client_secret: secret }).toString(),
    cache: 'no-store',
  });
  if (!res.ok) return null;
  const j = await res.json();
  return (j && typeof j.access_token === 'string') ? j.access_token : null;
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const q = url.searchParams.get('q') || '';
    if (!q.trim()) return NextResponse.json({ results: [] });
    const token = await getToken();
    if (!token) return NextResponse.json({ results: [] });
    const base = process.env.AMADEUS_API_BASE || 'https://test.api.amadeus.com';
    const r = await fetch(`${base}/v1/reference-data/locations?subType=CITY&keyword=${encodeURIComponent(q)}`, {
      headers: { authorization: `Bearer ${token}` }, next: { revalidate: 3600 }
    });
    if (!r.ok) return NextResponse.json({ results: [] });
    const j: unknown = await r.json();
    type RawRec = { iataCode?: unknown; address?: { cityName?: unknown; countryCode?: unknown } | unknown };
    const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
    const str = (v: unknown): string => (typeof v === 'string' ? v : (typeof v === 'number' ? String(v) : ''));
    const arr: unknown[] = isObj(j) && Array.isArray((j as { data?: unknown }).data)
      ? ((j as { data: unknown[] }).data)
      : [];
    const out = arr.map((rec): { city: string; country: string; iata: string } | null => {
      if (!isObj(rec)) return null;
      const r = rec as RawRec;
      const iata = str(r.iataCode);
      let city = '';
      let country = '';
      if (isObj(r.address)) {
        const addr = r.address as { cityName?: unknown; countryCode?: unknown };
        city = str(addr.cityName);
        country = str(addr.countryCode);
      }
      if (!city) city = iata;
      if (!city || !country) return null;
      return { city, country, iata };
    }).filter((x): x is { city: string; country: string; iata: string } => !!x);
    return NextResponse.json({ results: out.slice(0, 8) });
  } catch {
    return NextResponse.json({ results: [] });
  }
}
