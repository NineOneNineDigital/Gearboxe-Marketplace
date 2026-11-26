import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { requireAdmin } from "./lib/authorization";

const WEEK = 7 * 24 * 60 * 60 * 1000;
const LIMIT = 500;

// Bounded cohort with an explicit as-of cutoff; no message contents or identities leave the server.
export const weekly = query({
  args: {},
  handler: async ctx => {
    await requireAdmin(ctx);
    const asOf = Date.now(), start = asOf - WEEK;
    const tracking = await ctx.db.query("engagementTracking").withIndex("by_key", q => q.eq("key", "global")).unique();
    const rows = await ctx.db.query("engagementPairs").withIndex("by_first_at", q => q.gte("firstAt", start).lte("firstAt", asOf)).take(LIMIT + 1);
    const cohort = rows.slice(0, LIMIT);
    const selected = cohort.filter(row => row.excludedAt === undefined);
    const summarize = (kind: "active" | "reserved") => {
      const pairs = selected.filter(row => row.kind === kind);
      const responses = pairs.filter(row => row.respondedAt !== undefined && row.respondedAt <= asOf);
      return { inquiries: pairs.length, responses: responses.length, responseRate: pairs.length ? responses.length / pairs.length : null, averageResponseMs: responses.length ? responses.reduce((sum, row) => sum + row.respondedAt! - row.firstAt, 0) / responses.length : null, messages: pairs.filter(row => row.firstSource === "message").length, offers: pairs.filter(row => row.firstSource === "offer").length };
    };
    return { trackingStartedAt: tracking?.startedAt ?? null, start, asOf, truncated: rows.length > LIMIT, excludedPairs: cohort.length - selected.length, active: summarize("active"), reserved: summarize("reserved") };
  },
});

// The same bounded cohort as the report. Opaque IDs support an operator's case
// lookup; message text, offer prices, ZIPs, and contact details are never returned.
export const reviewPairs = query({
  args: {},
  handler: async ctx => {
    await requireAdmin(ctx);
    const asOf = Date.now();
    const rows = await ctx.db.query("engagementPairs").withIndex("by_first_at", q => q.gte("firstAt", asOf - WEEK).lte("firstAt", asOf)).take(LIMIT + 1);
    return { truncated: rows.length > LIMIT, pairs: rows.slice(0, LIMIT).map(row => ({
      id: row._id, vehicleId: row.vehicleId, buyerId: row.buyerId,
      kind: row.kind, firstAt: row.firstAt, firstSource: row.firstSource,
      responded: row.respondedAt !== undefined && row.respondedAt <= asOf,
      excludedAt: row.excludedAt ?? null,
    })) };
  },
});

export const setExcluded = mutation({
  args: { pairId: v.id("engagementPairs"), excluded: v.boolean(), reason: v.string() },
  handler: async (ctx, { pairId, excluded, reason }) => {
    const actor = await requireAdmin(ctx);
    const trimmedReason = reason.trim();
    if (trimmedReason.length < 10 || trimmedReason.length > 500) throw new Error("Reason must be 10–500 characters");
    const pair = await ctx.db.get(pairId);
    if (!pair) throw new Error("Engagement pair not found");
    if ((pair.excludedAt !== undefined) === excluded) return;
    const now = Date.now();
    await ctx.db.patch(pairId, { excludedAt: excluded ? now : undefined, excludedBy: excluded ? actor._id : undefined });
    await ctx.db.insert("adminAuditLog", {
      action: excluded ? "engagement_pair_excluded" : "engagement_pair_restored",
      actorId: actor._id, targetUserId: pair.buyerId, vehicleId: pair.vehicleId,
      source: "engagement_report", reason: `pair=${pairId}; ${trimmedReason}`, createdAt: now,
    });
  },
});

// Fixed-size batches keep cleanup bounded; the daily cron repeats as needed.
export const purge = internalMutation({
  args: {},
  handler: async ctx => {
    const expired = await ctx.db.query("engagementPairs").withIndex("by_purge_at", q => q.lte("purgeAt", Date.now())).take(100);
    for (const row of expired) await ctx.db.delete(row._id);
    return expired.length;
  },
});
