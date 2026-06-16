import { NextResponse } from "next/server";

export const runtime = 'nodejs';

// Free city autocomplete via OpenStreetMap Nominatim (no API key, no Amadeus).
// Returns { results: [{ city, country, iata? }] } — same shape the SearchBar expects.
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const q = (url.searchParams.get('q') || '').trim();
    if (!q) return NextResponse.json({ results: [] });

    const nomi = new URL('https://nominatim.openstreetmap.org/search');
    nomi.searchParams.set('q', q);
    nomi.searchParams.set('format', 'jsonv2');
    nomi.searchParams.set('addressdetails', '1');
    nomi.searchParams.set('limit', '8');
    // Bias toward settlements (cities/towns/villages)
    nomi.searchParams.set('featuretype', 'city');

    const r = await fetch(nomi.toString(), {
      headers: {
        'User-Agent': 'cosyhotels/1.0 (+https://www.cosyhotelroom.com; city autocomplete)',
        accept: 'application/json',
      },
      next: { revalidate: 86400 },
    });
    if (!r.ok) return NextResponse.json({ results: [] });
    const j: unknown = await r.json();
    if (!Array.isArray(j)) return NextResponse.json({ results: [] });

    const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
    const str = (v: unknown): string => (typeof v === 'string' ? v : '');

    const seen = new Set<string>();
    const out: Array<{ city: string; country: string }> = [];
    for (const rec of j) {
      if (!isObj(rec)) continue;
      const addr = isObj(rec.address) ? rec.address as Record<string, unknown> : {};
      const city =
        str(addr.city) || str(addr.town) || str(addr.village) ||
        str(addr.municipality) || str(rec.name);
      const country = str(addr.country);
      if (!city || !country) continue;
      const key = `${city}|${country}`.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ city, country });
      if (out.length >= 8) break;
    }
    return NextResponse.json({ results: out });
  } catch {
    return NextResponse.json({ results: [] });
  }
}
