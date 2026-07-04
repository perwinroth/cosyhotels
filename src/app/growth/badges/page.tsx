// Badge outreach — kanban board of the top ~2.3% hotels (Cosy Index, score ≥ 7.0) with a public
// contact. Ports the query + pitch from /badge-outreach and hands it to the client <BadgeBoard>.
// Renders inside the /growth shell layout: heading + board.
import type { Metadata } from "next";
import { getServerSupabase } from "@/lib/supabase/server";
import { displayCity, isLatin } from "@/lib/placeText";
import { cityToSlug } from "@/lib/citySlug";
import BadgeBoard, { type BadgeBoardRow } from "@/components/growth/BadgeBoard";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata: Metadata = { title: "Badge outreach", robots: { index: false, follow: false } };

const INDEX_MIN = 7.0; // the Cosy Index tier — mirrors /cosy-index
type Row = { hotel_id: string; score: number | null; score_final: number | null; hotel: { slug: string; name: string; name_en: string | null; city: string | null; instagram: string | null; website: string | null } | null };

export default async function GrowthBadgesPage() {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "https://gotcosy.com";
  const db = getServerSupabase();
  if (!db) return <p style={{ color: "var(--muted)" }}>Supabase not configured.</p>;

  const [{ data }, { count: totalScored }] = await Promise.all([
    db.from("cosy_scores")
      .select("hotel_id, score, score_final, hotel:hotel_id!inner(slug, name, name_en, city, instagram, website)")
      .gte("score", INDEX_MIN).order("score", { ascending: false }).limit(400),
    db.from("cosy_scores").select("*", { count: "exact", head: true }),
  ]);

  const rows = (data || []) as unknown as Row[];
  const seen = new Set<string>();
  const hotels: Array<{ id: string; slug: string; name: string; city: string; score: number; channel: string }> = [];
  for (const r of rows) {
    const h = r.hotel; if (!h || !r.hotel_id) continue;
    const name = String(h.name_en || h.name || "").trim();
    if (!name || !isLatin(name) || seen.has(name)) continue;
    const ig = h.instagram ? `@${String(h.instagram).replace(/^@/, "")}` : null;
    const site = h.website && /^https?:/.test(h.website) ? h.website : null;
    if (!ig && !site) continue; // no way to reach them → skip
    seen.add(name);
    hotels.push({ id: String(r.hotel_id), slug: h.slug, name, city: displayCity(h.city), score: Number((r.score_final ?? r.score) || 0), channel: ig ? "instagram" : "website" });
  }

  const statusById = new Map<string, string>();
  if (hotels.length) {
    const { data: st } = await db.from("hotel_outreach").select("hotel_id,status").in("hotel_id", hotels.map((h) => h.id));
    for (const s of (st || []) as Array<{ hotel_id: string; status: string }>) statusById.set(String(s.hotel_id), s.status);
  }

  const totalTxt = (totalScored || 17000).toLocaleString();
  const built: BadgeBoardRow[] = hotels.map((h) => {
    const badgeLink = `${base}/en/hotels/${h.slug}?badge`;
    const cityLink = `${base}/en/guides/${cityToSlug(h.city || "")}`;
    const pitch = `Hi! 👋 Out of the ${totalTxt} hotels we've AI-scored for cosiness, ${h.name} just made the Cosy Index — the cosiest ~2.3%, with a ${h.score.toFixed(1)}/10 Cosy Score for warmth & character.\n\nGrab your "Rated Cosy" badge to show it off — it links back to your ranking: ${badgeLink}\n\nYou're featured here: ${cityLink}\n\nA link back would mean a lot 🔥\n— Got Cosy (gotcosy.com)`;
    return { hotelId: h.id, name: h.name, city: h.city, score: h.score, channel: h.channel, status: statusById.get(h.id) || "queued", hotelHref: `${base}/en/hotels/${h.slug}`, pitch };
  });
  const channelById = Object.fromEntries(built.map((b) => [b.hotelId, b.channel]));

  return (
    <div>
      <header style={{ marginBottom: 18 }}>
        <h1 style={{ fontFamily: "Fraunces, serif", fontSize: 22, fontWeight: 600, margin: 0 }}>Badge outreach — the top 2.3%</h1>
        <p style={{ color: "var(--muted)", fontSize: 13.5, marginTop: 5 }}>{built.length} Cosy Index hotels with a public contact. Copy each pitch, DM/email it, then advance the card as they reply and embed the badge.</p>
      </header>
      <BadgeBoard rows={built} channelById={channelById} />
    </div>
  );
}
