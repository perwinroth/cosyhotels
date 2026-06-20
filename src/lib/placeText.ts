// Normalize hotel city/country for display on the (English) site. Source data carries local
// names (e.g. "日本", "京都市") and postal codes in the city field — show English or drop.

const COUNTRY_EN: Record<string, string> = {
  "日本": "Japan", "にほん": "Japan", "ニッポン": "Japan",
  "中国": "China", "中國": "China", "中华人民共和国": "China",
  "대한민국": "South Korea", "한국": "South Korea",
  "россия": "Russia", "российская федерация": "Russia",
  "ประเทศไทย": "Thailand", "ไทย": "Thailand",
  "ελλάδα": "Greece", "việt nam": "Vietnam", "việtnam": "Vietnam",
  "españa": "Spain", "deutschland": "Germany", "österreich": "Austria",
  "italia": "Italy", "polska": "Poland", "česko": "Czechia", "magyarország": "Hungary",
  "sverige": "Sweden", "norge": "Norway", "danmark": "Denmark", "suomi": "Finland",
  "nederland": "Netherlands", "belgië": "Belgium", "belgique": "Belgium",
  "schweiz": "Switzerland", "suisse": "Switzerland", "türkiye": "Turkey", "türki̇ye": "Turkey",
  "portugal": "Portugal", "україна": "Ukraine",
};

// "Mostly Latin script" — has Latin letters and no CJK/Cyrillic/Thai/Korean/Arabic blocks.
export function isLatin(s: string): boolean {
  return /[A-Za-z]/.test(s) && !/[　-鿿가-힯Ѐ-ӿ฀-๿؀-ۿ]/.test(s);
}

export function displayCountry(c?: string | null): string {
  if (!c) return "";
  const t = c.trim();
  const mapped = COUNTRY_EN[t] || COUNTRY_EN[t.toLowerCase()];
  if (mapped) return mapped;
  return isLatin(t) ? t : ""; // unknown non-Latin → drop rather than show foreign script
}

// Return an English-ish city, or `fallback` (e.g. the guide's city) when the stored value is a
// postal code or non-Latin.
export function displayCity(city?: string | null, fallback = ""): string {
  if (!city) return fallback;
  const t = city.replace(/^[\d\s.,\-–]+/, "").trim(); // strip leading postal code / numbers
  if (!t || /\d{3,}/.test(t)) return fallback;          // still postal-like
  if (!isLatin(t)) return fallback;                     // non-Latin city → use fallback
  return t;
}

// "City, Country" for display, dropping empties.
export function placeLine(city?: string | null, country?: string | null, cityFallback = ""): string {
  return [displayCity(city, cityFallback), displayCountry(country)].filter(Boolean).join(", ");
}
