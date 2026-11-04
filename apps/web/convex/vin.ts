import { v } from "convex/values";
import { action, internalMutation, internalQuery } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { decodedFields } from "./lib/vehicleSpecification";
import { autoDevDecoder } from "./lib/autoDev";
import { vpicDecoder } from "./lib/vpic";
import { normalizeVin, selectVinDecoder } from "./lib/vinDecoder";
import type { DecodedVehicle } from "./lib/vinDecoder";

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
    if (user.suspendedAt !== undefined) throw new Error("Account suspended");
    const vin = normalizeVin(args.vin);
    await ctx.runMutation(internal.vin.claimRequest, { userId: user._id });
    const cached = await ctx.runQuery(internal.vin.cached, { vin });
    if (cached && Date.now() - cached.decodedAt < 30 * 24 * 60 * 60 * 1000) {
      const { _id, _creationTime, decodedAt, ...result } = cached;
      void _id; void _creationTime; void decodedAt;
      return result;
    }
    const decoder = selectVinDecoder({
      VIN_DECODER_PROVIDER: process.env.VIN_DECODER_PROVIDER,
      AUTO_DEV_API_KEY: process.env.AUTO_DEV_API_KEY,
    }, { auto_dev: autoDevDecoder, vpic: vpicDecoder });
    const result = await decoder.decode(vin);
    await ctx.runMutation(internal.vin.storeDecode, { ...result, decodedAt: Date.now() });
    return result;
  },
});
