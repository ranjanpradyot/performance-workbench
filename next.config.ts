import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  allowedDevOrigins: ["127.0.0.1"],
  turbopack: {
    resolveAlias: {
      fs: { browser: "./src/infrastructure/empty-node.ts" },
      stream: { browser: "./src/infrastructure/empty-node.ts" },
      zlib: { browser: "./src/infrastructure/empty-node.ts" },
    },
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...(config.resolve.fallback ?? {}),
        fs: false,
        stream: false,
        zlib: false,
      };
    }
    return config;
  },
};

export default nextConfig;
