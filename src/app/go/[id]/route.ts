import { NextRequest, NextResponse } from "next/server";
// Curated hotels removed; resolve via Supabase or Places fallback
import { type Provider, bookingSearchUrl, expediaSearchUrl, buildAffiliateUrl } from "@/lib/affiliates";
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
        .select("id,slug,affiliate_url,website,name,city,country")
        .or(`slug.eq.${id},id.eq.${id}`)
        .single();
      if (data) {
        slug = String(data.slug);
        hotelId = String(data.id);
        // Optional: Accept provider and clickId
        const url = new URL(req.url);
        const providerParam = url.searchParams.get("provider");
        const isProvider = (p: string | null): p is Provider => !!p && ["generic","awin","cj","impact","booking","expedia"].includes(p);
        const pv = (isProvider(providerParam) ? providerParam : undefined) as Provider | undefined;
        // If a specific vendor is requested, compute deep link on the fly
        if (providerParam === 'booking') {
          const base = bookingSearchUrl({ name: String((data as any).name || ''), city: (data as any).city || null, country: (data as any).country || null });
          target = buildAffiliateUrl(base, { provider: 'generic' });
        } else if (providerParam === 'expedia') {
          const base = expediaSearchUrl({ name: String((data as any).name || ''), city: (data as any).city || null, country: (data as any).country || null });
          target = buildAffiliateUrl(base, { provider: 'generic' });
        } else {
          target = data.affiliate_url || data.website || "/";
        }
      }
    } catch {}
  }
  if (target === "/") {
    // If Places disabled or no website found, go home
    return NextResponse.redirect('/', { status: 302 });
  }

  // Optional: Accept provider and clickId
  const url2 = new URL(req.url);
  const providerParam2 = url2.searchParams.get("provider");
  const isProvider2 = (p: string | null): p is Provider => !!p && ["generic","awin","cj","impact","booking","expedia"].includes(p);
  const provider: Provider | undefined = isProvider2(providerParam2) ? providerParam2 : undefined;
  const clickId = url2.searchParams.get("clickId") || undefined;
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
