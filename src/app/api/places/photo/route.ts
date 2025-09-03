import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const ref = url.searchParams.get("ref");
  const maxwidth = url.searchParams.get("maxwidth") || "800";
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!ref || !key) return new NextResponse("Bad Request", { status: 400 });
  const photoEndpoint = `https://maps.googleapis.com/maps/api/place/photo?${new URLSearchParams({ photoreference: ref, maxwidth, key }).toString()}`;
  const res = await fetch(photoEndpoint, { redirect: "follow" });
  if (!res.ok) return new NextResponse("Not found", { status: 404 });
  const contentType = res.headers.get("content-type") || "image/jpeg";
  const buffer = Buffer.from(await res.arrayBuffer());
  return new NextResponse(buffer, { status: 200, headers: { "content-type": contentType, "cache-control": "public, max-age=86400" } });
}

