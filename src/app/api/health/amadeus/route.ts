import { NextResponse } from "next/server";
import { amadeusSearchHotels } from "@/lib/vendors/amadeus";

export const runtime = 'nodejs';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const city = url.searchParams.get('city') || 'Paris';
    const list = await amadeusSearchHotels(city);
    const ok = Array.isArray(list) && list.length > 0;
    const sample = list.slice(0, 5).map((h) => ({ id: h.id, name: h.name || null }));
    return NextResponse.json({ ok, city, count: list.length, sample });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

