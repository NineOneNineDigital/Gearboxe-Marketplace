import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireCurrentUser } from "./lib/authorization";
import { assertBuyerEmailVerified } from "./lib/trustGuards";
import { isPublicVehicleFromActiveSeller, publicVehicle } from "./lib/vehicleVisibility";
import { resolveVehicleMedia } from "./lib/vehicleMedia";

const MAX_PER_DAY = 20;
const DAY_MS = 86_400_000;

export const create = mutation({
  args: { vehicleIds: v.array(v.id("vehicles")) },
  handler: async (ctx, { vehicleIds }) => {
    const user = await requireCurrentUser(ctx);
    assertBuyerEmailVerified(user);
    if (vehicleIds.length < 2 || vehicleIds.length > 4 || new Set(vehicleIds).size !== vehicleIds.length) {
      throw new Error("Choose two to four different vehicles");
    }
    for (const vehicleId of vehicleIds) {
      const vehicle = await ctx.db.get(vehicleId);
      if (!vehicle || !(await isPublicVehicleFromActiveSeller(ctx, vehicle))) {
        throw new Error("One or more vehicles are no longer available");
      }
    }

    // Keep the owner list complete while bounding both storage and reads.
    const existing = await ctx.db.query("comparisons")
      .withIndex("by_user", q => q.eq("userId", user._id)).take(100);
    if (existing.length >= 100) throw new Error("Delete an old comparison before creating another");

    const now = Date.now();
    const windowStart = Math.floor(now / DAY_MS) * DAY_MS;
    const rate = await ctx.db.query("trustRateLimits")
      .withIndex("by_user_action", q => q.eq("userId", user._id).eq("action", "comparisonCreate"))
      .unique();
    const count = rate?.windowStart === windowStart ? rate.count : 0;
    if (count >= MAX_PER_DAY) throw new Error("Too many comparisons created today. Try again tomorrow.");
    if (rate) await ctx.db.patch(rate._id, { windowStart, count: count + 1 });
    else await ctx.db.insert("trustRateLimits", { userId: user._id, action: "comparisonCreate", windowStart, count: 1 });

    const token = crypto.randomUUID().replaceAll("-", "");
    const id = await ctx.db.insert("comparisons", { userId: user._id, token, vehicleIds, createdAt: now });
    return { id, token };
  },
});

export const listMine = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireCurrentUser(ctx);
    const rows = await ctx.db.query("comparisons")
      .withIndex("by_user", q => q.eq("userId", user._id))
      .order("desc").take(100);
    return rows.map(({ _id, token, vehicleIds, createdAt }) => ({ id: _id, token, vehicleIds, createdAt }));
  },
});

export const revoke = mutation({
  args: { id: v.id("comparisons") },
  handler: async (ctx, { id }) => {
    const user = await requireCurrentUser(ctx);
    const row = await ctx.db.get(id);
    if (!row || row.userId !== user._id) throw new Error("Comparison not found");
    await ctx.db.delete(id);
  },
});

export const getPublic = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    if (!/^[0-9a-f]{32}$/.test(token)) return null;
    const comparison = await ctx.db.query("comparisons")
      .withIndex("by_token", q => q.eq("token", token)).unique();
    if (!comparison) return null;
    const owner = await ctx.db.get(comparison.userId);
    if (!owner || owner.deletedAt !== undefined) return null;

    const cars = [];
    for (const id of comparison.vehicleIds.slice(0, 4)) {
      const vehicle = await ctx.db.get(id);
      if (!vehicle || !(await isPublicVehicleFromActiveSeller(ctx, vehicle))) continue;
      const publicListing = await resolveVehicleMedia(ctx, publicVehicle(vehicle));
      cars.push({
        id: publicListing._id,
        title: publicListing.title,
        year: publicListing.year,
        make: publicListing.make,
        model: publicListing.model,
        price: publicListing.price,
        mileage: publicListing.mileage,
        mileageUnit: publicListing.mileageUnit,
        status: publicListing.status,
        location: publicListing.location
          ? { city: publicListing.location.city, state: publicListing.location.state }
          : undefined,
        titleStatus: publicListing.titleStatus,
        serviceRecords: publicListing.serviceRecords,
        damageDisclosure: publicListing.damageDisclosure,
        accidentDisclosure: publicListing.accidentDisclosure,
        mechanicalIssues: publicListing.mechanicalIssues,
        photoUrl: publicListing.thumbnailPhotos[0],
      });
    }
    return { cars, unavailableCount: comparison.vehicleIds.length - cars.length };
  },
});
