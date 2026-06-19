// Pinterest pin image generator — 1000×1500 vertical "cosiest hotels in {City}" card.
// FETCH-FREE: an in-route Supabase fetch crashes the edge ImageResponse worker, so hotel
// data is passed in via the `items` query param (built by /api/social/next, which fetches).
//   GET /api/social/pin?city=Paris&items=Maison Lautrec~9.4|Le Pigalle~7.9
import { ImageResponse } from "next/og";

export const runtime = "edge";

// ASCII + Latin-1 only — other glyphs make satori attempt a (failing) dynamic font fetch.
function safe(s: string): string {
  return (s || "").replace(/…/g, "...").replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, "-").replace(/[^\x20-ÿ]/g, "").trim();
}

export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const city = safe(params.get("city")?.trim() || "Europe");
  const top = (params.get("items") || "")
    .split("|")
    .map((part) => {
      const i = part.lastIndexOf("~");
      if (i < 0) return null;
      const name = safe(part.slice(0, i));
      const score = Number(part.slice(i + 1)) || 0;
      return name ? { name, score } : null;
    })
    .filter(Boolean)
    .slice(0, 5) as Array<{ name: string; score: number }>;

  const color = (s: number) => (s >= 9 ? "#D8B25A" : s >= 7.8 ? "#7FB7A2" : s >= 6.8 ? "#7c8a5f" : "#b07a4a");

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "linear-gradient(160deg,#1d2a22,#0F1512)", color: "#F3EEE6", fontFamily: "sans-serif", padding: 70 }}>
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
    { width: 1000, height: 1500 }
  );
}
