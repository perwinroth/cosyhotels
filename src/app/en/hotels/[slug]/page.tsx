import { notFound } from "next/navigation";
import { hotels } from "@/data/hotels";

export function generateMetadata({ params }: { params: { slug: string } }) {
  const hotel = hotels.find(h => h.slug === params.slug);
  return hotel ? { title: `${hotel.name} – ${hotel.city}`, description: hotel.description } : {};
}

export default function HotelDetail({ params }: { params: { slug: string } }) {
  const hotel = hotels.find(h => h.slug === params.slug);
  if (!hotel) return notFound();
  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: 24 }}>
      <div style={{ aspectRatio: "4 / 3", background: "#f4f4f5", backgroundImage: "url(/hotel-placeholder.svg)", backgroundSize: "cover", borderRadius: 12, border: "1px solid #e5e5e5" }} />
      <h1 style={{ marginTop: 16, fontSize: 28, fontWeight: 600 }}>{hotel.name}</h1>
      <div style={{ color: "#666", marginTop: 4 }}>{hotel.city}, {hotel.country}</div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8, fontSize: 14 }}>
        <span style={{ background: "#dcfce7", color: "#14532d", borderRadius: 6, padding: "2px 6px" }}>{hotel.rating.toFixed(1)}</span>
        <span>•</span>
        <span>From ${hotel.price}/night</span>
      </div>
      <p style={{ marginTop: 12, color: "#444", lineHeight: 1.6 }}>{hotel.description}</p>
      <div style={{ marginTop: 16 }}>
        <a href={`/go/${hotel.slug}`} target="_blank" rel="noopener nofollow sponsored" style={{ display: "inline-block", background: "#111", color: "#fff", padding: "10px 14px", borderRadius: 8, textDecoration: "none" }}>
          Check availability →
        </a>
      </div>
      <div style={{ marginTop: 16 }}>
        <div style={{ fontWeight: 600 }}>Amenities</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 6 }}>
          {hotel.amenities.map(a => (
            <span key={a} style={{ border: "1px solid #e5e5e5", borderRadius: 999, padding: "6px 10px", fontSize: 14 }}>{a}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

