import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // A separate output directory can be selected for CI or OneDrive workspaces
  // without changing the normal Next.js `.next` deployment output.
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
