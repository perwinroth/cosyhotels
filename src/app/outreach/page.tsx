// Hotel outreach queue: featured hotels that expose a social handle, each with a ready-to-send
// "you're featured" message + their Cosy Score badge + city-guide link. Sending these is the
// #1 lever for BOTH backlinks (SEO) and reposts (audience). Internal/noindexed.
import type { Metadata } from "next";
import { getServerSupabase } from "@/lib/supabase/server";
import { hotelPinImageUrl, type Slide } from "@/lib/social";
import { displayCity, isLatin } from "@/lib/placeText";
import { cityToSlug } from "@/lib/citySlug";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata: Metadata = { title: "Hotel outreach", robots: { index: false, follow: false } };

type Row = { hotel_id: string; score: number | null; score_final: number | null; hotel: { slug: string; name: string; name_en: string | null; city: string | null; instagram: string | null; website: string | null } | null };

export default async function OutreachPage() {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "https://gotcosy.com";
  const db = getServerSupabase();
  if (!db) return <div style={{ padding: 32, color: "#F3EEE6", background: "#0F1512" }}>Supabase not configured.</div>;

  const { data } = await db
    .from("cosy_scores")
    .select("hotel_id, score, score_final, hotel:hotel_id!inner(slug, name, name_en, city, instagram, website)")
    .gte("score", 5)
    .not("hotel.instagram", "is", null)
    .order("score", { ascending: false })
    .limit(150);

  const rows = (data || []) as unknown as Row[];
  const seen = new Set<string>();
  const hotels: Array<{ id: string; name: string; city: string; score: number; instagram: string; website: string | null }> = [];
  for (const r of rows) {
    const h = r.hotel; if (!h || !r.hotel_id) continue;
    const name = String(h.name_en || h.name || "").trim();
    if (!name || !isLatin(name) || seen.has(name)) continue;
    seen.add(name);
    hotels.push({ id: String(r.hotel_id), name, city: displayCity(h.city), score: Number((r.score_final ?? r.score) || 0), instagram: `@${String(h.instagram).replace(/^@/, "")}`, website: h.website });
  }

  const photo = new Map<string, string>();
  const ids = hotels.map((h) => h.id);
  for (let i = 0; i < ids.length; i += 150) {
    const { data: imgs } = await db.from("hotel_images").select("hotel_id,url").in("hotel_id", ids.slice(i, i + 150)).eq("vision_ok", true);
    for (const im of (imgs || []) as Array<{ hotel_id: string | null; url: string | null }>) {
      const hid = im.hotel_id ? String(im.hotel_id) : ""; const u = im.url || "";
      if (hid && u && !u.includes("placehold.co") && !photo.has(hid)) photo.set(hid, u);
    }
  }

  const card: React.CSSProperties = { background: "#16201A", border: "1px solid #243029", borderRadius: 12, padding: 16 };
  return (
    <div style={{ minHeight: "100vh", background: "#0F1512", color: "#F3EEE6", fontFamily: "Inter, system-ui, sans-serif", padding: "32px 20px" }}>
      <div style={{ maxWidth: 820, margin: "0 auto" }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0 }}>Hotel outreach</h1>
        <p style={{ color: "#9DA89F", marginTop: 8, fontSize: 14, lineHeight: 1.6 }}>
          {hotels.length} featured hotels with a public Instagram. DM/email each one their feature: they repost (audience) and often link back (the best SEO backlink you can get). Best scores first.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 22 }}>
          {hotels.map((h) => {
            const cityLink = `${base}/en/guides/${cityToSlug(h.city || "")}`;
            const ph = photo.get(h.id);
            const badge = ph ? hotelPinImageUrl(base, { name: h.name, city: h.city, score: h.score, photo: ph, instagram: h.instagram } as Slide) : "";
            const msg = `Hi ${h.instagram}! 👋 Your hotel just landed on Got Cosy's AI-ranked list of the cosiest stays in ${h.city || "your city"}, with a ${h.score.toFixed(1)}/10 Cosy Score for warmth & character.\n\n${badge ? `Shareable badge: ${badge}\n` : ""}You're featured here: ${cityLink}\n\nFeel free to repost, and a link back to your feature would mean a lot 🔥\nGot Cosy (gotcosy.com)`;
            return (
              <div key={h.id} style={card}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ color: "#D8B25A", fontWeight: 700 }}>{h.score.toFixed(1)}/10</span>
                  <span style={{ fontSize: 17, fontWeight: 700 }}>{h.name}</span>
                  <span style={{ color: "#9DA89F", fontSize: 13 }}>· {h.city}</span>
                  <a href={`https://instagram.com/${h.instagram.replace(/^@/, "")}`} target="_blank" rel="noreferrer" style={{ color: "#7FB4FF", fontSize: 13 }}>{h.instagram}</a>
                  {h.website && <a href={h.website} target="_blank" rel="noreferrer" style={{ color: "#6f7a72", fontSize: 12 }}>site ↗</a>}
                </div>
                <pre style={{ whiteSpace: "pre-wrap", fontFamily: "inherit", fontSize: 13, color: "#C7CFC8", margin: "10px 0 0", lineHeight: 1.5, background: "#0F1512", borderRadius: 8, padding: 12 }}>{msg}</pre>
              </div>
            );
          })}
          {hotels.length === 0 && <p style={{ color: "#9DA89F" }}>No hotels with handles yet; the social-handles sweep is still resolving them.</p>}
        </div>
      </div>
    </div>
  );
}
