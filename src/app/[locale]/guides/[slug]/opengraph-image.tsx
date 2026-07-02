// Per-guide social-share card (1200×630). Replaces the old logo-seal.svg og:image that
// rendered blank on Pinterest/Reddit/X/Slack — every share of a money page now shows the city,
// the #1 cosy hotel, its score, and (when available) that hotel's real photo as the background.
// Output is JPEG: satori/ImageResponse emits PNG, but photographic PNGs run ~1MB+, so we
// re-encode with sharp (~6-8x smaller) and cache the result at the edge.
import { ImageResponse } from "next/og";
import sharp from "sharp";
import { getServerSupabase } from "@/lib/supabase/server";
import { cityFromSlug } from "@/lib/citySlug";
import { displayCity } from "@/lib/placeText";

export const runtime = "nodejs";
export const alt = "Got Cosy? — the cosiest hotels, AI-ranked";
export const size = { width: 1200, height: 630 };
export const contentType = "image/jpeg";

async function toJpeg(png: ImageResponse): Promise<Response> {
  const buf = Buffer.from(await png.arrayBuffer());
  const jpeg = await sharp(buf).jpeg({ quality: 80, mozjpeg: true }).toBuffer();
  return new Response(new Uint8Array(jpeg), {
    headers: {
      "Content-Type": "image/jpeg",
      // Crawlers fetch share images repeatedly; cache a day at the edge, serve stale while refreshing.
      "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
    },
  });
}

function resolveCity(slug: string): string {
  return cityFromSlug(slug) || slug.replace(/-cosy-hotel$/, "").replace(/-/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

// Pre-fetch the hero photo as a data URI so the card renders reliably (or falls back to gradient).
async function photoDataUri(url: string | null): Promise<string | null> {
  if (!url || !/^https:\/\//.test(url)) return null;
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (!r.ok) return null;
    const ct = r.headers.get("content-type") || "image/jpeg";
    if (!ct.startsWith("image/")) return null;
    const b64 = Buffer.from(await r.arrayBuffer()).toString("base64");
    return `data:${ct};base64,${b64}`;
  } catch {
    return null;
  }
}

export default async function OG({ params }: { params: { slug: string } }) {
  const cityName = resolveCity(params.slug);
  let topName = "";
  let topScore = 0;
  let hero: string | null = null;
  try {
    const db = getServerSupabase();
    if (db) {
      const cityMatch = cityName.replace(/\s+/g, "-");
      const { data } = await db
        .from("cosy_scores")
        .select("score, score_final, hotel:hotel_id!inner(id, name, name_en, city)")
        .gte("score", 5)
        .ilike("hotel.city", `%${cityMatch}%`)
        .order("score", { ascending: false })
        .limit(1);
      const row = (data || [])[0] as unknown as { score: number | null; score_final: number | null; hotel: { id: string; name: string; name_en: string | null } | null } | undefined;
      if (row?.hotel) {
        topName = String(row.hotel.name_en || row.hotel.name || "").trim();
        topScore = Number((row.score_final ?? row.score) || 0);
        const { data: img } = await db.from("hotel_images").select("url").eq("hotel_id", row.hotel.id).eq("vision_ok", true).limit(1);
        hero = await photoDataUri((img || [])[0]?.url || null);
      }
    }
  } catch { /* fall back to branded card */ }

  const scoreStr = topScore ? topScore.toFixed(1) : "";
  // Non-city slug (e.g. an editorial guide) — no top hotel found: render the branded generic card.
  if (!topName) {
    return toJpeg(new ImageResponse(
      (
        <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "radial-gradient(900px 500px at 50% 0%, #1d2a22, #0F1512)", color: "#F3EEE6", fontFamily: "serif" }}>
          <div style={{ fontSize: 30, letterSpacing: 6, textTransform: "uppercase", color: "#E08A4B", fontFamily: "sans-serif", marginBottom: 28 }}>AI-rated hotels for cosiness</div>
          <div style={{ fontSize: 150, fontWeight: 700, letterSpacing: -3, display: "flex" }}><span>Got&nbsp;</span><span style={{ color: "#E08A4B", fontStyle: "italic" }}>cosy?</span></div>
          <div style={{ fontSize: 40, color: "#9DA89F", marginTop: 24, fontFamily: "sans-serif" }}>Hotels ranked by cosiness — not stars.</div>
          <div style={{ fontSize: 28, color: "#D8B25A", marginTop: 48, fontFamily: "sans-serif", letterSpacing: 1 }}>gotcosy.com</div>
        </div>
      ),
      { ...size }
    ));
  }
  return toJpeg(new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", position: "relative", fontFamily: "serif", color: "#F3EEE6", background: "radial-gradient(900px 500px at 30% 0%, #1d2a22, #0F1512)" }}>
        {hero && (
          <img src={hero} width={1200} height={630} style={{ position: "absolute", inset: 0, width: 1200, height: 630, objectFit: "cover" }} />
        )}
        {/* legibility overlay */}
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg, rgba(10,12,10,0.92) 0%, rgba(10,12,10,0.72) 45%, rgba(10,12,10,0.32) 100%)" }} />
        <div style={{ position: "relative", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 64, width: "100%", height: "100%" }}>
          <div style={{ fontSize: 26, letterSpacing: 5, textTransform: "uppercase", color: "#E08A4B", fontFamily: "sans-serif" }}>
            AI-rated for cosiness
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 82, fontWeight: 700, letterSpacing: -2, lineHeight: 1.02, maxWidth: 980 }}>
              {`The cosiest hotels in ${displayCity(cityName)}`}
            </div>
            {topName && (
              <div style={{ display: "flex", alignItems: "center", marginTop: 34 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 96, height: 96, borderRadius: 24, background: "#E08A4B", color: "#0F1512", fontSize: 44, fontWeight: 700, marginRight: 26 }}>
                  {scoreStr}
                </div>
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <div style={{ fontSize: 24, color: "#9DA89F", fontFamily: "sans-serif" }}>#1 cosiest</div>
                  <div style={{ fontSize: 40, fontWeight: 600, maxWidth: 760, display: "flex" }}>{topName}</div>
                </div>
              </div>
            )}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", fontFamily: "sans-serif" }}>
            <div style={{ fontSize: 30, display: "flex" }}><span>Got&nbsp;</span><span style={{ color: "#E08A4B", fontStyle: "italic", fontFamily: "serif" }}>cosy?</span></div>
            <div style={{ fontSize: 26, color: "#D8B25A", letterSpacing: 1 }}>gotcosy.com</div>
          </div>
        </div>
      </div>
    ),
    { ...size }
  ));
}
