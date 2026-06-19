// Pinterest pin image generator — 1000×1500 vertical "cosiest hotels in {City}" card,
// rendered from live cosy-score data. Every publish path (Blotato/n8n) consumes this URL.
//   GET /api/social/pin?city=Paris
import { ImageResponse } from "next/og";

export const runtime = "edge";

// Keep only glyphs the default font can render (ASCII + Latin accents). Anything beyond
// (emoji, CJK, exotic symbols) makes satori attempt a dynamic font fetch and blanks the image.
function safe(s: string): string {
  return (s || "").replace(/…/g, "...").replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, "-").replace(/[^\x20-\u00ff]/g, "").trim();
}

export async function GET(req: Request) {
  const city = safe(new URL(req.url).searchParams.get("city")?.trim() || "Europe");
  const top: Array<{ name: string; score: number }> = [];
  // Edge-safe data fetch via Supabase REST (supabase-js doesn't run in edge).
  const SUPA = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  if (SUPA && KEY) {
    try {
      // Filter by city server-side (!inner) returning a few rows — fast + reliable in edge.
      // (Pulling 400 rows and filtering timed out and cached blank images.)
      const q = encodeURIComponent(`*${city}*`);
      const url = `${SUPA}/rest/v1/cosy_scores?select=score,score_final,hotel:hotel_id!inner(name,city)&score=gte.5&hotel.city=ilike.${q}&order=score.desc&limit=12`;
      const res = await fetch(url, { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } });
      const data = res.ok ? await res.json() : [];
      const seen = new Set<string>();
      for (const r of (data || []) as Array<{ score: number | null; score_final: number | null; hotel: { name: string } | null }>) {
        const nm = safe(r.hotel?.name || "");
        if (!nm || seen.has(nm)) continue;
        seen.add(nm);
        top.push({ name: nm, score: (typeof r.score_final === "number" ? r.score_final : Number(r.score)) || 0 });
        if (top.length >= 5) break;
      }
    } catch { /* render with empty list */ }
  }

  const color = (s: number) => (s >= 9 ? "#D8B25A" : s >= 7.8 ? "#7FB7A2" : s >= 6.8 ? "#7c8a5f" : "#b07a4a");

  // Bundle the font into the function via import.meta.url (NOT an origin fetch — that 404'd
  // and blanked images). This compiles the font bytes in, so satori always has a real font.
  const [f400, f700] = await Promise.all([
    fetch(new URL("./inter-400.woff", import.meta.url)).then((r) => r.arrayBuffer()),
    fetch(new URL("./inter-700.woff", import.meta.url)).then((r) => r.arrayBuffer()),
  ]);
  const fonts = [
    { name: "Inter", data: f400, weight: 400 as const, style: "normal" as const },
    { name: "Inter", data: f700, weight: 700 as const, style: "normal" as const },
  ];

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "linear-gradient(160deg,#1d2a22,#0F1512)", color: "#F3EEE6", fontFamily: "Inter", padding: 70 }}>
        <div style={{ fontSize: 30, letterSpacing: 5, textTransform: "uppercase", color: "#E08A4B" }}>AI-rated for cosiness</div>
        <div style={{ display: "flex", flexDirection: "column", fontSize: 84, fontWeight: 700, letterSpacing: -2, marginTop: 18, lineHeight: 1.05 }}>
          <span>The cosiest hotels in</span>
          <span style={{ color: "#E08A4B", fontStyle: "italic" }}>{city}</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 22, marginTop: 60, flex: 1 }}>
          {top.map((h, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 26 }}>
              <div style={{ fontSize: 34, color: "#9DA89F", width: 36 }}>{i + 1}</div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", width: 104, height: 104, borderRadius: 26, background: color(h.score), color: "#16201C", flexShrink: 0 }}>
                <div style={{ fontSize: 40, fontWeight: 700 }}>{h.score.toFixed(1)}</div>
                <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: 2 }}>COSY</div>
              </div>
              <div style={{ fontSize: 40, fontWeight: 600, overflow: "hidden" }}>{h.name.length > 26 ? h.name.slice(0, 25) + "..." : h.name}</div>
            </div>
          ))}
          {top.length === 0 && <div style={{ fontSize: 40, color: "#9DA89F" }}>Discover cosy hotels at gotcosy.com</div>}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 38, fontWeight: 700 }}>Got Cosy?</div>
          <div style={{ fontSize: 30, color: "#D8B25A" }}>gotcosy.com</div>
        </div>
      </div>
    ),
    { width: 1000, height: 1500, fonts }
  );
}
