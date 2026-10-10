import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import {
  getCurrentUser,
  isAdmin,
  requireAdmin,
  requireCurrentUser,
  requireMatchingUser,
} from "./lib/authorization";

const currentYear = new Date().getFullYear();

function validateVehicle(values: {
  title?: string;
  make?: string;
  model?: string;
  year?: number;
  mileage?: number;
  price?: number;
  vin?: string;
  photos?: string[];
  description?: string;
  contactInfo?: string;
}) {
  if (
    values.title !== undefined &&
    (values.title.trim().length < 3 || values.title.length > 120)
  ) {
    throw new Error("Title must contain between 3 and 120 characters");
  }
  for (const [label, value] of [
    ["Make", values.make],
    ["Model", values.model],
  ] as const) {
    if (value !== undefined && (!value.trim() || value.length > 60)) {
      throw new Error(`${label} must contain between 1 and 60 characters`);
    }
  }
  if (
    values.year !== undefined &&
    (!Number.isInteger(values.year) ||
      values.year < 1886 ||
      values.year > currentYear + 1)
  ) {
    throw new Error("Vehicle year is invalid");
  }
  if (
    values.mileage !== undefined &&
    (!Number.isFinite(values.mileage) ||
      values.mileage < 0 ||
      values.mileage > 2_000_000)
  ) {
    throw new Error("Mileage is invalid");
  }
  if (
    values.price !== undefined &&
    (!Number.isFinite(values.price) ||
      values.price <= 0 ||
      values.price > 100_000_000)
  ) {
    throw new Error("Price is invalid");
  }
  if (values.vin && !/^[A-HJ-NPR-Z0-9]{17}$/i.test(values.vin)) {
    throw new Error("VIN must be a valid 17-character VIN");
  }
  if (
    values.photos &&
    (values.photos.length > 30 ||
      values.photos.some((photo) => photo.length > 2_048))
  ) {
    throw new Error("A listing can contain at most 30 valid photo references");
  }
  if (
    values.description !== undefined &&
    (values.description.trim().length < 20 ||
      values.description.length > 10_000)
  ) {
    throw new Error("Description must contain between 20 and 10,000 characters");
  }
  if (
    values.contactInfo !== undefined &&
    (values.contactInfo.trim().length < 3 ||
      values.contactInfo.length > 320)
  ) {
    throw new Error("Contact information must contain between 3 and 320 characters");
  }
}

export const createVehicle = mutation({
  args: {
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
    const user = await requireCurrentUser(ctx);
    validateVehicle(args);
    return await ctx.db.insert("vehicles", {
      ...args,
      userId: user._id,
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
    const requestedStatus = args.status ?? "approved";
    if (requestedStatus !== "approved") {
      await requireAdmin(ctx);
    }
    const vehicles = await ctx.db
      .query("vehicles")
      .withIndex("by_status", (q) => q.eq("status", requestedStatus))
      .collect();

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
    const vehicle = await ctx.db.get(args.id);
    if (!vehicle || vehicle.status === "approved") return vehicle;

    const user = await getCurrentUser(ctx);
    if (!user || (vehicle.userId !== user._id && !isAdmin(user))) {
      return null;
    }
    return vehicle;
  },
});

export const getVehiclesByUser = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    await requireMatchingUser(ctx, args.userId);
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
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    validateVehicle(updates);
    const user = await requireCurrentUser(ctx);
    const vehicle = await ctx.db.get(id);
    if (!vehicle) throw new Error("Vehicle not found");
    if (vehicle.userId !== user._id && !isAdmin(user)) {
      throw new Error("You do not have permission to edit this vehicle");
    }
    await ctx.db.patch(id, {
      ...updates,
      ...(isAdmin(user) ? {} : { status: "pending" as const }),
    });
  },
});

export const deleteVehicle = mutation({
  args: { id: v.id("vehicles") },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    const vehicle = await ctx.db.get(args.id);
    if (!vehicle) throw new Error("Vehicle not found");
    if (vehicle.userId !== user._id && !isAdmin(user)) {
      throw new Error("You do not have permission to delete this vehicle");
    }
    const registration = await ctx.db
      .query("registrations")
      .withIndex("by_vehicle", (q) => q.eq("vehicleId", args.id))
      .first();
    if (registration) {
      throw new Error("Registered event vehicles cannot be deleted");
    }

    const [favorites, conversations] = await Promise.all([
      ctx.db
        .query("favorites")
        .withIndex("by_vehicle", (q) => q.eq("vehicleId", args.id))
        .collect(),
      ctx.db
        .query("conversations")
        .withIndex("by_vehicle", (q) => q.eq("vehicleId", args.id))
        .collect(),
    ]);
    for (const favorite of favorites) await ctx.db.delete(favorite._id);
    for (const conversation of conversations) {
      const messages = await ctx.db
        .query("messages")
        .withIndex("by_conversation", (q) =>
          q.eq("conversationId", conversation._id)
        )
        .collect();
      for (const message of messages) await ctx.db.delete(message._id);
      await ctx.db.delete(conversation._id);
    }
    await ctx.db.delete(args.id);
  },
});

export const approveVehicle = mutation({
  args: { id: v.id("vehicles") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.db.patch(args.id, { status: "approved" });
  },
});

export const rejectVehicle = mutation({
  args: { id: v.id("vehicles") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.db.patch(args.id, { status: "rejected" });
  },
});
