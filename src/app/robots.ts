import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const url = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  // We WANT AI answer engines to crawl us (AEO/GEO) — so name the major AI agents explicitly and
  // allow them, rather than relying only on the catch-all. Admin/cron are gated in middleware.
  const aiAgents = [
    "GPTBot", "OAI-SearchBot", "ChatGPT-User", "ClaudeBot", "Claude-Web", "anthropic-ai",
    "PerplexityBot", "Perplexity-User", "Google-Extended", "Applebot-Extended", "CCBot",
    "Amazonbot", "Bytespider", "Meta-ExternalAgent", "cohere-ai", "DuckAssistBot",
  ];
  // Non-content surfaces: API/image/badge endpoints, internal panels, and redirect/utility routes
  // should never be indexed. (Gated pages are 401-locked in middleware, but list them too so
  // crawlers don't waste budget on them.)
  const disallow = ["/api/", "/growth", "/admin", "/badge-outreach", "/outreach", "/today", "/posts", "/go/", "/follow", "/grade", "/rate", "/status", "/brand"];
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow },
      { userAgent: aiAgents, allow: "/", disallow },
    ],
    sitemap: `${url}/sitemap.xml`,
  };
}

