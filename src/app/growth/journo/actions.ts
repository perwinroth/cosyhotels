"use server";
// Server action for the /growth/journo board: advance a journo_queries row's status. Writes with
// the service-role key (same trust boundary as /api/admin/outreach — this route tree is already
// gated by middleware's panel-cookie check on /growth/*).
import { revalidatePath } from "next/cache";
import { getServerSupabase } from "@/lib/supabase/server";

const ALLOWED = ["new", "drafted", "skipped", "sent", "expired"];

export async function updateJournoStatus(id: string, status: string): Promise<{ ok: boolean; error?: string }> {
  if (!id || !ALLOWED.includes(status)) return { ok: false, error: "bad request" };
  const db = getServerSupabase();
  if (!db) return { ok: false, error: "db not configured" };
  const { error } = await db.from("journo_queries").update({ status }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/growth/journo");
  return { ok: true };
}
