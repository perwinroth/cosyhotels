import type { MetadataRoute } from "next";
// Removed curated hotels from sitemap; dynamic hotels are discovered at runtime
import { collections } from "@/data/collections";
import { guides } from "@/data/guides";
import { locales } from "@/i18n/locales";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const now = new Date();
  const routes: MetadataRoute.Sitemap = [];
  for (const locale of locales) {
    routes.push({ url: `${base}/${locale}`, lastModified: now, changeFrequency: "weekly", priority: 0.8 });
    routes.push({ url: `${base}/${locale}/hotels`, lastModified: now, changeFrequency: "weekly", priority: 0.7 });
    // Hotel detail pages are dynamic; omit static hotel URLs here
    for (const c of collections) {
      routes.push({ url: `${base}/${locale}/collections/${c.slug}`, lastModified: now, changeFrequency: "weekly", priority: 0.6 });
    }
    routes.push({ url: `${base}/${locale}/collections`, lastModified: now, changeFrequency: "monthly", priority: 0.5 });
    for (const g of guides) {
      routes.push({ url: `${base}/${locale}/guides/${g.slug}`, lastModified: now, changeFrequency: "monthly", priority: 0.5 });
    }
    routes.push({ url: `${base}/${locale}/guides`, lastModified: now, changeFrequency: "monthly", priority: 0.4 });
  }
  return routes;
}
