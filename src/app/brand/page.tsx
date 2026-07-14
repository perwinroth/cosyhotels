// Brand kit for the social profiles: avatar + cover images (right-click/download) and
// ready-to-copy bio text per platform. Internal/noindexed.
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Brand kit", robots: { index: false, follow: false } };

const BIOS: Array<{ platform: string; limit: string; text: string }> = [
  { platform: "Pinterest", limit: "~160 chars", text: "The cosiest hotels, AI-ranked for warmth, character & intimacy, not just stars. Real photos, the signals behind each score. Find your cosiest stay → gotcosy.com" },
  { platform: "Instagram", limit: "150 chars", text: "AI-rated cosy hotels ✨\nWarmth & character over star ratings 🔥\nReal cosy scores · boutique stays\nFind your cosiest stay ↓" },
  { platform: "Threads", limit: "~160 chars", text: "AI-rated cosy hotels. We score warmth, character & intimacy, not stars. Real photos, the signals behind each score, boutique stays. → gotcosy.com" },
  { platform: "TikTok", limit: "80 chars", text: "AI-rated cosy hotels 🔥 warmth & character, not stars → gotcosy.com" },
  { platform: "Facebook (About)", limit: "longer", text: "Got Cosy? rates hotels on what actually makes a stay cosy (warmth, character and intimacy) using AI, not star ratings. Browse AI-ranked cosy hotels by city, each with real photos and the signals behind its score, and check availability in one tap. Find your cosiest stay at gotcosy.com." },
];

export default function BrandPage() {
  const card: React.CSSProperties = { background: "#16201A", border: "1px solid #243029", borderRadius: 14, padding: 18 };
  return (
    <div style={{ minHeight: "100vh", background: "#0F1512", color: "#F3EEE6", fontFamily: "Inter, system-ui, sans-serif", padding: "32px 20px" }}>
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0 }}>Brand kit</h1>
        <p style={{ color: "#9DA89F", marginTop: 8, fontSize: 14 }}>Right-click → Save the images, and copy the bio for each platform. Handles: Pinterest <strong>@gotcosy</strong> · Instagram/Threads <strong>@got_cosy</strong>.</p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginTop: 22 }}>
          <div style={card}>
            <div style={{ fontSize: 13, color: "#9DA89F", marginBottom: 10 }}>Profile avatar (1000×1000)</div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/api/brand/avatar" alt="avatar" style={{ width: "100%", aspectRatio: "1/1", borderRadius: 12, display: "block" }} />
            <a href="/api/brand/avatar" download="gotcosy-avatar.png" style={{ display: "inline-block", marginTop: 10, color: "#7FB4FF", fontSize: 13 }}>download ↓</a>
          </div>
          <div style={card}>
            <div style={{ fontSize: 13, color: "#9DA89F", marginBottom: 10 }}>Cover / banner (1600×900)</div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/api/brand/cover" alt="cover" style={{ width: "100%", aspectRatio: "16/9", borderRadius: 12, display: "block", objectFit: "cover" }} />
            <a href="/api/brand/cover" download="gotcosy-cover.png" style={{ display: "inline-block", marginTop: 10, color: "#7FB4FF", fontSize: 13 }}>download ↓</a>
          </div>
        </div>

        <h2 style={{ fontSize: 18, fontWeight: 700, marginTop: 30 }}>Profile bios</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 12 }}>
          {BIOS.map((b) => (
            <div key={b.platform} style={card}>
              <div style={{ fontSize: 13, color: "#E08A4B", fontWeight: 700 }}>{b.platform} <span style={{ color: "#6f7a72", fontWeight: 400 }}>· {b.limit}</span></div>
              <pre style={{ whiteSpace: "pre-wrap", fontFamily: "inherit", fontSize: 14, color: "#F3EEE6", margin: "8px 0 0", lineHeight: 1.5 }}>{b.text}</pre>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
