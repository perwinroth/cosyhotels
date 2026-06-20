// Publish a city's cosy-hotel carousel to Blotato → Pinterest (and Instagram once connected).
// Replaces the n8n middle layer: build the carousel from our own data, upload the photos to
// Blotato, post the pin. Featured hotels are @mentioned (IG) so they repost → free reach.
//
//   GET /api/cron/social-publish?city=Paris          publish now
//        &schedule=2026-06-21T09:00:00Z              schedule instead of publishing now
//        &dry=1                                       show what WOULD post; call nothing
//
// Env: BLOTATO_API_KEY (required), BLOTATO_PINTEREST_ACCOUNT_ID (default 7575),
//      BLOTATO_PINTEREST_BOARD_ID (required for Pinterest),
//      BLOTATO_INSTAGRAM_ACCOUNT_ID (optional — when set, also posts to Instagram).
import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";
import { cityPin, hotelPinImageUrl, hotelPinDescription, populatedCities } from "@/lib/social";

export const runtime = "nodejs";
export const maxDuration = 300;
export const revalidate = 0;

const BLOTATO = "https://backend.blotato.com";

async function blotato(path: string, body: unknown, key: string) {
  const res = await fetch(`${BLOTATO}${path}`, {
    method: "POST",
    headers: { "blotato-api-key": key, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`blotato ${path} ${res.status}: ${JSON.stringify(json).slice(0, 300)}`);
  return json as Record<string, unknown>;
}

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const schedule = sp.get("schedule")?.trim() || "";
  const dry = sp.get("dry") === "1";
  const auto = sp.get("auto") === "1";          // pick the city automatically (daily rotation)
  const only = sp.get("only")?.trim() || "";    // "instagram" | "pinterest" | "" (both)

  const key = process.env.BLOTATO_API_KEY;
  if (!key) return NextResponse.json({ error: "BLOTATO_API_KEY not set" }, { status: 500 });

  // Protect real posting: when CRON_SECRET is set, require it (Vercel cron sends it as a
  // Bearer token; manual calls can pass ?key=). Dry runs are open.
  const secret = process.env.CRON_SECRET;
  if (!dry && secret) {
    const auth = req.headers.get("authorization") || "";
    if (auth !== `Bearer ${secret}` && sp.get("key") !== secret) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  const pinAccount = process.env.BLOTATO_PINTEREST_ACCOUNT_ID || "7575";
  const pinBoard = process.env.BLOTATO_PINTEREST_BOARD_ID || "";
  const igAccount = process.env.BLOTATO_INSTAGRAM_ACCOUNT_ID || "";

  const db = getServerSupabase();
  if (!db) return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  const base = process.env.NEXT_PUBLIC_SITE_URL || "https://gotcosy.com";

  // City: explicit ?city=, or auto-rotate one populated city per day.
  let city = sp.get("city")?.trim() || "";
  if (!city && auto) {
    const cities = await populatedCities(db);
    if (!cities.length) return NextResponse.json({ error: "no populated cities" }, { status: 404 });
    const dayIdx = Math.floor(Date.now() / 86_400_000);
    city = cities[dayIdx % cities.length].city;
  }
  if (!city) return NextResponse.json({ error: "?city= or ?auto=1 required" }, { status: 400 });

  const pin = await cityPin(db, city, base);
  if (!pin.slides.length) return NextResponse.json({ error: `no publishable slides for ${city}` }, { status: 422 });

  // IG caption @-mentions the featured hotels (drives reposts); Pinterest uses a clean description.
  const mentions = pin.slides.map((s) => s.instagram).filter(Boolean).join(" ");
  const igCaption = `${pin.description}${mentions ? `\n\nFeaturing ${mentions}` : ""}`;

  // Each hotel → its own badge image (photo + Cosy Score). Pinterest = one pin per hotel
  // (its single-image native format); Instagram = one carousel of all the badge images.
  const badgeUrls = pin.slides.map((s) => hotelPinImageUrl(base, s));

  if (dry) {
    return NextResponse.json({
      dry: true, city, hotels: pin.slides.length,
      pinterest: pinBoard
        ? { account: pinAccount, board: pinBoard, pins: pin.slides.map((s) => ({ title: `${s.name} · ${s.city}`, score: s.score, link: pin.link, media: hotelPinImageUrl(base, s) })) }
        : "(BLOTATO_PINTEREST_BOARD_ID unset)",
      instagram: igAccount ? { account: igAccount, caption: igCaption, slides: badgeUrls.length } : "(not connected — set BLOTATO_INSTAGRAM_ACCOUNT_ID)",
    });
  }

  const sched = schedule ? { scheduledTime: schedule } : {};
  const results: Record<string, unknown> = {};

  // Upload helper: badge image → Blotato-hosted URL.
  const upload = async (u: string): Promise<string | null> => {
    try { const up = await blotato("/v2/media", { url: u }, key); return typeof up.url === "string" ? up.url : null; }
    catch { return null; }
  };

  // 1) Pinterest — ONE pin per hotel (single image), best Pinterest format + max discovery.
  if (pinBoard && only !== "instagram") {
    const pinResults: unknown[] = [];
    for (const s of pin.slides) {
      const hosted = await upload(hotelPinImageUrl(base, s));
      if (!hosted) { pinResults.push({ hotel: s.name, error: "media upload failed" }); continue; }
      const r = await blotato("/v2/posts", {
        post: {
          accountId: pinAccount,
          content: { text: hotelPinDescription(s.name, s.city, s.score), mediaUrls: [hosted], platform: "pinterest" },
          target: { targetType: "pinterest", boardId: pinBoard, title: `${s.name} · ${s.city}`, link: pin.link, altText: `${s.name}, a cosy hotel in ${s.city}` },
        },
        ...sched,
      }, key).then(() => ({ hotel: s.name, ok: true })).catch((e) => ({ hotel: s.name, error: String(e) }));
      pinResults.push(r);
    }
    results.pinterest = pinResults;
  } else {
    results.pinterest = "skipped — BLOTATO_PINTEREST_BOARD_ID unset";
  }

  // 2) Instagram — ONE carousel of all the badge images (only if connected).
  if (igAccount && only !== "pinterest") {
    const hosted = (await Promise.all(badgeUrls.map(upload))).filter((u): u is string => !!u);
    results.instagram = hosted.length
      ? await blotato("/v2/posts", {
          post: { accountId: igAccount, content: { text: igCaption, mediaUrls: hosted, platform: "instagram" }, target: { targetType: "instagram" } },
          ...sched,
        }, key).catch((e) => ({ error: String(e) }))
      : { error: "no images uploaded" };
  } else {
    results.instagram = "skipped — not connected";
  }

  return NextResponse.json({ city, published: !schedule, scheduledTime: schedule || null, hotels: pin.slides.length, results });
}
