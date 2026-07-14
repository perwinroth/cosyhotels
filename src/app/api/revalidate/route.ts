// On-demand cache revalidation — call after a re-scoring run so corrected scores show on the
// (ISR-cached) homepage/guide pages immediately instead of waiting out the 1-hour cache. Without
// this, a corrected score is right on the dynamic detail page but stale on the cached homepage.
//   GET /api/revalidate?secret=...   (secret optional; set REVALIDATE_SECRET to require it)
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export function GET(req: Request) {
  const secret = new URL(req.url).searchParams.get("secret");
  if (process.env.REVALIDATE_SECRET && secret !== process.env.REVALIDATE_SECRET) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  revalidatePath("/", "layout"); // homepage + all locale pages and guides under it
  // Also refresh the split sitemaps (they're DB-driven route handlers with a daily cache) so slug/
  // catalogue changes surface to Google promptly instead of waiting out the s-maxage.
  for (const p of ["/sitemap.xml", "/sitemap-hotels.xml", "/sitemap-cities.xml", "/sitemap-collections.xml", "/sitemap-static.xml", "/sitemap-blog.xml", "/sitemap-trips.xml"]) revalidatePath(p);
  return NextResponse.json({ ok: true, revalidated: true, sitemaps: true, at: Date.now() });
}
