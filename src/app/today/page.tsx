// One-click manual posting queue for the Pinterest warm-up period (new accounts must post
// manually before API posting is allowed). Each card's "Pin to Pinterest" button opens
// Pinterest's create-pin flow PRE-FILLED with the hero photo, the city-ranking link, and the
// description — you just pick the board and publish. Warms the account AND ships real content.
// Internal/noindexed. Once the account is warm, the automated /api/cron/social-publish takes over.
import type { Metadata } from "next";
import { getServerSupabase } from "@/lib/supabase/server";
import { populatedCities, cityPin, type CityPin } from "@/lib/social";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata: Metadata = { title: "Today's pins", robots: { index: false, follow: false } };

const PINTEREST_CREATE = "https://www.pinterest.com/pin/create/button/";

export default async function TodayPage() {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "https://gotcosy.com";
  const db = getServerSupabase();
  if (!db) return <div style={{ padding: 32, color: "#F3EEE6", background: "#0F1512" }}>Supabase not configured.</div>;

  const toAbs = (u: string) => { const d = u.replace(/&amp;/g, "&"); return d.startsWith("/") ? base + d : d; };
  const cities = (await populatedCities(db)).slice(0, 18); // top queue by tier/popularity
  const pins: CityPin[] = [];
  const CONC = 8;
  for (let i = 0; i < cities.length; i += CONC) {
    const got = await Promise.all(cities.slice(i, i + CONC).map((c) => cityPin(db, c.city, base).catch(() => null)));
    for (const p of got) if (p && p.slides.length) pins.push(p);
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0F1512", color: "#F3EEE6", fontFamily: "Inter, system-ui, sans-serif", padding: "32px 20px" }}>
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0 }}>Today&apos;s pins → Pinterest</h1>
        <p style={{ color: "#9DA89F", marginTop: 8, fontSize: 14, lineHeight: 1.6 }}>
          Pinterest needs a ~2-week manual warm-up before automated posting. Post <strong>1/day</strong> (ramp to 2–3):
          tap <strong>📌 Pin to Pinterest</strong> — it opens the creator pre-filled with the photo, link, and description.
          Pick the <strong>Cosy Hotels</strong> board and publish. Work down the list; once warm, the cron takes over.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 20, marginTop: 24 }}>
          {pins.map((pin, idx) => {
            const hero = toAbs(pin.slides[0].photo);
            const desc = pin.description;
            const create = `${PINTEREST_CREATE}?url=${encodeURIComponent(pin.link)}&media=${encodeURIComponent(hero)}&description=${encodeURIComponent(desc)}`;
            return (
              <div key={pin.city} style={{ background: "#16201A", border: "1px solid #243029", borderRadius: 14, overflow: "hidden", display: "flex", flexDirection: "column" }}>
                <div style={{ display: "flex", gap: 2, overflowX: "auto" }}>
                  {pin.slides.map((s, i) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={i} src={toAbs(s.photo)} alt={s.name} loading="lazy" decoding="async"
                      style={{ flex: "0 0 38%", aspectRatio: "4/5", objectFit: "cover", background: "#0F1512", borderTop: i === 0 ? "3px solid #E08A4B" : "none" }} />
                  ))}
                </div>
                <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={{ fontSize: 13, color: "#9DA89F" }}>#{idx + 1} · {pin.slides.length} hotels · board: {pin.board}</div>
                  <div style={{ fontSize: 17, fontWeight: 700 }}>{pin.title}</div>
                  <div style={{ fontSize: 13, color: "#C7CFC8", lineHeight: 1.5 }}>{desc}</div>
                  <a href={create} target="_blank" rel="noreferrer"
                    style={{ display: "inline-block", textAlign: "center", background: "#E60023", color: "#fff", fontWeight: 700, fontSize: 16, padding: "12px 16px", borderRadius: 10, textDecoration: "none", marginTop: 4 }}>
                    📌 Pin to Pinterest
                  </a>
                  <div style={{ fontSize: 11, color: "#6f7a72" }}>
                    Hero = the orange-topped first photo. Opens Pinterest pre-filled → choose the board → Publish.
                    <a href={pin.link} target="_blank" rel="noreferrer" style={{ color: "#7FB4FF", marginLeft: 6 }}>preview landing page ↗</a>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
