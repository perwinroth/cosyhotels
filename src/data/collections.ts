import { hotels, type Hotel } from "@/data/hotels";

export type Collection = {
  slug: string;
  title: string;
  description: string;
  filter: (h: Hotel) => boolean;
};

export const collections: Collection[] = [
  {
    slug: "city-rooftops",
    title: "City hotels with rooftops",
    description: "Boutique stays featuring rooftops for sunset views and open-air lounging.",
    filter: (h) => h.amenities.includes("Rooftop"),
  },
  {
    slug: "spa-retreats",
    title: "Boutique spa retreats",
    description: "Relaxing hotels with on-site spa or sauna amenities.",
    filter: (h) => h.amenities.includes("Spa") || h.amenities.includes("Sauna"),
  },
  {
    slug: "pet-friendly",
    title: "Pet-friendly boutique hotels",
    description: "Cosy hotels that welcome four-legged companions.",
    filter: (h) => h.amenities.includes("Pet-friendly"),
  },
  {
    slug: "romantic-paris",
    title: "Romantic Paris boutique hotels",
    description: "Intimate, characterful places to stay in Paris.",
    filter: (h) => h.city === "Paris",
  },
];

export function getCollection(slug: string) {
  return collections.find((c) => c.slug === slug);
}

