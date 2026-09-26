import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

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
    let query = ctx.db.query("events");

    if (args.cityId) {
      query = query.withIndex("by_city", (q) => q.eq("cityId", args.cityId));
    }

    const events = await query.collect();

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
    const { id, ...updates } = args;
    await ctx.db.patch(id, updates);
  },
});

export const deleteEvent = mutation({
  args: { id: v.id("events") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});
