import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const createVehicle = mutation({
  args: {
    userId: v.id("users"),
    title: v.string(),
    make: v.string(),
    model: v.string(),
    year: v.number(),
    mileage: v.number(),
    price: v.number(),
    vin: v.optional(v.string()),
    photos: v.array(v.string()),
    description: v.string(),
    contactInfo: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("vehicles", {
      ...args,
      status: "pending",
      createdAt: Date.now(),
    });
  },
});

export const getVehicles = query({
  args: {
    status: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("approved"),
        v.literal("rejected")
      )
    ),
    make: v.optional(v.string()),
    model: v.optional(v.string()),
    minPrice: v.optional(v.number()),
    maxPrice: v.optional(v.number()),
    minYear: v.optional(v.number()),
    maxYear: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let query = ctx.db.query("vehicles");

    if (args.status) {
      query = query.withIndex("by_status", (q) => q.eq("status", args.status));
    }

    const vehicles = await query.collect();

    return vehicles.filter((vehicle) => {
      if (args.make && vehicle.make.toLowerCase() !== args.make.toLowerCase()) {
        return false;
      }
      if (
        args.model &&
        vehicle.model.toLowerCase() !== args.model.toLowerCase()
      ) {
        return false;
      }
      if (args.minPrice && vehicle.price < args.minPrice) {
        return false;
      }
      if (args.maxPrice && vehicle.price > args.maxPrice) {
        return false;
      }
      if (args.minYear && vehicle.year < args.minYear) {
        return false;
      }
      if (args.maxYear && vehicle.year > args.maxYear) {
        return false;
      }
      return true;
    });
  },
});

export const getVehicleById = query({
  args: { id: v.id("vehicles") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const getVehiclesByUser = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("vehicles")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
  },
});

export const updateVehicle = mutation({
  args: {
    id: v.id("vehicles"),
    title: v.optional(v.string()),
    make: v.optional(v.string()),
    model: v.optional(v.string()),
    year: v.optional(v.number()),
    mileage: v.optional(v.number()),
    price: v.optional(v.number()),
    vin: v.optional(v.string()),
    photos: v.optional(v.array(v.string())),
    description: v.optional(v.string()),
    contactInfo: v.optional(v.string()),
    status: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("approved"),
        v.literal("rejected")
      )
    ),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    await ctx.db.patch(id, updates);
  },
});

export const deleteVehicle = mutation({
  args: { id: v.id("vehicles") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});

export const approveVehicle = mutation({
  args: { id: v.id("vehicles") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { status: "approved" });
  },
});

export const rejectVehicle = mutation({
  args: { id: v.id("vehicles") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { status: "rejected" });
  },
});
