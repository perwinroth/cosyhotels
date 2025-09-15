import { filterHotels } from "@/data/hotels";
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
  // Curated dataset removed; id lookup not supported here anymore

  const results = filterHotels({ city, minRating, amenities, sort });
  return NextResponse.json({ results });
}
