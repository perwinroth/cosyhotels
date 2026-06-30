// Blog listicle hotel selection. Honest by construction: we start from the hotels our AI scores
// HIGHEST for cosiness (score ≥ minScore), then surface the ones whose REAL signals + AI
// description match the post's use-case keywords. No hand-picking, no invented fit — a hotel only
// appears if its own data supports it. Mirrors the guides page gates (vision-vetted images, Latin
// names, public score floor) so the blog never shows anything the rest of the site wouldn't.
import type { SupabaseClient } from "@supabase/supabase-js";
import { isLatin, displayCity, displayCountry } from "@/lib/placeText";
import { stay22AllezUrl } from "@/lib/affiliates";

export type BlogPick = {
  slug: string; name: string; city: string; country: string;
  score: number; snippet: string; img: string | null; cta: string;
};

// The chains that occasionally clear our cosy bar — used by the "are chains ever cosy?" post.
const CHAIN_RE = /\b(marriott|hilton|hyatt|accor|radisson|kempinski|four seasons|ritz[- ]?carlton|intercontinental|sheraton|ibis|novotel|mercure|holiday inn|best western|wyndham|premier inn|travelodge|hampton|courtyard|doubletree|crowne plaza|ramada|sofitel|pullman|moxy|mama shelter|hoxton|citizenm|25hours|indigo|autograph|curio|tribute|design hotels)\b/i;

type SelectOpts = { re?: RegExp; chains?: boolean; minScore?: number; limit?: number; campaign?: string };

export async function selectBlogHotels(db: SupabaseClient, opts: SelectOpts): Promise<BlogPick[]> {
  const { re, chains, minScore = 6.5, limit = 12, campaign = "blog" } = opts;
  const { data } = await db
    .from("cosy_scores")
    .select("score,score_final,signals,description,hotel:hotel_id(id,slug,name,name_en,city,country,lat,lng)")
    .gte("score", minScore)
    .order("score", { ascending: false })
    .limit(1500);
  type Row = { score: number | null; score_final: number | null; signals: string[] | null; description: string | null; hotel: { id: string; slug: string | null; name: string | null; name_en?: string | null; city: string | null; country: string | null; lat: number | null; lng: number | null } | null };
  const rows = ((data || []) as unknown as Row[]).filter((r) => r.hotel && r.hotel.slug);

  const seenSlug = new Set<string>();
  const seenName = new Set<string>();
  const picks: Array<{ r: Row; s: number }> = [];
  for (const r of rows) {
    const h = r.hotel!;
    const name = String(h.name_en || h.name || "");
    if (!isLatin(name)) continue;
    const hay = `${(r.signals || []).join(" ")} ${r.description || ""}`;
    const ok = chains ? CHAIN_RE.test(name) : re ? re.test(hay) : true;
    if (!ok) continue;
    const slug = String(h.slug);
    const nkey = name.toLowerCase().replace(/[^a-z0-9]+/g, "");
    if (seenSlug.has(slug) || seenName.has(nkey)) continue;
    seenSlug.add(slug); seenName.add(nkey);
    const s = typeof r.score_final === "number" ? r.score_final : (typeof r.score === "number" ? r.score : 0);
    picks.push({ r, s });
    if (picks.length >= limit) break;
  }
  picks.sort((a, b) => b.s - a.s);

  // Vision-vetted images for the chosen hotels (same gate as everywhere else).
  const ids = picks.map((p) => String(p.r.hotel!.id));
  const imgMap = new Map<string, string>();
  if (ids.length) {
    const { data: imgRows } = await db
      .from("hotel_images")
      .select("hotel_id,url,created_at,vision_ok")
      .in("hotel_id", ids)
      .eq("vision_ok", true)
      .order("created_at", { ascending: false });
    for (const row of (imgRows || []) as Array<{ hotel_id: string | null; url: string | null }>) {
      const hid = row.hotel_id ? String(row.hotel_id) : "";
      const url = row.url ? String(row.url) : "";
      if (!hid || !url || url.includes("placehold.co")) continue;
      if (!imgMap.has(hid)) imgMap.set(hid, url);
    }
  }

  return picks.map(({ r, s }) => {
    const h = r.hotel!;
    const name = String(h.name_en || h.name || "");
    const city = displayCity(String(h.city || ""), "");
    const country = displayCountry(String(h.country || ""));
    const img = imgMap.get(String(h.id)) || null;
    return {
      slug: String(h.slug), name, city, country,
      score: Number(s.toFixed(1)),
      snippet: (r.description || "").trim(),
      img: img && !img.includes("placehold.co") ? img : null,
      cta: stay22AllezUrl({ name, city, country, lat: h.lat, lng: h.lng, campaign }),
    };
  });
}
