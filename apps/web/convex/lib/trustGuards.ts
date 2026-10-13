import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { RATE_LIMITS, rateWindow } from "./trustPolicy";
export async function consumeRateLimit(ctx: MutationCtx, userId: Id<"users">, action: keyof typeof RATE_LIMITS) {
    const limit = RATE_LIMITS[action];
    const windowStart = rateWindow(Date.now(), limit.windowMs);
    const row = await ctx.db.query("trustRateLimits").withIndex("by_user_action", q => q.eq("userId", userId).eq("action", action)).unique();
    const count = row?.windowStart === windowStart ? row.count : 0;
    if (count >= limit.count)
        throw new Error("Too many requests. Please try again after the rate limit resets.");
    if (row)
        await ctx.db.patch(row._id, { windowStart, count: count + 1 });
    else
        await ctx.db.insert("trustRateLimits", { userId, action, windowStart, count: 1 });
}
export async function assertCanContact(ctx: QueryCtx | MutationCtx, senderId: Id<"users">, recipientId: Id<"users">) {
    const [sender, recipient] = await Promise.all([ctx.db.get(senderId), ctx.db.get(recipientId)]);
    if (!sender || sender.suspendedAt !== undefined)
        throw new Error("This account cannot send messages");
    if (!recipient || recipient.suspendedAt !== undefined)
        throw new Error("This account cannot receive messages");
    const pairs = await Promise.all([
        ctx.db.query("userBlocks").withIndex("by_pair", q => q.eq("userId", senderId).eq("blockedUserId", recipientId)).unique(),
        ctx.db.query("userBlocks").withIndex("by_pair", q => q.eq("userId", recipientId).eq("blockedUserId", senderId)).unique(),
    ]);
    if (pairs.some(Boolean))
        throw new Error("Messaging is unavailable between these accounts");
}
export async function assertSellerTrust(ctx: QueryCtx | MutationCtx, vehicle: Doc<"vehicles">) {
    const seller = await ctx.db.get(vehicle.userId);
    if (!seller || seller.suspendedAt !== undefined)
        throw new Error("This seller account is suspended");
    if (!seller.emailVerified || !seller.phoneVerified)
        throw new Error("Verify your email and phone in account settings before submitting a listing");
    if (!vehicle.ownershipAttestedAt)
        throw new Error("Confirm that you own this vehicle or have permission to sell it before submitting");
}
