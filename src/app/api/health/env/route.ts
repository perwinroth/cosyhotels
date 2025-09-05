import { NextResponse } from "next/server";

export async function GET() {
  const hasGoogle = !!process.env.GOOGLE_MAPS_API_KEY;
  const hasSupabase = !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY;
  return NextResponse.json({ googleMaps: hasGoogle, supabase: hasSupabase });
}

