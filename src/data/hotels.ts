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
};

export const hotels: Hotel[] = [
  { id: "h1", slug: "atelier-rivoli-paris", name: "Atelier Rivoli", city: "Paris", country: "France", rating: 9.2, price: 240, amenities: ["Rooftop","Bar","Pet-friendly"], description: "A characterful townhouse near the Seine with artisan touches.", affiliateUrl: "https://partner.example/atelier-rivoli-paris" },
  { id: "h2", slug: "villa-aurora-rome", name: "Villa Aurora", city: "Rome", country: "Italy", rating: 9.0, price: 210, amenities: ["Garden","Bar"], description: "Sunlit rooms and leafy courtyards near Rome's historic center.", affiliateUrl: "https://partner.example/villa-aurora-rome" },
  { id: "h3", slug: "casa-luz-lisbon", name: "Casa Luz", city: "Lisbon", country: "Portugal", rating: 9.4, price: 180, amenities: ["Rooftop","Restaurant"], description: "Light-filled interiors with views over Lisbon's terracotta roofs.", affiliateUrl: "https://partner.example/casa-luz-lisbon" }
  ,{ id: "h4", slug: "harbor-nook-copenhagen", name: "Harbor Nook", city: "Copenhagen", country: "Denmark", rating: 9.1, price: 230, amenities: ["Spa","Sauna","Bicycles"], description: "Nordic minimalism meets hygge comfort by the canals, complete with sauna and spa.", affiliateUrl: "https://partner.example/harbor-nook-copenhagen", featured: true }
  ,{ id: "h5", slug: "ringstrasse-vienna", name: "Ringstrasse Residence", city: "Vienna", country: "Austria", rating: 9.5, price: 285, amenities: ["Spa","Bar","Restaurant"], description: "Elegant rooms on the Ringstrasse with a serene spa and refined dining.", affiliateUrl: "https://partner.example/ringstrasse-vienna", featured: true }
];

// Popular destinations derived from the data (can be expanded)
export const destinations = Array.from(new Set(hotels.map((h) => h.city))).map((city) => ({
  city,
  slug: city.toLowerCase(),
}));

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
