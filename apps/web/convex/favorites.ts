import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const addFavorite = mutation({
  args: {
    userId: v.id("users"),
    vehicleId: v.id("vehicles"),
  },
  handler: async (ctx, args) => {
    // Check if already favorited
    const existing = await ctx.db
      .query("favorites")
      .withIndex("by_user_vehicle", (q) =>
        q.eq("userId", args.userId).eq("vehicleId", args.vehicleId)
      )
      .first();

    if (existing) {
      return existing._id;
    }

    return await ctx.db.insert("favorites", {
      ...args,
      createdAt: Date.now(),
    });
  },
});

export const removeFavorite = mutation({
  args: {
    userId: v.id("users"),
    vehicleId: v.id("vehicles"),
  },
  handler: async (ctx, args) => {
    const favorite = await ctx.db
      .query("favorites")
      .withIndex("by_user_vehicle", (q) =>
        q.eq("userId", args.userId).eq("vehicleId", args.vehicleId)
      )
      .first();

    if (favorite) {
      await ctx.db.delete(favorite._id);
    }
  },
});

export const getFavoritesByUser = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const favorites = await ctx.db
      .query("favorites")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    // Get vehicle details for each favorite
    const vehicles = await Promise.all(
      favorites.map(async (favorite) => {
        const vehicle = await ctx.db.get(favorite.vehicleId);
        return vehicle;
      })
    );

    return vehicles.filter(Boolean);
  },
});

export const isFavorited = query({
  args: {
    userId: v.id("users"),
    vehicleId: v.id("vehicles"),
  },
  handler: async (ctx, args) => {
    const favorite = await ctx.db
      .query("favorites")
      .withIndex("by_user_vehicle", (q) =>
        q.eq("userId", args.userId).eq("vehicleId", args.vehicleId)
      )
      .first();

    return !!favorite;
  },
});
