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
import sharp from "sharp";
import { getServerSupabase } from "@/lib/supabase/server";
import { cityPin, hotelPinImageUrl, hotelPinDescription, populatedCities } from "@/lib/social";

export const runtime = "nodejs";
export const maxDuration = 300;
export const revalidate = 0;

const BLOTATO = "https://backend.blotato.com";

// A carousel needs at least this many real-photo slides to be worth posting (Instagram).
// Below it we skip rather than publish a 1-image "carousel".
const MIN_IG_SLIDES = 3;
// A rendered badge below this mean brightness (0–255) is the black fallback (photo failed to
// decode/fetch), not a real photo. Pure-black bg renders ~20; real photos sit well above.
const MIN_BADGE_BRIGHTNESS = 32;

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

// Render the badge ourselves and measure mean brightness so we never publish a black card.
// Returns null on our own fetch error (don't over-drop on transient flakiness); 0 when the
// badge endpoint itself failed (treat as black → drop).
async function badgeBrightness(url: string): Promise<number | null> {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!r.ok) return 0;
    const buf = Buffer.from(await r.arrayBuffer());
    const { data } = await sharp(buf).resize(40, 60, { fit: "fill" }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    let sum = 0;
    for (const v of data) sum += v;
    return sum / data.length;
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const schedule = sp.get("schedule")?.trim() || "";
  const dry = sp.get("dry") === "1";
  const auto = sp.get("auto") === "1";          // pick the city automatically (daily rotation)
  const only = sp.get("only")?.trim() || "";    // "instagram" | "pinterest" | "" (both)
  const limit = Math.max(0, parseInt(sp.get("limit") || "0", 10) || 0); // cap Pinterest pins/run (0 = whole city)

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
  // Default board = "Cosy hotel stays" (gotcosy Pinterest). Override via BLOTATO_PINTEREST_BOARD_ID.
  const pinBoard = process.env.BLOTATO_PINTEREST_BOARD_ID || "1102537621216957324";
  // INSTAGRAM AUTOPOSTING SUSPENDED (founder, 2026-07-12). Instagram restricted @got_cosy on
  // 2026-07-11 15:02 ("we restrict certain activity") after this cron's API post with multiple
  // @-mentions; the account must stay clean for the badge DM wave (incident record:
  // die-validation outreach-experiment-preregistration, INCIDENT 2026-07-11). Pinterest is
  // unaffected. Re-enabling needs a mention cap and a Challenger re-pass, not just this flag.
  const igAccount = "";

  const db = getServerSupabase();
  if (!db) return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  const base = process.env.NEXT_PUBLIC_SITE_URL || "https://gotcosy.com";

  // City: explicit ?city=, or auto-rotate. Rotation must land on a city that can actually fill
  // a carousel — blindly cycling by day-index lands on villages (e.g. Giethoorn) with a single
  // vetted photo, which then posts as a 1-image "carousel". So walk forward from today's index
  // and pick the first city with enough photo slides (bounded scan to keep the cron cheap).
  let city = sp.get("city")?.trim() || "";
  let pin = city ? await cityPin(db, city, base) : null;
  if (!city && auto) {
    const cities = await populatedCities(db);
    if (!cities.length) return NextResponse.json({ error: "no populated cities" }, { status: 404 });
    const dayIdx = Math.floor(Date.now() / 86_400_000);
    // ROTATION FIX: don't "walk forward to the first carousel-capable city" — with good-photo
    // cities being sparse, that lands on the SAME city for many days in a row (the Stratford
    // repeat). Instead collect the cities that can actually fill a carousel, then rotate through
    // THAT eligible list by day-index, so each day posts a different one. Bounded scan for cost.
    const eligible: Array<{ city: string; pin: Awaited<ReturnType<typeof cityPin>> }> = [];
    for (const c of cities) {
      const p = await cityPin(db, c.city, base);
      if (p.slides.length >= MIN_IG_SLIDES) eligible.push({ city: c.city, pin: p });
      if (eligible.length >= 60) break; // plenty of rotation variety; keep the cron cheap
    }
    if (eligible.length) {
      const pick = eligible[dayIdx % eligible.length];
      city = pick.city; pin = pick.pin;
    } else { // nothing fills a carousel — fall back to the top populated city
      city = cities[dayIdx % cities.length].city; pin = await cityPin(db, city, base);
    }
  }
  if (!city || !pin) return NextResponse.json({ error: "?city= or ?auto=1 required" }, { status: 400 });
  if (!pin.slides.length) return NextResponse.json({ error: `no publishable slides for ${city}` }, { status: 422 });

  // Drop any slide whose badge renders black (photo failed to decode/fetch) before it can post.
  const vetted = [];
  for (const s of pin.slides) {
    const b = await badgeBrightness(hotelPinImageUrl(base, s));
    if (b !== null && b < MIN_BADGE_BRIGHTNESS) continue;
    vetted.push(s);
  }
  if (!vetted.length) return NextResponse.json({ error: `all slides rendered black for ${city}` }, { status: 422 });

  // IG caption @-mentions the featured hotels (drives reposts); Pinterest uses a clean description.
  const mentions = vetted.map((s) => s.instagram).filter(Boolean).join(" ");
  const igCaption = `${pin.description}${mentions ? `\n\nFeaturing ${mentions}` : ""}`;

  // Each hotel → its own badge image (photo + Cosy Score). Pinterest = one pin per hotel
  // (its single-image native format); Instagram = one carousel of all the badge images.
  const badgeUrls = vetted.map((s) => hotelPinImageUrl(base, s));
  const dropped = pin.slides.length - vetted.length;

  if (dry) {
    return NextResponse.json({
      dry: true, city, hotels: vetted.length, droppedBlack: dropped,
      pinterest: pinBoard
        ? { account: pinAccount, board: pinBoard, limit: limit || null, pins: (limit > 0 ? vetted.slice(0, limit) : vetted).map((s) => ({ title: `${s.name} · ${s.city}`, score: s.score, link: pin.link, media: hotelPinImageUrl(base, s) })) }
        : "(BLOTATO_PINTEREST_BOARD_ID unset)",
      instagram: igAccount
        ? (vetted.length >= MIN_IG_SLIDES
            ? { account: igAccount, caption: igCaption, slides: badgeUrls.length }
            : `(would skip — only ${vetted.length} valid slide(s), need ${MIN_IG_SLIDES} for a carousel)`)
        : "(not connected — set BLOTATO_INSTAGRAM_ACCOUNT_ID)",
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
    // Cap pins per run when ?limit= is set (conservative cadence just after account warm-up).
    const pinSlides = limit > 0 ? vetted.slice(0, limit) : vetted;
    for (const s of pinSlides) {
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

  // 2) Instagram — ONE carousel of all the badge images (only if connected). Never post a
  // sub-carousel: a 1–2 image "carousel" looks broken, so require MIN_IG_SLIDES.
  if (igAccount && only !== "pinterest") {
    if (vetted.length < MIN_IG_SLIDES) {
      results.instagram = `skipped — only ${vetted.length} valid slide(s), need ${MIN_IG_SLIDES} for a carousel`;
    } else {
      const hosted = (await Promise.all(badgeUrls.map(upload))).filter((u): u is string => !!u);
      results.instagram = hosted.length >= MIN_IG_SLIDES
        ? await blotato("/v2/posts", {
            post: { accountId: igAccount, content: { text: igCaption, mediaUrls: hosted, platform: "instagram" }, target: { targetType: "instagram" } },
            ...sched,
          }, key).catch((e) => ({ error: String(e) }))
        : { error: `only ${hosted.length} image(s) uploaded, need ${MIN_IG_SLIDES}` };
    }
  } else {
    results.instagram = "skipped — not connected";
  }

  return NextResponse.json({ city, published: !schedule, scheduledTime: schedule || null, hotels: vetted.length, droppedBlack: dropped, results });
}
