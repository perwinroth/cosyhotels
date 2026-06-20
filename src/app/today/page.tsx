// One-click manual Pinterest queue for the warm-up period. Pinterest is single-image-per-pin,
// so each FEATURED HOTEL is its own pin: a "Cosy Score" badge image + the hotel name/score,
// linking to the city ranking page. Tap "Pin to Pinterest" → Pinterest opens pre-filled →
// pick the board → publish. Warms the account AND ships content. Internal/noindexed.
import type { Metadata } from "next";
import { getServerSupabase } from "@/lib/supabase/server";
import { populatedCities, cityPin, hotelPinImageUrl, hotelPinDescription, type Slide } from "@/lib/social";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata: Metadata = { title: "Today's pins", robots: { index: false, follow: false } };

const PINTEREST_CREATE = "https://www.pinterest.com/pin/create/button/";

export default async function TodayPage() {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "https://gotcosy.com";
  const db = getServerSupabase();
  if (!db) return <div style={{ padding: 32, color: "#F3EEE6", background: "#0F1512" }}>Supabase not configured.</div>;

  const cities = (await populatedCities(db)).slice(0, 24);
  // One pin PER HOTEL, flattened across cities and sorted by score (best first).
  type HotelPin = { slide: Slide; link: string };
  const hotelPins: HotelPin[] = [];
  const CONC = 8;
  for (let i = 0; i < cities.length; i += CONC) {
    const got = await Promise.all(cities.slice(i, i + CONC).map((c) => cityPin(db, c.city, base).catch(() => null)));
    for (const p of got) if (p) for (const s of p.slides) hotelPins.push({ slide: s, link: p.link });
  }
  hotelPins.sort((a, b) => b.slide.score - a.slide.score);

  return (
    <div style={{ minHeight: "100vh", background: "#0F1512", color: "#F3EEE6", fontFamily: "Inter, system-ui, sans-serif", padding: "32px 20px" }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0 }}>Today&apos;s pins → Pinterest</h1>
        <p style={{ color: "#9DA89F", marginTop: 8, fontSize: 14, lineHeight: 1.6 }}>
          {hotelPins.length} pin-worthy hotels. Pinterest needs a ~2-week manual warm-up before automated posting —
          post <strong>1/day</strong> (ramp to 2–3): tap <strong>📌 Pin to Pinterest</strong>, it opens the creator
          pre-filled with the badge image, the city link, and the description. Pick the <strong>Cosy Hotels</strong> board
          and publish. Work down the list (best scores first); once warm, the cron takes over.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 18, marginTop: 24 }}>
          {hotelPins.map(({ slide, link }, idx) => {
            const media = hotelPinImageUrl(base, slide);
            const desc = hotelPinDescription(slide.name, slide.city, slide.score);
            const create = `${PINTEREST_CREATE}?url=${encodeURIComponent(link)}&media=${encodeURIComponent(media)}&description=${encodeURIComponent(desc)}`;
            return (
              <div key={`${slide.city}-${slide.name}-${idx}`} style={{ background: "#16201A", border: "1px solid #243029", borderRadius: 14, overflow: "hidden", display: "flex", gap: 14 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={media} alt={slide.name} loading="lazy" decoding="async" style={{ flex: "0 0 130px", width: 130, aspectRatio: "2/3", objectFit: "cover", background: "#0F1512" }} />
                <div style={{ padding: "14px 14px 14px 0", display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
                  <div style={{ fontSize: 12, color: "#9DA89F" }}>#{idx + 1} · {slide.city} · <span style={{ color: "#D8B25A", fontWeight: 700 }}>{slide.score.toFixed(1)}/10</span></div>
                  <div style={{ fontSize: 18, fontWeight: 700, lineHeight: 1.2 }}>{slide.name}</div>
                  <div style={{ fontSize: 12, color: "#C7CFC8", lineHeight: 1.45 }}>{desc}</div>
                  <a href={create} target="_blank" rel="noreferrer"
                    style={{ display: "inline-block", textAlign: "center", background: "#E60023", color: "#fff", fontWeight: 700, fontSize: 14, padding: "9px 14px", borderRadius: 9, textDecoration: "none", marginTop: 2, maxWidth: 220 }}>
                    📌 Pin to Pinterest
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
