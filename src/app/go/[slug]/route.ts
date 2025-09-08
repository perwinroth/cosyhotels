import { NextResponse, type NextRequest } from "next/server";
import { hotels } from "@/data/hotels";
import { applyOverride, fetchOverrideFor } from "@/lib/overrides";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ slug: string }> }
) {
  const { slug } = await ctx.params;
  const base = hotels.find((h) => h.slug === slug);
  if (base) {
    const override = await fetchOverrideFor(slug);
    const h = applyOverride(base, override);
    if (h.affiliateUrl) return NextResponse.redirect(h.affiliateUrl, 302);
  }
  // Not found or no affiliate URL; go to homepage
  return NextResponse.redirect("/", 302);
}
