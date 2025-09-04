import type { Hotel } from "@/data/hotels";
import { getServerSupabase } from "@/lib/supabase/server";

export type AffiliateOverride = {
  hotel_id: string | null;
  slug: string | null;
  affiliate_url: string | null;
  price: number | null;
  provider: string | null;
};

export async function fetchOverrides(): Promise<AffiliateOverride[] | null> {
  const supabase = getServerSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase.from("affiliate_overrides").select("hotel_id,slug,affiliate_url,price,provider");
  if (error) {
    console.error("supabase_overrides_error", error);
    return null;
  }
  return data || [];
}

export async function fetchOverrideFor(slugOrId: string): Promise<AffiliateOverride | null> {
  const supabase = getServerSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("affiliate_overrides")
    .select("hotel_id,slug,affiliate_url,price,provider")
    .or(`slug.eq.${slugOrId},hotel_id.eq.${slugOrId}`)
    .maybeSingle();
  if (error) {
    console.error("supabase_override_error", error);
    return null;
  }
  return data || null;
}

export function applyOverrides(base: Hotel[], overrides: AffiliateOverride[] | null) {
  if (!overrides || overrides.length === 0) return base;
  const bySlug = new Map(overrides.filter(o => o.slug).map(o => [o.slug!, o]));
  const byId = new Map(overrides.filter(o => o.hotel_id).map(o => [o.hotel_id!, o]));
  return base.map(h => {
    const o = byId.get(h.id) || bySlug.get(h.slug);
    if (!o) return h;
    return {
      ...h,
      affiliateUrl: o.affiliate_url || h.affiliateUrl,
      price: typeof o.price === "number" ? o.price : h.price,
    };
  });
}

export function applyOverride(base: Hotel, override: AffiliateOverride | null) {
  if (!override) return base;
  return {
    ...base,
    affiliateUrl: override.affiliate_url || base.affiliateUrl,
    price: typeof override.price === "number" ? override.price : base.price,
  };
}
