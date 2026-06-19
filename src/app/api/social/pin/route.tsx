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

  // Simple flat list of name lines (nested flex score-badge rows crash satori in this edge route).
  const topScore = top.length ? Math.max(...top.map((h) => h.score)) : 0;
  const lines = top.map((h) => `${h.name.length > 30 ? h.name.slice(0, 29) + "..." : h.name}  -  ${h.score.toFixed(1)}/10`);

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "linear-gradient(160deg,#1d2a22,#0F1512)", color: "#F3EEE6", fontFamily: "sans-serif", padding: 70 }}>
        <div style={{ fontSize: 30, letterSpacing: 5, textTransform: "uppercase", color: "#E08A4B" }}>AI-rated for cosiness</div>
        <div style={{ display: "flex", flexDirection: "column", fontSize: 82, fontWeight: 700, letterSpacing: -2, marginTop: 18, lineHeight: 1.05 }}>
          <span>The cosiest hotels in</span>
          <span style={{ color: "#E08A4B", fontStyle: "italic" }}>{city}</span>
        </div>
        {topScore > 0 && (
          <div style={{ fontSize: 34, color: "#9DA89F", marginTop: 24 }}>{`${top.length} hand-scored cosy stays - up to ${topScore.toFixed(1)}/10`}</div>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 18, marginTop: 50, flex: 1 }}>
          {lines.map((line, i) => (
            <div key={i} style={{ fontSize: 40, fontWeight: 600 }}>{`${i + 1}.  ${line}`}</div>
          ))}
          {lines.length === 0 && <div style={{ fontSize: 40, color: "#9DA89F" }}>Discover cosy hotels at gotcosy.com</div>}
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
