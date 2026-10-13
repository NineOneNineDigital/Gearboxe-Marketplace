import { fetchQuery } from "convex/nextjs";
import { makeFunctionReference } from "convex/server";

const manifest = makeFunctionReference<"query", Record<string, never>, { pages: number }>("discovery:sitemapManifest");
const page = makeFunctionReference<"query", { shard: number; paginationOpts: { numItems: number; cursor: string | null } }, { page: { _id: string; updatedAt?: number }[]; isDone: boolean; continueCursor: string }>("discovery:sitemapPage");

export async function sitemapManifest() {
  if (process.env.MARKETPLACE_ENV === "ci" && process.env.CI === "true") return { pages: 0 };
  const result = await fetchQuery(manifest, {});
  // One additional entry is reserved for the static sitemap. The sitemap
  // protocol allows at most 50,000 entries in an index.
  if (!Number.isSafeInteger(result.pages) || result.pages < 0 || result.pages > 49_999) throw new Error("Invalid sitemap manifest");
  return result;
}

export async function sitemapShard(shard: number) {
  if (!Number.isSafeInteger(shard) || shard < 0) throw new Error("Invalid sitemap page");
  const result = await fetchQuery(page, { shard, paginationOpts: { numItems: 500, cursor: null } });
  if (!result.isDone) throw new Error("Sitemap page exceeded its configured capacity");
  return result.page;
}

export function escapeXml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[character]!);
}
