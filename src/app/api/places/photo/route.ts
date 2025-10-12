import { NextRequest, NextResponse } from "next/server";
import { placeholderUrl } from "@/lib/image";

export const runtime = 'nodejs';

// Backward compatibility route for old /api/places/photo URLs stored in DB.
// If Google Places is disabled or key missing, redirect to a raster placeholder
// to avoid 400s from Next/Image optimizer.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const ref = searchParams.get("ref");
  const maxwidth = searchParams.get("maxwidth") || "800";
  const key = process.env.GOOGLE_MAPS_API_KEY;

  if (!ref || !key) {
    return NextResponse.redirect(placeholderUrl, { status: 302 });
  }
  try {
    const url = new URL("https://maps.googleapis.com/maps/api/place/photo");
    url.searchParams.set("photo_reference", ref);
    url.searchParams.set("maxwidth", maxwidth);
    url.searchParams.set("key", key);
    const res = await fetch(url.toString(), { redirect: "follow" });
    if (!res.ok) return NextResponse.redirect(placeholderUrl, { status: 302 });
    const headers = new Headers();
    const ct = res.headers.get("content-type") || "image/jpeg";
    headers.set("content-type", ct);
    headers.set("cache-control", "public, max-age=86400, s-maxage=86400, stale-while-revalidate=86400");
    return new NextResponse(res.body, { status: 200, headers });
  } catch {
    return NextResponse.redirect(placeholderUrl, { status: 302 });
  }
}

