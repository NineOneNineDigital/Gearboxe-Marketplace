import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import {
  getCurrentUser,
  isAdmin,
  requireAdmin,
  requireCurrentUser,
  requireMatchingUser,
} from "./lib/authorization";

import { optionalSpecificationFields, listingStatus, storedListingStatus } from "./lib/vehicleSpecification";
import { validateVehicle, assertStatusTransition } from "./lib/vehicleValidation";
import type { Doc } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { publicVehicle, normalizeVehicleStatus } from "./lib/vehicleVisibility";

async function recordStatus(ctx: MutationCtx, vehicle: Doc<"vehicles">, actor: Doc<"users">, status: Doc<"vehicles">["status"], reason: string) {
  const entry = { fromStatus: vehicle.status, toStatus: status, reason, actorId: actor._id, createdAt: Date.now() };
  await ctx.db.insert("vehicleModerationLog", { vehicleId: vehicle._id, ...entry });
  await ctx.db.patch(vehicle._id, { status, moderationReason: reason, moderationHistory: [...(vehicle.moderationHistory ?? []), entry] });
}
async function verification(ctx: MutationCtx, vehicle: {vin?: string; year: number; make: string; model: string}) {
  const decoded = vehicle.vin ? await ctx.db.query("vinDecodes").withIndex("by_vin", q => q.eq("vin", vehicle.vin!)).unique() : null;
  const matches = decoded && decoded.year === vehicle.year && decoded.make.toLowerCase() === vehicle.make.toLowerCase() && decoded.model.toLowerCase() === vehicle.model.toLowerCase();
  return { vinVerificationStatus: matches ? "decoded" as const : "unverified" as const, vinDecodedAt: matches ? decoded.decodedAt : undefined };
}
export const createVehicle = mutation({
  args: {
    ...optionalSpecificationFields,
    status: v.optional(v.union(v.literal("draft"), v.literal("pending"))),
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
    const status = args.status ?? "pending";
    const values = { ...args, vin: args.vin?.trim().toUpperCase() };
    validateVehicle(values, status !== "draft");
    const entry = { toStatus: status, reason: status === "draft" ? "Draft created" : "Listing submitted for review", actorId: user._id, createdAt: Date.now() };
    const id = await ctx.db.insert("vehicles", {
      ...values,
      ...await verification(ctx, values),
      moderationReason: entry.reason,
      moderationHistory: [entry],
      userId: user._id,
      status,
      createdAt: entry.createdAt,
    });
    await ctx.db.insert("vehicleModerationLog", { vehicleId: id, ...entry });
    return id;
  },
});

export const getVehicles = query({
  args: {
    status: v.optional(storedListingStatus),
    make: v.optional(v.string()),
    model: v.optional(v.string()),
    minPrice: v.optional(v.number()),
    maxPrice: v.optional(v.number()),
    minYear: v.optional(v.number()),
    maxYear: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const requestedStatus = args.status ?? "active";
    if (requestedStatus !== "approved" && requestedStatus !== "active") {
      await requireAdmin(ctx);
    }
    const vehicles = await ctx.db
      .query("vehicles")
      .withIndex("by_status", (q) => q.eq("status", requestedStatus))
      .collect();

    const legacy = requestedStatus === "active" ? await ctx.db.query("vehicles").withIndex("by_status", q => q.eq("status", "approved")).collect() : [];
    return [...vehicles, ...legacy].filter((vehicle) => {
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
    }).map(vehicle => requestedStatus === "active" || requestedStatus === "approved" ? publicVehicle(vehicle) : vehicle);
  },
});

export const getVehicleById = query({
  args: { id: v.id("vehicles") },
  handler: async (ctx, args) => {
    const vehicle = await ctx.db.get(args.id);
    if (!vehicle) return null;
    const user = await getCurrentUser(ctx);
    if (user && (vehicle.userId === user._id || isAdmin(user))) return normalizeVehicleStatus(vehicle);
    return vehicle.status === "approved" || vehicle.status === "active" ? publicVehicle(vehicle) : null;
  },
});

export const getVehiclesByUser = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    await requireMatchingUser(ctx, args.userId);
    const vehicles = await ctx.db.query("vehicles").withIndex("by_user", q => q.eq("userId", args.userId)).collect();
    return vehicles.map(normalizeVehicleStatus);
  },
});

export const updateVehicle = mutation({
  args: {
    id: v.id("vehicles"),
    ...optionalSpecificationFields,
    numberOfOwners: v.optional(v.union(v.number(), v.null())),
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
    const { id, numberOfOwners, ...fields } = args;
    const updates = { ...fields, ...(numberOfOwners !== undefined ? { numberOfOwners: numberOfOwners ?? undefined } : {}) };
    if (updates.vin !== undefined) updates.vin = updates.vin.trim().toUpperCase();
    const user = await requireCurrentUser(ctx);
    const vehicle = await ctx.db.get(id);
    if (!vehicle) throw new Error("Vehicle not found");
    if (vehicle.userId !== user._id && !isAdmin(user)) {
      throw new Error("You do not have permission to edit this vehicle");
    }
    if (vehicle.status === "sold" || vehicle.status === "archived") throw new Error("This listing cannot be edited in its current status");
    const merged = { ...vehicle, ...updates };
    validateVehicle(merged, vehicle.status !== "draft");
    await ctx.db.patch(id, { ...updates, ...await verification(ctx, merged) });
    await recordStatus(ctx, vehicle, user, vehicle.status === "draft" ? "draft" : "pending", "Listing edited; review required");
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

export const changeVehicleStatus = mutation({
  args: { id: v.id("vehicles"), status: listingStatus, reason: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    const vehicle = await ctx.db.get(args.id);
    if (!vehicle) throw new Error("Vehicle not found");
    if (vehicle.userId !== user._id && !isAdmin(user)) throw new Error("You cannot manage this listing");
    assertStatusTransition(vehicle.status, args.status, isAdmin(user), args.reason);
    if (args.status === "pending" || args.status === "active") validateVehicle(vehicle, true);
    await recordStatus(ctx, vehicle, user, args.status, args.reason?.trim() || `Listing marked ${args.status}`);
  },
});
export const approveVehicle = mutation({
  args: { id: v.id("vehicles") },
  handler: async (ctx, args) => {
    const actor = await requireAdmin(ctx);
    const vehicle = await ctx.db.get(args.id);
    if (!vehicle) throw new Error("Vehicle not found");
    assertStatusTransition(vehicle.status, "active", true);
    validateVehicle(vehicle, true);
    await recordStatus(ctx, vehicle, actor, "active", "Approved by moderator");
  },
});
export const rejectVehicle = mutation({
  args: { id: v.id("vehicles"), reason: v.string() },
  handler: async (ctx, args) => {
    const actor = await requireAdmin(ctx);
    const vehicle = await ctx.db.get(args.id);
    if (!vehicle) throw new Error("Vehicle not found");
    assertStatusTransition(vehicle.status, "rejected", true, args.reason);
    await recordStatus(ctx, vehicle, actor, "rejected", args.reason.trim());
  },
});
