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

type ScoreRow = { hotel_id: string; score: number | null; hotel: { name: string; name_en: string | null; city: string | null; country: string | null } | null };

export default async function RatePage() {
  const db = getServerSupabase();
  if (!db) return <Shell><p style={{ color: "#F3EEE6" }}>Not configured.</p></Shell>;

  // Vetted photos → the pool of "showable" hotels (a swipe tool needs a real image).
  const photoById = new Map<string, string>();
  const { data: imgs } = await db.from("hotel_images").select("hotel_id,url,created_at").eq("vision_ok", true).order("created_at", { ascending: false }).limit(6000);
  for (const im of (imgs || []) as Array<{ hotel_id: string | null; url: string | null }>) {
    const hid = im.hotel_id ? String(im.hotel_id) : ""; const url = im.url ? String(im.url) : "";
    if (hid && url && !url.includes("placehold.co") && !photoById.has(hid)) photoById.set(hid, url.replace(/&amp;/g, "&"));
  }
  const ids = [...photoById.keys()];

  // Scores + names for those hotels.
  const cands: Array<{ hotelId: string; name: string; city: string; score: number; photo: string }> = [];
  for (const part of chunk(ids, 200)) {
    const { data } = await db.from("cosy_scores").select("hotel_id, score, hotel:hotel_id!inner(name, name_en, city, country)").in("hotel_id", part);
    for (const r of (data || []) as unknown as ScoreRow[]) {
      const h = r.hotel; if (!h) continue;
      const name = String(h.name_en || h.name || "").trim(); if (!name) continue;
      cands.push({ hotelId: r.hotel_id, name, city: [h.city, h.country].filter(Boolean).join(", "), score: Number(r.score || 0), photo: photoById.get(r.hotel_id) || "" });
    }
  }

  // Deterministic spanning set: 5 score bands × 5 hotels (ordered by id for stability), backfilled to 25.
  const bands = [[0, 4], [4, 5.5], [5.5, 7], [7, 8.5], [8.5, 10.01]];
  const perBand = Math.ceil(SET_SIZE / bands.length);
  const picked: typeof cands = []; const used = new Set<string>();
  for (const [lo, hi] of bands) {
    const inBand = cands.filter((c) => c.score >= lo && c.score < hi).sort((a, b) => a.hotelId.localeCompare(b.hotelId));
    for (const c of inBand.slice(0, perBand)) { picked.push(c); used.add(c.hotelId); }
  }
  for (const c of cands.sort((a, b) => a.hotelId.localeCompare(b.hotelId))) { if (picked.length >= SET_SIZE) break; if (!used.has(c.hotelId)) { picked.push(c); used.add(c.hotelId); } }

  // Shuffle deterministically (by id hash) so the order isn't score-ordered (avoids a "good run / bad run" bias).
  const cards: Card[] = picked
    .map((c) => ({ ...c, _k: [...c.hotelId].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7) }))
    .sort((a, b) => a._k - b._k)
    .slice(0, SET_SIZE)
    .map(({ _k, score, ...c }) => { void _k; void score; return c; }); // strip score — friends never see it

  return <Shell><RateSwipe cards={cards} /></Shell>;
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", background: "#0F1512", color: "#F3EEE6", fontFamily: "Inter, system-ui, sans-serif", display: "flex", justifyContent: "center", padding: "16px" }}>
      <div style={{ width: "100%", maxWidth: 440 }}>{children}</div>
    </div>
  );
}
