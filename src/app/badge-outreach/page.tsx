// Badge-outreach queue: the top-tier hotels (Cosy Index, score ≥ 7.0) that expose a contact channel,
// each with a copy-paste "you made the top ~2.3% — embed your badge" pitch and a status picker. The
// badge embed is the highest-ROI backlink lever (editorial + trust). Internal/noindexed + panel-gated.
import type { Metadata } from "next";
import { getServerSupabase } from "@/lib/supabase/server";
import { displayCity, isLatin } from "@/lib/placeText";
import { cityToSlug } from "@/lib/citySlug";
import BadgeOutreachRow, { type BadgeRow } from "@/components/BadgeOutreachRow";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata: Metadata = { title: "Badge outreach", robots: { index: false, follow: false } };

const INDEX_MIN = 7.0; // the Cosy Index tier — mirrors /cosy-index

type Row = { hotel_id: string; score: number | null; score_final: number | null; hotel: { slug: string; name: string; name_en: string | null; city: string | null; instagram: string | null; website: string | null } | null };

export default async function BadgeOutreachPage() {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "https://gotcosy.com";
  const db = getServerSupabase();
  if (!db) return <div style={{ padding: 32, color: "#F3EEE6", background: "#0F1512" }}>Supabase not configured.</div>;

  const [{ data }, { count: totalScored }] = await Promise.all([
    db.from("cosy_scores")
      .select("hotel_id, score, score_final, hotel:hotel_id!inner(slug, name, name_en, city, instagram, website)")
      .gte("score", INDEX_MIN)
      .order("score", { ascending: false })
      .limit(400),
    db.from("cosy_scores").select("*", { count: "exact", head: true }),
  ]);

  const rows = (data || []) as unknown as Row[];
  const seen = new Set<string>();
  const hotels: Array<{ id: string; slug: string; name: string; city: string; score: number; instagram: string | null; website: string | null }> = [];
  for (const r of rows) {
    const h = r.hotel; if (!h || !r.hotel_id) continue;
    const name = String(h.name_en || h.name || "").trim();
    if (!name || !isLatin(name) || seen.has(name)) continue;
    const ig = h.instagram ? `@${String(h.instagram).replace(/^@/, "")}` : null;
    const site = h.website && /^https?:/.test(h.website) ? h.website : null;
    if (!ig && !site) continue; // no way to reach them → skip
    seen.add(name);
    hotels.push({ id: String(r.hotel_id), slug: h.slug, name, city: displayCity(h.city), score: Number((r.score_final ?? r.score) || 0), instagram: ig, website: site });
  }

  // Existing statuses for these hotels (one query).
  const statusById = new Map<string, string>();
  if (hotels.length) {
    const { data: st } = await db.from("hotel_outreach").select("hotel_id,status").in("hotel_id", hotels.map((h) => h.id));
    for (const s of (st || []) as Array<{ hotel_id: string; status: string }>) statusById.set(String(s.hotel_id), s.status);
  }

  const totalTxt = (totalScored || 17000).toLocaleString();
  const built: BadgeRow[] = hotels.map((h) => {
    const badgeLink = `${base}/en/hotels/${h.slug}?badge`;
    const cityLink = `${base}/en/guides/${cityToSlug(h.city || "")}`;
    const badgeSrc = `${base}/api/badge?score=${h.score.toFixed(1)}&name=${encodeURIComponent(h.name)}`;
    const greet = h.instagram || h.name;
    const pitch = `Hi ${greet}! 👋 Out of the ${totalTxt} hotels we've AI-scored for cosiness, ${h.name} just made the Cosy Index — the cosiest ~2.3%, with a ${h.score.toFixed(1)}/10 Cosy Score for warmth & character.\n\nGrab your "Rated Cosy" badge to show it off — it links back to your ranking: ${badgeLink}\n\nYou're featured here: ${cityLink}\n\nA link back would mean a lot 🔥\n— Got Cosy (gotcosy.com)`;
    return { hotelId: h.id, name: h.name, city: h.city, score: h.score, instagram: h.instagram, website: h.website, badgeSrc, badgeLink, pitch, channel: h.instagram ? "instagram" : "website", status: statusById.get(h.id) || "queued" };
  });

  const contacted = built.filter((b) => b.status !== "queued").length;
  return (
    <div style={{ minHeight: "100vh", background: "#0F1512", color: "#F3EEE6", fontFamily: "Inter, system-ui, sans-serif", padding: "32px 20px" }}>
      <div style={{ maxWidth: 860, margin: "0 auto" }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0 }}>Badge outreach — the top 2.3%</h1>
        <p style={{ color: "#9DA89F", marginTop: 8, fontSize: 14, lineHeight: 1.6 }}>
          {built.length} Cosy Index hotels (≥{INDEX_MIN.toFixed(1)}/10) with a public contact. Pitch each their &quot;Rated Cosy&quot; badge — when they embed it, that&apos;s an editorial backlink from a real hotel site (the highest-ROI link we can earn). Best scores first · {contacted} worked.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 22 }}>
          {built.map((b) => <BadgeOutreachRow key={b.hotelId} {...b} />)}
          {built.length === 0 && <p style={{ color: "#9DA89F" }}>No top-tier hotels with a contact channel yet.</p>}
        </div>
      </div>
    </div>
  );
}
