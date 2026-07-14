import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";
import { generateEditToken, isValidEmail, normalizeLocale, sanitizeTitle } from "@/lib/savedLists";

function randomSlug(len = 6) {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let s = "";
  for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

// Create a saved list ("save a place to your plan"). No login: the email captured here is the
// creator's identity; the returned editToken is the ONLY thing that grants edit access later (via
// the private link, never displayed again). Both are stored but NEVER returned by GET.
export async function POST(req: Request) {
  try {
    const supabase = getServerSupabase();
    if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
    const body = await req.json().catch(() => ({}));
    const itemSlug: string | undefined = typeof body.itemSlug === "string" ? body.itemSlug : undefined;
    const email: unknown = body.email;

    if (!isValidEmail(email)) {
      return NextResponse.json({ error: "A valid email is required" }, { status: 400 });
    }
    const titleResult = sanitizeTitle(body.title);
    if (!titleResult.ok) return NextResponse.json({ error: titleResult.error }, { status: 400 });
    const locale = normalizeLocale(body.locale);

    // generate unique slug
    let slug = randomSlug();
    for (let i = 0; i < 5; i++) {
      const { data: exists } = await supabase.from("shortlists").select("slug").eq("slug", slug).maybeSingle();
      if (!exists) break;
      slug = randomSlug();
    }
    const items = itemSlug ? [itemSlug] : [];
    const now = new Date().toISOString();
    const editToken = generateEditToken();
    const { error } = await supabase.from("shortlists").insert({
      slug,
      title: titleResult.title,
      items,
      email: email as string,
      edit_token: editToken,
      locale,
      created_at: now,
      updated_at: now,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ slug, editToken });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
