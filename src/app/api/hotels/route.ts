import { filterHotels, hotels } from "@/data/hotels";
import { NextResponse } from "next/server";

export function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const city = searchParams.get("city") || undefined;
  const minRating = searchParams.get("minRating")
    ? Number(searchParams.get("minRating"))
    : undefined;
  const amenities = searchParams.getAll("amenity") || undefined;
  const sortParam = searchParams.get("sort");
  const sort: "relevance" | "rating-desc" | "price-asc" | "price-desc" | undefined =
    sortParam === "relevance" || sortParam === "rating-desc" || sortParam === "price-asc" || sortParam === "price-desc"
      ? sortParam
      : "relevance";
  const id = searchParams.get("id") || undefined;

  if (id) {
    const hotel = hotels.find((h) => h.id === id || h.slug === id);
    if (!hotel) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(hotel);
  }

  const results = filterHotels({ city, minRating, amenities, sort });
  return NextResponse.json({ results });
}
