// Ready-to-post score graphic for the Instagram badge wave (linked from the per-hotel asset page)
// AND the per-hotel link-preview card (og:image, format=og).
//   GET /api/asset-card?slug=<hotel-slug>&format=feed|story|og
//     feed  → 1080×1080 PNG (Instagram feed post)
//     story → 1080×1920 PNG (Instagram story)
//     og    → 1200×630 PNG  (1.91:1 link preview / og:image — sharp, correctly proportioned)
// SECURITY: ALL data (name, score, tier, percentile, evidence) is loaded server-side from the DB by
// slug — the format param only picks the layout; a requester can never choose a score or tier.
// Score below the 6.0 proactive floor → 404 (no graphic exists below the floor; the asset PAGE
// fail-softs instead). Mirrors the ImageResponse pattern of /api/social/hotel-pin.
// satori rule (the historic 500, fixed 2026-07-15): EVERY <div> with more than one child needs an
// explicit display:flex — so every div below sets it, and interpolated text uses a single string.
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
  const fmt = p.get("format");
  const format = fmt === "story" ? "story" : fmt === "og" ? "og" : "feed";
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
  const totalTxt = (totalScored ?? 0).toLocaleString("en-GB");
  const pctLine = pct != null ? `Top ${pct}% of ${totalTxt} hotels analysed` : "";
  const verifyLine = `gotcosy.com/hotels/${hotel.slug}`;
  const hex = badgeHex(eff);

  const dims = format === "og" ? { width: 1200, height: 630 } : { width: 1080, height: format === "story" ? 1920 : 1080 };

  // ── LANDSCAPE link-preview card (og:image, 1.91:1) ──────────────────────────────────────────────
  if (format === "og") {
    const img = new ImageResponse(
      (
        <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "#FAF7F1", padding: "54px 66px", fontFamily: "sans-serif" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <Flame size={38} />
            <div style={{ display: "flex", fontSize: 32, fontWeight: 700, color: "#2b2420", letterSpacing: 2 }}>GOT COSY</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 46, marginTop: "auto", marginBottom: "auto" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", width: 206, height: 206, borderRadius: 42, background: hex, boxShadow: "0 8px 30px rgba(43,36,32,.18)", flexShrink: 0 }}>
              <div style={{ display: "flex", fontSize: 90, fontWeight: 800, color: "#FFFFFF", lineHeight: 1 }}>{eff.toFixed(1)}</div>
              <div style={{ display: "flex", fontSize: 21, fontWeight: 700, letterSpacing: 2, color: "#FAF7F1", marginTop: 6 }}>COSY SCORE</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 16, flex: 1 }}>
              <div style={{ display: "flex", fontSize: name.length > 26 ? 44 : 56, fontWeight: 800, color: "#2b2420", lineHeight: 1.08 }}>{name}</div>
              {tier && <div style={{ display: "flex", fontSize: 34, fontWeight: 800, color: "#B5642A" }}>{safe(tier.label)}</div>}
              {pctLine && <div style={{ display: "flex", fontSize: 28, fontWeight: 600, color: "#2b2420" }}>{pctLine}</div>}
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "2px solid #e7dfd2", paddingTop: 26 }}>
            <div style={{ display: "flex", fontSize: 24, color: "#8c8478" }}>{scoredStamp}</div>
            <div style={{ display: "flex", fontSize: 26, fontWeight: 700, color: "#D2783A" }}>{verifyLine}</div>
          </div>
        </div>
      ),
      dims,
    );
    img.headers.set("cache-control", "public, max-age=3600, s-maxage=3600");
    img.headers.set("x-robots-tag", "noindex");
    return img;
  }

  // ── SQUARE / STORY download graphics (feed 1080², story 1080×1920) ───────────────────────────────
  const story = format === "story";
  const img = new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: story ? "center" : "flex-start", background: "#FAF7F1", padding: story ? "140px 90px" : "80px 90px", fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <Flame size={44} />
          <div style={{ display: "flex", fontSize: 40, fontWeight: 700, color: "#2b2420", letterSpacing: 2 }}>GOT COSY</div>
        </div>

        <div style={{ display: "flex", fontSize: name.length > 28 ? 64 : 78, fontWeight: 800, color: "#2b2420", lineHeight: 1.08, marginTop: story ? 90 : 70 }}>
          {name}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 34, marginTop: story ? 80 : 60 }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", width: 190, height: 190, borderRadius: 38, background: hex, boxShadow: "0 8px 30px rgba(43,36,32,.18)" }}>
            <div style={{ display: "flex", fontSize: 82, fontWeight: 800, color: "#FFFFFF", lineHeight: 1 }}>{eff.toFixed(1)}</div>
            <div style={{ display: "flex", fontSize: 20, fontWeight: 700, letterSpacing: 2, color: "#FAF7F1", marginTop: 6 }}>COSY SCORE</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {tier && <div style={{ display: "flex", fontSize: 44, fontWeight: 800, color: "#B5642A" }}>{safe(tier.label)}</div>}
            {pctLine && <div style={{ display: "flex", fontSize: 32, fontWeight: 600, color: "#2b2420" }}>{pctLine}</div>}
          </div>
        </div>

        {evidence && (
          <div style={{ display: "flex", fontSize: 26, color: "#8c8478", lineHeight: 1.45, marginTop: story ? 90 : 64 }}>
            {`condensed from guest reviews: ${evidence}`}
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "auto", paddingTop: 50, borderTop: "2px solid #e7dfd2" }}>
          <div style={{ display: "flex", fontSize: 26, color: "#8c8478" }}>{scoredStamp}</div>
          <div style={{ display: "flex", fontSize: 28, fontWeight: 700, color: "#D2783A" }}>{verifyLine}</div>
        </div>
      </div>
    ),
    dims,
  );

  img.headers.set("cache-control", "public, max-age=3600, s-maxage=3600");
  img.headers.set("x-robots-tag", "noindex");
  return img;
}
