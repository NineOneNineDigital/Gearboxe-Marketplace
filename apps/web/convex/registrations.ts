import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const createRegistration = mutation({
  args: {
    eventId: v.id("events"),
    vehicleId: v.id("vehicles"),
    userId: v.id("users"),
    stripePaymentId: v.string(),
    qrCodeData: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("registrations", {
      ...args,
      paymentStatus: "completed",
      checkedIn: false,
      createdAt: Date.now(),
    });
  },
});

export const getRegistrationsByEvent = query({
  args: { eventId: v.id("events") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("registrations")
      .withIndex("by_event", (q) => q.eq("eventId", args.eventId))
      .collect();
  },
});

export const getRegistrationsByUser = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("registrations")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
  },
});

export const getRegistrationById = query({
  args: { id: v.id("registrations") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const getRegistrationByVehicle = query({
  args: { vehicleId: v.id("vehicles") },
  handler: async (ctx, args) => {
    const registration = await ctx.db
      .query("registrations")
      .withIndex("by_vehicle", (q) => q.eq("vehicleId", args.vehicleId))
      .first();

    if (!registration) {
      return null;
    }

    // Get event details
    const event = await ctx.db.get(registration.eventId);

    return {
      registration,
      event,
    };
  },
});

export const checkInRegistration = mutation({
  args: { id: v.id("registrations") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { checkedIn: true });
  },
});

export const validateQRCode = query({
  args: { qrCodeData: v.string() },
  handler: async (ctx, args) => {
    const registration = await ctx.db
      .query("registrations")
      .filter((q) => q.eq(q.field("qrCodeData"), args.qrCodeData))
      .first();

    if (!registration) {
      return null;
    }

    // Get vehicle and event details
    const vehicle = await ctx.db.get(registration.vehicleId);
    const event = await ctx.db.get(registration.eventId);
    const user = await ctx.db.get(registration.userId);

    return {
      registration,
      vehicle,
      event,
      user,
    };
  },
});
