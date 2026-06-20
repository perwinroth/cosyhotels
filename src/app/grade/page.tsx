// One-tap cosy grader — the human-in-the-loop that turns the AI score into a measured,
// trustworthy rating. Owner tool, noindexed. Each card shows a hotel's real photo, the AI
// score + signals, and the outbound affiliate link; you judge (a) is the SCORE right and
// (b) is the LINK right, in one keystroke. Labels land in hotel_grades and feed both the
// confidence metric and the scorer's calibration (see lib/scoring/calibration.ts).
import type { Metadata } from "next";
import { getServerSupabase } from "@/lib/supabase/server";
import { validateHotel } from "@/lib/dataQuality";
import { stay22AllezUrl } from "@/lib/affiliates";
import Grader, { type Candidate } from "./Grader";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata: Metadata = { title: "Grade cosiness", robots: { index: false, follow: false } };

type ScoreRow = {
  hotel_id: string;
  score: number | null;
  score_final: number | null;
  signals: string[] | null;
  description: string | null;
  confidence: string | null;
  hotel: {
    id: string; slug: string | null; name: string; name_en: string | null;
    city: string | null; country: string | null; lat: number | null; lng: number | null;
    website: string | null; reviews_count: number | null; amenities: string[] | null; rooms_count: number | null; rating: number | null;
  } | null;
};

const chunk = <T,>(a: T[], n: number): T[][] => { const o: T[][] = []; for (let i = 0; i < a.length; i += n) o.push(a.slice(i, i + n)); return o; };

export default async function GradePage() {
  const db = getServerSupabase();
  if (!db) return <Shell><p>Supabase not configured.</p></Shell>;

  // Candidate pool: surfaced hotels (the ones users actually see), plus some borderline.
  const { data: scoreData } = await db
    .from("cosy_scores")
    .select("hotel_id, score, score_final, signals, description, confidence, hotel:hotel_id!inner(id, slug, name, name_en, city, country, lat, lng, website, reviews_count, amenities, rooms_count, rating)")
    .gte("score", 4)
    .order("score", { ascending: false })
    .limit(800);
  const rows = (scoreData || []) as unknown as ScoreRow[];

  // Already graded → so we queue ungraded first and can show progress.
  const { data: gradedData } = await db.from("hotel_grades").select("hotel_id, cosy_verdict, link_ok, human_score, ai_score");
  const graded = (gradedData || []) as Array<{ hotel_id: string; cosy_verdict: string; link_ok: boolean | null; human_score: number | null; ai_score: number | null }>;
  const gradedIds = new Set(graded.map((g) => g.hotel_id));

  // Real photo per candidate (chunked .in — big id lists 400 on PostgREST).
  const ids = rows.map((r) => r.hotel?.id).filter(Boolean) as string[];
  const photoById = new Map<string, string>();
  for (const part of chunk(ids, 200)) {
    const { data: imgs } = await db
      .from("hotel_images").select("hotel_id, url, created_at")
      .in("hotel_id", part).eq("vision_ok", true).order("created_at", { ascending: false });
    for (const im of (imgs || []) as Array<{ hotel_id: string | null; url: string | null }>) {
      const hid = im.hotel_id ? String(im.hotel_id) : ""; const url = im.url ? String(im.url) : "";
      if (hid && url && !url.includes("placehold.co") && !photoById.has(hid)) photoById.set(hid, url.replace(/&amp;/g, "&"));
    }
  }

  // Build candidates with a teaching-priority score: ungraded first, then borderline scores
  // (4–6, where the model is least sure), then data-quality-flagged hotels.
  const candidates: Array<Candidate & { _pri: number }> = [];
  for (const r of rows) {
    const h = r.hotel; if (!h) continue;
    const score = Number((r.score_final ?? r.score) || 0);
    const qa = validateHotel({ ...h });
    const isGraded = gradedIds.has(h.id);
    const borderline = score >= 4 && score <= 6.5 ? 1 : 0;
    const flagged = qa.issues.length > 0 ? 1 : 0;
    const pri = (isGraded ? 0 : 1000) + borderline * 100 + flagged * 50 + Math.round((6.5 - Math.abs(score - 5.25)) * 5);
    candidates.push({
      _pri: pri,
      hotelId: h.id,
      name: String(h.name_en || h.name || "").trim(),
      city: String(h.city || "").trim(),
      country: String(h.country || "").trim(),
      score,
      confidence: r.confidence || "medium",
      signals: (r.signals || []).slice(0, 5),
      description: r.description || "",
      photo: photoById.get(h.id) || "",
      website: h.website || "",
      link: stay22AllezUrl({ name: h.name, city: h.city, country: h.country, lat: h.lat, lng: h.lng, campaign: "grade" }),
      issues: qa.issues,
      graded: isGraded,
    });
  }
  candidates.sort((a, b) => b._pri - a._pri);
  const queue: Candidate[] = candidates.map(({ _pri, ...c }) => { void _pri; return c; });

  // Live confidence metrics from existing labels.
  const total = graded.length;
  const good = graded.filter((g) => g.cosy_verdict === "good").length;
  const linkAssessed = graded.filter((g) => g.link_ok != null).length;
  const linkOk = graded.filter((g) => g.link_ok === true).length;
  const agreement = total ? Math.round((good / total) * 100) : null;
  const linkAccuracy = linkAssessed ? Math.round((linkOk / linkAssessed) * 100) : null;
  const moe = total ? Math.round(196 * Math.sqrt(0.25 / total)) / 10 : null; // 95% margin (%, worst case p=.5)
  // Mean absolute error between AI score and the owner's corrected score (where given).
  const corrections = graded.filter((g) => g.human_score != null && g.ai_score != null);
  const mae = corrections.length
    ? Math.round((corrections.reduce((s, g) => s + Math.abs(Number(g.human_score) - Number(g.ai_score)), 0) / corrections.length) * 10) / 10
    : null;

  return (
    <Shell>
      <Grader
        queue={queue}
        stats={{ total, agreement, linkAccuracy, moe, mae, surfaced: rows.length }}
      />
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", background: "#0F1512", color: "#F3EEE6", fontFamily: "Inter, system-ui, sans-serif", padding: "24px 16px" }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>{children}</div>
    </div>
  );
}
