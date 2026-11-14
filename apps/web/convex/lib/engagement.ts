import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

type Kind = "active" | "reserved";
type Source = "message" | "offer";

// Six calendar months in UTC, clamping the day to the destination month.
export function engagementPurgeAt(at: number) {
  const original = new Date(at);
  const result = new Date(at);
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + 7);
  result.setUTCDate(0);
  result.setUTCDate(Math.min(original.getUTCDate(), result.getUTCDate()));
  return result.getTime();
}

// Captures only facts already checked at the authenticated write boundary.
export async function recordEngagementInquiry(ctx: MutationCtx, vehicle: Doc<"vehicles">, buyer: Doc<"users">, kind: Kind, source: Source, at: number) {
  if (buyer._id === vehicle.userId || !buyer.emailVerified || buyer.suspendedAt !== undefined) return;
  const existing = await ctx.db.query("engagementPairs").withIndex("by_vehicle_buyer_kind", q => q.eq("vehicleId", vehicle._id).eq("buyerId", buyer._id).eq("kind", kind)).unique();
  if (existing) return;
  const tracking = await ctx.db.query("engagementTracking").withIndex("by_key", q => q.eq("key", "global")).unique();
  if (!tracking) await ctx.db.insert("engagementTracking", { key: "global", startedAt: at });
  await ctx.db.insert("engagementPairs", { vehicleId: vehicle._id, buyerId: buyer._id, sellerId: vehicle.userId, kind, firstAt: at, firstSource: source, purgeAt: engagementPurgeAt(at) });
}

export async function recordEngagementResponse(ctx: MutationCtx, vehicleId: Id<"vehicles">, buyerId: Id<"users">, sellerId: Id<"users">, at: number, kind?: Kind) {
  const candidates = await Promise.all((kind ? [kind] : ["active", "reserved"] as const).map(candidate => ctx.db.query("engagementPairs").withIndex("by_vehicle_buyer_kind", q => q.eq("vehicleId", vehicleId).eq("buyerId", buyerId).eq("kind", candidate)).unique()));
  // A message has no reply target; attribute it to the most recent unanswered inquiry.
  const pair = candidates.filter(item => item && item.sellerId === sellerId && item.respondedAt === undefined && item.firstAt <= at).sort((a, b) => b!.firstAt - a!.firstAt)[0];
  if (pair) await ctx.db.patch(pair._id, { respondedAt: at });
}
