// SEO route hygiene: reject malformed / placeholder / template slugs before they render an
// indexable page. Google was indexing junk like `/en/hotels/%7Bsearch_term_string%7D` and
// `/xx/...` (unvalidated locale) as real 200 pages, poisoning canonical selection.
//
// Next.js URL-decodes route params, so `%7B` arrives as `{`. We reject on the decoded value
// (braces, `$`, template syntax) plus a few literal placeholder tokens. This is a denylist of
// clearly-invalid shapes, NOT an allowlist — legitimate unicode slugs must still pass.

const MALFORMED_SLUG = /[{}$<>]|%[0-9a-f]{2}|search_term_string/i;
const PLACEHOLDER_TOKENS = new Set(["undefined", "null", "nan", "nil", "none", "[object object]"]);

/** True when a public route slug should NOT render an indexable page (return notFound()). */
export function isMalformedSlug(slug: string | null | undefined): boolean {
  if (slug == null) return true;
  const s = slug.trim().toLowerCase();
  if (s === "") return true;
  if (PLACEHOLDER_TOKENS.has(s)) return true;
  return MALFORMED_SLUG.test(slug);
}
