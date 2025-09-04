import type { Hotel } from "@/data/hotels";
import { site } from "@/config/site";

export type AffiliateHotelRecord = {
  id?: string;
  slug?: string;
  affiliateUrl?: string;
  price?: number;
};

export function mergeAffiliateData(base: Hotel[], records: AffiliateHotelRecord[]) {
  const byId = new Map<string, AffiliateHotelRecord>();
  const bySlug = new Map<string, AffiliateHotelRecord>();
  for (const r of records) {
    if (r.id) byId.set(r.id, r);
    if (r.slug) bySlug.set(r.slug, r);
  }
  return base.map((h) => {
    const r = byId.get(h.id) || bySlug.get(h.slug);
    if (!r) return h;
    return {
      ...h,
      affiliateUrl: r.affiliateUrl || h.affiliateUrl,
      price: typeof r.price === "number" ? r.price : h.price,
    };
  });
}

// Provider config (expand per network as needed)
export type Provider = "generic" | "awin" | "cj" | "impact";

const providerParams: Record<Provider, { subIdParam?: string }> = {
  generic: { subIdParam: "subid" },
  awin: { subIdParam: "clickref" },
  cj: { subIdParam: "sid" },
  impact: { subIdParam: "subId1" },
};

export function buildAffiliateUrl(baseUrl: string, opts?: { provider?: Provider; campaign?: string; content?: string; clickId?: string }) {
  const u = new URL(baseUrl);
  u.searchParams.set("utm_source", site.affiliate.source);
  u.searchParams.set("utm_medium", site.affiliate.medium);
  u.searchParams.set("utm_campaign", opts?.campaign || site.affiliate.campaign);
  if (opts?.content) u.searchParams.set("utm_content", opts.content);
  const p = providerParams[opts?.provider || "generic"];
  if (p.subIdParam && opts?.clickId) u.searchParams.set(p.subIdParam, String(opts.clickId));
  return u.toString();
}

export function hotelAffiliateUrl(hotel: Hotel, opts?: { provider?: Provider; campaign?: string; content?: string; clickId?: string }) {
  return buildAffiliateUrl(hotel.affiliateUrl, opts);
}
