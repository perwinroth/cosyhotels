// Shared JSON-LD builders. One source of truth for the entity/site schema that SEO (Google rich
// results), AEO (answer engines) and GEO (AI citation) all read. Keep these graph-consistent: same
// Organization @id everywhere so engines resolve "Got Cosy" to a single entity.
import { site } from "@/config/site";

const ORG_ID = `${site.url}/#organization`;
const SITE_ID = `${site.url}/#website`;

export function organizationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": ORG_ID,
    name: "Got Cosy",
    alternateName: "Cozy Hotels Guide",
    url: site.url,
    description: site.description,
    logo: `${site.url}/icon`,
    sameAs: [
      "https://www.instagram.com/got_cosy/",
      "https://www.pinterest.com/gotcosy/",
    ],
  };
}

// WebSite + SearchAction → enables the sitelinks search box and tells engines how to query the site.
export function websiteSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": SITE_ID,
    url: site.url,
    name: site.name,
    description: site.description,
    publisher: { "@id": ORG_ID },
    // No SearchAction: we have no dedicated search-results endpoint. The old target pointed at
    // /en/guides/{search_term_string}-cosy-hotel, which crawlers indexed as a literal garbage URL.
  };
}

export function breadcrumbSchema(items: Array<{ name: string; url: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: it.url.startsWith("http") ? it.url : `${site.url}${it.url}`,
    })),
  };
}

// Inline <script type="application/ld+json"> payload, ready to spread into dangerouslySetInnerHTML.
export function jsonLd(obj: unknown) {
  return { __html: JSON.stringify(obj) };
}
