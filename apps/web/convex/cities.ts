import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const createCity = mutation({
  args: {
    name: v.string(),
    state: v.string(),
    slug: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("cities", {
      ...args,
      active: true,
      createdAt: Date.now(),
    });
  },
});

export const getCities = query({
  handler: async (ctx) => {
    return await ctx.db
      .query("cities")
      .filter((q) => q.eq(q.field("active"), true))
      .collect();
  },
});

export const getCityBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("cities")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();
  },
});

export const updateCity = mutation({
  args: {
    id: v.id("cities"),
    name: v.optional(v.string()),
    state: v.optional(v.string()),
    slug: v.optional(v.string()),
    active: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    await ctx.db.patch(id, updates);
  },
});
