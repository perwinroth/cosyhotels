// Canonicalise the free-text `hotels.country` column into clean English countries + slugs, so we
// can build ONE country hub per country instead of fragmenting across the 190 raw variants the data
// carries: native names ("Italia", "日本"), English aliases ("USA" vs "United States"), multilingual
// composites ("België / Belgique / Belgien") and postcode-prefixed junk ("1056 Hungary").
//
// Matching is two-tier:
//   • aliases  — exact, case-insensitive full-string match (for non-Latin / composite native names)
//   • words    — a country word delimited by non-letters anywhere in the value (matches "1056 Hungary",
//                "Taiwan 10491", "Schweiz/Suisse/…"), Unicode-aware so it never mis-splits scripts.
// A value that matches no country (a bare postcode, a leaked street address, an unlisted country)
// returns null and is simply left out of every hub — honest under-inclusion beats a junk hub.

export type CanonCountry = { name: string; slug: string; words: string[]; aliases?: string[] };

// Curated set. `words` are ASCII tokens matched at word boundaries; `aliases` are exact non-Latin or
// composite forms. Slugs are the English name kebab-cased. Countries below the hub threshold are still
// listed here (so their hotels canonicalise correctly) — the index/sitemap decide what's substantive.
export const COUNTRIES: CanonCountry[] = [
  { name: "Italy", slug: "italy", words: ["italy", "italia"] },
  { name: "United Kingdom", slug: "united-kingdom", words: ["united kingdom", "uk", "great britain"] },
  { name: "France", slug: "france", words: ["france"] },
  { name: "Germany", slug: "germany", words: ["germany", "deutschland"] },
  { name: "Spain", slug: "spain", words: ["spain", "españa", "espana"] },
  { name: "United States", slug: "united-states", words: ["united states", "usa", "u.s.a"] },
  { name: "Portugal", slug: "portugal", words: ["portugal"] },
  { name: "Canada", slug: "canada", words: ["canada"] },
  { name: "Ireland", slug: "ireland", words: ["ireland"] },
  { name: "Greece", slug: "greece", words: ["greece"], aliases: ["ελλάς", "ελλάδα"] },
  { name: "Austria", slug: "austria", words: ["austria", "österreich", "osterreich"] },
  { name: "Indonesia", slug: "indonesia", words: ["indonesia"] },
  { name: "Belgium", slug: "belgium", words: ["belgium", "belgique", "belgien"] },
  { name: "Morocco", slug: "morocco", words: ["morocco", "maroc"] },
  { name: "Switzerland", slug: "switzerland", words: ["switzerland", "schweiz", "suisse", "svizzera"] },
  { name: "Croatia", slug: "croatia", words: ["croatia", "hrvatska"] },
  { name: "Czechia", slug: "czechia", words: ["czechia", "czech republic"], aliases: ["česko"] },
  { name: "Netherlands", slug: "netherlands", words: ["netherlands", "nederland", "holland"] },
  { name: "Denmark", slug: "denmark", words: ["denmark", "danmark"] },
  { name: "Japan", slug: "japan", words: ["japan"], aliases: ["日本"] },
  { name: "Iceland", slug: "iceland", words: ["iceland"], aliases: ["ísland"] },
  { name: "Australia", slug: "australia", words: ["australia"] },
  { name: "Turkey", slug: "turkey", words: ["turkey", "turkiye"], aliases: ["türkiye"] },
  { name: "Poland", slug: "poland", words: ["poland", "polska"] },
  { name: "Slovenia", slug: "slovenia", words: ["slovenia", "slovenija"] },
  { name: "Luxembourg", slug: "luxembourg", words: ["luxembourg"] },
  { name: "Vietnam", slug: "vietnam", words: ["vietnam"], aliases: ["việt nam"] },
  { name: "South Africa", slug: "south-africa", words: ["south africa"] },
  { name: "India", slug: "india", words: ["india"] },
  { name: "Thailand", slug: "thailand", words: ["thailand"], aliases: ["ประเทศไทย", "ไทย"] },
  { name: "Sweden", slug: "sweden", words: ["sweden", "sverige"] },
  { name: "Peru", slug: "peru", words: ["peru"], aliases: ["perú"] },
  { name: "Norway", slug: "norway", words: ["norway", "norge"] },
  { name: "Hungary", slug: "hungary", words: ["hungary"], aliases: ["magyarország"] },
  { name: "New Zealand", slug: "new-zealand", words: ["new zealand"] },
  { name: "Estonia", slug: "estonia", words: ["estonia", "eesti"] },
  { name: "Romania", slug: "romania", words: ["romania"], aliases: ["românia"] },
  { name: "Malta", slug: "malta", words: ["malta"] },
  { name: "Bulgaria", slug: "bulgaria", words: ["bulgaria"] },
  { name: "Sri Lanka", slug: "sri-lanka", words: ["sri lanka"] },
  { name: "Argentina", slug: "argentina", words: ["argentina"] },
  { name: "Finland", slug: "finland", words: ["finland", "suomi"] },
  { name: "Nepal", slug: "nepal", words: ["nepal"], aliases: ["नेपाल"] },
  { name: "Laos", slug: "laos", words: ["laos"], aliases: ["ປະເທດລາວ"] },
  { name: "Montenegro", slug: "montenegro", words: ["montenegro", "crna gora"] },
  { name: "Singapore", slug: "singapore", words: ["singapore"] },
  { name: "Mexico", slug: "mexico", words: ["mexico"], aliases: ["méxico"] },
  { name: "Brazil", slug: "brazil", words: ["brazil", "brasil"] },
  { name: "China", slug: "china", words: ["china"], aliases: ["中国", "中國"] },
  { name: "Taiwan", slug: "taiwan", words: ["taiwan"], aliases: ["臺灣", "台灣"] },
];

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// Precompiled matchers: a country word bounded by non-letters (or string ends), Unicode-aware.
const WORD_MATCHERS: Array<{ re: RegExp; c: CanonCountry }> = COUNTRIES.flatMap((c) =>
  c.words.map((w) => ({ re: new RegExp(`(^|[^\\p{L}])${escapeRe(w)}([^\\p{L}]|$)`, "iu"), c }))
);
const ALIAS_MAP = new Map<string, CanonCountry>();
for (const c of COUNTRIES) for (const a of c.aliases || []) ALIAS_MAP.set(a.toLowerCase(), c);

export const countryBySlug = (slug: string): CanonCountry | undefined => COUNTRIES.find((c) => c.slug === slug);

// Map a raw `hotels.country` value to its canonical country, or null if unrecognised.
export function canonicalCountry(raw?: string | null): CanonCountry | null {
  if (!raw) return null;
  const lower = raw.trim().toLowerCase();
  if (!lower) return null;
  const alias = ALIAS_MAP.get(lower);
  if (alias) return alias;
  for (const { re, c } of WORD_MATCHERS) if (re.test(lower)) return c;
  return null;
}

// Aggregate raw (country, count) rows into canonical live-hotel counts per country, desc by count.
export function aggregateCountryCounts(rows: Array<{ country: string | null; n: number }>): Array<{ country: CanonCountry; live: number }> {
  const bySlug = new Map<string, { country: CanonCountry; live: number }>();
  for (const r of rows) {
    const c = canonicalCountry(r.country);
    if (!c) continue;
    const cur = bySlug.get(c.slug);
    if (cur) cur.live += r.n; else bySlug.set(c.slug, { country: c, live: r.n });
  }
  return [...bySlug.values()].sort((a, b) => b.live - a.live);
}
