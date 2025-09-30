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
    // Increase CDN cache time for optimized results
    minimumCacheTTL: 60 * 60 * 24 * 30, // 30 days
  },
};

export default nextConfig;
