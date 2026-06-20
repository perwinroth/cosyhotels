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
import { cityPin } from "@/lib/social";

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
  const city = sp.get("city")?.trim();
  const schedule = sp.get("schedule")?.trim() || "";
  const dry = sp.get("dry") === "1";
  if (!city) return NextResponse.json({ error: "?city= is required" }, { status: 400 });

  const key = process.env.BLOTATO_API_KEY;
  if (!key) return NextResponse.json({ error: "BLOTATO_API_KEY not set" }, { status: 500 });
  const pinAccount = process.env.BLOTATO_PINTEREST_ACCOUNT_ID || "7575";
  const pinBoard = process.env.BLOTATO_PINTEREST_BOARD_ID || "";
  const igAccount = process.env.BLOTATO_INSTAGRAM_ACCOUNT_ID || "";

  const db = getServerSupabase();
  if (!db) return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  const base = process.env.NEXT_PUBLIC_SITE_URL || "https://gotcosy.com";
  // Absolutize relative URLs (/api/places/photo) and decode &amp; — Blotato fetches by URL.
  const toAbs = (u: string) => { const d = u.replace(/&amp;/g, "&"); return d.startsWith("/") ? base + d : d; };

  const pin = await cityPin(db, city, base);
  if (!pin.slides.length) return NextResponse.json({ error: `no publishable slides for ${city}` }, { status: 422 });

  // IG caption @-mentions the featured hotels (drives reposts); Pinterest uses a clean description.
  const mentions = pin.slides.map((s) => s.instagram).filter(Boolean).join(" ");
  const igCaption = `${pin.description}${mentions ? `\n\nFeaturing ${mentions}` : ""}`;

  if (dry) {
    return NextResponse.json({
      dry: true, city, slides: pin.slides.length,
      pinterest: { account: pinAccount, board: pinBoard || "(BLOTATO_PINTEREST_BOARD_ID unset)", title: pin.title, link: pin.link },
      instagram: igAccount ? { account: igAccount, caption: igCaption } : "(not connected — set BLOTATO_INSTAGRAM_ACCOUNT_ID)",
      photos: pin.slides.map((s) => toAbs(s.photo)),
    });
  }

  // 1) Upload each slide photo to Blotato (normalizes long Places URLs → short hosted ones).
  const mediaUrls: string[] = [];
  for (const s of pin.slides) {
    try {
      const up = await blotato("/v2/media", { url: toAbs(s.photo) }, key);
      if (typeof up.url === "string") mediaUrls.push(up.url);
    } catch { /* skip an image Blotato can't fetch */ }
  }
  if (!mediaUrls.length) return NextResponse.json({ error: "no images could be uploaded to Blotato" }, { status: 502 });

  const sched = schedule ? { scheduledTime: schedule } : {};
  const results: Record<string, unknown> = {};

  // 2) Pinterest pin (carousel).
  if (pinBoard) {
    results.pinterest = await blotato("/v2/posts", {
      post: {
        accountId: pinAccount,
        content: { text: pin.description, mediaUrls, platform: "pinterest" },
        target: { targetType: "pinterest", boardId: pinBoard, title: pin.title, link: pin.link, altText: `Cosiest hotels in ${city}` },
      },
      ...sched,
    }, key).catch((e) => ({ error: String(e) }));
  } else {
    results.pinterest = "skipped — BLOTATO_PINTEREST_BOARD_ID unset";
  }

  // 3) Instagram carousel (only if an IG account is connected).
  if (igAccount) {
    results.instagram = await blotato("/v2/posts", {
      post: {
        accountId: igAccount,
        content: { text: igCaption, mediaUrls, platform: "instagram" },
        target: { targetType: "instagram" },
      },
      ...sched,
    }, key).catch((e) => ({ error: String(e) }));
  } else {
    results.instagram = "skipped — not connected";
  }

  return NextResponse.json({ city, published: !schedule, scheduledTime: schedule || null, mediaCount: mediaUrls.length, results });
}
