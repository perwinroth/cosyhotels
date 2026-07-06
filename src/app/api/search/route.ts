import { NextResponse } from "next/server";
import { searchSite } from "@/lib/search";

// Unified homepage/header search autocomplete: hotels (by name) + cities (live guide) + countries
// (live hub). Backed by the shared src/lib/search.ts so the API and the /search results page never
// diverge. Not logged here — logging happens once per submitted search on the /search page, to avoid
// recording every debounced keystroke.
export const runtime = "nodejs";
export const dynamic = "force-dynamic"; // per-query results, never cached

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q") || "";
  const { hotels, cities, countries } = await searchSite(q);
  return NextResponse.json({ hotels, cities, countries });
}
