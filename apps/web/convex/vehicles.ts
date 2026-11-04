import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
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
import { mediaReference, attachMedia, resolveVehicleMedia } from "./lib/vehicleMedia";
import { removeMedia } from "./mediaRecords";
import { notifySeller, notifyListingFollowers } from "./notifications";
import { assertRevision, assertSubmitReady, duplicateVin, listingRevision, nextRevision } from "./lib/listingLifecycle";
import { consumeRateLimit } from "./lib/trustGuards";
import { syncDiscovery } from "./lib/discoveryIndex";

const listingFields = {
  ...optionalSpecificationFields,
  title: v.string(), make: v.string(), model: v.string(), year: v.number(), mileage: v.number(), price: v.number(),
  vin: v.optional(v.string()), photos: v.array(v.string()), media: v.optional(v.array(mediaReference)),
  description: v.string(), contactInfo: v.string(),
};
function approximateLocation(location: Doc<"vehicles">["location"]) {
  if (!location) return undefined;
  validateVehicle({ location }, false);
  return { city: location.city, state: location.state, latitude: location.latitude === undefined ? undefined : Math.round(location.latitude * 100) / 100, longitude: location.longitude === undefined ? undefined : Math.round(location.longitude * 100) / 100 };
}

async function recordStatus(ctx: MutationCtx, vehicle: Doc<"vehicles">, actor: Doc<"users">, status: Doc<"vehicles">["status"], reason: string) {
  const entry = { fromStatus: vehicle.status, toStatus: status, reason, actorId: actor._id, createdAt: Date.now() };
  await ctx.db.insert("vehicleModerationLog", { vehicleId: vehicle._id, ...entry });
  if (isAdmin(actor)) await ctx.db.insert("adminAuditLog", { action: "listing_status_changed", actorId: actor._id, targetUserId: vehicle.userId, vehicleId: vehicle._id, source: "admin", reason, createdAt: entry.createdAt });
  await ctx.db.patch(vehicle._id, { status, updatedAt: nextRevision(vehicle), moderationReason: reason, moderationHistory: [...(vehicle.moderationHistory ?? []), entry] });
  await notifySeller(ctx, vehicle.userId, vehicle._id, status, `${vehicle.title || "Your listing"}: ${reason}`);
  await syncDiscovery(ctx, vehicle._id);
  await notifyListingFollowers(ctx, vehicle._id, status, entry.createdAt);
}
async function verification(ctx: MutationCtx, vehicle: {vin?: string; year: number; make: string; model: string}) {
  const decoded = vehicle.vin ? await ctx.db.query("vinDecodes").withIndex("by_vin", q => q.eq("vin", vehicle.vin!)).unique() : null;
  const matches = decoded && decoded.year === vehicle.year && decoded.make.toLowerCase() === vehicle.make.toLowerCase() && decoded.model.toLowerCase() === vehicle.model.toLowerCase();
  return { vinVerificationStatus: matches ? "decoded" as const : "unverified" as const, vinDecodedAt: matches ? decoded.decodedAt : undefined };
}
export const createVehicle = mutation({
  args: {
    ...listingFields,
    status: v.optional(v.union(v.literal("draft"), v.literal("pending"))),
  },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    const status = args.status ?? "pending";
    await consumeRateLimit(ctx, user._id, "listing");
    const values = { ...args, vin: args.vin?.trim().toUpperCase(), location: approximateLocation(args.location) };
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
      updatedAt: entry.createdAt,
      vinKey: values.vin || undefined,
    });
    await ctx.db.insert("vehicleModerationLog", { vehicleId: id, ...entry });
    await attachMedia(ctx, id, user._id, args.photos, args.media ?? []);
    if (status === "pending") await assertSubmitReady(ctx, (await ctx.db.get(id))!);
    await notifySeller(ctx, user._id, id, status, `${values.title || "Your listing"}: ${entry.reason}`);
    return id;
  },
});

export const saveDraft = mutation({
  args: { ...listingFields, numberOfOwners: v.optional(v.union(v.number(), v.null())), id: v.optional(v.id("vehicles")), expectedUpdatedAt: v.optional(v.number()), clientRequestId: v.optional(v.string()) },
  handler: async (ctx, { id, expectedUpdatedAt, clientRequestId, numberOfOwners, ...fields }) => {
    const user = await requireCurrentUser(ctx);
    if (clientRequestId && !/^[a-zA-Z0-9-]{1,100}$/.test(clientRequestId)) throw new Error("Invalid draft request");
    if (!id && clientRequestId) {
      const previous = await ctx.db.query("vehicles").withIndex("by_user_draft_request", q => q.eq("userId", user._id).eq("draftRequestId", clientRequestId)).unique();
      if (previous) return { id: previous._id, updatedAt: listingRevision(previous), reused: true };
    }
    const values = { ...fields, vin: fields.vin?.trim().toUpperCase(), location: approximateLocation(fields.location), numberOfOwners: numberOfOwners ?? undefined };
    validateVehicle(values, false);
    if (id) {
      const vehicle = await ctx.db.get(id);
      if (!vehicle || vehicle.userId !== user._id) throw new Error("Listing not found");
      if (vehicle.status !== "draft" && vehicle.status !== "rejected") throw new Error("Autosave is available only for draft or rejected listings");
      if (expectedUpdatedAt === undefined) throw new Error("Reload this draft before saving it");
      assertRevision(vehicle, expectedUpdatedAt);
      await attachMedia(ctx, id, vehicle.userId, values.photos, values.media ?? [], vehicle);
      const updatedAt = nextRevision(vehicle);
      await ctx.db.patch(id, { ...values, ownershipAttestedAt: values.vin === vehicle.vin ? vehicle.ownershipAttestedAt : undefined, vinKey: values.vin || undefined, updatedAt, ...await verification(ctx, values) });
      return { id, updatedAt, reused: false };
    }
    await consumeRateLimit(ctx, user._id, "listing");
    const updatedAt = nextRevision();
    const entry = { toStatus: "draft" as const, reason: "Draft created", actorId: user._id, createdAt: updatedAt };
    const createdId = await ctx.db.insert("vehicles", { ...values, vinKey: values.vin || undefined, userId: user._id, status: "draft", createdAt: updatedAt, updatedAt, draftRequestId: clientRequestId, moderationReason: entry.reason, moderationHistory: [entry], ...await verification(ctx, values) });
    await attachMedia(ctx, createdId, user._id, values.photos, values.media ?? []);
    await ctx.db.insert("vehicleModerationLog", { vehicleId: createdId, ...entry });
    await notifySeller(ctx, user._id, createdId, "draft", `${values.title || "Your listing"}: Draft saved`);
    return { id: createdId, updatedAt, reused: false };
  },
});

export const submitVehicle = mutation({
  args: { id: v.id("vehicles"), expectedUpdatedAt: v.optional(v.number()) },
  handler: async (ctx, { id, expectedUpdatedAt }) => {
    const user = await requireCurrentUser(ctx);
    const vehicle = await ctx.db.get(id);
    if (!vehicle || vehicle.userId !== user._id) throw new Error("Listing not found");
    assertRevision(vehicle, expectedUpdatedAt);
    if (vehicle.status !== "draft" && vehicle.status !== "rejected") throw new Error("Only drafts and rejected listings can be submitted");
    await consumeRateLimit(ctx, user._id, "listing");
    await assertSubmitReady(ctx, vehicle);
    await recordStatus(ctx, vehicle, user, "pending", vehicle.status === "rejected" ? "Rejected listing resubmitted for review" : "Listing submitted for review");
    return id;
  },
});

export const checkDuplicateVin = query({
  args: { vin: v.string(), excludeId: v.optional(v.id("vehicles")) },
  handler: async (ctx, args) => {
    await requireCurrentUser(ctx);
    return { duplicate: await duplicateVin(ctx, args.vin, args.excludeId) };
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
    const filtered = [...vehicles, ...legacy].filter((vehicle) => {
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
    return Promise.all(filtered.map(vehicle => resolveVehicleMedia(ctx, vehicle)));
  },
});

export const getVehicleById = query({
  args: { id: v.id("vehicles") },
  handler: async (ctx, args) => {
    const vehicle = await ctx.db.get(args.id);
    if (!vehicle) return null;
    const user = await getCurrentUser(ctx);
    if (user && (vehicle.userId === user._id || isAdmin(user))) return resolveVehicleMedia(ctx, normalizeVehicleStatus(vehicle));
    if (vehicle.status === "approved" || vehicle.status === "active") return resolveVehicleMedia(ctx, publicVehicle(vehicle));
    return null;
  },
});

export const getVehiclesByUser = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    await requireMatchingUser(ctx, args.userId);
    const vehicles = await ctx.db.query("vehicles").withIndex("by_user", q => q.eq("userId", args.userId)).collect();
    return Promise.all(vehicles.map(vehicle => resolveVehicleMedia(ctx, normalizeVehicleStatus(vehicle))));
  },
});

export const updateVehicle = mutation({
  args: {
    id: v.id("vehicles"),
    expectedUpdatedAt: v.optional(v.number()),
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
    media: v.optional(v.array(mediaReference)),
    description: v.optional(v.string()),
    contactInfo: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, expectedUpdatedAt, numberOfOwners, ...fields } = args;
    const updates = { ...fields, ...(numberOfOwners !== undefined ? { numberOfOwners: numberOfOwners ?? undefined } : {}) };
    if (updates.location) updates.location = approximateLocation(updates.location);
    if (updates.vin !== undefined) updates.vin = updates.vin.trim().toUpperCase();
    const user = await requireCurrentUser(ctx);
    const vehicle = await ctx.db.get(id);
    if (!vehicle) throw new Error("Vehicle not found");
    if (vehicle.userId !== user._id && !isAdmin(user)) {
      throw new Error("You do not have permission to edit this vehicle");
    }
    assertRevision(vehicle, expectedUpdatedAt);
    if (["sold", "withdrawn", "archived"].includes(vehicle.status)) throw new Error("This listing cannot be edited in its current status");
    if (updates.vin !== undefined && updates.vin !== vehicle.vin && !["draft", "rejected"].includes(vehicle.status)) throw new Error("Create a new draft for a different vehicle VIN");
    const merged = { ...vehicle, ...updates };
    const requiresReview = vehicle.status !== "draft" && vehicle.status !== "rejected";
    validateVehicle(merged, requiresReview);
    await attachMedia(ctx, id, vehicle.userId, updates.photos ?? vehicle.photos, updates.media ?? vehicle.media ?? [], vehicle);
    await ctx.db.patch(id, { ...updates, ownershipAttestedAt: merged.vin === vehicle.vin ? vehicle.ownershipAttestedAt : undefined, vinKey: merged.vin || undefined, updatedAt: nextRevision(vehicle), ...await verification(ctx, merged) });
    if (requiresReview) {
      await consumeRateLimit(ctx, user._id, "listing");
      await assertSubmitReady(ctx, (await ctx.db.get(id))!);
      await recordStatus(ctx, vehicle, user, "pending", "Listing edited and submitted for review");
    }
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
    if (vehicle.status !== "draft" && vehicle.status !== "rejected") throw new Error("Withdraw this listing to preserve its history; only drafts and rejected listings can be deleted");
    const registration = await ctx.db
      .query("registrations")
      .withIndex("by_vehicle", (q) => q.eq("vehicleId", args.id))
      .first();
    if (registration) {
      throw new Error("Registered event vehicles cannot be deleted");
    }

    const conversation = await ctx.db.query("conversations").withIndex("by_vehicle", q => q.eq("vehicleId", args.id)).first();
    if (conversation) throw new Error("Listings with conversations cannot be deleted. Withdraw the listing to preserve messages.");
    const favorites = await ctx.db
        .query("favorites")
        .withIndex("by_vehicle", (q) => q.eq("vehicleId", args.id))
        .collect();
    for (const favorite of favorites) await ctx.db.delete(favorite._id);
    for (const ref of vehicle.media ?? []) {
      const media = await ctx.db.get(ref.id);
      if (media?.vehicleId === args.id) await removeMedia(ctx, media);
    }
    await ctx.db.delete(args.id);
    await syncDiscovery(ctx, args.id);
  },
});

export const changeVehicleStatus = mutation({
  args: { id: v.id("vehicles"), status: listingStatus, reason: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    const vehicle = await ctx.db.get(args.id);
    if (!vehicle) throw new Error("Vehicle not found");
    if (vehicle.userId !== user._id && !isAdmin(user)) throw new Error("You cannot manage this listing");
    if (vehicle.moderationRemovedAt !== undefined) throw new Error("This listing was removed by moderation. Contact support to appeal.");
    assertStatusTransition(vehicle.status, args.status, isAdmin(user), args.reason);
    if (args.status === "pending" && !isAdmin(user)) await consumeRateLimit(ctx, user._id, "listing");
    if (args.status === "pending" || args.status === "active") await assertSubmitReady(ctx, vehicle);
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
    await assertSubmitReady(ctx, vehicle);
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

export const recordView = mutation({
  args: { id: v.id("vehicles"), visitorKey: v.string() },
  handler: async (ctx, { id, visitorKey }) => {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(visitorKey)) throw new Error("Invalid view session");
    const vehicle = await ctx.db.get(id);
    if (!vehicle || (vehicle.status !== "active" && vehicle.status !== "approved")) return;
    const user = await getCurrentUser(ctx);
    if (user && (user._id === vehicle.userId || isAdmin(user))) return;
    const day = Math.floor(Date.now() / 86_400_000);
    const existing = await ctx.db.query("listingViews").withIndex("by_vehicle_visitor_day", q => q.eq("vehicleId", id).eq("visitorKey", visitorKey).eq("day", day)).unique();
    if (existing) return;
    await ctx.db.insert("listingViews", { vehicleId: id, visitorKey, day, createdAt: Date.now() });
    await ctx.db.patch(id, { viewCount: (vehicle.viewCount ?? 0) + 1 });
  },
});

export const getSellerAnalytics = query({
  args: {},
  handler: async ctx => {
    const seller = await requireCurrentUser(ctx);
    const vehicles = await ctx.db.query("vehicles").withIndex("by_user", q => q.eq("userId", seller._id)).collect();
    return Promise.all(vehicles.map(async vehicle => {
      const [favorites, conversations] = await Promise.all([
        ctx.db.query("favorites").withIndex("by_vehicle", q => q.eq("vehicleId", vehicle._id)).collect(),
        ctx.db.query("conversations").withIndex("by_vehicle", q => q.eq("vehicleId", vehicle._id)).collect(),
      ]);
      const messages = await Promise.all(conversations.map(conversation => ctx.db.query("messages").withIndex("by_conversation", q => q.eq("conversationId", conversation._id)).collect()));
      return { vehicleId: vehicle._id, views: vehicle.viewCount ?? 0, favorites: favorites.length, conversations: conversations.length, inquiries: messages.flat().filter(message => message.recipientId === seller._id && message.senderId !== seller._id).length };
    }));
  },
});

export const cleanupViews = internalMutation({
  args: {},
  handler: async ctx => {
    const stale = await ctx.db.query("listingViews").withIndex("by_created", q => q.lt("createdAt", Date.now() - 7 * 86_400_000)).take(500);
    for (const view of stale) await ctx.db.delete(view._id);
  },
});
