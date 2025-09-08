import { NextResponse } from "next/server";
import { hotels } from "@/data/hotels";
import { applyOverride, fetchOverrideFor } from "@/lib/overrides";

export async function GET(
  _req: Request,
  { params }: { params: { slug: string } }
) {
  const base = hotels.find((h) => h.slug === params.slug);
  if (base) {
    const override = await fetchOverrideFor(params.slug);
    const h = applyOverride(base, override);
    if (h.affiliateUrl) return NextResponse.redirect(h.affiliateUrl, 302);
  }
  // Not found or no affiliate URL; go to homepage
  return NextResponse.redirect("/", 302);
}

