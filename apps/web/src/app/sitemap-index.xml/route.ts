import { absoluteUrl } from "@/lib/seo";
import { escapeXml, sitemapManifest } from "@/lib/sitemap";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { pages } = await sitemapManifest();
    const urls = [absoluteUrl("/sitemap.xml"), ...Array.from({ length: pages }, (_, id) => absoluteUrl(`/vehicles/sitemap/${id}.xml`))];
    const body = `<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map((url) => `<sitemap><loc>${escapeXml(url)}</loc></sitemap>`).join("")}</sitemapindex>`;
    return new Response(body, { headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "no-cache" } });
  } catch {
    console.warn("Listing sitemap manifest could not be loaded from Convex");
    return new Response("Sitemap temporarily unavailable", { status: 503, headers: { "Retry-After": "60" } });
  }
}
