import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    // Ensure builds use this repo as the root, not parent directories
    root: ".",
  },
  images: {
    // Limit generated variants to reduce optimization churn and costs
    deviceSizes: [360, 640, 828],
    imageSizes: [400, 600, 800],
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      // Allow our own proxy endpoint in production hostname
      { protocol: 'https', hostname: 'www.cosyhotelroom.com', pathname: '/api/proxy/image' },
      { protocol: 'https', hostname: 'www.cosyhotelroom.com', pathname: '/api/proxy/image/**' },
    ],
    // Increase CDN cache time for optimized results
    minimumCacheTTL: 60 * 60 * 24 * 30, // 30 days
  },
  async redirects() {
    return [
      // The New York city guide was renamed "New York City" → "New York" (to match the DB city and
      // index). 308 the old slug (any locale) to the new one so no inbound link 404s.
      {
        source: "/:locale/guides/new-york-city-cosy-hotel",
        destination: "/:locale/guides/new-york-cosy-hotel",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
