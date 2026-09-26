import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const getAdminStats = query({
  handler: async (ctx) => {
    const vehicles = await ctx.db.query("vehicles").collect();
    const events = await ctx.db.query("events").collect();
    const registrations = await ctx.db.query("registrations").collect();
    const users = await ctx.db.query("users").collect();

    const pendingVehicles = vehicles.filter((v) => v.status === "pending");
    const approvedVehicles = vehicles.filter((v) => v.status === "approved");
    const upcomingEvents = events.filter((e) => e.date > Date.now());

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
    const vehicles = await ctx.db.query("vehicles").collect();

    // Get user details for each vehicle
    const vehiclesWithUsers = await Promise.all(
      vehicles.map(async (vehicle) => {
        const user = await ctx.db.get(vehicle.userId);
        return { ...vehicle, user };
      })
    );

    return vehiclesWithUsers;
  },
});

export const getAllEvents = query({
  handler: async (ctx) => {
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
    const user = await ctx.db.get(userId);
    if (!user) {
      throw new Error("User not found");
    }

    await ctx.db.patch(userId, { role });
    return { success: true, user: { ...user, role } };
  },
});

export const promoteToAdmin = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const user = await ctx.db.get(userId);
    if (!user) {
      throw new Error("User not found");
    }

    await ctx.db.patch(userId, { role: "admin" });
    return { success: true, user: { ...user, role: "admin" } };
  },
});

export const promoteToSuperAdmin = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const user = await ctx.db.get(userId);
    if (!user) {
      throw new Error("User not found");
    }

    await ctx.db.patch(userId, { role: "superAdmin" });
    return { success: true, user: { ...user, role: "superAdmin" } };
  },
});

export const demoteToUser = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const user = await ctx.db.get(userId);
    if (!user) {
      throw new Error("User not found");
    }

    await ctx.db.patch(userId, { role: "user" });
    return { success: true, user: { ...user, role: "user" } };
  },
});

export const getAllRegistrations = query({
  handler: async (ctx) => {
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
