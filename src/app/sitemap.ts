import type { MetadataRoute } from "next";
import { guides } from "@/data/guides";
import { cityGuides } from "@/data/cityGuides";
import { BLOG_POSTS } from "@/data/blogPosts";
import { locales } from "@/i18n/locales";
import { getServerSupabase } from "@/lib/supabase/server";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const now = new Date();
  const routes: MetadataRoute.Sitemap = [];
  // Root homepage (English default)
  routes.push({ url: `${base}/`, lastModified: now, changeFrequency: "weekly", priority: 0.9 });
  for (const locale of locales) {
    routes.push({ url: `${base}/${locale}`, lastModified: now, changeFrequency: "weekly", priority: 0.8 });
    for (const g of guides) {
      routes.push({ url: `${base}/${locale}/guides/${g.slug}`, lastModified: now, changeFrequency: "monthly", priority: 0.5 });
    }
    for (const cg of cityGuides) {
      routes.push({ url: `${base}/${locale}/guides/${cg.slug}`, lastModified: now, changeFrequency: "weekly", priority: 0.7 });
    }
    routes.push({ url: `${base}/${locale}/guides`, lastModified: now, changeFrequency: "monthly", priority: 0.4 });
    routes.push({ url: `${base}/${locale}/cosy-score`, lastModified: now, changeFrequency: "monthly", priority: 0.5 });
    routes.push({ url: `${base}/${locale}/for-hotels`, lastModified: now, changeFrequency: "monthly", priority: 0.5 });
    routes.push({ url: `${base}/${locale}/cosy-index`, lastModified: now, changeFrequency: "weekly", priority: 0.7 });
    routes.push({ url: `${base}/${locale}/what-makes-a-hotel-cosy`, lastModified: now, changeFrequency: "monthly", priority: 0.7 });
    routes.push({ url: `${base}/${locale}/make-your-hotel-look-cosy`, lastModified: now, changeFrequency: "monthly", priority: 0.6 });
    routes.push({ url: `${base}/${locale}/blog`, lastModified: now, changeFrequency: "weekly", priority: 0.6 });
    for (const p of BLOG_POSTS) {
      routes.push({ url: `${base}/${locale}/blog/${p.slug}`, lastModified: now, changeFrequency: "monthly", priority: 0.6 });
    }
  }

  // Add dynamic hotel detail URLs from Supabase, paginated to avoid timeouts
  const db = getServerSupabase();
  if (db) {
    const pageSize = 1000;
    // Only SURFACED hotels (cosy score ≥5), canonical /en locale only. This keeps the sitemap
    // well under Vercel's 19MB limit and avoids indexing thin/hidden pages + locale duplicates.
    let from = 0;
    for (let i = 0; i < 50; i++) {
      const to = from + pageSize - 1;
      const { data, error } = await db
        .from('cosy_scores')
        .select('score, hotel:hotel_id (slug, updated_at)')
        .gte('score', 5)
        .range(from, to);
      if (error || !data || data.length === 0) break;
      for (const row of data as unknown as Array<{ hotel: { slug: string | null; updated_at: string | null } | null }>) {
        const slug = (row.hotel?.slug || '').trim();
        if (!slug) continue;
        const lm = row.hotel?.updated_at ? new Date(row.hotel.updated_at) : now;
        routes.push({ url: `${base}/en/hotels/${slug}`, lastModified: lm, changeFrequency: 'weekly', priority: 0.6 });
      }
      if (data.length < pageSize) break;
      from += pageSize;
    }
  }

  return routes;
}
