import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { enqueueNotification } from "../notifications";
import { purgeDeadline } from "./offerPolicy";

export type Thread = Doc<"offerThreads">;
export type OfferContext = QueryCtx | MutationCtx;
export const unavailable = () => new Error("Offer unavailable");
export const conflict = () => new Error("This offer changed. Refresh before responding.");

export async function currentCycle(ctx: OfferContext, vehicleId: Id<"vehicles">) {
  return ctx.db.query("offerCycles").withIndex("by_vehicle_closed", q => q.eq("vehicleId", vehicleId).eq("closedAt", undefined)).unique();
}

export async function note(ctx: MutationCtx, thread: Thread, kind: string, status: Thread["status"],
  at: number, options: { actorId?: Id<"users">; priceCents?: number; reason?: string; proposalVersion?: number } = {}) {
  const version = thread.version + 1;
  await ctx.db.insert("offerActions", {
    threadId: thread._id, version, proposalVersion: options.proposalVersion ?? thread.proposalVersion,
    kind, status, at, ...options,
  });
  await ctx.db.patch(thread._id, { version, status });
  return version;
}

export async function offerNotice(ctx: MutationCtx, thread: Thread, input: Parameters<typeof enqueueNotification>[1]) {
  const notificationId = await enqueueNotification(ctx, input);
  if (notificationId) {
    const delivery = await ctx.db.query("emailOutbox").withIndex("by_event", q => q.eq("eventKey", input.dedupeKey)).unique();
    await ctx.db.insert("offerNoticeRefs", { threadId: thread._id, notificationId, deliveryId: delivery?._id });
  }
}

export async function notify(ctx: MutationCtx, thread: Thread, kind: string, version: number,
  recipients: Id<"users">[], actorId?: Id<"users">) {
  for (const userId of recipients) {
    await offerNotice(ctx, thread, {
      userId, category: "messages", kind: "offer_" + kind, message: "There is an update to a private vehicle offer. Sign in to see the details.",
      link: "/myAccount/messages?offer=" + thread._id, conversationId: thread.conversationId,
      sourceUserId: actorId === userId ? undefined : actorId,
      dedupeKey: ["offer", thread._id, version, kind, userId].join(":"),
    });
  }
}

type Closure = "expired" | "declined" | "withdrawn" | "listing_closed" | "sold" | "released";
export async function closeThread(ctx: MutationCtx, thread: Thread, status: Closure, at: number,
  actorId?: Id<"users">, reason?: string) {
  if (thread.closedAt !== undefined) return;
  const version = await note(ctx, thread, status, status, at, { actorId, reason });
  const purgeAt = purgeDeadline(at);
  await ctx.db.patch(thread._id, {
    closedAt: at, purgeAt, checkAt: undefined, nextCheckAt: undefined, needsReview: undefined,
  });
  await ctx.scheduler.runAt(purgeAt, internal.offers.purgeClosedThread, { threadId: thread._id });
  if (Date.now() < purgeAt) await notify(ctx, thread, status, version, [thread.sellerId, thread.buyerId], actorId);
}

export async function consumeProposalLimit(ctx: MutationCtx, actorId: Id<"users">, vehicleId: Id<"vehicles">, now: number) {
  const window = 10 * 60 * 1000;
  for (const [key, limit] of [[`account:${actorId}`, 20], [`listing:${vehicleId}`, 100]] as const) {
    const row = await ctx.db.query("offerRateLimits").withIndex("by_key", q => q.eq("key", key)).unique();
    const active = row && now < row.resetsAt;
    if (active && row.count >= limit) throw new Error(`Too many proposals. Try again in ${Math.ceil((row.resetsAt - now) / 1000)} seconds.`);
    const value = { resetsAt: active ? row.resetsAt : now + window, count: active ? row.count + 1 : 1 };
    if (row) await ctx.db.patch(row._id, value);
    else await ctx.db.insert("offerRateLimits", { key, ...value });
  }
}
