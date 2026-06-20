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
            <svg width="54" height="54" viewBox="0 0 24 24" fill="none">
              <path transform="scale(-1,1) translate(-24,0)" d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" fill="#1d2a22" />
            </svg>
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
