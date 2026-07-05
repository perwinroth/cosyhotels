import { NextResponse } from "next/server";
import { searchSite } from "@/lib/search";

// Unified homepage/header search autocomplete: hotels (by name) + cities (with a live guide).
// Backed by the shared src/lib/search.ts so the API and the /search results page never diverge.
export const runtime = "nodejs";
export const dynamic = "force-dynamic"; // per-query results, never cached

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q") || "";
  const { hotels, cities } = await searchSite(q);
  return NextResponse.json({ hotels, cities });
}
