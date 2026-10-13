import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { getCurrentUser, requireCurrentUser } from "./lib/authorization";
import { publicVehicle } from "./lib/vehicleVisibility";
import { resolveVehicleMedia } from "./lib/vehicleMedia";
export const record = mutation({ args: { id: v.id("vehicles") }, handler: async (ctx, { id }) => {
  const user = await getCurrentUser(ctx); if (!user) return;
  const vehicle = await ctx.db.get(id); if (!vehicle || !["active", "approved"].includes(vehicle.status)) return;
  const existing = await ctx.db.query("recentViews").withIndex("by_user_vehicle", q => q.eq("userId", user._id).eq("vehicleId", id)).unique();
  if (existing) await ctx.db.patch(existing._id, { viewedAt: Date.now() });
  else await ctx.db.insert("recentViews", { userId: user._id, vehicleId: id, viewedAt: Date.now() });
  const rows = await ctx.db.query("recentViews").withIndex("by_user_time", q => q.eq("userId", user._id)).order("desc").take(51);
  for (const row of rows.slice(50)) await ctx.db.delete(row._id);
} });
export const list = query({ args: {}, handler: async ctx => {
  const user = await requireCurrentUser(ctx);
  const rows = await ctx.db.query("recentViews").withIndex("by_user_time", q => q.eq("userId", user._id)).order("desc").take(50);
  const results = [];
  for (const row of rows) {
    const vehicle = await ctx.db.get(row.vehicleId);
    if (vehicle && ["active", "approved"].includes(vehicle.status)) results.push(await resolveVehicleMedia(ctx, publicVehicle(vehicle)));
    if (results.length === 12) break;
  }
  return results;
} });
