import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

const isDev = process.env.NODE_ENV !== "production";

/**
 * Hope Admin PWA — Next.js 15 + Serwist
 *
 * Service-worker entry lives at `app/sw.ts` and is compiled to `public/sw.js`.
 * Disabled in dev to avoid stale chunks while iterating.
 */
const withSerwist = withSerwistInit({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
  disable: isDev,
  reloadOnOnline: true,
});

const nextConfig: NextConfig = {
  outputFileTracingRoot: process.cwd(),
  transpilePackages: ["xlsx"],
  poweredByHeader: false,
  compress: true,

  images: {
    domains: ["localhost", "lh3.googleusercontent.com", "firebasestorage.googleapis.com"],
    formats: ["image/webp", "image/avif"],
  },

  experimental: {
    optimizePackageImports: ["lucide-react", "@mui/material", "@mui/icons-material"],
  },

  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },

  async headers() {
    return [
      {
        source: "/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.webmanifest).*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "origin-when-cross-origin" },
        ],
      },
      {
        source: "/sw.js",
        headers: [
          { key: "Service-Worker-Allowed", value: "/" },
          { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
        ],
      },
    ];
  },
};

export default withSerwist(nextConfig);
