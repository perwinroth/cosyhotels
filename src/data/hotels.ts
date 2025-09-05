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

export const hotels: Hotel[] = [
  { id: "h1", slug: "atelier-rivoli-paris", name: "Atelier Rivoli", city: "Paris", country: "France", rating: 7.1, price: 240, amenities: ["Rooftop","Bar","Pet-friendly"], description: "A characterful townhouse near the Seine with artisan touches.", affiliateUrl: "https://partner.example/atelier-rivoli-paris", image: "/images/paris-atelier.svg", featured: true },
  { id: "h2", slug: "villa-aurora-rome", name: "Villa Aurora", city: "Rome", country: "Italy", rating: 6.9, price: 210, amenities: ["Garden","Bar"], description: "Sunlit rooms and leafy courtyards near Rome's historic center.", affiliateUrl: "https://partner.example/villa-aurora-rome", image: "/images/rome-aurora.svg" },
  { id: "h3", slug: "casa-luz-lisbon", name: "Casa Luz", city: "Lisbon", country: "Portugal", rating: 7.3, price: 180, amenities: ["Rooftop","Restaurant"], description: "Light-filled interiors with views over Lisbon's terracotta roofs.", affiliateUrl: "https://partner.example/casa-luz-lisbon", image: "/images/lisbon-casaluz.svg", featured: true },
  { id: "h4", slug: "harbor-nook-copenhagen", name: "Harbor Nook", city: "Copenhagen", country: "Denmark", rating: 7.0, price: 230, amenities: ["Spa","Sauna","Bicycles"], description: "Nordic minimalism meets hygge comfort by the canals, complete with sauna and spa.", affiliateUrl: "https://partner.example/harbor-nook-copenhagen", image: "/images/copenhagen-harbor.svg", featured: true },
  { id: "h5", slug: "ringstrasse-vienna", name: "Ringstrasse Residence", city: "Vienna", country: "Austria", rating: 7.4, price: 285, amenities: ["Spa","Bar","Restaurant"], description: "Elegant rooms on the Ringstrasse with a serene spa and refined dining.", affiliateUrl: "https://partner.example/ringstrasse-vienna", image: "/images/vienna-ring.svg", featured: true },
  { id: "h6", slug: "canal-quartet-amsterdam", name: "Canal Quartet", city: "Amsterdam", country: "Netherlands", rating: 6.6, price: 210, amenities: ["Bar","Pet-friendly"], description: "Historic canal house charm with contemporary comfort and an intimate lounge bar.", affiliateUrl: "https://partner.example/canal-quartet-amsterdam", image: "/images/amsterdam-canal.svg" },
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
