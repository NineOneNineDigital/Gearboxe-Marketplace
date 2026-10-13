import { paginationOptsValidator } from "convex/server";
import type { PaginationOptions } from "convex/server";
import { v } from "convex/values";
import { query, internalMutation } from "./_generated/server";
import { discoveryFilters, discoverySort, validateFilters, words, scopeKey, geoScope, matches } from "./lib/discoveryPolicy";
import { publicVehicle } from "./lib/vehicleVisibility";
import { resolveVehicleMedia } from "./lib/vehicleMedia";
import { syncDiscovery } from "./lib/discoveryIndex";
import { requireAdmin } from "./lib/authorization";
import { mutation } from "./_generated/server";

function boundedPagination(options: PaginationOptions, cap: number, rows = 256) {
  if (!Number.isFinite(options.numItems) || options.numItems < 1) throw new Error("Invalid page size");
  // Read-budget options exist in this SDK runtime but are omitted from its
  // public .d.ts because they are internal. Pass a structural options value.
  return { ...options, numItems: Math.min(cap, Math.floor(options.numItems)), maximumRowsRead: rows, maximumBytesRead: 2_000_000 };
}

export const browse = query({
  args: { filters: discoveryFilters, sort: discoverySort, paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const f = validateFilters(args.filters);
    if (f.search && !words(f.search).length) throw new Error("Enter a search word or number");
    const spatialScope = geoScope(f);
    const token = spatialScope ? "" : words(f.search ?? "")[0] ?? "";
    const scope = spatialScope || scopeKey(f);
    const base = ctx.db.query("vehicleSearchTerms");
    const indexed = args.sort.startsWith("price")
      ? base.withIndex("by_price", q => { const start = q.eq("token", token).eq("scope", scope); if (f.minPrice !== undefined && f.maxPrice !== undefined) return start.gte("price", f.minPrice).lte("price", f.maxPrice); if (f.minPrice !== undefined) return start.gte("price", f.minPrice); if (f.maxPrice !== undefined) return start.lte("price", f.maxPrice); return start; })
      : args.sort.startsWith("mileage")
        ? base.withIndex("by_mileage", q => { const start = q.eq("token", token).eq("scope", scope); return f.maxMileage !== undefined ? start.lte("mileageMiles", f.maxMileage) : start; })
        : args.sort.startsWith("year")
          ? base.withIndex("by_year", q => { const start = q.eq("token", token).eq("scope", scope); if (f.minYear !== undefined && f.maxYear !== undefined) return start.gte("year", f.minYear).lte("year", f.maxYear); if (f.minYear !== undefined) return start.gte("year", f.minYear); if (f.maxYear !== undefined) return start.lte("year", f.maxYear); return start; })
          : base.withIndex("by_recency", q => q.eq("token", token).eq("scope", scope));
    const direction = ["newest", "price-high", "mileage-high", "year-new"].includes(args.sort) ? "desc" : "asc";
    // Bound work independently of result count. The cursor advances even when
    // remaining filters eliminate every row in a sparse page.
    const result = await indexed.order(direction).paginate(boundedPagination(args.paginationOpts, 48));
    const page = await Promise.all(result.page.filter(row => matches(row, f)).map(async row => {
      const vehicle = await ctx.db.get(row.vehicleId);
      if (!vehicle || !["active", "approved"].includes(vehicle.status)) return null;
      return resolveVehicleMedia(ctx, publicVehicle(vehicle));
    }));
    return { ...result, page: page.filter(row => row !== null) };
  },
});

export const related = query({ args: { id: v.id("vehicles") }, handler: async (ctx, { id }) => {
  const vehicle = await ctx.db.get(id);
  if (!vehicle || !["active", "approved"].includes(vehicle.status)) return [];
  const rows = await ctx.db.query("vehicleSearchTerms").withIndex("by_recency", q => q.eq("token", "").eq("scope", scopeKey({ make: vehicle.make }))).order("desc").take(4);
  const result = [];
  for (const row of rows) {
    if (row.vehicleId === id) continue;
    const candidate = await ctx.db.get(row.vehicleId);
    if (candidate && ["active", "approved"].includes(candidate.status)) result.push(await resolveVehicleMedia(ctx, publicVehicle(candidate)));
    if (result.length === 3) break;
  }
  return result;
} });
export const recentPublic = query({ args: { ids: v.array(v.string()) }, handler: async (ctx, { ids }) => {
  if (ids.length > 12) throw new Error("At most 12 recently viewed listings are allowed");
  const rows = await Promise.all([...new Set(ids)].map(async value => {
    const id = ctx.db.normalizeId("vehicles", value); if (!id) return null;
    const vehicle = await ctx.db.get(id);
    return vehicle && ["active", "approved"].includes(vehicle.status) ? resolveVehicleMedia(ctx, publicVehicle(vehicle)) : null;
  }));
  return rows.filter(row => row !== null);
} });

export const metadataVehicle = query({
  args: { id: v.id("vehicles") },
  handler: async (ctx, { id }) => {
    const vehicle = await ctx.db.get(id);
    if (!vehicle || !["active", "approved"].includes(vehicle.status)) return null;
    const media = await resolveVehicleMedia(ctx, publicVehicle(vehicle));
    return { _id: vehicle._id, title: vehicle.title, year: vehicle.year, make: vehicle.make, model: vehicle.model, trim: vehicle.trim, price: vehicle.price, mileage: vehicle.mileage, mileageUnit: vehicle.mileageUnit,
      location: vehicle.location ? { city: vehicle.location.city, state: vehicle.location.state } : undefined,
      photoUrl: media.photos[0], updatedAt: vehicle.updatedAt ?? vehicle.createdAt };
  },
});
export const sitemapManifest = query({ args: {}, handler: async ctx => {
  const counter = await ctx.db.query("discoveryCounters").withIndex("by_key", q => q.eq("key", "sitemap")).unique();
  return { pages: Math.ceil((counter?.next ?? 0) / 500) };
} });
export const sitemapPage = query({ args: { shard: v.number(), paginationOpts: paginationOptsValidator }, handler: async (ctx, args) => {
  if (!Number.isInteger(args.shard) || args.shard < 0) throw new Error("Invalid sitemap shard");
  const result = await ctx.db.query("vehicleCatalog").withIndex("by_sitemap_shard", q => q.eq("sitemapShard", args.shard)).paginate(boundedPagination(args.paginationOpts, 500, 501));
  const page = await Promise.all(result.page.map(async row => {
    const vehicle = await ctx.db.get(row.vehicleId);
    return vehicle && ["active", "approved"].includes(vehicle.status) ? { _id: row.vehicleId, updatedAt: row.updatedAt } : null;
  }));
  return { ...result, page: page.filter(row => row !== null) };
} });
// Bounded, resumable backfill; invoke manually only on the confirmed deployment.
export const backfill = mutation({ args: { cursor: v.union(v.string(), v.null()) }, handler: async (ctx, { cursor }) => {
  await requireAdmin(ctx);
  const result = await ctx.db.query("vehicles").paginate(boundedPagination({ numItems: 1, cursor }, 1, 1));
  for (const vehicle of result.page) await syncDiscovery(ctx, vehicle._id);
  return { isDone: result.isDone, continueCursor: result.continueCursor };
} });
export const backfillInternal = internalMutation({ args: { cursor: v.union(v.string(), v.null()) }, handler: async (ctx, { cursor }) => {
  const result = await ctx.db.query("vehicles").paginate(boundedPagination({ numItems: 1, cursor }, 1, 1));
  for (const vehicle of result.page) await syncDiscovery(ctx, vehicle._id);
  return { isDone: result.isDone, continueCursor: result.continueCursor };
} });
