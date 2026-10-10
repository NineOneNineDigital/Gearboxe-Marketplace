import { v } from "convex/values";
import { action, internalMutation, internalQuery } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { decodedFields } from "./lib/vehicleSpecification";
import { normalizeVin, fetchDecode } from "./lib/autoDev";
import type { DecodedVehicle } from "./lib/autoDev";

export const cached = internalQuery({
  args: { vin: v.string() },
  handler: (ctx, args) => ctx.db.query("vinDecodes").withIndex("by_vin", q => q.eq("vin", args.vin)).unique(),
});
export const claimRequest = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const last = await ctx.db.query("vinDecodeLimits").withIndex("by_user", q => q.eq("userId", args.userId)).unique();
    const now = Date.now();
    if (last && now - last.requestedAt < 10_000) throw new Error("Wait ten seconds between VIN decode requests");
    if (last) await ctx.db.patch(last._id, { requestedAt: now });
    else await ctx.db.insert("vinDecodeLimits", { userId: args.userId, requestedAt: now });
  },
});
export const storeDecode = internalMutation({
  args: { ...decodedFields, decodedAt: v.number() },
  handler: async (ctx, args) => {
    const existing = await ctx.db.query("vinDecodes").withIndex("by_vin", q => q.eq("vin", args.vin)).unique();
    if (existing) await ctx.db.replace(existing._id, args);
    else await ctx.db.insert("vinDecodes", args);
  },
});
export const decodeVin = action({
  args: { vin: v.string() },
  handler: async (ctx, args): Promise<DecodedVehicle> => {
    const user = await ctx.runQuery(api.users.current, {});
    if (!user) throw new Error("Authentication required");
    const vin = normalizeVin(args.vin);
    await ctx.runMutation(internal.vin.claimRequest, { userId: user._id });
    const cached = await ctx.runQuery(internal.vin.cached, { vin });
    if (cached && Date.now() - cached.decodedAt < 30 * 24 * 60 * 60 * 1000) {
      const { _id, _creationTime, decodedAt, ...result } = cached;
      void _id; void _creationTime; void decodedAt;
      return result;
    }
    const key = process.env.AUTO_DEV_API_KEY;
    if (!key) throw new Error("VIN decoding is not configured; enter vehicle details manually");
    const result = await fetchDecode(vin, key);
    await ctx.runMutation(internal.vin.storeDecode, { ...result, decodedAt: Date.now() });
    return result;
  },
});
