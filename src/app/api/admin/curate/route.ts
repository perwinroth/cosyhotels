import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const supabase = getServerSupabase();
  if (!supabase) return NextResponse.redirect("/admin/candidates");
  const form = await req.formData();
  const hotelId = form.get("hotel_id") as string | null;
  if (!hotelId) return NextResponse.redirect("/admin/candidates");
  // Toggle
  const { data } = await supabase.from("hotels").select("curated").eq("id", hotelId).maybeSingle();
  const curated = !data?.curated;
  await supabase.from("hotels").update({ curated }).eq("id", hotelId);
  return NextResponse.redirect("/admin/candidates");
}

