// D-0010 "Feelings Layer" probe: public, read-only, paginated list of live cosy-scored hotels.
// Thin wrapper over src/lib/graph/hotels.ts — no gating logic duplicated here. NO email/PII.
import { NextResponse } from "next/server";
import { listGraphHotels, DEFAULT_LIMIT, MAX_LIMIT } from "@/lib/graph/hotels";

export const runtime = "nodejs";

function numParam(sp: URLSearchParams, key: string): number | undefined {
  const raw = sp.get(key);
  if (raw == null || raw === "") return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const result = await listGraphHotels({
    city: searchParams.get("city") || undefined,
    country: searchParams.get("country") || undefined,
    minScore: numParam(searchParams, "min_score"),
    limit: numParam(searchParams, "limit") ?? DEFAULT_LIMIT,
    offset: numParam(searchParams, "offset") ?? 0,
  });
  if (!result) return NextResponse.json({ error: "graph_unavailable" }, { status: 503 });
  return NextResponse.json(
    { ...result, max_limit: MAX_LIMIT },
    { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" } },
  );
}
