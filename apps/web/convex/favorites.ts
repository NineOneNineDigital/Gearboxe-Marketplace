import { publicVehicle } from "./lib/vehicleVisibility";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireCurrentUser } from "./lib/authorization";
import { enqueueNotification } from "./notifications";
import { consumeRateLimit } from "./lib/trustGuards";
import { resolveVehicleMedia } from "./lib/vehicleMedia";

export const addFavorite = mutation({
  args: {
    vehicleId: v.id("vehicles"),
  },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    const vehicle = await ctx.db.get(args.vehicleId);
    if (!vehicle || (vehicle.status !== "approved" && vehicle.status !== "active")) {
      throw new Error("Vehicle is not available");
    }
    // Check if already favorited
    const existing = await ctx.db
      .query("favorites")
      .withIndex("by_user_vehicle", (q) =>
        q.eq("userId", user._id).eq("vehicleId", args.vehicleId)
      )
      .first();

    if (existing) {
      return existing._id;
    }

    await consumeRateLimit(ctx, user._id, "favorite");
    const id = await ctx.db.insert("favorites", { ...args, userId: user._id, createdAt: Date.now() });
    if (vehicle.userId !== user._id) await enqueueNotification(ctx, {
      userId: vehicle.userId, sourceUserId: user._id, category: "favorites", kind: "new_favorite",
      message: "A shopper saved your listing.", vehicleId: vehicle._id,
      link: `/myAccount/my-listings#listing-${vehicle._id}`, dedupeKey: `favorite:${vehicle._id}:${user._id}`,
    });
    return id;
  },
});

export const removeFavorite = mutation({
  args: {
    vehicleId: v.id("vehicles"),
  },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    const favorite = await ctx.db
      .query("favorites")
      .withIndex("by_user_vehicle", (q) =>
        q.eq("userId", user._id).eq("vehicleId", args.vehicleId)
      )
      .first();

    if (favorite) {
      await ctx.db.delete(favorite._id);
    }
  },
});

export const getFavoritesByUser = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireCurrentUser(ctx);
    const favorites = await ctx.db
      .query("favorites")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    // Get vehicle details for each favorite
    const vehicles = await Promise.all(
      favorites.map(async (favorite) => {
        const vehicle = await ctx.db.get(favorite.vehicleId);
        return vehicle;
      })
    );

    const visible = vehicles.flatMap((vehicle) =>
      (vehicle?.status === "approved" || vehicle?.status === "active") ? [publicVehicle(vehicle)] : []
    );
    return Promise.all(visible.map(vehicle => resolveVehicleMedia(ctx, vehicle)));
  },
});

export const isFavorited = query({
  args: {
    vehicleId: v.id("vehicles"),
  },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    const favorite = await ctx.db
      .query("favorites")
      .withIndex("by_user_vehicle", (q) =>
        q.eq("userId", user._id).eq("vehicleId", args.vehicleId)
      )
      .first();

    return !!favorite;
  },
});
