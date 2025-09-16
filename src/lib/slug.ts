import slugify from "slugify";
import type { SupabaseClient } from "@supabase/supabase-js";

function cleanPart(s: string | null | undefined) {
  return slugify(String(s || "").trim(), { lower: true, strict: true });
}

async function isCityAmbiguous(db: SupabaseClient, city: string) {
  const { data, error } = await db
    .from("hotels")
    .select("country")
    .ilike("city", city)
    .limit(50);
  if (error || !data) return false;
  const countries = new Set((data as Array<{ country: string | null }>).map((r) => (r.country || "").toLowerCase()).filter(Boolean));
  return countries.size > 1;
}

async function ensureUnique(db: SupabaseClient, base: string) {
  const lower = base.toLowerCase();
  const { data } = await db.from("hotels").select("slug").ilike("slug", `${lower}%`).limit(200);
  const existing = new Set(((data || []) as Array<{ slug: string | null }>).map((r) => String(r.slug || "").toLowerCase()));
  if (!existing.has(lower)) return lower;
  for (let i = 2; i < 1000; i++) {
    const cand = `${lower}-${i}`;
    if (!existing.has(cand)) return cand;
  }
  return `${lower}-${Date.now()}`;
}

export async function generateHotelSlug(db: SupabaseClient, name: string, city: string | null, country: string | null) {
  const n = cleanPart(name);
  const c = cleanPart(city);
  const k = cleanPart(country);
  let base = c ? `${c}-${n}` : n;
  if (c) {
    const ambiguous = await isCityAmbiguous(db, city || "");
    if (ambiguous && k) base = `${k}-${base}`;
  } else if (k) {
    base = `${k}-${base}`;
  }
  return ensureUnique(db, base);
}

