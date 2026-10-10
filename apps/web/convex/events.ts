import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAdmin } from "./lib/authorization";

function validateEvent(values: {
  name?: string;
  date?: number;
  location?: string;
  address?: string;
  capacity?: number;
  description?: string;
}) {
  for (const [label, value, max] of [
    ["Name", values.name, 120],
    ["Location", values.location, 200],
    ["Address", values.address, 300],
    ["Description", values.description, 5_000],
  ] as const) {
    if (value !== undefined && (!value.trim() || value.length > max)) {
      throw new Error(
        `${label} is required and must not exceed ${max} characters`
      );
    }
  }
  if (
    values.date !== undefined &&
    (!Number.isFinite(values.date) || values.date <= Date.now())
  ) {
    throw new Error("Event date must be in the future");
  }
  if (
    values.capacity !== undefined &&
    (!Number.isInteger(values.capacity) ||
      values.capacity < 1 ||
      values.capacity > 100_000)
  ) {
    throw new Error("Event capacity must be between 1 and 100,000");
  }
}

export const createEvent = mutation({
  args: {
    cityId: v.id("cities"),
    name: v.string(),
    date: v.number(),
    location: v.string(),
    address: v.string(),
    capacity: v.number(),
    description: v.string(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    validateEvent(args);
    return await ctx.db.insert("events", {
      ...args,
      createdAt: Date.now(),
    });
  },
});

export const getEvents = query({
  args: {
    cityId: v.optional(v.id("cities")),
    upcoming: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const events = args.cityId
      ? await ctx.db
          .query("events")
          .withIndex("by_city", (q) => q.eq("cityId", args.cityId!))
          .collect()
      : await ctx.db.query("events").collect();

    if (args.upcoming) {
      const now = Date.now();
      return events.filter((event) => event.date > now);
    }

    return events;
  },
});

export const getEventById = query({
  args: { id: v.id("events") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const getUpcomingEvents = query({
  handler: async (ctx) => {
    const now = Date.now();
    return await ctx.db
      .query("events")
      .withIndex("by_date", (q) => q.gt("date", now))
      .collect();
  },
});

export const updateEvent = mutation({
  args: {
    id: v.id("events"),
    name: v.optional(v.string()),
    date: v.optional(v.number()),
    location: v.optional(v.string()),
    address: v.optional(v.string()),
    capacity: v.optional(v.number()),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const { id, ...updates } = args;
    validateEvent(updates);
    if (updates.capacity !== undefined) {
      const registrations = await ctx.db
        .query("registrations")
        .withIndex("by_event", (q) => q.eq("eventId", id))
        .collect();
      if (updates.capacity < registrations.length) {
        throw new Error("Capacity cannot be lower than current registrations");
      }
    }
    await ctx.db.patch(id, updates);
  },
});

export const deleteEvent = mutation({
  args: { id: v.id("events") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const registration = await ctx.db
      .query("registrations")
      .withIndex("by_event", (q) => q.eq("eventId", args.id))
      .first();
    if (registration) {
      throw new Error("Events with registrations cannot be deleted");
    }
    await ctx.db.delete(args.id);
  },
});
