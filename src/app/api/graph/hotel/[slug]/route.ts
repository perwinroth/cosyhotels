// D-0010 "Feelings Layer" probe: public, read-only single-hotel graph detail. Below-gate hotels
// return {below_bar:true} with no score (matches the site's own public posture); delisted/missing
// hotels 404. Thin wrapper over src/lib/graph/hotels.ts. NO email/PII.
import { NextResponse } from "next/server";
import { getGraphHotel } from "@/lib/graph/hotels";

export const runtime = "nodejs";

export async function GET(_request: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const result = await getGraphHotel(slug);
  if (result === null) return NextResponse.json({ error: "graph_unavailable" }, { status: 503 });
  if (result === "not_found") return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json(result, {
    headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" },
  });
}
