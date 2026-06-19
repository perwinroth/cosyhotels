// Pinterest pin image generator — 1000×1500 vertical "cosiest hotels in {City}" card,
// rendered from live cosy-score data. Every publish path (Blotato/n8n) consumes this URL.
//   GET /api/social/pin?city=Paris
import { ImageResponse } from "next/og";

export const runtime = "edge";

export async function GET(req: Request) {
  const city = new URL(req.url).searchParams.get("city")?.trim() || "Europe";
  const top: Array<{ name: string; score: number }> = [];
  // Edge-safe data fetch via Supabase REST (supabase-js doesn't run in edge).
  const SUPA = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  if (SUPA && KEY) {
    try {
      const url = `${SUPA}/rest/v1/cosy_scores?select=score,score_final,hotel:hotel_id(name,city)&score=gte.5&order=score_final.desc.nullslast,score.desc&limit=400`;
      const res = await fetch(url, { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } });
      const data = res.ok ? await res.json() : [];
      const seen = new Set<string>();
      for (const r of (data || []) as Array<{ score: number | null; score_final: number | null; hotel: { name: string; city: string | null } | null }>) {
        const h = r.hotel;
        if (!h?.name || !h.city) continue;
        if (!h.city.toLowerCase().includes(city.toLowerCase())) continue;
        if (seen.has(h.name)) continue;
        seen.add(h.name);
        top.push({ name: h.name, score: (typeof r.score_final === "number" ? r.score_final : Number(r.score)) || 0 });
        if (top.length >= 5) break;
      }
    } catch { /* render with empty list */ }
  }

  const color = (s: number) => (s >= 9 ? "#D8B25A" : s >= 7.8 ? "#7FB7A2" : s >= 6.8 ? "#7c8a5f" : "#b07a4a");

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "linear-gradient(160deg,#1d2a22,#0F1512)", color: "#F3EEE6", fontFamily: "serif", padding: 70 }}>
        <div style={{ fontSize: 30, letterSpacing: 5, textTransform: "uppercase", color: "#E08A4B", fontFamily: "sans-serif" }}>◆ AI-rated for cosiness</div>
        <div style={{ display: "flex", flexDirection: "column", fontSize: 84, fontWeight: 700, letterSpacing: -2, marginTop: 18, lineHeight: 1.05 }}>
          <span>The cosiest hotels in</span>
          <span style={{ color: "#E08A4B", fontStyle: "italic" }}>{city}</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 22, marginTop: 60, flex: 1 }}>
          {top.map((h, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 26 }}>
              <div style={{ fontSize: 34, color: "#9DA89F", fontFamily: "sans-serif", width: 36 }}>{i + 1}</div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", width: 104, height: 104, borderRadius: 26, background: color(h.score), color: "#16201C", flexShrink: 0 }}>
                <div style={{ fontSize: 40, fontWeight: 700 }}>{h.score.toFixed(1)}</div>
                <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: 2, fontFamily: "sans-serif" }}>COSY</div>
              </div>
              <div style={{ fontSize: 40, fontWeight: 600, overflow: "hidden" }}>{h.name.length > 26 ? h.name.slice(0, 25) + "…" : h.name}</div>
            </div>
          ))}
          {top.length === 0 && <div style={{ fontSize: 40, color: "#9DA89F" }}>Discover cosy hotels at gotcosy.com</div>}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontFamily: "sans-serif" }}>
          <div style={{ fontSize: 38, fontWeight: 700 }}>Got Cosy?</div>
          <div style={{ fontSize: 30, color: "#D8B25A" }}>gotcosy.com</div>
        </div>
      </div>
    ),
    { width: 1000, height: 1500 }
  );
}
