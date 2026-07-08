// Live system-status dashboard. Server-rendered, no cache, auto-refreshes. Shows backfill
// progress, budgets, catalog/score counts, image coverage, and health checks. Noindexed.
import type { Metadata } from "next";
import { getServerSupabase } from "@/lib/supabase/server";
import { targetCities } from "@/data/targetCities";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata: Metadata = { title: "System status", robots: { index: false, follow: false } };

export default async function StatusPage() {
  const db = getServerSupabase();
  const env = {
    Supabase: !!db,
    "Anthropic key": !!process.env.ANTHROPIC_API_KEY,
    "Google Places": !!(process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY),
    "Stay22 LMA": !!(process.env.NEXT_PUBLIC_STAY22_LMAID || true),
    "Site URL": process.env.NEXT_PUBLIC_SITE_URL || "(unset)",
  };

  type Row = { city: string; tier: number; status: string; hotels_scored: number };
  let state: Row[] = [];
  let budget = { spent_usd: 0, reviews_spent_usd: 0 };
  let hotels = 0, scores = 0, surfaced = 0, imgsTotal = 0, imgsPlaceholder = 0;

  if (db) {
    const database = db;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const c = async (table: string, mod?: (q: any) => any) => {
      let q: unknown = database.from(table).select("*", { count: "exact", head: true });
      if (mod) q = mod(q);
      const { count } = await (q as Promise<{ count: number | null }>);
      return count ?? 0;
    };
    const [st, bud, h, sc, su, it, ip] = await Promise.all([
      db.from("populate_state").select("city,tier,status,hotels_scored").order("tier").order("hotels_scored", { ascending: false }),
      db.from("populate_budget").select("spent_usd,reviews_spent_usd").eq("id", 1).maybeSingle(),
      c("hotels"),
      c("cosy_scores"),
      c("cosy_scores", (q) => q.gte("score", 5)),
      c("hotel_images"),
      c("hotel_images", (q) => q.like("url", "%placehold.co%")),
    ]);
    state = (st.data || []) as Row[];
    budget = (bud.data as typeof budget) || budget;
    hotels = h; scores = sc; surfaced = su; imgsTotal = it; imgsPlaceholder = ip;
  }

  const targetTotal = targetCities.length;
  const done = state.filter((s) => s.status === "done").length;
  const scoredViaBackfill = state.reduce((a, s) => a + (s.hotels_scored || 0), 0);
  const realImgs = imgsTotal - imgsPlaceholder;
  const tierCounts: Record<number, { done: number; total: number }> = { 1: { done: 0, total: 0 }, 2: { done: 0, total: 0 }, 3: { done: 0, total: 0 }, 4: { done: 0, total: 0 } };
  for (const t of targetCities) tierCounts[t.tier].total++;
  for (const s of state) if (s.status === "done" && tierCounts[s.tier]) tierCounts[s.tier].done++;

  return (
    <div style={{ minHeight: "100vh", background: "#0F1512", color: "#F3EEE6", fontFamily: "Inter, system-ui, sans-serif", padding: "32px 24px" }}>
      <meta httpEquiv="refresh" content="30" />
      <div style={{ maxWidth: 1000, margin: "0 auto" }}>
        <h1 style={{ fontFamily: "Fraunces, serif", fontSize: 32, fontWeight: 600 }}>Got Cosy? System Status</h1>
        <p style={{ color: "#9DA89F", marginTop: 4, fontSize: 14 }}>Live · auto-refreshes every 30s</p>

        {/* Health */}
        <Section title="Health">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            {Object.entries(env).map(([k, v]) => (
              <Pill key={k} ok={typeof v === "boolean" ? v : true} label={`${k}${typeof v === "string" ? `: ${v}` : ""}`} />
            ))}
          </div>
        </Section>

        {/* Budgets */}
        <Section title="Budgets">
          <Bar label="Scoring (Claude vision)" value={budget.spent_usd} max={200} />
          <Bar label="Review comments (Google Places)" value={budget.reviews_spent_usd} max={50} />
        </Section>

        {/* Backfill */}
        <Section title={`Backfill: ${done}/${targetTotal} cities done`}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 14 }}>
            {[1, 2, 3, 4].map((t) => (
              <Stat key={t} big={`${tierCounts[t].done}/${tierCounts[t].total}`} small={`Tier ${t} cities`} />
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
            <Stat big={scoredViaBackfill.toLocaleString()} small="Hotels scored (backfill)" />
            <Stat big={done.toString()} small="Cities complete" />
            <Stat big={state.filter((s) => s.status === "error").length.toString()} small="Cities errored" />
          </div>
        </Section>

        {/* Catalog */}
        <Section title="Catalog & scores">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 }}>
            <Stat big={hotels.toLocaleString()} small="Hotels total" />
            <Stat big={scores.toLocaleString()} small="Scored" />
            <Stat big={surfaced.toLocaleString()} small="Surfaced (≥5/10)" />
            <Stat big={(scores - surfaced).toLocaleString()} small="Hidden (<5)" />
          </div>
        </Section>

        {/* Images */}
        <Section title="Image coverage">
          <Bar label={`Real photos: ${realImgs.toLocaleString()} of ${imgsTotal.toLocaleString()}`} value={realImgs} max={imgsTotal || 1} pct />
        </Section>

        {/* Recent cities */}
        <Section title="Cities (most recently populated)">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {state.slice(0, 40).map((s) => (
              <span key={s.city} style={{ fontSize: 13, padding: "5px 11px", borderRadius: 100, border: "1px solid #2A332D", background: s.status === "done" ? "rgba(127,183,162,.12)" : "rgba(224,138,75,.12)", color: s.status === "done" ? "#7FB7A2" : "#E08A4B" }}>
                {s.city} · {s.hotels_scored}
              </span>
            ))}
            {state.length === 0 && <span style={{ color: "#9DA89F" }}>No backfill activity yet.</span>}
          </div>
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 28 }}>
      <h2 style={{ fontFamily: "Fraunces, serif", fontSize: 18, fontWeight: 600, marginBottom: 12 }}>{title}</h2>
      <div style={{ background: "#18201C", border: "1px solid #2A332D", borderRadius: 16, padding: 18 }}>{children}</div>
    </div>
  );
}

function Pill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span style={{ fontSize: 13, padding: "6px 12px", borderRadius: 100, border: `1px solid ${ok ? "rgba(127,183,162,.4)" : "rgba(224,138,75,.4)"}`, background: ok ? "rgba(127,183,162,.12)" : "rgba(224,138,75,.12)", color: ok ? "#7FB7A2" : "#E08A4B" }}>
      {ok ? "✓" : "✗"} {label}
    </span>
  );
}

function Stat({ big, small }: { big: string; small: string }) {
  return (
    <div style={{ background: "#0B100E", border: "1px solid #2A332D", borderRadius: 12, padding: "14px 16px" }}>
      <div style={{ fontFamily: "Fraunces, serif", fontSize: 26, fontWeight: 600 }}>{big}</div>
      <div style={{ fontSize: 12, color: "#9DA89F", marginTop: 2 }}>{small}</div>
    </div>
  );
}

function Bar({ label, value, max, pct }: { label: string; value: number; max: number; pct?: boolean }) {
  const ratio = Math.max(0, Math.min(1, max ? value / max : 0));
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}>
        <span>{label}</span>
        <span style={{ color: "#9DA89F" }}>{pct ? `${Math.round(ratio * 100)}%` : `$${value.toFixed(2)} / $${max}`}</span>
      </div>
      <div style={{ height: 10, borderRadius: 100, background: "#0B100E", border: "1px solid #2A332D", overflow: "hidden" }}>
        <div style={{ width: `${ratio * 100}%`, height: "100%", background: ratio > 0.9 ? "#E08A4B" : "#7FB7A2" }} />
      </div>
    </div>
  );
}
