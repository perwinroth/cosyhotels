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
];

