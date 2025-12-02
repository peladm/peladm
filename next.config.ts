import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  turbo: {},
  experimental: {
    turbo: {
      resolveAlias: {
        canvas: './empty-module.js',
      },
    },
  },
};

export default nextConfig;
