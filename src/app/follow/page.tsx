// Manual follow list: every featured hotel with a resolved Instagram, compact, with a direct
// "Follow" link. Following hotels (+ @mentioning + DMing them) builds the relationship that
// gets reposts. MANUAL ONLY — automated following violates Instagram's ToS and gets new
// accounts banned; do it gradually (a new account should stay well under ~50/day). Noindexed.
import type { Metadata } from "next";
import Link from "next/link";
import { getServerSupabase } from "@/lib/supabase/server";
import { displayCity, isLatin } from "@/lib/placeText";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata: Metadata = { title: "Follow hotels", robots: { index: false, follow: false } };

type Row = { score: number | null; score_final: number | null; hotel: { name: string; name_en: string | null; city: string | null; instagram: string | null } | null };

export default async function FollowPage() {
  const db = getServerSupabase();
  if (!db) return <div style={{ padding: 32, color: "#F3EEE6", background: "#0F1512" }}>Supabase not configured.</div>;

  const { data } = await db
    .from("cosy_scores")
    .select("score, score_final, hotel:hotel_id!inner(name, name_en, city, instagram)")
    .gte("score", 5)
    .not("hotel.instagram", "is", null)
    .order("score", { ascending: false })
    .limit(400);

  const seen = new Set<string>();
  const hotels: Array<{ name: string; city: string; score: number; handle: string }> = [];
  for (const r of (data || []) as unknown as Row[]) {
    const h = r.hotel; if (!h) continue;
    const handle = String(h.instagram || "").replace(/^@/, "").trim();
    const name = String(h.name_en || h.name || "").trim();
    if (!handle || !name || !isLatin(name) || seen.has(handle)) continue;
    seen.add(handle);
    hotels.push({ name, city: displayCity(h.city), score: Number((r.score_final ?? r.score) || 0), handle });
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0F1512", color: "#F3EEE6", fontFamily: "Inter, system-ui, sans-serif", padding: "32px 20px" }}>
      <div style={{ maxWidth: 820, margin: "0 auto" }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0 }}>Follow the hotels</h1>
        <p style={{ color: "#9DA89F", marginTop: 8, fontSize: 14, lineHeight: 1.6 }}>
          {hotels.length} featured hotels on Instagram. Follow them yourself; pair it with an @mention in a post and a DM
          (see <Link href="/outreach" style={{ color: "#7FB4FF" }}>/outreach</Link>) and they tend to follow back &amp; repost.
          <strong style={{ color: "#E08A4B" }}> Go slow</strong>: a new account should stay well under ~50 follows/day, or Instagram flags it. Never automate this (it&apos;s against IG&apos;s ToS and gets accounts banned).
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 8, marginTop: 22 }}>
          {hotels.map((h) => (
            <a key={h.handle} href={`https://instagram.com/${h.handle}`} target="_blank" rel="noreferrer"
              style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, background: "#16201A", border: "1px solid #243029", borderRadius: 10, padding: "10px 12px", textDecoration: "none" }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ color: "#F3EEE6", fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{h.name}</div>
                <div style={{ color: "#9DA89F", fontSize: 11 }}>@{h.handle} · {h.city} · {h.score.toFixed(1)}</div>
              </div>
              <span style={{ flexShrink: 0, color: "#E60023", fontWeight: 700, fontSize: 12 }}>Follow ↗</span>
            </a>
          ))}
          {hotels.length === 0 && <p style={{ color: "#9DA89F" }}>No handles yet; the resolver is still running.</p>}
        </div>
      </div>
    </div>
  );
}
