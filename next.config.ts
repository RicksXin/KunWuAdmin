import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  distDir: process.env.KUNWU_ADMIN_DIST_DIR ?? ".next",
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
