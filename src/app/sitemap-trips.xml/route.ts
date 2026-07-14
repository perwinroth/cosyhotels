// Trip-board sitemap. Only INDEXABLE, live-membered boards: a board touching a control market, or
// with any stop below 2 live picks, is omitted (the page noindexes itself under the same rule via
// resolveBoardLive.indexable, so sitemap and page can never disagree). Trips are genuinely
// translated content, so each board is emitted with xhtml:link hreflang alternates for the enabled
// locales (unlike the /en-only city guides).
import { TRIP_BOARDS } from "@/data/tripBoards";
import { resolveBoardLive } from "@/lib/tripsLive";
import { locales } from "@/i18n/locales";
import { XML_HEADERS } from "@/lib/seo/sitemapData";

export const revalidate = 86400;

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://gotcosy.com";
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[c] as string));

export async function GET() {
  const resolved = await Promise.all(TRIP_BOARDS.map((b) => resolveBoardLive(b)));
  const indexable = resolved.filter((r) => r.indexable);
  const now = new Date().toISOString();

  const urls = indexable.map((r) => {
    const alternates = [
      ...locales.map((l) => `<xhtml:link rel="alternate" hreflang="${l}" href="${esc(`${SITE}/${l}/trips/${r.board.slug}`)}"/>`),
      `<xhtml:link rel="alternate" hreflang="x-default" href="${esc(`${SITE}/en/trips/${r.board.slug}`)}"/>`,
    ].join("");
    // Canonical loc is the /en twin; every locale is offered via the hreflang alternates.
    return `<url><loc>${esc(`${SITE}/en/trips/${r.board.slug}`)}</loc><lastmod>${now}</lastmod><changefreq>weekly</changefreq><priority>0.6</priority>${alternates}</url>`;
  }).join("");

  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">${urls}</urlset>`;
  return new Response(body, { headers: XML_HEADERS });
}
