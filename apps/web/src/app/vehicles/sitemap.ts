import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/seo";
import { sitemapManifest, sitemapShard } from "@/lib/sitemap";

export const dynamic = "force-dynamic";

export async function generateSitemaps() {
  const { pages } = await sitemapManifest();
  return Array.from({ length: pages }, (_, id) => ({ id }));
}

export default async function sitemap({ id }: { id: number }): Promise<MetadataRoute.Sitemap> {
  const vehicles = await sitemapShard(Number(id));
  return vehicles.map((vehicle) => ({
    url: absoluteUrl(`/vehicles/${encodeURIComponent(vehicle._id)}`),
    ...(vehicle.updatedAt ? { lastModified: new Date(vehicle.updatedAt) } : {}),
  }));
}
