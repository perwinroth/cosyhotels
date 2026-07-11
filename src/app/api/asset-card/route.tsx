// Ready-to-post score graphic for the Instagram badge wave (linked from the per-hotel asset page).
//   GET /api/asset-card?slug=<hotel-slug>&format=feed|story  → PNG (1080×1080 / 1080×1920)
// SECURITY: ALL data (name, score, tier, percentile, evidence) is loaded server-side from the DB by
// slug — the format param only picks the layout; a requester can never choose a score or tier.
// Score below the 6.0 proactive floor → 404 (no graphic exists below the floor; the asset PAGE
// fail-softs instead). Mirrors the ImageResponse pattern of /api/social/hotel-pin.
import { ImageResponse } from "next/og";
import { getServerSupabase } from "@/lib/supabase/server";
import { tierForScore, roundPctUp, pitchExcerpt } from "@/lib/badgePitch";

export const runtime = "nodejs";

// satori renders from its own font set — normalise typographic chars it renders badly.
function safe(s: string): string {
  return (s || "").replace(/…/g, "...").replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, "-").trim();
}

// The site's cosy-score badge scale (src/lib/cosyColor.ts) resolved to the LIGHT-theme hex values
// from globals.css — satori can't read CSS variables, and the card is warm-cream (light) by design.
function badgeHex(score: number): string {
  if (score >= 9) return "#A87F2E";   // gold
  if (score >= 7.8) return "#4F7E6C"; // sage
  if (score >= 6.8) return "#5f6a44"; // olive
  return "#9a5f30";                   // clay (floor is 6.0 — nothing below renders)
}

// Simplified flame mark (inline path — the press SVGs are a seal/wordmark, not a flame).
function Flame({ size }: { size: number }) {
  return (
    <svg width={size} height={size * 1.25} viewBox="0 0 24 30">
      <path
        d="M12 1c1.6 5.2 8 8.6 8 16a8 8 0 0 1-16 0c0-4.6 2.6-7.2 4.2-10.4 1 2.4 2.3 3.6 3.8 4.6C12.9 8.2 11.4 4.8 12 1z"
        fill="#D2783A"
      />
      <path d="M12 13c.9 2.6 4 4.3 4 7.6a4 4 0 0 1-8 0c0-2.3 1.3-3.6 2.1-5.2.5 1.2 1.2 1.8 1.9 2.3-.3-1.5-.6-3.1 0-4.7z" fill="#FAF7F1" opacity="0.85" />
    </svg>
  );
}

const notFound = () =>
  new Response("not found", { status: 404, headers: { "x-robots-tag": "noindex" } });

export async function GET(req: Request) {
  const p = new URL(req.url).searchParams;
  const slug = (p.get("slug") || "").trim();
  const format = p.get("format") === "story" ? "story" : "feed";
  if (!slug) return notFound();

  const db = getServerSupabase();
  if (!db) return notFound();

  const { data: hotel } = await db.from("hotels").select("id, slug, name, name_en").eq("slug", slug).maybeSingle();
  if (!hotel) return notFound();
  const { data: sc } = await db.from("cosy_scores").select("score, score_final, description").eq("hotel_id", hotel.id).maybeSingle();
  const eff = sc == null ? NaN : Number(sc.score_final ?? sc.score ?? NaN);
  if (!Number.isFinite(eff) || eff < 6) return notFound(); // no graphic below the proactive floor

  // Live percentile (rounded UP) + tier — same definitions as the asset page.
  const [{ count: atOrAbove }, { count: totalScored }] = await Promise.all([
    db.from("cosy_scores").select("*", { count: "exact", head: true }).gte("score_final", eff),
    db.from("cosy_scores").select("*", { count: "exact", head: true }).not("score_final", "is", null),
  ]);
  const pct = totalScored ? roundPctUp((100 * (atOrAbove ?? 0)) / totalScored) : null;
  const tier = tierForScore(eff);
  const name = safe(String(hotel.name_en || hotel.name || "")).slice(0, 60);
  const evidence = safe(pitchExcerpt(sc?.description, 120)).replace(/[.…\s]+$/, "");
  const scoredStamp = `Scored ${new Date().toLocaleString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" })}`;

  const story = format === "story";
  const width = 1080;
  const height = story ? 1920 : 1080;

  // Warm-cream card in the site's light palette (globals.css): paper #FAF7F1, ink #2b2420,
  // ember #D2783A, muted #8c8478.
  const img = new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: story ? "center" : "flex-start",
          background: "#FAF7F1",
          padding: story ? "140px 90px" : "80px 90px",
          fontFamily: "sans-serif",
        }}
      >
        {/* brand row: flame + wordmark */}
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <Flame size={44} />
          <div style={{ fontSize: 40, fontWeight: 700, color: "#2b2420", letterSpacing: 2 }}>GOT COSY</div>
        </div>

        {/* hotel name */}
        <div style={{ display: "flex", fontSize: name.length > 28 ? 64 : 78, fontWeight: 800, color: "#2b2420", lineHeight: 1.08, marginTop: story ? 90 : 70 }}>
          {name}
        </div>

        {/* score badge + tier */}
        <div style={{ display: "flex", alignItems: "center", gap: 34, marginTop: story ? 80 : 60 }}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              width: 190,
              height: 190,
              borderRadius: 38,
              background: badgeHex(eff),
              boxShadow: "0 8px 30px rgba(43,36,32,.18)",
            }}
          >
            <div style={{ fontSize: 82, fontWeight: 800, color: "#FFFFFF", lineHeight: 1 }}>{eff.toFixed(1)}</div>
            <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: 2, color: "#FAF7F1", marginTop: 6 }}>COSY SCORE</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {tier && <div style={{ fontSize: 44, fontWeight: 800, color: "#B5642A" }}>{safe(tier.label)}</div>}
            {pct != null && (
              <div style={{ fontSize: 32, fontWeight: 600, color: "#2b2420" }}>
                Top {pct}% of {(totalScored ?? 0).toLocaleString("en-GB")} hotels analysed
              </div>
            )}
          </div>
        </div>

        {/* evidence small print */}
        {evidence && (
          <div style={{ display: "flex", fontSize: 26, color: "#8c8478", lineHeight: 1.45, marginTop: story ? 90 : 64 }}>
            condensed from guest reviews: {evidence}
          </div>
        )}

        {/* footer: date stamp + verification line */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: "auto",
            paddingTop: 50,
            borderTop: "2px solid #e7dfd2",
          }}
        >
          <div style={{ fontSize: 26, color: "#8c8478" }}>{scoredStamp}</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: "#D2783A" }}>gotcosy.com/hotels/{hotel.slug}</div>
        </div>
      </div>
    ),
    { width, height },
  );

  // ImageResponse is a Response — attach cache + noindex headers on the way out.
  img.headers.set("cache-control", "public, max-age=3600, s-maxage=3600");
  img.headers.set("x-robots-tag", "noindex");
  return img;
}
