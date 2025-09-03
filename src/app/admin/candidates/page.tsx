import Link from "next/link";
import { getServerSupabase } from "@/lib/supabase/server";

export default async function CandidatesPage() {
  const supabase = getServerSupabase();
  const list = supabase
    ? (await supabase
        .from("hotels")
        .select("id, slug, name, city, country, rating, rooms_count, amenities, curated, cosy_scores:cosy_scores(score)")
        .order("curated", { ascending: true })
        .limit(100)).data || []
    : [];

  return (
    <main style={{ maxWidth: 960, margin: "0 auto", padding: 24 }}>
      <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 12 }}>Candidates</h1>
      <p style={{ color: "#666", marginBottom: 12 }}>Top 100 by score (uncurated shown first).</p>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={{ textAlign: "left", borderBottom: "1px solid #eee", padding: 8 }}>Hotel</th>
            <th style={{ textAlign: "left", borderBottom: "1px solid #eee", padding: 8 }}>City</th>
            <th style={{ textAlign: "left", borderBottom: "1px solid #eee", padding: 8 }}>Rating</th>
            <th style={{ textAlign: "left", borderBottom: "1px solid #eee", padding: 8 }}>Rooms</th>
            <th style={{ textAlign: "left", borderBottom: "1px solid #eee", padding: 8 }}>Score</th>
            <th style={{ textAlign: "left", borderBottom: "1px solid #eee", padding: 8 }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {list.map((h: any) => (
            <tr key={h.id}>
              <td style={{ padding: 8 }}>
                <Link href={`/en/hotels/${h.slug}`}>{h.name}</Link>
              </td>
              <td style={{ padding: 8 }}>{h.city}, {h.country}</td>
              <td style={{ padding: 8 }}>{h.rating ?? "-"}</td>
              <td style={{ padding: 8 }}>{h.rooms_count ?? "-"}</td>
              <td style={{ padding: 8 }}>{h.cosy_scores?.score?.toFixed?.(1) ?? "-"}</td>
              <td style={{ padding: 8 }}>
                <form action="/api/admin/curate" method="post">
                  <input type="hidden" name="hotel_id" value={h.id} />
                  <button type="submit">{h.curated ? "Uncurate" : "Curate"}</button>
                </form>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}

