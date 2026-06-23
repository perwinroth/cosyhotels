// Per-hotel Pinterest pin image: the hotel's real photo (full-bleed) + a "COSY SCORE x.x"
// badge baked in, plus the hotel name & city. Pinterest pins are a single image, so the
// badge must live IN the image. 1000×1500 (Pinterest 2:3).
//   GET /api/social/hotel-pin?photo=<url>&score=8.5&name=Hotel%20X&city=Paris
import { ImageResponse } from "next/og";
import sharp from "sharp";

export const runtime = "nodejs";

function safe(s: string): string {
  return (s || "").replace(/…/g, "...").replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, "-").trim();
}

// satori (next/og) only decodes JPEG/PNG — a WebP/AVIF <img> silently renders as the black
// background. So fetch the photo ourselves and transcode to a JPEG data URI (cover-cropped to
// the 1000×1500 frame). Returns null on fetch/decode failure → caller renders without a photo
// and the social-publish brightness guard drops the black card before it posts.
async function photoDataUri(url: string): Promise<string | null> {
  if (!url) return null;
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(8000), redirect: "follow" });
    if (!r.ok) return null;
    const buf = Buffer.from(await r.arrayBuffer());
    const jpeg = await sharp(buf).resize(1000, 1500, { fit: "cover", position: "centre" }).jpeg({ quality: 82 }).toBuffer();
    return `data:image/jpeg;base64,${jpeg.toString("base64")}`;
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  const p = new URL(req.url).searchParams;
  const photo = await photoDataUri(p.get("photo") || "");
  const name = safe(p.get("name") || "").slice(0, 48);
  const city = safe(p.get("city") || "");
  const score = Number(p.get("score")) || 0;

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", position: "relative", background: "#0F1512" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {photo ? <img src={photo} alt="" width={1000} height={1500} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : null}
        {/* top gradient + brand */}
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 220, display: "flex", justifyContent: "flex-start", alignItems: "flex-start", padding: 40, background: "linear-gradient(rgba(15,21,18,.75), rgba(15,21,18,0))" }}>
          <div style={{ color: "#F3EEE6", fontSize: 30, fontWeight: 700, letterSpacing: 4 }}>GOT COSY?</div>
        </div>
        {/* Cosy score badge — placed BELOW Instagram's square grid-crop line (~y250 of 1500) so
            it's never cropped in the profile grid; still visible in the 4:5 feed crop. */}
        <div style={{ position: "absolute", top: 296, right: 40, display: "flex", flexDirection: "column", alignItems: "center", background: "#E08A4B", borderRadius: 22, padding: "14px 22px", boxShadow: "0 6px 24px rgba(0,0,0,.35)" }}>
          <div style={{ fontSize: 58, fontWeight: 800, color: "#1d2a22", lineHeight: 1 }}>{score.toFixed(1)}</div>
          <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: 3, color: "#3a2a16", marginTop: 4 }}>COSY SCORE</div>
        </div>
        {/* bottom gradient + name/city */}
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, display: "flex", flexDirection: "column", padding: 50, background: "linear-gradient(rgba(15,21,18,0), rgba(15,21,18,.92))" }}>
          <div style={{ color: "#E08A4B", fontSize: 26, fontWeight: 700, letterSpacing: 4, textTransform: "uppercase" }}>{city ? `Cosiest in ${city}` : "AI-rated for cosiness"}</div>
          <div style={{ color: "#F3EEE6", fontSize: 64, fontWeight: 800, lineHeight: 1.05, marginTop: 12 }}>{name}</div>
          <div style={{ color: "#D8B25A", fontSize: 28, marginTop: 16 }}>gotcosy.com</div>
        </div>
      </div>
    ),
    { width: 1000, height: 1500 }
  );
}
