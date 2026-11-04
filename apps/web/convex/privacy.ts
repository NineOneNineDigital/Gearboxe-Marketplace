import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { syncDiscovery } from "./lib/discoveryIndex";

const DAY = 86_400_000;
// Each transaction is bounded; the daily sweep continues without a full-table read.
export const cleanup = internalMutation({
  args: { cursor: v.union(v.string(), v.null()) },
  handler: async (ctx, { cursor }) => {
    const page = await ctx.db.query("vehicles").paginate({ cursor, numItems: 50 });
    for (const vehicle of page.page) {
      const closed = ["sold", "withdrawn", "archived", "rejected", "draft"].includes(vehicle.status);
      if (closed && (vehicle.updatedAt ?? vehicle.createdAt) < Date.now() - 90 * DAY && (vehicle.vin || vehicle.contactInfo)) {
        await ctx.db.patch(vehicle._id, { vin: undefined, vinKey: undefined, vinVerificationStatus: "unverified", vinDecodedAt: undefined, contactInfo: "" });
      }
      const location = vehicle.location;
      if (location && (location.postalCode !== undefined || (location.latitude !== undefined && location.latitude !== Math.round(location.latitude * 100) / 100) || (location.longitude !== undefined && location.longitude !== Math.round(location.longitude * 100) / 100))) {
        await ctx.db.patch(vehicle._id, { location: { city: location.city, state: location.state, latitude: location.latitude === undefined ? undefined : Math.round(location.latitude * 100) / 100, longitude: location.longitude === undefined ? undefined : Math.round(location.longitude * 100) / 100 } });
        await syncDiscovery(ctx, vehicle._id);
      }
    }
    if (!page.isDone) await ctx.scheduler.runAfter(0, internal.privacy.cleanup, { cursor: page.continueCursor });
  },
});
export const cleanupVinCache = internalMutation({
  args: {},
  handler: async ctx => {
    const rows = await ctx.db.query("vinDecodes").withIndex("by_decoded", q => q.lt("decodedAt", Date.now() - 30 * DAY)).take(100);
    for (const row of rows) await ctx.db.delete(row._id);
    if (rows.length === 100) await ctx.scheduler.runAfter(0, internal.privacy.cleanupVinCache, {});
  },
});
