import { hotelUrls, urlsetXml, XML_HEADERS } from "@/lib/seo/sitemapData";

export const revalidate = 86400;

export async function GET() {
  return new Response(urlsetXml(await hotelUrls()), { headers: XML_HEADERS });
}
