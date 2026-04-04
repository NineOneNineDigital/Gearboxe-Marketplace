import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const join = mutation({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const email = args.email.toLowerCase().trim();

    const existing = await ctx.db
      .query("waitlist")
      .withIndex("by_email", (q) => q.eq("email", email))
      .unique();

    if (existing) {
      return { alreadyJoined: true };
    }

    await ctx.db.insert("waitlist", {
      email,
      createdAt: Date.now(),
    });

    return { alreadyJoined: false };
  },
});

export const list = query({
  args: {},
  handler: async (ctx) =>
    await ctx.db.query("waitlist").order("desc").collect(),
});

export const count = query({
  args: {},
  handler: async (ctx) => {
    const entries = await ctx.db.query("waitlist").collect();
    return entries.length;
  },
});
