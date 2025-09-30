export type CityCoord = { lat: number; lng: number; radiusKm: number };

// Approximate city centers and search radii
export const cityCoords: Record<string, CityCoord> = {
  // Europe
  Paris: { lat: 48.8566, lng: 2.3522, radiusKm: 15 },
  Edinburgh: { lat: 55.9533, lng: -3.1883, radiusKm: 12 },
  Amsterdam: { lat: 52.3676, lng: 4.9041, radiusKm: 10 },
  Prague: { lat: 50.0755, lng: 14.4378, radiusKm: 12 },
  Bruges: { lat: 51.2093, lng: 3.2247, radiusKm: 8 },
  Venice: { lat: 45.4408, lng: 12.3155, radiusKm: 10 },
  Florence: { lat: 43.7696, lng: 11.2558, radiusKm: 10 },
  Barcelona: { lat: 41.3851, lng: 2.1734, radiusKm: 12 },
  Copenhagen: { lat: 55.6761, lng: 12.5683, radiusKm: 12 },
  Santorini: { lat: 36.3932, lng: 25.4615, radiusKm: 25 },
  Reykjavik: { lat: 64.1466, lng: -21.9426, radiusKm: 15 },
  Lucerne: { lat: 47.0502, lng: 8.3093, radiusKm: 10 },
  Salzburg: { lat: 47.8095, lng: 13.0550, radiusKm: 12 },
  Porto: { lat: 41.1579, lng: -8.6291, radiusKm: 12 },
  Dubrovnik: { lat: 42.6507, lng: 18.0944, radiusKm: 12 },

  // North America
  'New York City': { lat: 40.7128, lng: -74.0060, radiusKm: 25 },
  'San Francisco': { lat: 37.7749, lng: -122.4194, radiusKm: 18 },
  Charleston: { lat: 32.7765, lng: -79.9311, radiusKm: 15 },
  Savannah: { lat: 32.0809, lng: -81.0912, radiusKm: 15 },
  'Quebec City': { lat: 46.8139, lng: -71.2080, radiusKm: 15 },

  // Asia-Pacific
  Kyoto: { lat: 35.0116, lng: 135.7681, radiusKm: 15 },
  Ubud: { lat: -8.5069, lng: 115.2625, radiusKm: 12 },
  Queenstown: { lat: -45.0312, lng: 168.6626, radiusKm: 15 },
  Sydney: { lat: -33.8688, lng: 151.2093, radiusKm: 20 },
  Tokyo: { lat: 35.6762, lng: 139.6503, radiusKm: 20 },
};

export function bboxFor(city: string): { minLat: number; maxLat: number; minLng: number; maxLng: number } | null {
  const c = cityCoords[city];
  if (!c) return null;
  const kmPerDegreeLat = 110.574; // approx
  const kmPerDegreeLng = 111.320 * Math.cos((c.lat * Math.PI) / 180);
  const dLat = c.radiusKm / kmPerDegreeLat;
  const dLng = c.radiusKm / kmPerDegreeLng;
  return { minLat: c.lat - dLat, maxLat: c.lat + dLat, minLng: c.lng - dLng, maxLng: c.lng + dLng };
}

