import { NextResponse } from "next/server";
import { getDetails } from "@/lib/places";
import { cosyScore } from "@/lib/scoring/cosy";
import { getServerSupabase } from "@/lib/supabase/server";
import slugify from "slugify";

export async function POST(req: Request) {
  const supabase = getServerSupabase();
  if (!supabase) return NextResponse.redirect("/admin/candidates");

  // Accept form or JSON
  let placeId: string | null = null;
  const contentType = req.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const body = await req.json();
    placeId = body?.place_id || body?.id || null;
  } else {
    const form = await req.formData();
    placeId = (form.get("place_id") as string) || null;
  }
  if (!placeId) return NextResponse.redirect("/en/hotels");

  const d = await getDetails(placeId);
  if (!d) return NextResponse.redirect("/en/hotels");

  const slug = slugify(d.name || placeId, { lower: true, strict: true });
  const city = d.formatted_address?.split(",")[d.formatted_address.split(",").length - 2]?.trim() || null;
  const country = d.formatted_address?.split(",")[d.formatted_address.split(",").length - 1]?.trim() || null;

  // Derive simple amenities from summary text
  const summary = d.editorial_summary?.overview || "";
  const summaryLower = summary.toLowerCase();
  const am: string[] = [];
  if (summaryLower.includes("spa")) am.push("Spa");
  if (summaryLower.includes("sauna")) am.push("Sauna");
  if (summaryLower.includes("fireplace")) am.push("Fireplace");
  if (summaryLower.includes("bath")) am.push("Bathtub");
  if (summaryLower.includes("rooftop")) am.push("Rooftop");
  if (summaryLower.includes("garden")) am.push("Garden");
  if (summaryLower.includes("bar")) am.push("Bar");
  if (summaryLower.includes("restaurant")) am.push("Restaurant");

  const { data: hotel, error } = await supabase
    .from("hotels")
    .upsert({
      source: "google-places",
      source_id: d.place_id,
      slug,
      name: d.name,
      address: d.formatted_address || null,
      city,
      country,
      lat: d.geometry?.location.lat ?? null,
      lng: d.geometry?.location.lng ?? null,
      rating: d.rating ? Number((d.rating * 2).toFixed(1)) : null, // convert 5-star scale to 10
      reviews_count: d.user_ratings_total ?? null,
      rooms_count: null,
      amenities: am.length ? am : null,
      description: summary || null,
      website: d.website || null,
      affiliate_url: null,
      updated_at: new Date().toISOString(),
    }, { onConflict: "slug" })
    .select("id")
    .single();
  if (error) return NextResponse.redirect("/en/hotels");

  // Compute cosy score for this hotel
  const score = cosyScore({
    rating: d.rating ? d.rating * 2 : undefined,
    amenities: am,
    description: `${d.name}. ${summary}`,
  });
  await supabase.from("cosy_scores").upsert({ hotel_id: hotel.id, score, computed_at: new Date().toISOString() }, { onConflict: "hotel_id" });

  // Save first image reference, if any (as proxied URL for later use)
  const pref = d.photos?.[0]?.photo_reference;
  if (pref) {
    const url = `/api/places/photo?ref=${encodeURIComponent(pref)}&maxwidth=1200`;
    await supabase.from("hotel_images").insert({ hotel_id: hotel.id, url }).throwOnError();
  }

  // Redirect back to candidates page
  return NextResponse.redirect("/admin/candidates");
}
