export type Hotel = {
  id: string;
  slug: string;
  name: string;
  city: string;
  country: string;
  rating: number;
  price: number;
  amenities: string[];
  description: string;
  affiliateUrl: string;
  featured?: boolean;
  image?: string;
};

export const hotels: Hotel[] = [];

// Popular destinations derived from the data (can be expanded)
export const destinations = [] as Array<{ city: string; slug: string }>;

export function filterHotels({
  city,
  minRating,
  amenities,
  sort,
}: {
  city?: string;
  minRating?: number;
  amenities?: string[];
  sort?: "relevance" | "rating-desc" | "price-asc" | "price-desc";
}) {
  let results = hotels.slice();
  if (city) {
    const q = city.trim().toLowerCase();
    results = results.filter((h) => h.city.toLowerCase().includes(q));
  }
  if (minRating) {
    results = results.filter((h) => h.rating >= (minRating ?? 0));
  }
  if (amenities && amenities.length) {
    results = results.filter((h) => amenities.every((a) => h.amenities.includes(a)));
  }
  switch (sort) {
    case "rating-desc":
      results.sort((a, b) => b.rating - a.rating);
      break;
    case "price-asc":
      results.sort((a, b) => a.price - b.price);
      break;
    case "price-desc":
      results.sort((a, b) => b.price - a.price);
      break;
  }
  return results;
}
