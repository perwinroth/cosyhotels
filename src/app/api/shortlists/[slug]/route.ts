import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";
import { MAX_ITEMS, sanitizeTitle, tokenAuthorized } from "@/lib/savedLists";

// NEVER select email or edit_token here — this is the public read the list page renders from.
export async function GET(_: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const supabase = getServerSupabase();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  const { data, error } = await supabase.from("shortlists").select("slug,title,items,updated_at,created_at").eq("slug", slug).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(data);
}

// Add/remove an item, optionally rename. Requires `token` to match the row's edit_token — rows
// with no edit_token (legacy/anon, pre-v1) stay open (tokenAuthorized fails open in that case).
export async function PUT(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const supabase = getServerSupabase();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  const body = await req.json().catch(() => ({}));
  const add: string | undefined = typeof body.add === "string" ? body.add : undefined;
  const remove: string | undefined = typeof body.remove === "string" ? body.remove : undefined;
  const titleResult = sanitizeTitle(body.title);
  if (!titleResult.ok) return NextResponse.json({ error: titleResult.error }, { status: 400 });

  const { data, error } = await supabase.from("shortlists").select("items,edit_token").eq("slug", slug).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!tokenAuthorized(data.edit_token as string | null, body.token)) {
    return NextResponse.json({ error: "Invalid or missing edit token" }, { status: 403 });
  }

  let items: string[] = Array.isArray(data.items) ? data.items : [];
  if (add && !items.includes(add) && items.length < MAX_ITEMS) items.push(add);
  if (remove) items = items.filter((s) => s !== remove);
  const now = new Date().toISOString();
  const update: Record<string, unknown> = { items, updated_at: now };
  if (body.title !== undefined) update.title = titleResult.title;
  const { error: upErr } = await supabase.from("shortlists").update(update).eq("slug", slug);
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });
  return NextResponse.json({ slug, items, title: titleResult.title });
}

// Rename the list's title and/or its slug (the shareable URL). Same token gate as PUT.
export async function PATCH(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const supabase = getServerSupabase();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  const body = await req.json().catch(() => ({}));
  const newSlug: string | undefined = typeof body.newSlug === "string" ? body.newSlug : undefined;
  const titleResult = sanitizeTitle(body.title);
  if (!titleResult.ok) return NextResponse.json({ error: titleResult.error }, { status: 400 });

  const { data, error } = await supabase.from("shortlists").select("edit_token").eq("slug", slug).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!tokenAuthorized(data.edit_token as string | null, body.token)) {
    return NextResponse.json({ error: "Invalid or missing edit token" }, { status: 403 });
  }

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.title !== undefined) update.title = titleResult.title;
  if (newSlug && newSlug !== slug) {
    const { data: exists } = await supabase.from("shortlists").select("slug").eq("slug", newSlug).maybeSingle();
    if (exists) return NextResponse.json({ error: "Slug already taken" }, { status: 400 });
    update.slug = newSlug;
  }
  const { error: upErr } = await supabase.from("shortlists").update(update).eq("slug", slug);
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });
  return NextResponse.json({ slug: newSlug && newSlug !== slug ? newSlug : slug, title: titleResult.title });
}

