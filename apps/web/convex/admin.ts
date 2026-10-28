import { normalizeVehicleStatus } from "./lib/vehicleVisibility";
import { v } from "convex/values";
import { internalAction, mutation, query } from "./_generated/server";
import { requireAdmin, requireSuperAdmin } from "./lib/authorization";
import { validateEnvironment } from "./lib/environment";
import { resolveVehicleMedia } from "./lib/vehicleMedia";

// Operator-only readiness check, invoked by the protected release workflow.
export const validateDeployment = internalAction({
  args: { expectedEnvironment: v.string() },
  handler: async (_ctx, { expectedEnvironment }) => {
    const { mode } = validateEnvironment(process.env, "convex");
    if (mode !== expectedEnvironment) throw new Error("Backend environment does not match the release target");
    return { ready: true, environment: mode };
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
    const upcomingEvents = events.filter((e) => e.date > Date.now() && e.cancelledAt === undefined);

    return {
      totalVehicles: vehicles.length,
      pendingVehicles: pendingVehicles.length,
      approvedVehicles: approvedVehicles.length,
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
