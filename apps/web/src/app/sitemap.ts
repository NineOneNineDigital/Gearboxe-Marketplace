import { popupPaymentsEnabled } from "@/convex/lib/environment";
import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/seo";

export default function sitemap(): MetadataRoute.Sitemap {
  return ["/", "/vehicles", ...(popupPaymentsEnabled() ? ["/events"] : [])].map((path) => ({ url: absoluteUrl(path) }));
}
