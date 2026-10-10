import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import {
  isAdmin,
  requireAdmin,
  requireCurrentUser,
  requireMatchingUser,
} from "./lib/authorization";

export const completeRegistration = internalMutation({
  args: {
    eventId: v.id("events"),
    vehicleId: v.id("vehicles"),
    userId: v.id("users"),
    stripePaymentId: v.string(),
    qrCodeData: v.string(),
  },
  handler: async (ctx, args) => {
    const existingPayment = await ctx.db
      .query("registrations")
      .withIndex("by_stripe_payment", (q) =>
        q.eq("stripePaymentId", args.stripePaymentId)
      )
      .unique();
    if (existingPayment) return existingPayment._id;

    const [event, vehicle, user, duplicate, eventRegistrations] =
      await Promise.all([
        ctx.db.get(args.eventId),
        ctx.db.get(args.vehicleId),
        ctx.db.get(args.userId),
        ctx.db
          .query("registrations")
          .withIndex("by_event_vehicle", (q) =>
            q.eq("eventId", args.eventId).eq("vehicleId", args.vehicleId)
          )
          .first(),
        ctx.db
          .query("registrations")
          .withIndex("by_event", (q) => q.eq("eventId", args.eventId))
          .collect(),
      ]);
    if (!event || !vehicle || !user) throw new Error("Invalid registration");
    if (vehicle.userId !== user._id) {
      throw new Error("The registered user must own the vehicle");
    }
    if (vehicle.status !== "approved") {
      throw new Error("Only approved vehicles can be registered");
    }
    if (duplicate) return duplicate._id;
    if (eventRegistrations.length >= event.capacity) {
      throw new Error("Event capacity has been reached");
    }
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
    await requireAdmin(ctx);
    const registrations = await ctx.db
      .query("registrations")
      .withIndex("by_event", (q) => q.eq("eventId", args.eventId))
      .collect();
    return await Promise.all(
      registrations.map(async (registration) => ({
        ...registration,
        vehicle: await ctx.db.get(registration.vehicleId),
        user: await ctx.db.get(registration.userId),
      }))
    );
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
    return vehicles.flatMap((vehicle) =>
      vehicle?.status === "approved" ? [vehicle] : []
    );
  },
});

export const getCheckoutContext = query({
  args: {
    eventId: v.id("events"),
    vehicleId: v.id("vehicles"),
  },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    const [event, vehicle, duplicate, registrations] = await Promise.all([
      ctx.db.get(args.eventId),
      ctx.db.get(args.vehicleId),
      ctx.db
        .query("registrations")
        .withIndex("by_event_vehicle", (q) =>
          q.eq("eventId", args.eventId).eq("vehicleId", args.vehicleId)
        )
        .first(),
      ctx.db
        .query("registrations")
        .withIndex("by_event", (q) => q.eq("eventId", args.eventId))
        .collect(),
    ]);

    if (!event || !vehicle) throw new Error("Event or vehicle not found");
    if (vehicle.userId !== user._id || vehicle.status !== "approved") {
      throw new Error("Only your approved vehicles can be registered");
    }
    if (event.date <= Date.now()) throw new Error("Event has ended");
    if (duplicate) throw new Error("Vehicle is already registered");
    if (registrations.length >= event.capacity) {
      throw new Error("Event capacity has been reached");
    }

    return {
      user: { id: user._id, email: user.email },
      event: { id: event._id, name: event.name },
      vehicle: {
        id: vehicle._id,
        year: vehicle.year,
        make: vehicle.make,
        model: vehicle.model,
      },
    };
  },
});

export const getRegistrationsByUser = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    await requireMatchingUser(ctx, args.userId);
    const registrations = await ctx.db
      .query("registrations")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    return await Promise.all(
      registrations.map(async (registration) => ({
        ...registration,
        event: await ctx.db.get(registration.eventId),
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
      .withIndex("by_vehicle", (q) => q.eq("vehicleId", args.vehicleId))
      .first();

    if (!registration) {
      return null;
    }

    // Get event details
    const event = await ctx.db.get(registration.eventId);

    return { event };
  },
});

export const checkInRegistration = mutation({
  args: { id: v.id("registrations") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.db.patch(args.id, { checkedIn: true });
  },
});

export const validateQRCode = query({
  args: { qrCodeData: v.string() },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
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
