import { NextRequest, NextResponse } from "next/server";
// Curated hotels removed; resolve via Supabase or Places fallback
import { type Provider } from "@/lib/affiliates";
import { getServerSupabase } from "@/lib/supabase/server";
import { getDetails } from "@/lib/places";

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const supabase = getServerSupabase();
  let target = "/";
  let slug = id;
  let hotelId: string | undefined;
  if (supabase) {
    try {
      const { data } = await supabase
        .from("hotels")
        .select("id,slug,affiliate_url,website")
        .or(`slug.eq.${id},id.eq.${id}`)
        .single();
      if (data) {
        slug = String(data.slug);
        hotelId = String(data.id);
        target = data.affiliate_url || data.website || "/";
      }
    } catch {}
  }
  if (target === "/") {
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
  // target precomputed from Supabase (affiliate_url or website)

  // Log click (best-effort)
  if (supabase && hotelId) {
    try {
      const referer = req.headers.get("referer");
      const ua = req.headers.get("user-agent");
      const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "";
      await supabase.from("affiliate_clicks").insert({
        hotel_id: hotelId,
        slug,
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
