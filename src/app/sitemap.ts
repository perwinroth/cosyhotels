import type { MetadataRoute } from "next";
import { collections } from "@/data/collections";
import { guides } from "@/data/guides";
import { cityGuides } from "@/data/cityGuides";
import { locales } from "@/i18n/locales";
import { getServerSupabase } from "@/lib/supabase/server";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const now = new Date();
  const routes: MetadataRoute.Sitemap = [];
  for (const locale of locales) {
    routes.push({ url: `${base}/${locale}`, lastModified: now, changeFrequency: "weekly", priority: 0.8 });
    routes.push({ url: `${base}/${locale}/hotels`, lastModified: now, changeFrequency: "weekly", priority: 0.7 });
    for (const c of collections) {
      routes.push({ url: `${base}/${locale}/collections/${c.slug}`, lastModified: now, changeFrequency: "weekly", priority: 0.6 });
    }
    routes.push({ url: `${base}/${locale}/collections`, lastModified: now, changeFrequency: "monthly", priority: 0.5 });
    for (const g of guides) {
      routes.push({ url: `${base}/${locale}/guides/${g.slug}`, lastModified: now, changeFrequency: "monthly", priority: 0.5 });
    }
    for (const cg of cityGuides) {
      routes.push({ url: `${base}/${locale}/guides/${cg.slug}`, lastModified: now, changeFrequency: "weekly", priority: 0.7 });
    }
    routes.push({ url: `${base}/${locale}/guides`, lastModified: now, changeFrequency: "monthly", priority: 0.4 });
  }

  // Add dynamic hotel detail URLs from Supabase, paginated to avoid timeouts
  const db = getServerSupabase();
  if (db) {
    const pageSize = 1000;
    let from = 0;
    // Loop up to 50k entries defensively
    for (let i = 0; i < 50; i++) {
      const to = from + pageSize - 1;
      const { data, error } = await db
        .from('hotels')
        .select('slug, updated_at')
        .order('updated_at', { ascending: false })
        .range(from, to);
      if (error || !data || data.length === 0) break;
      for (const row of data as Array<{ slug: string | null; updated_at: string | null }>) {
        const slug = (row.slug || '').trim();
        if (!slug) continue;
        const lm = row.updated_at ? new Date(row.updated_at) : now;
        for (const locale of locales) {
          routes.push({ url: `${base}/${locale}/hotels/${slug}`, lastModified: lm, changeFrequency: 'weekly', priority: 0.6 });
        }
      }
      if (data.length < pageSize) break;
      from += pageSize;
    }
  }

  return routes;
}
