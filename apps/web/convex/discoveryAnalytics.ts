import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAdmin } from "./lib/authorization";

const DAY_MS = 86_400_000;
const MAX_DAILY_COUNT = 10_000;
const KINDS = ["zip_entry", "zero_results", "radius_expand", "nationwide_view", "listing_click"] as const;
const kind = v.union(...KINDS.map(value => v.literal(value)));

export function utcDay(at: number) {
  return Math.floor(at / DAY_MS) * DAY_MS;
}

// Public and best-effort by design. A row contains only a UTC day, a fixed
// event name and a count; it cannot reconstruct a visitor's search or route.
export const record = mutation({
  args: { kind },
  handler: async (ctx, { kind }) => {
    const day = utcDay(Date.now());
    const existing = await ctx.db.query("discoveryActivity")
      .withIndex("by_day_kind", q => q.eq("day", day).eq("kind", kind)).unique();
    if (existing) {
      // Bound writes per event/day even when an automated caller repeats events.
      if (existing.count < MAX_DAILY_COUNT) await ctx.db.patch(existing._id, { count: existing.count + 1 });
    } else {
      await ctx.db.insert("discoveryActivity", { day, kind, count: 1 });
    }
  },
});

export const lastThirtyDays = query({
  args: {},
  handler: async ctx => {
    await requireAdmin(ctx);
    const asOf = Date.now(), startDay = utcDay(asOf) - 29 * DAY_MS;
    const rows = await ctx.db.query("discoveryActivity")
      .withIndex("by_day", q => q.gte("day", startDay)).take(151);
    const totals = Object.fromEntries(KINDS.map(value => [value, 0])) as Record<(typeof KINDS)[number], number>;
    for (const row of rows.slice(0, 150)) totals[row.kind] += row.count;
    return { asOf, startDay, totals, truncated: rows.length > 150, capped: rows.some(row => row.count >= MAX_DAILY_COUNT) };
  },
});
