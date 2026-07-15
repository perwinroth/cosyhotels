import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";
import { hashToken } from "@/lib/savedLists";

// Right to be forgotten (GDPR erasure). POST { token }: token is the same raw magic-link access
// token used by /collections/view (never anything else), which already proves ownership of the
// email it resolves to. On a valid, unexpired token we permanently delete every row tied to that
// email across shortlists, email_contacts, and collection_access_tokens. Irreversible by design.
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const rawToken: unknown = body.token;
    if (typeof rawToken !== "string" || rawToken.length === 0) {
      return NextResponse.json({ ok: false }, { status: 403 });
    }

    const supabase = getServerSupabase();
    if (!supabase) return NextResponse.json({ ok: false }, { status: 403 });

    const tokenHash = hashToken(rawToken);
    const { data: tokenRow } = await supabase
      .from("collection_access_tokens")
      .select("email,expires_at")
      .eq("token_hash", tokenHash)
      .maybeSingle();

    if (!tokenRow || new Date(tokenRow.expires_at).getTime() < Date.now()) {
      return NextResponse.json({ ok: false }, { status: 403 });
    }

    const email = tokenRow.email as string;

    // Best-effort, in order. Each delete is scoped strictly to this token's own email, never any
    // other identity, so one visitor's erasure can never touch another's data.
    await supabase.from("shortlists").delete().eq("email", email);
    await supabase.from("email_contacts").delete().eq("email", email);
    await supabase.from("collection_access_tokens").delete().eq("email", email);

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 403 });
  }
}
