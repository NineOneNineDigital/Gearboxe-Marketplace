import { eventForViewer } from "./lib/eventVisibility";
import { publicVehicle } from "./lib/vehicleVisibility";
import { resolveVehicleMedia } from "./lib/vehicleMedia";
import { checkIn } from "./eventOperations";
import { requireEventStaff, rosterRow } from "./lib/eventStaff";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import {
  isAdmin,
  requireCurrentUser,
} from "./lib/authorization";

export const getRegistrationsByEvent = query({
  args: { eventId: v.id("events") },
  handler: async (ctx, args) => {
    await requireEventStaff(ctx, args.eventId);
    const registrations = await ctx.db.query("registrations").withIndex("by_event", q => q.eq("eventId", args.eventId)).take(100);
    return Promise.all(registrations.map(row => rosterRow(ctx, row)));
  },
});

export const getVehiclesByEvent = query({
  args: { eventId: v.id("events") },
  handler: async (ctx, args) => {
    const registrations = await ctx.db
      .query("registrations")
      .withIndex("by_event", (q) => q.eq("eventId", args.eventId))
      .collect();
    const vehicles = await Promise.all(
      registrations
        .filter((registration) => registration.paymentStatus === "completed")
        .map((registration) => ctx.db.get(registration.vehicleId))
    );
    const visible = vehicles.flatMap((vehicle) =>
      (vehicle?.status === "approved" || vehicle?.status === "active") ? [publicVehicle(vehicle)] : []
    );
    return Promise.all(visible.map(vehicle => resolveVehicleMedia(ctx, vehicle)));
  },
});

export const getRegistrationsByUser = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireCurrentUser(ctx);
    const registrations = await ctx.db
      .query("registrations")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    return await Promise.all(
      registrations.map(async (registration) => ({
        ...registration,
        event: await (async () => { const event = await ctx.db.get(registration.eventId); return event ? eventForViewer(ctx, event, user) : null; })(),
      }))
    );
  },
});

export const getRegistrationById = query({
  args: { id: v.id("registrations") },
  handler: async (ctx, args) => {
    const currentUser = await requireCurrentUser(ctx);
    const registration = await ctx.db.get(args.id);
    if (
      !registration ||
      (registration.userId !== currentUser._id && !isAdmin(currentUser))
    ) {
      return null;
    }
    return registration;
  },
});

export const getRegistrationByVehicle = query({
  args: { vehicleId: v.id("vehicles") },
  handler: async (ctx, args) => {
    const registration = await ctx.db
      .query("registrations")
      .withIndex("by_vehicle_status", q => q.eq("vehicleId", args.vehicleId).eq("paymentStatus", "completed"))
      .order("desc")
      .first();

    if (!registration) {
      return null;
    }

    // Get event details
    const event = await ctx.db.get(registration.eventId);

    return event && event.cancelledAt === undefined ? { event: await eventForViewer(ctx, event) } : null;
  },
});

// Compatibility entrypoint uses the same assignment, replay and revision safeguards.
export const checkInRegistration = mutation({
  args: { id: v.id("registrations"), eventId: v.id("events"), requestId: v.string(), expectedRevision: v.number(), expectedActorId: v.optional(v.id("users")) },
  handler: async (ctx, args) => checkIn(ctx, { ...args, registrationId: args.id }),
});

export const validateQRCode = query({
  args: { eventId: v.id("events"), qrCodeData: v.string() },
  handler: async (ctx, args) => {
    const { event } = await requireEventStaff(ctx, args.eventId);
    if (event.cancelledAt !== undefined || args.qrCodeData.length > 500) return null;
    const registration = await ctx.db.query("registrations").withIndex("by_event_qr", q => q.eq("eventId", args.eventId).eq("qrCodeData", args.qrCodeData)).unique();
    if (!registration || registration.paymentStatus !== "completed") return null;
    return rosterRow(ctx, registration);
  },
});
