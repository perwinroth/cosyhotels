// Friend cosiness vote — a dead-simple, photo-first swipe (cosy / not cosy). NO link check,
// NO AI score shown (so the vote is an independent baseline, not anchored to the model).
// Everyone gets the SAME deterministic ~25-hotel anchor set spanning the score range, so we
// can measure inter-rater agreement and build a consensus. Public link, noindexed.
import type { Metadata } from "next";
import { getServerSupabase } from "@/lib/supabase/server";
import RateSwipe, { type Card } from "./RateSwipe";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata: Metadata = { title: "Which hotels feel cosy?", robots: { index: false, follow: false } };

const SET_SIZE = 25;
const chunk = <T,>(a: T[], n: number): T[][] => { const o: T[][] = []; for (let i = 0; i < a.length; i += n) o.push(a.slice(i, i + n)); return o; };

type ScoreRow = { hotel_id: string; score: number | null; score_final: number | null; hotel: { name: string; name_en: string | null; city: string | null; country: string | null } | null };

export default async function RatePage({ searchParams }: { searchParams?: { as?: string; u?: string; name?: string; set?: string } }) {
  // Name appendix: /rate?as=anna pre-fills the rater so you can send each friend their own
  // link (clean attribution, no typos, skips the name step). Falls back to the in-app prompt.
  const rater = String(searchParams?.as || searchParams?.u || searchParams?.name || "").trim().toLowerCase().slice(0, 40) || null;
  // ROUND 2 — /rate?set=surfaced: a DISJOINT set of the genuinely-cosy hotels we actually show
  // (high score_final + good photo, spread across cities), bypassing the round-1 score-band lock.
  // This answers "are the hotels we're proud to show actually cosy?" — a clean held-out test, and
  // the surfaced set never overlaps round 1, so votes stay separable by hotel membership.
  const surfaced = String(searchParams?.set || "").trim().toLowerCase() === "surfaced";
  const db = getServerSupabase();
  if (!db) return <Shell><p style={{ color: "#F3EEE6" }}>Not configured.</p></Shell>;

  // Showable photos only. vision_ok alone is too lenient (it let pillow/chair/stair detail
  // crops through), so we keep only the representative labels and pick the BEST shot per hotel
  // by label rank (exterior → room → interior → view; amenity/food/etc. excluded). https only
  // (http images are mixed-content-blocked on the page). Paged — PostgREST caps at 1000/req.
  const RANK: Record<string, number> = { exterior: 1, room: 2, interior: 3, view: 4 };
  const bestImg = new Map<string, { url: string; rank: number }>();
  for (let from = 0; from < 8000; from += 1000) {
    const { data: imgs } = await db.from("hotel_images")
      .select("hotel_id,url,vision_label").eq("vision_ok", true).in("vision_label", Object.keys(RANK)).range(from, from + 999);
    const rows = (imgs || []) as Array<{ hotel_id: string | null; url: string | null; vision_label: string | null }>;
    for (const im of rows) {
      const hid = im.hotel_id ? String(im.hotel_id) : ""; const url = im.url ? String(im.url).replace(/&amp;/g, "&") : "";
      const rank = RANK[String(im.vision_label)] || 9;
      if (!hid || !url.startsWith("https://") || url.includes("placehold.co")) continue;
      const prev = bestImg.get(hid);
      if (!prev || rank < prev.rank) bestImg.set(hid, { url, rank });
    }
    if (rows.length < 1000) break;
  }
  const photoById = new Map<string, string>([...bestImg].map(([k, v]) => [k, v.url]));
  const ids = [...photoById.keys()];

  // LOCK the anchor set: once anyone has voted, every rater must get the SAME hotels so votes
  // are comparable across people. So if votes exist, the set = the already-voted hotels;
  // otherwise generate a fresh spanning set. We only ever improve the IMAGE, never swap hotels.
  const { data: votedRows } = await db.from("cosy_votes").select("hotel_id");
  const votedIds = [...new Set(((votedRows || []) as Array<{ hotel_id: string }>).map((r) => String(r.hotel_id)))];
  const locked = votedIds.length >= 20;

  // Names + score for whichever id set we need. (surfaced round needs the whole photo'd pool to
  // pick the top hotels from; the other rounds only need their fixed id set.)
  const nameById = new Map<string, { name: string; city: string; score: number; scoreFinal: number; cityKey: string }>();
  for (const part of chunk(surfaced ? ids : (locked ? votedIds : ids), 200)) {
    const { data } = await db.from("cosy_scores").select("hotel_id, score, score_final, hotel:hotel_id!inner(name, name_en, city, country)").in("hotel_id", part);
    for (const r of (data || []) as unknown as ScoreRow[]) {
      const h = r.hotel; if (!h) continue;
      const name = String(h.name_en || h.name || "").trim(); if (!name) continue;
      const sf = typeof r.score_final === "number" ? r.score_final : Number(r.score || 0);
      nameById.set(r.hotel_id, { name, city: [h.city, h.country].filter(Boolean).join(", "), score: Number(r.score || 0), scoreFinal: sf, cityKey: String(h.city || "").toLowerCase().trim() });
    }
  }

  // Locked hotels whose best-label image was filtered out: keep the hotel (consistency), fall
  // back to any https vision_ok photo so it still shows.
  if (locked) {
    const missing = votedIds.filter((id) => !photoById.has(id));
    for (const part of chunk(missing, 200)) {
      const { data } = await db.from("hotel_images").select("hotel_id,url").eq("vision_ok", true).in("hotel_id", part);
      for (const im of (data || []) as Array<{ hotel_id: string | null; url: string | null }>) {
        const hid = im.hotel_id ? String(im.hotel_id) : ""; const url = im.url ? String(im.url).replace(/&amp;/g, "&") : "";
        if (hid && url.startsWith("https://") && !url.includes("placehold.co") && !photoById.has(hid)) photoById.set(hid, url);
      }
    }
  }

  // Target ids: surfaced round, the locked voted set, or a fresh deterministic spanning set.
  let targetIds: string[];
  if (surfaced) {
    // The hotels we'd actually show: high display score + a real photo, ONE per city for spread,
    // never a round-1 hotel. Deterministic (score desc, id tiebreak) so every friend gets the same.
    const votedSet = new Set(votedIds);
    const cands = [...nameById]
      .map(([id, v]) => ({ hotelId: id, ...v, photo: photoById.get(id) || "" }))
      .filter((c) => c.photo && c.scoreFinal >= 7.5 && !votedSet.has(c.hotelId))
      .sort((a, b) => (b.scoreFinal - a.scoreFinal) || a.hotelId.localeCompare(b.hotelId));
    const seenCity = new Set<string>(); const pickedS: typeof cands = [];
    for (const c of cands) { if (pickedS.length >= SET_SIZE) break; if (c.cityKey && seenCity.has(c.cityKey)) continue; if (c.cityKey) seenCity.add(c.cityKey); pickedS.push(c); }
    if (pickedS.length < SET_SIZE) { const used = new Set(pickedS.map((c) => c.hotelId)); for (const c of cands) { if (pickedS.length >= SET_SIZE) break; if (!used.has(c.hotelId)) pickedS.push(c); } }
    targetIds = pickedS.map((c) => c.hotelId);
  } else if (locked) {
    targetIds = votedIds;
  } else {
    const cands = [...nameById].map(([id, v]) => ({ hotelId: id, ...v, photo: photoById.get(id) || "" })).filter((c) => c.photo);
    const bands = [[0, 4], [4, 5.5], [5.5, 7], [7, 8.5], [8.5, 10.01]];
    const perBand = Math.ceil(SET_SIZE / bands.length);
    const picked: typeof cands = []; const used = new Set<string>();
    for (const [lo, hi] of bands) {
      const inBand = cands.filter((c) => c.score >= lo && c.score < hi).sort((a, b) => a.hotelId.localeCompare(b.hotelId));
      for (const c of inBand.slice(0, perBand)) { picked.push(c); used.add(c.hotelId); }
    }
    for (const c of cands.sort((a, b) => a.hotelId.localeCompare(b.hotelId))) { if (picked.length >= SET_SIZE) break; if (!used.has(c.hotelId)) { picked.push(c); used.add(c.hotelId); } }
    targetIds = picked.map((c) => c.hotelId);
  }

  // Build cards (deterministic shuffle by id hash; score stripped — friends never see it).
  const cards: Card[] = targetIds
    .map((id) => ({ id, n: nameById.get(id), photo: photoById.get(id) || "", _k: [...id].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7) }))
    .filter((c) => c.n && c.photo)
    .sort((a, b) => a._k - b._k)
    .slice(0, (locked && !surfaced) ? votedIds.length : SET_SIZE)
    .map((c) => ({ hotelId: c.id, name: c.n!.name, city: c.n!.city, photo: c.photo }));

  return <Shell><RateSwipe cards={cards} rater={rater} /></Shell>;
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", background: "#0F1512", color: "#F3EEE6", fontFamily: "Inter, system-ui, sans-serif", display: "flex", justifyContent: "center", padding: "16px" }}>
      <div style={{ width: "100%", maxWidth: 440 }}>{children}</div>
    </div>
  );
}
