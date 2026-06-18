// On-demand: submit the homepage + all city-guide URLs to Google + Bing.
// Gated on GOOGLE_SERVICE_ACCOUNT_JSON / BING_API_KEY (skips + reports if absent).
import { NextResponse } from "next/server";
import { cityGuides } from "@/data/cityGuides";
import { submitUrls } from "@/lib/indexing";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function GET() {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "https://www.cosyhotelroom.com";
  const urls = [
    `${base}/`,
    `${base}/en/hotels`,
    `${base}/en/guides`,
    ...cityGuides.map((g) => `${base}/en/guides/${g.slug}`),
  ];
  const tags = await submitUrls(urls);
  return NextResponse.json({ submitted_count: urls.length, result: tags });
}
