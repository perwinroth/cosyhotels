// Embeddable "Rated Cosy by Got Cosy" badge (SVG) — the backlink engine. A featured hotel
// drops <a href="…/hotels/{slug}"><img src="/api/badge?score=8.4&name=…"></a> on their site,
// which earns us a real backlink + a trust signal for them. SVG so it stays crisp anywhere.
export const runtime = "nodejs";

function esc(s: string): string {
  return s.replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c] || c));
}

export function GET(req: Request) {
  const p = new URL(req.url).searchParams;
  const score = Math.max(0, Math.min(10, Number(p.get("score")) || 0)).toFixed(1);
  const name = esc((p.get("name") || "").slice(0, 34));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="92" viewBox="0 0 240 92" role="img" aria-label="Rated ${score} out of 10 for cosiness by Got Cosy">
  <rect width="240" height="92" rx="14" fill="#16201C"/>
  <rect x="0.5" y="0.5" width="239" height="91" rx="13.5" fill="none" stroke="#2A332D"/>
  <circle cx="50" cy="46" r="30" fill="#E08A4B"/>
  <text x="50" y="50" text-anchor="middle" font-family="Georgia, serif" font-size="26" font-weight="700" fill="#16201C">${score}</text>
  <text x="50" y="66" text-anchor="middle" font-family="Inter, system-ui, sans-serif" font-size="7.5" font-weight="700" letter-spacing="1.2" fill="#3a2a16">COSY SCORE</text>
  <text x="92" y="34" font-family="Georgia, serif" font-size="15" font-weight="700" fill="#F3EEE6">GOT COSY<tspan fill="#E08A4B">?</tspan></text>
  <text x="92" y="52" font-family="Inter, system-ui, sans-serif" font-size="10.5" fill="#9DA89F">${name || "AI-rated for cosiness"}</text>
  <text x="92" y="70" font-family="Inter, system-ui, sans-serif" font-size="10" font-weight="600" fill="#D8B25A">gotcosy.com</text>
</svg>`;
  return new Response(svg, { headers: { "content-type": "image/svg+xml; charset=utf-8", "cache-control": "public, max-age=86400, s-maxage=86400" } });
}
