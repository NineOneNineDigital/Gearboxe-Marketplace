import type { NextConfig } from "next";
import { validateEnvironment } from "./convex/lib/environment";

validateEnvironment(process.env, process.env.VERCEL === "1" ? "web-runtime" : "web-build");

const nextConfig: NextConfig = {
  poweredByHeader: false,
  transpilePackages: ["@workspace/design-tokens"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      ...(process.env.NEXT_PUBLIC_CONVEX_URL ? [{
        protocol: "https" as const,
        hostname: new URL(process.env.NEXT_PUBLIC_CONVEX_URL).hostname,
        pathname: "/api/storage/**",
      }] : []),
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(self), geolocation=(self), microphone=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
