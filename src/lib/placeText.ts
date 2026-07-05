// Normalize hotel city/country for display on the (English) site. Source data carries local
// names (e.g. "日本", "京都市") and postal codes in the city field — show English or drop.
import { EXONYM_DISPLAY } from "@/lib/exonyms";

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

// Native/local city names → the English exonym we display site-wide (consistency + matches our
// city guides, e.g. so "Praha 1-Staré Město" resolves to the real Prague guide, not a junk slug).
// Sourced from the shared exonym list (src/lib/exonyms.ts) so display and DB-matching never drift.
const CITY_EN: Record<string, string> = EXONYM_DISPLAY;
// Sub-national codes that leak into the city field after a postcode ("Sydney NSW 2000" → "Sydney").
const REGION_CODE = new Set(["nsw", "vic", "qld", "wa", "sa", "tas", "act", "nt"]);

// "Mostly Latin script" — has Latin letters and no CJK/Cyrillic/Thai/Korean/Arabic blocks.
export function isLatin(s: string): boolean {
  return /[A-Za-z]/.test(s) && !/[　-鿿가-힯Ѐ-ӿ฀-๿؀-ۿ]/.test(s);
}

export function displayCountry(c?: string | null): string {
  if (!c) return "";
  const t = c.trim().replace(/^[\d\s.,\-–]+/, "").trim(); // strip leaked leading postcode: "3915 Hungary" → "Hungary"
  const mapped = COUNTRY_EN[t] || COUNTRY_EN[t.toLowerCase()];
  if (mapped) return mapped;
  return isLatin(t) ? t : ""; // unknown non-Latin → drop rather than show foreign script
}

// Return an English-ish city, or `fallback` (e.g. the guide's city) when the stored value is a
// postal code or non-Latin.
export function displayCity(city?: string | null, fallback = ""): string {
  if (!city) return fallback;
  let t = city.replace(/^[\d\s.,\-–]+/, "").trim();     // strip leading postal code / numbers
  t = t.replace(/^chang wat\s+/i, "");                  // Thai "Province of X" prefix → "X"
  // Strip trailing postcode + sub-national-code tokens: "London SW1X 8HQ" → "London",
  // "Sydney NSW 2000" → "Sydney". Cities don't carry digits, so any digit-bearing trailing token is
  // postal noise; a trailing region code (NSW, VIC…) is admin noise.
  const toks = t.split(/\s+/).filter(Boolean);
  while (toks.length > 1 && (/\d/.test(toks[toks.length - 1]) || REGION_CODE.has(toks[toks.length - 1].toLowerCase().replace(/[.,]/g, "")))) toks.pop();
  t = toks.join(" ").replace(/[\s,]+$/, "").trim();
  // English exonym: whole-string ("Krung Thep Maha Nakhon" → "Bangkok"), else first segment before a
  // district hyphen/space ("Praha 1-Staré Město" / "Praha-Praha 1" → "Prague"). Keys are specific
  // native names, so an English city like "New York" (first seg "New") never mis-maps.
  const whole = CITY_EN[t.toLowerCase()];
  if (whole) return whole;
  const firstSeg = (t.split(/[\s\-–,]/).filter(Boolean)[0] || "").toLowerCase();
  if (CITY_EN[firstSeg]) return CITY_EN[firstSeg];
  if (!t || /\d{3,}/.test(t)) return fallback;          // still postal-like
  if (/(^|\s)(u|út|str|stra(ss|ß)e|rd|ave|st|blvd|via|rue|rkp)\.?$/i.test(t)) return fallback; // a street, not a city → drop
  if (!isLatin(t)) return fallback;                     // non-Latin city → use fallback
  return t;
}

// "City, Country" for display, dropping empties.
export function placeLine(city?: string | null, country?: string | null, cityFallback = ""): string {
  return [displayCity(city, cityFallback), displayCountry(country)].filter(Boolean).join(", ");
}
