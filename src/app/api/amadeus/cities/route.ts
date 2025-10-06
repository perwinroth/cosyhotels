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
    const j = await r.json();
    const out = (Array.isArray(j?.data) ? j.data : []).map((c: any) => ({
      city: String(c?.address?.cityName || c?.iataCode || ''),
      country: String(c?.address?.countryCode || ''),
      iata: String(c?.iataCode || ''),
    })).filter((x: any) => x.city && x.country);
    return NextResponse.json({ results: out.slice(0, 8) });
  } catch {
    return NextResponse.json({ results: [] });
  }
}

