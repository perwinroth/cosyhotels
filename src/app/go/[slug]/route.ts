import { NextResponse, type NextRequest } from "next/server";
import { hotels } from "@/data/hotels";
import { applyOverride, fetchOverrideFor } from "@/lib/overrides";
import { getDetails } from "@/lib/places";

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
    // Fallback for curated without affiliate: try a search to official site via Google
    const q = encodeURIComponent(`${h.name} ${h.city} official website`);
    return NextResponse.redirect(`https://www.google.com/search?q=${q}`, 302);
  }
  // Not curated: treat slug as Google Place ID and try to resolve website
  try {
    const d = await getDetails(slug);
    if (d?.website) return NextResponse.redirect(d.website, 302);
  } catch {}
  // Fallback to Google Maps place by ID even if details unavailable (e.g., missing API key)
  return NextResponse.redirect(`https://www.google.com/maps/place/?q=place_id:${encodeURIComponent(slug)}` , 302);
}
