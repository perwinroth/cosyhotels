import { NextResponse } from "next/server";
import { hotels } from "@/data/hotels";
import { getImageForHotel } from "@/lib/hotelImages";

export async function GET() {
  const hasKey = !!process.env.GOOGLE_MAPS_API_KEY;
  if (!hasKey) return NextResponse.json({ ok: false, error: "GOOGLE_MAPS_API_KEY not set" }, { status: 500 });
  let ok = 0; let fail = 0;
  for (const h of hotels) {
    try {
      const url = await getImageForHotel(h.name, h.city, 800, h.slug, h.id);
      if (url) ok++; else fail++;
    } catch {
      fail++;
    }
  }
  return NextResponse.json({ ok: true, cached: ok, failed: fail });
}

