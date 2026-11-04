import { v } from "convex/values";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { requireAdmin } from "./lib/authorization";

export const record = internalMutation({
  args: { eventId: v.string(), type: v.string(), objectId: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db.query("stripeWebhookEvents").withIndex("by_event", q => q.eq("eventId", args.eventId)).unique();
    if (existing) return existing;
    const now = Date.now();
    const id = await ctx.db.insert("stripeWebhookEvents", { ...args, status: "pending", attempts: 0, nextAttemptAt: now, createdAt: now, updatedAt: now });
    return (await ctx.db.get(id))!;
  },
});
export const claim = internalMutation({
  args: { eventId: v.string() },
  handler: async (ctx, args) => {
    const row = await ctx.db.query("stripeWebhookEvents").withIndex("by_event", q => q.eq("eventId", args.eventId)).unique();
    if (!row || row.status === "completed" || row.status === "failed" || row.nextAttemptAt > Date.now()) return null;
    await ctx.db.patch(row._id, { status: "processing", attempts: row.attempts + 1, nextAttemptAt: Date.now() + 5 * 60_000, updatedAt: Date.now() });
    return row;
  },
});
export const finish = internalMutation({
  args: { eventId: v.string(), error: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const row = await ctx.db.query("stripeWebhookEvents").withIndex("by_event", q => q.eq("eventId", args.eventId)).unique();
    if (!row || row.status === "completed") return;
    await ctx.db.patch(row._id, { status: args.error ? row.attempts >= 12 ? "failed" : "pending" : "completed", lastError: args.error, nextAttemptAt: Date.now() + Math.min(3_600_000, 30_000 * 2 ** row.attempts), updatedAt: Date.now() });
  },
});
export const due = internalQuery({ args: {}, handler: async ctx => (await Promise.all(["pending", "processing"].map(status => ctx.db.query("stripeWebhookEvents").withIndex("by_status_due", q => q.eq("status", status).lte("nextAttemptAt", Date.now())).take(25)))).flat() });
export const getFailures = query({ args: {}, handler: async ctx => { await requireAdmin(ctx); return (await Promise.all(["pending", "processing", "failed"].map(status => ctx.db.query("stripeWebhookEvents").withIndex("by_status_due", q => q.eq("status", status)).take(50)))).flat(); } });
export const retry = mutation({ args: { eventId: v.string() }, handler: async (ctx, args) => {
  const admin = await requireAdmin(ctx);
  const row = await ctx.db.query("stripeWebhookEvents").withIndex("by_event", q => q.eq("eventId", args.eventId)).unique();
  if (!row || row.status !== "failed") throw new Error("Failed webhook not found");
  await ctx.db.patch(row._id, { status: "pending", attempts: 0, nextAttemptAt: Date.now(), updatedAt: Date.now() });
  await ctx.db.insert("adminAuditLog", { action: "stripe_webhook_retry", actorId: admin._id, source: "dashboard", reason: args.eventId, createdAt: Date.now() });
} });
