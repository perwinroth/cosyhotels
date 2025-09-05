import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";

function randomSlug(len = 6) {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let s = "";
  for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

export async function POST(req: Request) {
  try {
    const supabase = getServerSupabase();
    if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
    const body = await req.json().catch(() => ({}));
    const itemSlug: string | undefined = body.itemSlug;
    const title: string | undefined = body.title;

    // generate unique slug
    let slug = randomSlug();
    if (body.slug && typeof body.slug === "string") slug = body.slug.toLowerCase();
    for (let i = 0; i < 5; i++) {
      const { data: exists } = await supabase.from("shortlists").select("slug").eq("slug", slug).maybeSingle();
      if (!exists) break;
      slug = randomSlug();
    }
    const items = itemSlug ? [itemSlug] : [];
    const now = new Date().toISOString();
    const { error } = await supabase.from("shortlists").insert({ slug, title, items, created_at: now, updated_at: now });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ slug });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
