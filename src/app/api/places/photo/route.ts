import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const ref = searchParams.get("ref");
  const maxwidth = searchParams.get("maxwidth") || "800";
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!ref || !key) return new Response("Bad Request", { status: 400 });

  const url = new URL("https://maps.googleapis.com/maps/api/place/photo");
  url.searchParams.set("photo_reference", ref);
  url.searchParams.set("maxwidth", maxwidth);
  url.searchParams.set("key", key);

  const res = await fetch(url.toString(), { redirect: "follow" });
  if (!res.ok) return new Response("Not Found", { status: 404 });

  // Stream image back without exposing API key
  const headers = new Headers();
  const ct = res.headers.get("content-type") || "image/jpeg";
  headers.set("content-type", ct);
  // Cache for a day on CDN, allow browser to cache as well
  headers.set("cache-control", "public, max-age=86400, s-maxage=86400, stale-while-revalidate=86400");
  return new Response(res.body, { status: 200, headers });
}
