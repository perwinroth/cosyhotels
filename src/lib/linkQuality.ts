import type { getServerSupabase } from "@/lib/supabase/server";

type DB = NonNullable<ReturnType<typeof getServerSupabase>>;

// Hotels a human grader marked as mislinked (link_ok=false) in /grade. We never feature or
// publish these — a wrong "Check availability" link breaks user trust AND the affiliate funnel.
// The exclusion set grows as grading continues, so featuring quality improves on its own.
export async function badLinkHotelIds(db: DB): Promise<Set<string>> {
  const { data } = await db.from("hotel_grades").select("hotel_id").eq("link_ok", false);
  return new Set(
    ((data || []) as Array<{ hotel_id: string | null }>).map((r) => String(r.hotel_id)).filter(Boolean),
  );
}
