import { NextResponse } from "next/server";
import { hotels } from "@/data/hotels";
import { hotelAffiliateUrl, type Provider } from "@/lib/affiliates";
import { getServerSupabase } from "@/lib/supabase/server";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const hotel = hotels.find((h) => h.slug === params.id || h.id === params.id);
  if (!hotel) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Optional: Accept provider and clickId
  const url = new URL(_req.url);
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
      const referer = _req.headers.get("referer");
      const ua = _req.headers.get("user-agent");
      const ip = _req.headers.get("x-forwarded-for") || _req.headers.get("x-real-ip") || "";
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
