import Link from "next/link";
import { getDetails, photoUrl } from "@/lib/places";

export async function generateMetadata({ params }: { params: { id: string } }) {
  const d = await getDetails(params.id);
  return d ? { title: `${d.name} – ${d.formatted_address || ""}`, description: d.editorial_summary?.overview || d.formatted_address } : {};
}

export default async function PlaceDetail({ params }: { params: { id: string } }) {
  const d = await getDetails(params.id);
  if (!d) return <div style={{ maxWidth: 720, margin: "0 auto", padding: 24 }}>Not found.</div>;
  const photoRef = d.photos?.[0]?.photo_reference;
  const website = d.website || `https://www.google.com/maps/place/?q=place_id:${d.place_id}`;
  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: 24 }}>
      <div style={{ aspectRatio: "4 / 3", background: "#f4f4f5", backgroundSize: "cover", borderRadius: 12, border: "1px solid #e5e5e5", backgroundImage: `url(${photoRef ? photoUrl(photoRef, 1200) : '/logo-seal.svg'})` }} />
      <h1 style={{ marginTop: 16, fontSize: 28, fontWeight: 600 }}>{d.name}</h1>
      <div style={{ color: "#666", marginTop: 4 }}>{d.formatted_address}</div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8, fontSize: 14 }}>
        <span style={{ background: "#dcfce7", color: "#14532d", borderRadius: 6, padding: "2px 6px" }}>{d.rating?.toFixed?.(1) ?? "-"}</span>
        <span>•</span>
        <span>{d.user_ratings_total ?? 0} reviews</span>
      </div>
  {d.editorial_summary?.overview ? (
    <p style={{ marginTop: 12, color: "#444", lineHeight: 1.6 }}>{d.editorial_summary.overview}</p>
  ) : null}
  <div style={{ marginTop: 16 }}>
    <a href={website} target="_blank" rel="noopener nofollow" style={{ display: "inline-block", background: "#111", color: "#fff", padding: "10px 14px", borderRadius: 8, textDecoration: "none" }}>
      Visit website →
    </a>
  </div>
  <form action="/api/places/save" method="post" style={{ marginTop: 8 }}>
    <input type="hidden" name="place_id" value={d.place_id} />
    <button type="submit" style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #e5e5e5", background: "#fff" }}>Save to shortlist</button>
  </form>
  <div style={{ marginTop: 16 }}>
    <Link href="/en/hotels" style={{ color: "#2563eb" }}>← Back to results</Link>
  </div>
    </div>
  );
}
