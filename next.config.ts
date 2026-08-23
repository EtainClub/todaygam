import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  reactStrictMode: true,
  productionBrowserSourceMaps: false,
  webpack: (config) => {
    // Toss app review: the full firebase/firestore SDK ships eval-flagged
    // codegen (WebChannel realtime transport, IndexedDB persistence) that
    // gets rejected by static scan regardless of whether it's used. Swap it
    // for the eval-free REST client in the Toss build only (see
    // package.json's build:toss) — src/lib/firebase/client.ts and sync.ts
    // branch on IS_TOSS_APP to route around the APIs firestore/lite lacks
    // (onSnapshot, persistentLocalCache).
    if (process.env.TOSS_BUILD === "1") {
      config.resolve.alias = {
        ...config.resolve.alias,
        "firebase/firestore$": "firebase/firestore/lite",
      };
    }
    return config;
  },
};

export default nextConfig;
