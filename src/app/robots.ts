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
  return {
    rules: [
      { userAgent: "*", allow: "/" },
      { userAgent: aiAgents, allow: "/" },
    ],
    sitemap: `${url}/sitemap.xml`,
  };
}

