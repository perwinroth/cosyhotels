import Link from "next/link";
import { searchText, photoUrl } from "@/lib/places";
import { adhocCosyScore } from "@/lib/scoring/cosy";

export const metadata = {
  title: "Explore hotels",
  description: "Browse cosy, curated hotels.",
};

export default async function HotelsPage({ searchParams }: { searchParams: { [k: string]: string | string[] | undefined } }) {
  const cityQ = typeof searchParams.city === "string" ? searchParams.city : "";
  const query = cityQ ? `cosy boutique hotel in ${cityQ}` : "cosy boutique hotel";
  const data = await searchText(query);
  // Compute an ad-hoc cosy score and sort
  const results = data.results
    .map(r => ({
      ...r,
      _cosy: adhocCosyScore({ rating: r.rating, summary: r.formatted_address, name: r.name }),
    }))
    .sort((a, b) => b._cosy - a._cosy);
  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: 24 }}>
      <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 12 }}>Explore hotels</h1>
      <form method="get" style={{ marginBottom: 16 }}>
        <input name="city" placeholder="Filter by city (e.g., Paris)" defaultValue={typeof searchParams.city === "string" ? searchParams.city : ""} style={{ padding: 8, width: 280, marginRight: 8 }} />
        <button type="submit" style={{ padding: "8px 12px" }}>Search</button>
      </form>
      <div style={{ color: "#666", marginBottom: 8 }}>
        {results.length} result{results.length === 1 ? "" : "s"}{cityQ ? ` in ${cityQ}` : ""}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 }}>
        {results.map(h => (
          <Link key={h.place_id} href={`/en/hotels/place/${h.place_id}`} style={{ textDecoration: "none", color: "inherit" }}>
            <div style={{ border: "1px solid #e5e5e5", borderRadius: 12, overflow: "hidden" }}>
              <div style={{ aspectRatio: "4 / 3", background: "#f4f4f5", backgroundSize: "cover", backgroundImage: `url(${h.photos?.[0]?.photo_reference ? photoUrl(h.photos[0].photo_reference, 640) : '/hotel-placeholder.svg'})` }} />
              <div style={{ padding: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontWeight: 600 }}>{h.name}</div>
                  <span style={{ fontSize: 12, background: "#dcfce7", color: "#14532d", borderRadius: 6, padding: "2px 6px" }}>Cosy {h._cosy.toFixed(1)}</span>
                </div>
                <div style={{ fontSize: 14, color: "#666" }}>{h.formatted_address}</div>
                <form action="/api/places/save" method="post" style={{ marginTop: 8 }}>
                  <input type="hidden" name="place_id" value={h.place_id} />
                  <button type="submit" style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #e5e5e5", background: "#fff" }}>Save to shortlist</button>
                </form>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
