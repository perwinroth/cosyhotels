export type CityGuide = { slug: string; city: string; region: string };

const toSlug = (city: string) => `${city.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-cosy-hotel`;

export const cityGuides: CityGuide[] = [
  // Europe
  { city: 'Paris', region: 'Europe', slug: toSlug('Paris') },
  { city: 'Edinburgh', region: 'Europe', slug: toSlug('Edinburgh') },
  { city: 'Amsterdam', region: 'Europe', slug: toSlug('Amsterdam') },
  { city: 'Prague', region: 'Europe', slug: toSlug('Prague') },
  { city: 'Bruges', region: 'Europe', slug: toSlug('Bruges') },
  { city: 'Venice', region: 'Europe', slug: toSlug('Venice') },
  { city: 'Florence', region: 'Europe', slug: toSlug('Florence') },
  { city: 'Barcelona', region: 'Europe', slug: toSlug('Barcelona') },
  { city: 'Copenhagen', region: 'Europe', slug: toSlug('Copenhagen') },
  { city: 'Santorini', region: 'Europe', slug: toSlug('Santorini') },
  // North America
  // Named "New York" to match the DB city + the common online name (was "New York City", which
  // matched no hotels → the guide was empty/noindex). Old slug 308s to this via next.config.
  { city: 'New York', region: 'North America', slug: toSlug('New York') },
  { city: 'San Francisco', region: 'North America', slug: toSlug('San Francisco') },
  { city: 'Charleston', region: 'North America', slug: toSlug('Charleston') },
  { city: 'Savannah', region: 'North America', slug: toSlug('Savannah') },
  { city: 'Quebec City', region: 'North America', slug: toSlug('Quebec City') },
  // Asia-Pacific
  { city: 'Kyoto', region: 'Asia-Pacific', slug: toSlug('Kyoto') },
  { city: 'Ubud', region: 'Asia-Pacific', slug: toSlug('Ubud') },
  { city: 'Queenstown', region: 'Asia-Pacific', slug: toSlug('Queenstown') },
  { city: 'Sydney', region: 'Asia-Pacific', slug: toSlug('Sydney') },
  { city: 'Tokyo', region: 'Asia-Pacific', slug: toSlug('Tokyo') },
  // Additional romantic/boutique spots in Europe
  { city: 'Reykjavik', region: 'Europe', slug: toSlug('Reykjavik') },
  { city: 'Lucerne', region: 'Europe', slug: toSlug('Lucerne') },
  { city: 'Salzburg', region: 'Europe', slug: toSlug('Salzburg') },
  { city: 'Porto', region: 'Europe', slug: toSlug('Porto') },
  { city: 'Dubrovnik', region: 'Europe', slug: toSlug('Dubrovnik') },
];

export function getCityGuide(slug: string): CityGuide | undefined {
  return cityGuides.find((c) => c.slug === slug);
}
