// Canonical + hreflang policy for pages whose visible body is genuinely translated per locale
// (title/intro/snippets rendered through translate(), not just metadata strings). Country hubs,
// theme/facet hubs, facet+city pages and region hubs all follow the `isEn ? ... : await
// translate(...)` body pattern; see each page's own comment for confirmation before adding it here.
//
// TRANSLATED_LOCALES mirrors translate.ts's AUTHORIZED_LOCALES allowlist (founder, 2026-07-16):
// only Swedish is live-translated (Claude Opus pipeline, native-quality verified). That constant
// lives inside translate()'s function body and isn't exported, so it is duplicated here rather than
// imported (importing translate.ts would also pull in its server-only Supabase client). Add a
// locale here ONLY when it is also added to AUTHORIZED_LOCALES in src/lib/i18n/translate.ts.
export const TRANSLATED_LOCALES = new Set(["sv"]);

export type LocaleSeo = {
  canonical: string;
  languages?: Record<string, string>;
};

// `enPath` is the path AFTER the locale segment, e.g. "/cosy-hotels/in/sweden" for
// /en/cosy-hotels/in/sweden. Returns a relative canonical (resolved via each layout's
// metadataBase) plus hreflang alternates for translated locales.
//
// - Translated locale (TRANSLATED_LOCALES): self-canonical at `/${locale}${enPath}`, with hreflang
//   for every translated locale, "en", and "x-default" -> en (the pre-translation default).
// - Everything else (untranslated locales; the pre-existing behavior): canonicalize to the /en
//   twin, no hreflang (Google consolidates ranking on the one indexed English copy).
//
// NOT for hotel detail pages: hotel description/FAQ content is deliberately untranslated (see
// src/app/[locale]/hotels/[slug]/page.tsx), so every locale stays canonical -> /en regardless of
// TRANSLATED_LOCALES. Only call this from a page whose body actually branches on `isEn`.
export function localeSeo(locale: string, enPath: string): LocaleSeo {
  if (TRANSLATED_LOCALES.has(locale)) {
    const languages: Record<string, string> = { en: `/en${enPath}` };
    for (const l of TRANSLATED_LOCALES) languages[l] = `/${l}${enPath}`;
    languages["x-default"] = `/en${enPath}`;
    return { canonical: `/${locale}${enPath}`, languages };
  }
  return { canonical: `/en${enPath}` };
}
