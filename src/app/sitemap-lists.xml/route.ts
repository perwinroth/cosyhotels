// Saved-lists sitemap. Only lists that clear the substance gate (title AND >= 4 items) are ever
// emitted — thin/anonymous lists stay noindex forever (G13 doorway rule), same gate the list page's
// generateMetadata enforces. Prefers the `shortlists_indexable` view (sql/saved-lists-v1.sql); falls
// back to an equivalent filtered query if the view isn't present yet (pre-migration safety). Mirrors
// sitemap-trips.xml's structure.
import { getServerSupabase } from "@/lib/supabase/server";
import { XML_HEADERS } from "@/lib/seo/sitemapData";

export const revalidate = 86400;

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://gotcosy.com";
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[c] as string));

type Row = { slug: string; locale: string | null; updated_at: string | null };

async function loadIndexableLists(): Promise<Row[]> {
  const db = getServerSupabase();
  if (!db) return [];
  // Try the view first (matches the exact substance gate: title non-empty AND items >= 4).
  const view = await db.from("shortlists_indexable").select("slug,updated_at");
  if (!view.error && view.data) {
    // The view doesn't carry `locale`, so fetch it alongside for the emitted per-locale URL.
    const slugs = view.data.map((r: { slug: string }) => r.slug);
    if (slugs.length === 0) return [];
    const { data: locRows } = await db.from("shortlists").select("slug,locale").in("slug", slugs);
    const localeBySlug = new Map((locRows || []).map((r: { slug: string; locale: string | null }) => [r.slug, r.locale]));
    return view.data.map((r: { slug: string; updated_at: string | null }) => ({ slug: r.slug, updated_at: r.updated_at, locale: localeBySlug.get(r.slug) || "en" }));
  }
  // Fallback: the view doesn't exist yet (migration not applied). Equivalent filtered query.
  const { data } = await db.from("shortlists").select("slug,title,items,updated_at,locale");
  return (data || [])
    .filter((r: { title: string | null; items: string[] | null }) => (r.title || "").trim().length > 0 && Array.isArray(r.items) && r.items.length >= 4)
    .map((r: { slug: string; updated_at: string | null; locale: string | null }) => ({ slug: r.slug, updated_at: r.updated_at, locale: r.locale || "en" }));
}

export async function GET() {
  const rows = await loadIndexableLists();
  const now = new Date().toISOString();
  const urls = rows.map((r) => {
    const locale = r.locale || "en";
    const loc = esc(`${SITE}/${locale}/trips/lists/${r.slug}`);
    const lastmod = r.updated_at ? new Date(r.updated_at).toISOString() : now;
    return `<url><loc>${loc}</loc><lastmod>${lastmod}</lastmod><changefreq>weekly</changefreq><priority>0.4</priority></url>`;
  }).join("");

  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`;
  return new Response(body, { headers: XML_HEADERS });
}
