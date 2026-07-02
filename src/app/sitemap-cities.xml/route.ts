import { cityUrls, urlsetXml, XML_HEADERS } from "@/lib/seo/sitemapData";

export const revalidate = 86400;

export function GET() {
  return new Response(urlsetXml(cityUrls()), { headers: XML_HEADERS });
}
