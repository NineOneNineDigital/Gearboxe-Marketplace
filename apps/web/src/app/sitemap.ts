import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/seo";

export default function sitemap(): MetadataRoute.Sitemap {
  return ["/", "/vehicles", "/events"].map((path) => ({ url: absoluteUrl(path) }));
}
