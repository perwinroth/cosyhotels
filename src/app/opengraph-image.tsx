import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Got Cosy? — AI-rated cosy hotels";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Branded social-share card: dark Boutique-Nocturne look, "Got cosy?" wordmark.
export default function OG() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "radial-gradient(900px 500px at 50% 0%, #1d2a22, #0F1512)",
          color: "#F3EEE6",
          fontFamily: "serif",
        }}
      >
        <div
          style={{
            fontSize: 30,
            letterSpacing: 6,
            textTransform: "uppercase",
            color: "#E08A4B",
            fontFamily: "sans-serif",
            marginBottom: 28,
          }}
        >
          ◆ AI-rated hotels for cosiness
        </div>
        <div style={{ fontSize: 150, fontWeight: 700, letterSpacing: -3, display: "flex" }}>
          <span>Got&nbsp;</span>
          <span style={{ color: "#E08A4B", fontStyle: "italic" }}>cosy?</span>
        </div>
        <div style={{ fontSize: 40, color: "#9DA89F", marginTop: 24, fontFamily: "sans-serif" }}>
          Hotels ranked by cosiness — not stars.
        </div>
        <div style={{ fontSize: 28, color: "#D8B25A", marginTop: 48, fontFamily: "sans-serif", letterSpacing: 1 }}>
          gotcosy.com
        </div>
      </div>
    ),
    { ...size }
  );
}
