import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";

export async function GET(_: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const supabase = getServerSupabase();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  const { data, error } = await supabase.from("shortlists").select("slug,title,items,updated_at,created_at").eq("slug", slug).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(data);
}

export async function PUT(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const supabase = getServerSupabase();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  const body = await req.json().catch(() => ({}));
  const add: string | undefined = body.add;
  const remove: string | undefined = body.remove;
  const title: string | undefined = body.title;
  const { data, error } = await supabase.from("shortlists").select("items").eq("slug", slug).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  let items: string[] = Array.isArray(data.items) ? data.items : [];
  if (add && !items.includes(add)) items.push(add);
  if (remove) items = items.filter((s) => s !== remove);
  const now = new Date().toISOString();
  const { error: upErr } = await supabase.from("shortlists").update({ items, title, updated_at: now }).eq("slug", slug);
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });
  return NextResponse.json({ slug, items, title });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const supabase = getServerSupabase();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  const body = await req.json().catch(() => ({}));
  const newSlug: string | undefined = body.newSlug;
  const newTitle: string | undefined = body.title;
  if (!newSlug) return NextResponse.json({ error: "newSlug required" }, { status: 400 });
  // Ensure new slug doesn't exist
  const { data: exists } = await supabase.from("shortlists").select("slug").eq("slug", newSlug).maybeSingle();
  if (exists) return NextResponse.json({ error: "Slug already taken" }, { status: 400 });
  // Update primary key
  const { error: upErr } = await supabase.from("shortlists").update({ slug: newSlug, title: newTitle }).eq("slug", slug);
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });
  return NextResponse.json({ slug: newSlug, title: newTitle });
}

