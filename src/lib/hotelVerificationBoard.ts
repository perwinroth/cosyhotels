// Query + ordering logic for the founder eyeball-verification board (/growth/verify). Shared by
// the SSR first page (src/app/growth/verify/page.tsx) and the lazy-load API route
// (src/app/api/admin/hotel-verifications/list/route.ts) so pagination past page 0 sorts exactly
// the same way the initial render did.
//
// Two-phase read, deliberately: phase 1 pulls a LIGHTWEIGHT full-universe slice (just the columns
// needed to sort, filtered but not yet paginated (up to ~12k rows of a few small fields), computes
// the founder-priority order across everything the filter matches, then slices one page of ids;
// phase 2 fetches full hotel/score/verification details for ONLY those ~50 ids. This keeps the
// "sort across everything, but only ever render 50" requirement fast without a giant client payload.
import type { SupabaseClient } from "@supabase/supabase-js";
import { displayCity, displayCountry } from "@/lib/placeText";
import { isValidWebsiteUrl } from "@/lib/delisted";
import { stay22AllezUrl } from "@/lib/affiliates";

type DbLike = Pick<SupabaseClient, "from">;

export const PAGE_SIZE = 50;

export const VERDICTS = [
  "SAME_HOTEL",
  "SAME_GROUP",
  "DIFFERENT",
  "HIJACKED",
  "CITY_MISMATCH",
  "INSUFFICIENT_EVIDENCE",
  "MODEL_ERROR",
] as const;

export const FOUNDER_STATUSES = ["pending", "verified", "rejected"] as const;

// Default sort per the founder brief: (a) hotels currently queued in hotel_outreach, (b) severe
// auto-verdicts (link is probably wrong), (c) insufficient evidence (couldn't tell), (d) everything
// else (SAME_HOTEL / SAME_GROUP / MODEL_ERROR / no verdict yet).
export const SEVERE_VERDICTS = new Set(["DIFFERENT", "HIJACKED", "CITY_MISMATCH"]);
const SEVERE = SEVERE_VERDICTS;
export function priorityRank(row: { queued: boolean; autoVerdict: string | null }): number {
  if (row.queued) return 0;
  if (row.autoVerdict && SEVERE.has(row.autoVerdict)) return 1;
  if (row.autoVerdict === "INSUFFICIENT_EVIDENCE") return 2;
  return 3;
}

export type VerifyFilters = { verdict?: string; status?: string };

export type VerifyRow = {
  hotelId: string;
  slug: string;
  name: string;
  place: string;
  score: number | null;
  hotelHref: string;
  website: string | null;
  stay22: string; // the LIVE Check-availability destination for founder eyeball checks
  autoVerdict: string | null;
  autoConfidence: number | null;
  autoEvidence: string | null;
  founderStatus: string;
  queued: boolean;
};

export type VerifyCounts = { pending: number; verified: number; rejected: number };

async function fetchAllPages<T>(
  query: (from: number, to: number) => Promise<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const out: T[] = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await query(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    const rows = data || [];
    out.push(...rows);
    if (rows.length < PAGE) break;
  }
  return out;
}

/** Progress counts (verified/pending/rejected) across the WHOLE table, ignoring filters. */
export async function getVerificationCounts(db: DbLike): Promise<VerifyCounts> {
  const [pending, verified, rejected] = await Promise.all(
    FOUNDER_STATUSES.map(async (s) => {
      const { count } = await db.from("hotel_verifications").select("*", { count: "exact", head: true }).eq("founder_status", s);
      return count ?? 0;
    }),
  );
  return { pending, verified, rejected };
}

/** One page (default 50 rows) of the verification board, sorted per the founder priority above. */
export async function getVerificationPage(db: DbLike, filters: VerifyFilters, page: number, base: string): Promise<{ rows: VerifyRow[]; total: number }> {
  type UniRow = { hotel_id: string; auto_verdict: string | null; founder_status: string };
  const universe = await fetchAllPages<UniRow>((from, to) => {
    let q = db.from("hotel_verifications").select("hotel_id, auto_verdict, founder_status").range(from, to);
    if (filters.verdict && filters.verdict !== "ALL") q = q.eq("auto_verdict", filters.verdict);
    if (filters.status && filters.status !== "ALL") q = q.eq("founder_status", filters.status);
    return q as unknown as Promise<{ data: UniRow[] | null; error: { message: string } | null }>;
  });
  const total = universe.length;
  if (!total) return { rows: [], total: 0 };

  // Which of these hotels are currently queued for outreach: chunked .in() (12k ids would
  // overflow a single request URL).
  const universeIds = universe.map((r) => String(r.hotel_id));
  const queuedSet = new Set<string>();
  for (let i = 0; i < universeIds.length; i += 150) {
    const chunk = universeIds.slice(i, i + 150);
    const { data } = await db.from("hotel_outreach").select("hotel_id").eq("status", "queued").in("hotel_id", chunk);
    for (const r of (data || []) as Array<{ hotel_id: string }>) queuedSet.add(String(r.hotel_id));
  }

  const withPriority = universe.map((r) => ({
    hotelId: String(r.hotel_id),
    autoVerdict: r.auto_verdict,
    founderStatus: r.founder_status,
    queued: queuedSet.has(String(r.hotel_id)),
  }));
  withPriority.sort((a, b) => priorityRank(a) - priorityRank(b) || a.hotelId.localeCompare(b.hotelId));

  const pageSlice = withPriority.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
  const pageIds = pageSlice.map((r) => r.hotelId);
  if (!pageIds.length) return { rows: [], total };

  type VRow = { hotel_id: string; slug: string | null; auto_verdict: string | null; auto_confidence: number | null; auto_evidence: string | null; founder_status: string };
  type HRow = { id: string; slug: string; name: string; name_en: string | null; city: string | null; country: string | null; website: string | null; lat: number | null; lng: number | null };
  type SRow = { hotel_id: string; score: number | null; score_final: number | null };
  const [{ data: vData }, { data: hData }, { data: sData }] = await Promise.all([
    db.from("hotel_verifications").select("hotel_id, slug, auto_verdict, auto_confidence, auto_evidence, founder_status").in("hotel_id", pageIds),
    db.from("hotels").select("id, slug, name, name_en, city, country, website, lat, lng").in("id", pageIds),
    db.from("cosy_scores").select("hotel_id, score, score_final").in("hotel_id", pageIds),
  ]);
  const vById = new Map(((vData || []) as VRow[]).map((r) => [String(r.hotel_id), r]));
  const hById = new Map(((hData || []) as HRow[]).map((r) => [String(r.id), r]));
  const sById = new Map(((sData || []) as SRow[]).map((r) => [String(r.hotel_id), r]));

  const rows: VerifyRow[] = pageSlice.map((p) => {
    const v = vById.get(p.hotelId);
    const h = hById.get(p.hotelId);
    const s = sById.get(p.hotelId);
    const slug = h?.slug || v?.slug || "";
    const website = h?.website && isValidWebsiteUrl(h.website) ? h.website : null;
    return {
      hotelId: p.hotelId,
      slug,
      name: String(h?.name_en || h?.name || "(unknown hotel)").trim(),
      place: [displayCity(h?.city), displayCountry(h?.country)].filter(Boolean).join(", "),
      score: s ? Number((s.score_final ?? s.score) || 0) : null,
      hotelHref: slug ? `${base}/en/hotels/${slug}` : "",
      website,
      stay22: stay22AllezUrl({ name: String(h?.name_en || h?.name || ""), city: h?.city, country: h?.country, lat: h?.lat, lng: h?.lng, campaign: "verify-board" }),
      autoVerdict: v?.auto_verdict ?? p.autoVerdict,
      autoConfidence: v?.auto_confidence ?? null,
      autoEvidence: v?.auto_evidence ?? null,
      founderStatus: v?.founder_status ?? p.founderStatus,
      queued: p.queued,
    };
  });

  return { rows, total };
}
