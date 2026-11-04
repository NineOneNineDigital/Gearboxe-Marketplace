import type { MetadataRoute } from "next";
import { absoluteUrl, appOrigin } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/myAccount/", "/admin/", "/api/", "/sign-in", "/sign-up"] },
    sitemap: absoluteUrl("/sitemap-index.xml"), host: appOrigin().origin,
  };
}
