// Self-driving population cron. Walks the tiered target-city list and, per city, runs the
// cost-minimizing funnel: ingest all OSM lodging (free) → rank by the free heuristic → take
// the top `depth` (tier-4 also requires a real photo + heuristic bar) → resolve a free photo
// → vision-score with Claude. State in populate_state (resumes, never repeats); approximate
// spend in populate_budget enforces a hard cap. Free ingestion continues even if scoring is
// paused by the cap. Designed to be hit on a schedule; processes one city-batch per run.
import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";
import { osmSearchHotels, type OSMHotel } from "@/lib/vendors/osm";
import { osmCosyScore } from "@/lib/scoring/osmCosy";
import { resolveHotelImage } from "@/lib/hotelImageFree";
import { claudeCosyScore } from "@/lib/scoring/claudeCosy";
import { targetCities, type TargetCity } from "@/data/targetCities";

export const runtime = "nodejs";
export const maxDuration = 300;

const BATCH = 40;                       // hotels scored per invocation
const USD_PER_SCORE = 0.011;            // approx vision cost per hotel
const CAP_USD = Number(process.env.POPULATE_BUDGET_USD || "200");
const TIER4_HEURISTIC_MIN = 6.0;        // long tail: only score the genuinely promising

function slugify(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "hotel";
}

type DB = NonNullable<ReturnType<typeof getServerSupabase>>;

async function spent(db: DB): Promise<number> {
  const { data } = await db.from("populate_budget").select("spent_usd").eq("id", 1).maybeSingle();
  return Number((data as { spent_usd: number } | null)?.spent_usd ?? 0);
}

async function nextCity(db: DB): Promise<TargetCity | null> {
  const { data } = await db.from("populate_state").select("city,status,hotels_scored");
  const state = new Map<string, { status: string; hotels_scored: number }>();
  for (const r of (data || []) as Array<{ city: string; status: string; hotels_scored: number }>) {
    state.set(r.city, { status: r.status, hotels_scored: r.hotels_scored });
  }
  // First city that isn't 'done' or 'error', in tier priority order.
  for (const t of targetCities) {
    const s = state.get(t.city);
    if (!s || (s.status !== "done" && s.status !== "error")) return t;
  }
  return null;
}

async function run() {
  const db = getServerSupabase();
  if (!db) return { error: "Supabase not configured" } as const;

  const budget = await spent(db);
  const scoringOn = budget < CAP_USD;

  const t = await nextCity(db);
  if (!t) return { done: true, message: "all target cities processed", spent_usd: budget } as const;

  let found: OSMHotel[] = [];
  try { found = await osmSearchHotels(t.city); } catch { /* mirror down; retry next run */ }
  if (!found.length) {
    await db.from("populate_state").upsert({ city: t.city, tier: t.tier, status: "error", note: "no OSM results", ingested_at: new Date().toISOString() }, { onConflict: "city" });
    return { city: t.city, found: 0, status: "error" } as const;
  }

  // Rank by free heuristic; tier-4 gates on heuristic bar.
  let ranked = found
    .map((h) => ({ h, cosy: osmCosyScore(h).cosy }))
    .sort((a, b) => b.cosy - a.cosy);
  if (t.tier === 4) ranked = ranked.filter((x) => x.cosy >= TIER4_HEURISTIC_MIN);
  const top = ranked.slice(0, t.depth).map((x) => x.h);

  // Map existing rows by source_id; insert missing.
  const ids = top.map((h) => h.id);
  const idMap = new Map<string, string>(); // source_id -> hotel uuid
  for (let i = 0; i < ids.length; i += 200) {
    const { data } = await db.from("hotels").select("id,source_id").eq("source", "osm").in("source_id", ids.slice(i, i + 200));
    for (const r of (data || []) as Array<{ id: string; source_id: string }>) idMap.set(r.source_id, r.id);
  }
  let ingested = 0;
  for (const h of top) {
    if (idMap.has(h.id)) continue;
    const digits = h.id.replace(/\D/g, "") || h.id.replace(/[^a-z0-9]/gi, "");
    const { data, error } = await db.from("hotels").insert({
      source: "osm", source_id: h.id, slug: `${slugify(h.name)}-${digits}`.slice(0, 80),
      name: h.name, city: h.city || t.city, country: h.country || null,
      lat: h.lat, lng: h.lng, website: h.website || null, address: h.address || null, stars: h.stars ?? null,
    }).select("id").single();
    if (!error && data) { idMap.set(h.id, String((data as { id: string }).id)); ingested++; }
  }

  // Which of the top are already scored? Skip them.
  const uuids = [...idMap.values()];
  const scoredSet = new Set<string>();
  for (let i = 0; i < uuids.length; i += 200) {
    const { data } = await db.from("cosy_scores").select("hotel_id").in("hotel_id", uuids.slice(i, i + 200));
    for (const r of (data || []) as Array<{ hotel_id: string }>) scoredSet.add(String(r.hotel_id));
  }
  const toScore = top.filter((h) => idMap.get(h.id) && !scoredSet.has(idMap.get(h.id)!)).slice(0, BATCH);

  let scoredNow = 0, errors = 0;
  if (scoringOn && budget + toScore.length * USD_PER_SCORE <= CAP_USD + 1) {
    const CONC = 4;
    for (let i = 0; i < toScore.length; i += CONC) {
      const batch = toScore.slice(i, i + CONC);
      await Promise.all(batch.map(async (h) => {
        const hid = idMap.get(h.id)!;
        try {
          const img = await resolveHotelImage({ name: h.name, website: h.website, wikidata: h.wikidata, imageTag: h.imageTag, lat: h.lat, lng: h.lng, city: h.city || t.city });
          if (img.source !== "placeholder") {
            await db.from("hotel_images").insert({ hotel_id: hid, url: img.url, attributions: img.attribution ?? null });
          }
          const base = { name: h.name, city: h.city || t.city, country: h.country ?? undefined, website: h.website ?? undefined, stars: h.stars ?? undefined };
          const hasImg = img.source !== "placeholder";
          let r;
          try {
            r = await claudeCosyScore({ ...base, imageUrls: hasImg ? [img.url] : undefined });
          } catch (e) {
            // Bad/broken image URL can 400 the vision call — retry text-only so the hotel still scores.
            if (hasImg) r = await claudeCosyScore(base);
            else throw e;
          }
          const now = new Date().toISOString();
          await db.from("cosy_scores").upsert({
            hotel_id: hid, score: r.score10, raw_score: r.score10, score_100: r.score100,
            signals: r.signals, penalties: r.penalties, description: r.description,
            confidence: r.confidence, score_model: r.model, scored_at: now, computed_at: now,
          }, { onConflict: "hotel_id" });
          scoredNow++;
        } catch { errors++; }
      }));
    }
    if (scoredNow) {
      await db.from("populate_budget").update({ spent_usd: budget + scoredNow * USD_PER_SCORE, updated_at: new Date().toISOString() }).eq("id", 1);
    }
  }

  // Update state. Done when no unscored candidates remain (all top scored, or scoring paused
  // but ingest complete and nothing left to score under the cap).
  const remaining = top.filter((h) => idMap.get(h.id) && !scoredSet.has(idMap.get(h.id)!)).length - scoredNow;
  const prevScored = (await db.from("populate_state").select("hotels_scored").eq("city", t.city).maybeSingle()).data as { hotels_scored: number } | null;
  const totalScored = (prevScored?.hotels_scored ?? 0) + scoredNow;
  const status = remaining <= 0 ? "done" : (scoringOn ? "ingested" : "ingested");
  await db.from("populate_state").upsert({
    city: t.city, tier: t.tier, status,
    ingested_at: new Date().toISOString(), scored_at: scoredNow ? new Date().toISOString() : undefined,
    hotels_ingested: top.length, hotels_scored: totalScored,
    note: scoringOn ? null : `scoring paused (cap $${CAP_USD})`,
  }, { onConflict: "city" });

  return { city: t.city, tier: t.tier, found: found.length, ingested, scored_now: scoredNow, errors, total_scored: totalScored, remaining, spent_usd: Math.round((budget + scoredNow * USD_PER_SCORE) * 100) / 100, scoring: scoringOn } as const;
}

export async function GET() {
  const res = await run();
  return NextResponse.json(res, { status: "error" in res ? 500 : 200 });
}
