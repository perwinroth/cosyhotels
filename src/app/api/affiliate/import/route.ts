import { NextResponse } from "next/server";
import { hotels } from "@/data/hotels";
import { mergeAffiliateData, type AffiliateHotelRecord } from "@/lib/affiliates";
import { getServerSupabase } from "@/lib/supabase/server";

export async function POST(req: Request) {
  try {
    const payload = (await req.json()) as { records: AffiliateHotelRecord[] };
    if (!payload || !Array.isArray(payload.records)) {
      return NextResponse.json({ error: "Expected { records: AffiliateHotelRecord[] }" }, { status: 400 });
    }
    const merged = mergeAffiliateData(hotels, payload.records);

    const supabase = getServerSupabase();
    if (!supabase) {
      // No persistence available; return merged preview only
      return NextResponse.json({ results: merged, persisted: false });
    }
    // Upsert overrides by (slug or hotel_id)
    const rows = payload.records.map((r) => ({
      hotel_id: r.id || null,
      slug: r.slug || null,
      affiliate_url: r.affiliateUrl || null,
      price: typeof r.price === "number" ? r.price : null,
    }));
    const { error } = await supabase.from("affiliate_overrides").upsert(rows, { onConflict: "slug,hotel_id" });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ results: merged, persisted: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Bad Request" }, { status: 400 });
  }
}
