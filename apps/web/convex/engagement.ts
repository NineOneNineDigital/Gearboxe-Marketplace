import { internalMutation, query } from "./_generated/server";
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
    const selected = rows.slice(0, LIMIT);
    const summarize = (kind: "active" | "reserved") => {
      const pairs = selected.filter(row => row.kind === kind);
      const responses = pairs.filter(row => row.respondedAt !== undefined && row.respondedAt <= asOf);
      return { inquiries: pairs.length, responses: responses.length, responseRate: pairs.length ? responses.length / pairs.length : null, averageResponseMs: responses.length ? responses.reduce((sum, row) => sum + row.respondedAt! - row.firstAt, 0) / responses.length : null, messages: pairs.filter(row => row.firstSource === "message").length, offers: pairs.filter(row => row.firstSource === "offer").length };
    };
    return { trackingStartedAt: tracking?.startedAt ?? null, start, asOf, truncated: rows.length > LIMIT, active: summarize("active"), reserved: summarize("reserved") };
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
