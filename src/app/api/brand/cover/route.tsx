// Wide profile cover/banner (Pinterest profile, Facebook page). 1600×900.
//   GET /api/brand/cover → PNG
import { ImageResponse } from "next/og";

export const runtime = "nodejs";

export async function GET() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", background: "linear-gradient(135deg, #1d2a22 0%, #0F1512 100%)", padding: "0 110px", fontFamily: "Georgia, serif" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          <div style={{ display: "flex", width: 96, height: 96, borderRadius: 96, background: "#E08A4B", alignItems: "center", justifyContent: "center" }}>
            <div style={{ fontSize: 66, fontWeight: 800, color: "#1d2a22", lineHeight: 1 }}>c</div>
          </div>
          <div style={{ fontSize: 84, fontWeight: 800, color: "#F3EEE6", letterSpacing: -1 }}>Got Cosy?</div>
        </div>
        <div style={{ display: "flex", fontSize: 56, color: "#F3EEE6", marginTop: 40, lineHeight: 1.15, maxWidth: 1150, fontFamily: "Inter, sans-serif", fontWeight: 600 }}>
          The cosiest hotels, AI-ranked for warmth, character and intimacy — not just stars.
        </div>
        <div style={{ fontSize: 34, color: "#9DA89F", marginTop: 28, letterSpacing: 4, fontFamily: "Inter, sans-serif" }}>REAL PHOTOS · HONEST COSY SCORES · gotcosy.com</div>
      </div>
    ),
    { width: 1600, height: 900 }
  );
}
