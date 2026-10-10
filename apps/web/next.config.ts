import type { NextConfig } from "next";
import { validateEnvironment } from "./convex/lib/environment";

validateEnvironment(process.env, process.env.VERCEL === "1" ? "web-runtime" : "web-build");

const nextConfig: NextConfig = {
  poweredByHeader: false,
  transpilePackages: ["@workspace/design-tokens"],
  images: {
    domains: ["localhost"],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
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
            value: "camera=(self), geolocation=(), microphone=()",
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
