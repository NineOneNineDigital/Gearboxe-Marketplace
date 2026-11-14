import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAdmin } from "./lib/authorization";
import { DEALER_RISK_SAMPLE_LIMIT, summarizeDealerRisk } from "./lib/dealerRiskPolicy";
import { trustText } from "./lib/trustPolicy";

// On demand per selected listing, never per row in the queue.
export const forListing = query({
  args: { vehicleId: v.id("vehicles") },
  handler: async (ctx, { vehicleId }) => {
    await requireAdmin(ctx);
    const vehicle = await ctx.db.get(vehicleId);
    if (!vehicle) throw new Error("Vehicle not found");
    const [rows, ...reportGroups] = await Promise.all([
      ctx.db.query("vehicles").withIndex("by_user", q => q.eq("userId", vehicle.userId)).order("desc").take(DEALER_RISK_SAMPLE_LIMIT + 1),
      ...(["open", "reviewing", "escalated"] as const).map(status =>
        ctx.db.query("trustReports").withIndex("by_target_status", q => q.eq("targetUserId", vehicle.userId).eq("status", status)).take(11)),
    ]);
    return summarizeDealerRisk(rows.slice(0, DEALER_RISK_SAMPLE_LIMIT), reportGroups.reduce((total, group) => total + group.length, 0), Date.now(), rows.length > DEALER_RISK_SAMPLE_LIMIT || reportGroups.some(group => group.length === 11));
  },
});

// Records a review step only; listing transitions use the existing guarded mutations.
export const recordReview = mutation({
  args: { vehicleId: v.id("vehicles"), nextStep: v.union(v.literal("request_evidence"), v.literal("escalate"), v.literal("reviewed")), reason: v.string() },
  handler: async (ctx, { vehicleId, nextStep, reason }) => {
    const actor = await requireAdmin(ctx);
    const vehicle = await ctx.db.get(vehicleId);
    if (!vehicle) throw new Error("Vehicle not found");
    await ctx.db.insert("adminAuditLog", { actorId: actor._id, vehicleId, targetUserId: vehicle.userId,
      action: `repeat_listing_${nextStep}`, source: "moderation", reason: trustText(reason, "Reason", 1000), createdAt: Date.now() });
  },
});
