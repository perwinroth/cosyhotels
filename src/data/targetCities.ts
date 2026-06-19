// Prioritized ingestion targets for the auto-populate cron.
// Tiers reflect cosy/boutique SEARCH demand (not raw tourist volume): European city
// breaks + English-speaking markets + character towns + boutique supply, weighted by
// SEO winnability. `depth` = how many top heuristic-ranked, photo-having hotels we
// vision-score per city (city pages show a ranked list, so we don't score all ~200).

export type TargetTier = 1 | 2 | 3 | 4;
export type TargetCity = { city: string; tier: TargetTier; depth: number };

const T1 = 150, T2 = 80, T3 = 50, T4 = 25;

const tier1 = [
  "London", "Paris", "Rome", "New York", "Edinburgh", "Amsterdam", "Barcelona",
  "Venice", "Florence", "Lisbon", "Dublin", "Vienna", "Prague", "Tokyo", "Kyoto",
  "Copenhagen", "Reykjavik", "Bruges", "Porto", "Istanbul",
];

const tier2 = [
  "Madrid", "Berlin", "Munich", "Budapest", "Seville", "Granada", "Bath", "York",
  "Brighton", "Oxford", "Cambridge", "Stockholm", "Oslo", "Helsinki", "Bergen",
  "Salzburg", "Innsbruck", "Lucerne", "Interlaken", "Zurich", "Nice", "Lyon",
  "Bordeaux", "Milan", "Naples", "Bologna", "Verona", "Siena", "Dubrovnik", "Split",
  "Athens", "Santorini", "Krakow", "Tallinn", "San Sebastián", "Marrakesh",
  "Cape Town", "Sydney", "Melbourne", "Singapore",
];

const tier3 = [
  "Boston", "San Francisco", "Chicago", "Charleston", "Savannah", "New Orleans",
  "Quebec City", "Montreal", "Toronto", "Vancouver", "Seattle", "Portland", "Austin",
  "Nashville", "Asheville", "Santa Fe", "Banff", "Queenstown", "Auckland", "Hong Kong",
  "Bangkok", "Chiang Mai", "Hoi An", "Ubud", "Hanoi", "Seoul", "Osaka", "Hakone",
  "Taipei", "Marrakech", "Fez", "Mexico City", "Buenos Aires", "Rio de Janeiro",
  "Cartagena", "Cusco", "Valletta", "Ljubljana", "Bled", "Zagreb", "Hallstatt",
  "Colmar", "Strasbourg", "Ghent", "Antwerp", "Utrecht", "Rotterdam", "Cologne",
  "Hamburg", "Dresden", "Heidelberg", "Freiburg", "Bath", "Galway", "Cork",
  "Glasgow", "Manchester", "Liverpool", "Cardiff", "Inverness", "Aviemore",
  "Stratford-upon-Avon", "Windsor", "Canterbury", "St Andrews", "Valencia", "Bilbao",
  "Toledo", "Cordoba", "Ronda", "Sintra", "Madeira", "Palermo", "Turin", "Genoa",
  "Lucca", "Perugia", "Como", "Sorrento", "Positano", "Taormina", "Mykonos", "Crete",
];

// Long tail — character / romantic towns. depth small + photo+heuristic gated.
const tier4 = [
  "Cotswolds", "Lake District", "Whitby", "Rye", "Ludlow", "Harrogate", "Keswick",
  "Conwy", "Tenby", "Pitlochry", "Oban", "Portree", "Kinsale", "Kilkenny", "Dingle",
  "Annecy", "Aix-en-Provence", "Avignon", "Carcassonne", "Honfleur", "Sarlat",
  "Èze", "Chamonix", "Menton", "Giverny", "Rothenburg ob der Tauber", "Bamberg",
  "Bacharach", "Garmisch-Partenkirchen", "Füssen", "Baden-Baden", "Hallstatt",
  "Zermatt", "St. Moritz", "Wengen", "Gimmelwald", "Bellagio", "Portofino",
  "Cinque Terre", "Montepulciano", "San Gimignano", "Assisi", "Orvieto", "Matera",
  "Alberobello", "Ravello", "Óbidos", "Évora", "Lagos", "Ronda", "Cádiz", "Girona",
  "Cadaqués", "Comporta", "Hvar", "Rovinj", "Kotor", "Nafplio", "Chania", "Bath",
  "Český Krumlov", "Hallstatt", "Sighișoara", "Brașov", "Tallinn", "Gdansk",
  "Wrocław", "Bruges", "Dinant", "Giethoorn", "Reine", "Ålesund", "Tromsø",
  "Ribe", "Visby", "Rauma", "Savonlinna", "Banff", "Jasper", "Stowe", "Woodstock",
  "Mystic", "Kennebunkport", "Stockbridge", "Telluride", "Sedona", "Carmel",
  "Healdsburg", "Leavenworth", "Niagara-on-the-Lake", "Stratford", "Tofino",
  "Akaroa", "Wanaka", "Hakone", "Takayama", "Kanazawa", "Nara", "Hoi An",
  "Luang Prabang", "Pokhara", "Galle", "Pondicherry", "Udaipur", "Jaipur",
];

function build(list: string[], tier: TargetTier, depth: number): TargetCity[] {
  return list.map((city) => ({ city, tier, depth }));
}

// Deduped, in priority order (tier 1 first).
const seen = new Set<string>();
export const targetCities: TargetCity[] = [
  ...build(tier1, 1, T1),
  ...build(tier2, 2, T2),
  ...build(tier3, 3, T3),
  ...build(tier4, 4, T4),
].filter((t) => {
  const k = t.city.toLowerCase();
  if (seen.has(k)) return false;
  seen.add(k);
  return true;
});
