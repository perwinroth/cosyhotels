import { NextRequest, NextResponse } from "next/server";
import { hotels } from "@/data/hotels";
import { hotelAffiliateUrl, type Provider } from "@/lib/affiliates";
import { getServerSupabase } from "@/lib/supabase/server";
import { getDetails } from "@/lib/places";

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const hotel = hotels.find((h) => h.slug === id || h.id === id);
  if (!hotel) {
    // Treat id as Google Place ID: try to resolve website; fallback to Google Maps place URL
    try {
      const d = await getDetails(id);
      if (d?.website) return NextResponse.redirect(d.website, { status: 302 });
    } catch {}
    return NextResponse.redirect(`https://www.google.com/maps/place/?q=place_id:${encodeURIComponent(id)}`, { status: 302 });
  }

  // Optional: Accept provider and clickId
  const url = new URL(req.url);
  const providerParam = url.searchParams.get("provider");
  const isProvider = (p: string | null): p is Provider => !!p && ["generic","awin","cj","impact"].includes(p);
  const provider: Provider | undefined = isProvider(providerParam) ? providerParam : undefined;
  const clickId = url.searchParams.get("clickId") || undefined;
  const target = hotelAffiliateUrl(hotel, {
    provider,
    content: "cta",
    clickId: clickId || undefined,
  });

  // Log click (best-effort)
  const supabase = getServerSupabase();
  if (supabase) {
    try {
      const referer = req.headers.get("referer");
      const ua = req.headers.get("user-agent");
      const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "";
      await supabase.from("affiliate_clicks").insert({
        hotel_id: hotel.id,
        slug: hotel.slug,
        target_url: target,
        provider: provider || null,
        click_id: clickId || null,
        user_agent: ua,
        referer,
        ip,
      });
    } catch (e) {
      console.error("affiliate_click_log_error", e);
    }
  }

  return NextResponse.redirect(target, { status: 302 });
}
