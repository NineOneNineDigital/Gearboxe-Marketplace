import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireCurrentUser } from "./lib/authorization";
import { discoveryFilters, discoverySort, validateFilters } from "./lib/discoveryPolicy";
export const list = query({ args: {}, handler: async ctx => {
  const user = await requireCurrentUser(ctx);
  return ctx.db.query("savedSearches").withIndex("by_user", q => q.eq("userId", user._id)).order("desc").take(25);
} });
export const save = mutation({ args: { name: v.string(), filters: discoveryFilters, sort: discoverySort }, handler: async (ctx, args) => {
  const user = await requireCurrentUser(ctx);
  const name = args.name.trim(); if (!name || name.length > 80) throw new Error("Search name must contain 1–80 characters");
  const filters = validateFilters(args.filters);
  const existing = await ctx.db.query("savedSearches").withIndex("by_user", q => q.eq("userId", user._id)).take(25);
  if (existing.length >= 25) throw new Error("Remove a saved search before adding another (maximum 25)");
  return ctx.db.insert("savedSearches", { userId: user._id, name, filters, sort: args.sort, createdAt: Date.now() });
} });
export const remove = mutation({ args: { id: v.id("savedSearches") }, handler: async (ctx, { id }) => {
  const user = await requireCurrentUser(ctx), search = await ctx.db.get(id);
  if (!search || search.userId !== user._id) throw new Error("Saved search not found");
  await ctx.db.delete(id);
} });
