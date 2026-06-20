// Square profile avatar for the social accounts (Pinterest/Instagram/Threads/Facebook).
// Brand: dark cosy green + warm amber. Kept simple so it reads at small/circular sizes.
//   GET /api/brand/avatar   → 1000×1000 PNG
import { ImageResponse } from "next/og";

export const runtime = "nodejs";

export async function GET() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "radial-gradient(circle at 50% 38%, #243a2e 0%, #0F1512 70%)", fontFamily: "Georgia, serif" }}>
        <div style={{ display: "flex", width: 220, height: 220, borderRadius: 200, background: "#E08A4B", alignItems: "center", justifyContent: "center", boxShadow: "0 10px 40px rgba(0,0,0,.45)" }}>
          <div style={{ fontSize: 150, fontWeight: 800, color: "#1d2a22", lineHeight: 1 }}>c</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: 46 }}>
          <div style={{ fontSize: 96, fontWeight: 800, color: "#F3EEE6", letterSpacing: -1, lineHeight: 1 }}>Got Cosy?</div>
          <div style={{ fontSize: 32, color: "#9DA89F", letterSpacing: 6, marginTop: 20, textTransform: "uppercase", fontFamily: "Inter, sans-serif" }}>AI-rated cosy hotels</div>
        </div>
      </div>
    ),
    { width: 1000, height: 1000 }
  );
}
