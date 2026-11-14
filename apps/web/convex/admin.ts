import { isPublicVehicle, normalizeVehicleStatus } from "./lib/vehicleVisibility";
import { v } from "convex/values";
import { internalAction, internalQuery, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { requireAdmin, requireSuperAdmin } from "./lib/authorization";
import { validateEnvironment } from "./lib/environment";
import { resolveVehicleMedia } from "./lib/vehicleMedia";

// Operator-only readiness check, invoked by the protected release workflow.
export const validateDeployment = internalAction({
  args: { expectedEnvironment: v.string(), expectedPopupPaymentsEnabled: v.optional(v.boolean()), webPaymentRecoveryConfigured: v.optional(v.boolean()) },
  handler: async (ctx, { expectedEnvironment, expectedPopupPaymentsEnabled = false, webPaymentRecoveryConfigured = false }) => {
    const { mode, paymentsEnabled } = validateEnvironment(process.env, "convex");
    if (mode !== expectedEnvironment) throw new Error("Backend environment does not match the release target");
    if (paymentsEnabled !== expectedPopupPaymentsEnabled) throw new Error("Backend popup rollout does not match the web release");
    if (!paymentsEnabled && (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET || !webPaymentRecoveryConfigured)) {
      const outstanding = await ctx.runQuery(internal.admin.hasOutstandingEventPayments, {});
      if (outstanding) throw new Error("Keep web and backend Stripe API and webhook credentials configured until existing event payments and refunds are reconciled");
    }
    return { ready: true, environment: mode, paymentsEnabled };
  },
});

// A disabled popup switch stops new checkout, not recovery of earlier charges.
// Indexed existence checks keep this release guard bounded regardless of history size.
export const hasOutstandingEventPayments = internalQuery({
  args: {},
  handler: async (ctx) => {
    for (const status of ["held", "refund_pending"]) {
      if (await ctx.db.query("eventReservations").withIndex("by_status_expiry", q => q.eq("status", status)).first()) return true;
    }
    for (const status of ["paid", "refund_pending", "refund_processing", "refund_failed"]) {
      if (await ctx.db.query("eventPayments").withIndex("by_status_due", q => q.eq("status", status)).first()) return true;
    }
    for (const status of ["completed", "refund_pending"] as const) {
      if (await ctx.db.query("registrations").withIndex("by_payment_status", q => q.eq("paymentStatus", status)).first()) return true;
    }
    for (const status of ["pending", "processing", "failed"]) {
      if (await ctx.db.query("stripeWebhookEvents").withIndex("by_status_due", q => q.eq("status", status)).first()) return true;
    }
    return false;
  },
});

export const getAdminStats = query({
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const vehicles = await ctx.db.query("vehicles").collect();
    const events = await ctx.db.query("events").collect();
    const registrations = await ctx.db.query("registrations").collect();
    const users = await ctx.db.query("users").collect();

    const pendingVehicles = vehicles.filter((v) => v.status === "pending");
    const approvedVehicles = vehicles.filter((v) => (v.status === "approved" || v.status === "active"));
    const activeVehicles = approvedVehicles.filter(vehicle => isPublicVehicle(vehicle));
    const reservedVehicles = vehicles.filter((v) => v.status === "reserved" && isPublicVehicle(v));
    const soldVehicles = vehicles.filter((v) => v.status === "sold");
    const upcomingEvents = events.filter((e) => e.date > Date.now() && e.cancelledAt === undefined);

    return {
      totalVehicles: vehicles.length,
      pendingVehicles: pendingVehicles.length,
      approvedVehicles: approvedVehicles.length,
      activeVehicles: activeVehicles.length,
      reservedVehicles: reservedVehicles.length,
      soldVehicles: soldVehicles.length,
      totalEvents: events.length,
      upcomingEvents: upcomingEvents.length,
      totalRegistrations: registrations.length,
      totalUsers: users.length,
    };
  },
});

export const getAllVehicles = query({
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const vehicles = await ctx.db.query("vehicles").collect();

    // Get user details for each vehicle
    const vehiclesWithUsers = await Promise.all(
      vehicles.map(async (vehicle) => {
        const user = await ctx.db.get(vehicle.userId);
        return { ...await resolveVehicleMedia(ctx, normalizeVehicleStatus(vehicle)), user };
      })
    );

    return vehiclesWithUsers;
  },
});

export const getAllEvents = query({
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const events = await ctx.db.query("events").collect();

    // Get city details for each event
    const eventsWithCities = await Promise.all(
      events.map(async (event) => {
        const city = await ctx.db.get(event.cityId);
        return { ...event, city };
      })
    );

    return eventsWithCities;
  },
});

export const getAllUsers = query({
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const users = await ctx.db.query("users").collect();
    return users.sort((a, b) => b.createdAt - a.createdAt);
  },
});

export const updateUserRole = mutation({
  args: {
    userId: v.id("users"),
    role: v.union(
      v.literal("user"),
      v.literal("admin"),
      v.literal("superAdmin")
    ),
  },
  handler: async (ctx, { userId, role }) => {
    const actor = await requireSuperAdmin(ctx);
    if (actor._id === userId && role !== "superAdmin") {
      throw new Error("You cannot remove your own super administrator role");
    }
    const user = await ctx.db.get(userId);
    if (!user) {
      throw new Error("User not found");
    }

    await ctx.db.patch(userId, { role });
    await ctx.db.insert("adminAuditLog", { action: "role_changed", actorId: actor._id, targetUserId: userId, source: "admin", reason: `Role changed to ${role}`, createdAt: Date.now() });
    return { success: true, user: { ...user, role } };
  },
});

export const promoteToAdmin = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const actor = await requireSuperAdmin(ctx);
    if (actor._id === userId) {
      throw new Error("You cannot remove your own super administrator role");
    }
    const user = await ctx.db.get(userId);
    if (!user) {
      throw new Error("User not found");
    }

    await ctx.db.patch(userId, { role: "admin" });
    await ctx.db.insert("adminAuditLog", { action: "role_changed", actorId: actor._id, targetUserId: userId, source: "admin", reason: "Role changed to admin", createdAt: Date.now() });
    return { success: true, user: { ...user, role: "admin" } };
  },
});

export const promoteToSuperAdmin = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const actor = await requireSuperAdmin(ctx);
    const user = await ctx.db.get(userId);
    if (!user) {
      throw new Error("User not found");
    }

    await ctx.db.patch(userId, { role: "superAdmin" });
    await ctx.db.insert("adminAuditLog", { action: "role_changed", actorId: actor._id, targetUserId: userId, source: "admin", reason: "Role changed to superAdmin", createdAt: Date.now() });
    return { success: true, user: { ...user, role: "superAdmin" } };
  },
});

export const demoteToUser = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const actor = await requireSuperAdmin(ctx);
    if (actor._id === userId) {
      throw new Error("You cannot remove your own super administrator role");
    }
    const user = await ctx.db.get(userId);
    if (!user) {
      throw new Error("User not found");
    }

    await ctx.db.patch(userId, { role: "user" });
    await ctx.db.insert("adminAuditLog", { action: "role_changed", actorId: actor._id, targetUserId: userId, source: "admin", reason: "Role changed to user", createdAt: Date.now() });
    return { success: true, user: { ...user, role: "user" } };
  },
});

export const getAllRegistrations = query({
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const registrations = await ctx.db.query("registrations").collect();

    // Get related details for each registration
    const registrationsWithDetails = await Promise.all(
      registrations.map(async (registration) => {
        const vehicle = await ctx.db.get(registration.vehicleId);
        const event = await ctx.db.get(registration.eventId);
        const user = await ctx.db.get(registration.userId);
        return { ...registration, vehicle, event, user };
      })
    );

    return registrationsWithDetails;
  },
});
