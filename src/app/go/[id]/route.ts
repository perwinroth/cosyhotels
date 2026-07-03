import { NextRequest, NextResponse } from "next/server";
// Curated hotels removed; resolve via Supabase or Places fallback
import { type Provider, bookingSearchUrl, expediaSearchUrl, buildAffiliateUrl } from "@/lib/affiliates";
import { getServerSupabase } from "@/lib/supabase/server";
// no Places usage in go redirect

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const supabase = getServerSupabase();
  // Fallback redirect MUST be absolute — NextResponse.redirect() throws on a relative URL (that was
  // the 5xx: any not-found /go/* hit `redirect("/")` and 500'd).
  const home = () => NextResponse.redirect(new URL("/", req.url), { status: 302 });
  let target = "";
  let slug = id;
  let hotelId: string | undefined;
  if (supabase) {
    try {
      // `id` is a hotel slug OR a uuid. Comparing a non-uuid string to the uuid `id` column errors
      // at the DB (that 500'd /go/30121-venezia-…, an old slug), so only match id.eq for real uuids.
      const isUuid = UUID_RE.test(id);
      let { data } = await supabase
        .from("hotels")
        .select("id,slug,affiliate_url,website,name,city,country")
        .or(isUuid ? `slug.eq.${id},id.eq.${id}` : `slug.eq.${id}`)
        .maybeSingle();
      // Old/reslugged slug? resolve via hotel_slug_redirects so the affiliate link still works.
      if (!data && !isUuid) {
        const { data: redir } = await supabase.from("hotel_slug_redirects").select("new_slug").eq("old_slug", id).maybeSingle();
        if (redir?.new_slug) {
          ({ data } = await supabase
            .from("hotels")
            .select("id,slug,affiliate_url,website,name,city,country")
            .eq("slug", redir.new_slug)
            .maybeSingle());
        }
      }
      if (data) {
        type Row = { id: string; slug: string; affiliate_url: string | null; website: string | null; name: string | null; city: string | null; country: string | null };
        const h = data as unknown as Row;
        slug = String(h.slug);
        hotelId = String(h.id);
        // Optional: Accept provider and clickId
        const url = new URL(req.url);
        const vendorParam = url.searchParams.get("provider"); // vendor: booking|expedia
        const networkParam = url.searchParams.get("network"); // network: impact|awin|cj|generic
        const isNetwork = (p: string | null): p is Provider => !!p && ["generic","awin","cj","impact"].includes(p);
        const network: Provider = isNetwork(networkParam) ? networkParam : 'generic';
        // If a specific vendor is requested, compute deep link on the fly
        if (vendorParam === 'booking') {
          const base = bookingSearchUrl({ name: String(h.name || ''), city: h.city || null, country: h.country || null });
          target = buildAffiliateUrl(base, { provider: network });
        } else if (vendorParam === 'expedia') {
          const base = expediaSearchUrl({ name: String(h.name || ''), city: h.city || null, country: h.country || null });
          target = buildAffiliateUrl(base, { provider: network });
        } else {
          target = h.affiliate_url || h.website || "";
        }
      }
    } catch (e) {
      console.error("go_lookup_error", e);
    }
  }
  // No usable target (hotel not found, no website/affiliate) → home (absolute URL).
  if (!target) return home();
  // Absolutize the target so NextResponse.redirect never throws on a relative/malformed value.
  let dest: URL;
  try {
    dest = new URL(target, req.url);
  } catch {
    return home();
  }

  // Optional: Accept provider and clickId
  const url2 = new URL(req.url);
  const networkParam2 = url2.searchParams.get("network");
  const isNetwork2 = (p: string | null): p is Provider => !!p && ["generic","awin","cj","impact"].includes(p);
  const provider: Provider | undefined = isNetwork2(networkParam2) ? networkParam2 : undefined;
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

  return NextResponse.redirect(dest, { status: 302 });
}
