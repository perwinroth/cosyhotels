// Favicon — the flame mark on brand amber. Next App Router generates the site icon from this.
import { ImageResponse } from "next/og";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#E08A4B", borderRadius: 14 }}>
        <svg width="44" height="44" viewBox="0 0 24 24" fill="none">
          <path d="M16.3 5.86 A7.5 7.5 0 1 0 16.3 18.14 L14.29 15.28 A4 4 0 1 1 14.29 8.72 Z" fill="#1d2a22" />
          <path d="M16.3 5.86 C14 3, 13.2 1.6, 13.6 1 C14.7 2.6, 16 4, 16.3 5.86 Z" fill="#1d2a22" />
        </svg>
      </div>
    ),
    { ...size }
  );
}
