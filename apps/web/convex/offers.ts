import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { recordEngagementInquiry, recordEngagementResponse } from "./lib/engagement";
import { isAdmin, isConversationParticipant, requireAdmin, requireCurrentUser } from "./lib/authorization";
import { assertBuyerEmailVerified, assertCanContact } from "./lib/trustGuards";
import { acceptsOffers, conversationForOffer, endCycle, setDealStatus } from "./lib/offerListing";
import { effectiveClosure, priceInCents, purgeDeadline, RESPONSE_MS, REVIEW_MS } from "./lib/offerPolicy";
import { closeThread, conflict, consumeProposalLimit, currentCycle, note, notify, offerNotice, unavailable } from "./lib/offerRecords";
import type { Thread } from "./lib/offerRecords";

const threadArgs = { threadId: v.id("offerThreads"), version: v.number() };
type Context = QueryCtx | MutationCtx;
type User = Doc<"users">;

function enabled() { return process.env.OFFERS_ENABLED === "true"; }
function requireEnabled() { if (!enabled()) throw new Error("Structured offers are currently unavailable."); }
function participant(thread: Thread, user: User) { return thread.buyerId === user._id || thread.sellerId === user._id; }
function reasonText(reason: string) {
  const text = reason.trim();
  if (text.length < 1 || text.length > 500) throw new Error("Give a reason of 1 to 500 characters.");
  return text;
}
function pageSize(options: { numItems: number; cursor: string | null }) {
  if (!Number.isInteger(options.numItems) || options.numItems < 1) throw new Error("Invalid page size");
  return { ...options, numItems: Math.min(options.numItems, 50) };
}

async function effective(ctx: Context, thread: Thread, now: number) {
  if (thread.status !== "open") return null;
  const [cycle, vehicle] = await Promise.all([ctx.db.get(thread.cycleId), ctx.db.get(thread.vehicleId)]);
  const listingEnd = vehicle && ["active", "approved"].includes(vehicle.status) ? vehicle.availabilityDueAt : undefined;
  const cutoff = Math.min(cycle?.closedAt ?? Infinity, listingEnd ?? Infinity);
  return effectiveClosure(thread.expiresAt, Number.isFinite(cutoff) ? cutoff : undefined, now);
}
async function visible(ctx: Context, thread: Thread, now: number) {
  const pending = await effective(ctx, thread, now);
  const wipeAt = thread.purgeAt ?? (pending ? purgeDeadline(pending.at) : undefined);
  return wipeAt === undefined || now < wipeAt;
}
async function contact(ctx: Context, thread: Thread) {
  const buyer = await ctx.db.get(thread.buyerId);
  if (!buyer) throw unavailable();
  assertBuyerEmailVerified(buyer);
  await assertCanContact(ctx, thread.buyerId, thread.sellerId);
}

async function actions(ctx: Context, thread: Thread, user: User, now: number) {
  if (!enabled()) return [];
  const seller = user._id === thread.sellerId;
  if (thread.status === "reserved" || thread.status === "awaiting_outcome") {
    const result = thread.status === "reserved" ? ["cancel"] : [];
    if (seller) {
      result.push("sold", "available");
      if (thread.status === "reserved" && !thread.selfExtended && thread.checkAt !== undefined && now >= thread.checkAt)
        result.push("renew");
    }
    return result;
  }
  if (thread.status !== "open" || now >= thread.expiresAt) return [];
  const [listing, cycle] = await Promise.all([ctx.db.get(thread.vehicleId), ctx.db.get(thread.cycleId)]);
  if (!acceptsOffers(listing, now) || !cycle || cycle.closedAt !== undefined || cycle.winner) return [];
  try { await contact(ctx, thread); } catch { return []; }
  if (thread.senderId !== user._id) return ["accept", "counter", "decline"];
  return seller ? [] : ["withdraw"];
}
async function summary(ctx: Context, thread: Thread, user: User, now: number) {
  const closure = await effective(ctx, thread, now);
  return {
    competingReservation: thread.status === "open" && !closure && (await ctx.db.get(thread.vehicleId))?.status === "reserved",
    id: thread._id, vehicleId: thread.vehicleId, buyerId: thread.buyerId, sellerId: thread.sellerId,
    conversationId: thread.conversationId, status: closure?.status ?? thread.status, version: thread.version,
    senderId: thread.senderId, priceCents: thread.priceCents, expiresAt: thread.expiresAt,
    acceptedAt: thread.acceptedAt, checkAt: thread.checkAt, closedAt: closure?.at ?? thread.closedAt,
    selfExtended: !!thread.selfExtended, needsReview: !!thread.needsReview,
    allowedActions: closure ? [] : await actions(ctx, thread, user, now),
  };
}

export const get = query({
  args: { threadId: v.string() },
  handler: async (ctx, { threadId }) => {
    const user = await requireCurrentUser(ctx);
    const id = ctx.db.normalizeId("offerThreads", threadId);
    const thread = id && await ctx.db.get(id);
    if (!thread || !participant(thread, user) || !await visible(ctx, thread, Date.now())) return null;
    return summary(ctx, thread, user, Date.now());
  },
});

export const forConversation = query({
  args: { conversationId: v.id("conversations"), paginationOpts: paginationOptsValidator },
  handler: async (ctx, { conversationId, paginationOpts }) => {
    const user = await requireCurrentUser(ctx);
    const conversation = await ctx.db.get(conversationId);
    if (!conversation || !isConversationParticipant(conversation, user._id)) throw unavailable();
    const records = await ctx.db.query("offerThreads").withIndex("by_conversation", q => q.eq("conversationId", conversationId))
      .order("desc").paginate(pageSize(paginationOpts));
    const now = Date.now();
    const page = [];
    for (const thread of records.page) {
      if (participant(thread, user) && await visible(ctx, thread, now)) page.push(await summary(ctx, thread, user, now));
    }
    return { ...records, page };
  },
});

export const history = query({
  args: { threadId: v.id("offerThreads"), paginationOpts: paginationOptsValidator },
  handler: async (ctx, { threadId, paginationOpts }) => {
    const user = await requireCurrentUser(ctx);
    const thread = await ctx.db.get(threadId);
    if (!thread || !participant(thread, user) || !await visible(ctx, thread, Date.now())) throw unavailable();
    const records = await ctx.db.query("offerActions").withIndex("by_thread_version", q => q.eq("threadId", threadId))
      .order("desc").paginate(pageSize(paginationOpts));
    return { ...records, page: records.page.map(({ version, proposalVersion, kind, status, actorId, priceCents, at }) =>
      ({ version, proposalVersion, kind, status, actorId, priceCents, at })) };
  },
});

// Disclosure and its audit are committed together. No administrator bypass on participant queries.
export const inspectForSupport = mutation({
  args: { threadId: v.id("offerThreads"), reason: v.string(), paginationOpts: paginationOptsValidator },
  handler: async (ctx, { threadId, reason, paginationOpts }) => {
    const admin = await requireAdmin(ctx);
    const thread = await ctx.db.get(threadId);
    if (!thread || !await visible(ctx, thread, Date.now())) throw unavailable();
    await ctx.db.insert("offerSupportAccess", { threadId, actorId: admin._id, reason: reasonText(reason), at: Date.now() });
    const records = await ctx.db.query("offerActions").withIndex("by_thread_version", q => q.eq("threadId", threadId))
      .order("desc").paginate(pageSize(paginationOpts));
    return { thread: { ...await summary(ctx, thread, admin, Date.now()), allowedActions: [] }, actions: records };
  },
});

export const submit = mutation({
  args: { vehicleId: v.id("vehicles"), dollars: v.number(), requestId: v.string() },
  handler: async (ctx, { vehicleId, dollars, requestId }) => {
    requireEnabled();
    const buyer = await requireCurrentUser(ctx);
    assertBuyerEmailVerified(buyer);
    if (!/^[\w-]{1,128}$/.test(requestId)) throw new Error("Invalid offer request ID.");
    const priceCents = priceInCents(dollars);
    const retry = await ctx.db.query("offerThreads").withIndex("by_buyer_request", q => q.eq("buyerId", buyer._id).eq("requestId", requestId)).unique();
    if (retry) {
      if (retry.initialPriceCents !== priceCents || retry.vehicleId !== vehicleId || !await visible(ctx, retry, Date.now())) throw conflict();
      return retry._id;
    }
    const now = Date.now(), vehicle = await ctx.db.get(vehicleId);
    if (!acceptsOffers(vehicle, now) || vehicle.userId === buyer._id) throw new Error("This listing does not accept offers.");
    await assertCanContact(ctx, buyer._id, vehicle.userId);
    const cycle = await currentCycle(ctx, vehicleId);
    if (cycle?.winner) throw conflict();
    const cycleId = cycle?._id ?? await ctx.db.insert("offerCycles", { vehicleId });
    const previous = await ctx.db.query("offerThreads").withIndex("by_cycle_buyer_status", q =>
      q.eq("cycleId", cycleId).eq("buyerId", buyer._id).eq("status", "open")).unique();
    if (previous) {
      if (now < previous.expiresAt) throw new Error("Your current offer already has an unanswered proposal.");
      await closeThread(ctx, previous, "expired", previous.expiresAt);
    }
    await consumeProposalLimit(ctx, buyer._id, vehicleId, now);
    const conversationId = await conversationForOffer(ctx, vehicleId, buyer._id, vehicle.userId, now);
    const expiresAt = now + RESPONSE_MS;
    const threadId = await ctx.db.insert("offerThreads", {
      vehicleId, cycleId, conversationId, sellerId: vehicle.userId, buyerId: buyer._id, requestId, initialPriceCents: priceCents,
      status: "open", version: 1, proposalVersion: 1, senderId: buyer._id, priceCents, expiresAt, createdAt: now,
    });
    const thread = (await ctx.db.get(threadId))!;
    await recordEngagementInquiry(ctx, vehicle, buyer, "active", "offer", now);
    await ctx.db.insert("offerActions", { threadId, version: 1, proposalVersion: 1, kind: "submitted", status: "open", actorId: buyer._id, priceCents, at: now });
    await notify(ctx, thread, "submitted", 1, [vehicle.userId], buyer._id);
    await ctx.scheduler.runAt(expiresAt, internal.offers.checkExpiry, { threadId, proposalVersion: 1 });
    return threadId;
  },
});

export const respond = mutation({
  args: { ...threadArgs, action: v.union(v.literal("accept"), v.literal("counter"), v.literal("decline"), v.literal("withdraw")), dollars: v.optional(v.number()) },
  handler: async (ctx, { threadId, version, action, dollars }) => {
    requireEnabled();
    const user = await requireCurrentUser(ctx), thread = await ctx.db.get(threadId);
    if (!thread || !participant(thread, user)) throw unavailable();
    if (thread.version !== version || thread.status !== "open") throw conflict();
    const now = Date.now();
    if (now >= thread.expiresAt) throw new Error("This proposal has expired.");
    const [vehicle, cycle] = await Promise.all([ctx.db.get(thread.vehicleId), ctx.db.get(thread.cycleId)]);
    if (!acceptsOffers(vehicle, now) || vehicle.userId !== thread.sellerId || !cycle || cycle.closedAt !== undefined || cycle.winner)
      throw new Error("This listing no longer accepts responses to this offer.");
    await contact(ctx, thread);
    const sender = thread.senderId === user._id;
    if (action === "withdraw" ? !sender || user._id !== thread.buyerId : sender) throw unavailable();
    if (action !== "counter" && dollars !== undefined) throw new Error("Only a counteroffer takes a price.");
    if (user._id === thread.sellerId) {
      await recordEngagementResponse(ctx, thread.vehicleId, thread.buyerId, thread.sellerId, now, "active");
    }
    if (action === "withdraw" || action === "decline") {
      await closeThread(ctx, thread, action === "withdraw" ? "withdrawn" : "declined", now, user._id);
      return;
    }
    if (action === "counter") {
      if (dollars === undefined) throw new Error("Enter a whole-dollar price.");
      const priceCents = priceInCents(dollars), expiresAt = now + RESPONSE_MS, proposalVersion = version + 1;
      await consumeProposalLimit(ctx, user._id, thread.vehicleId, now);
      await note(ctx, thread, "countered", "open", now, { actorId: user._id, priceCents, proposalVersion });
      await ctx.db.patch(threadId, { proposalVersion, expiresAt, senderId: user._id, priceCents });
      await notify(ctx, thread, "countered", proposalVersion, [thread.senderId], user._id);
      await ctx.scheduler.runAt(expiresAt, internal.offers.checkExpiry, { threadId, proposalVersion });
      return;
    }
    const checkAt = now + REVIEW_MS;
    await note(ctx, thread, "accepted", "reserved", now, { actorId: user._id, priceCents: thread.priceCents });
    await ctx.db.patch(threadId, { acceptedAt: now, checkAt, nextCheckAt: checkAt });
    await ctx.db.patch(cycle._id, { winner: threadId });
    await setDealStatus(ctx, vehicle, "reserved", now, user._id);
    await notify(ctx, thread, "accepted", version + 1, [thread.buyerId, thread.sellerId], user._id);
    await ctx.scheduler.runAt(checkAt, internal.offers.checkReview, { threadId, checkAt });
  },
});

async function reservation(ctx: MutationCtx, threadId: Id<"offerThreads">, version: number, support = false) {
  requireEnabled();
  const actor = await requireCurrentUser(ctx), thread = await ctx.db.get(threadId);
  if (!thread || (!participant(thread, actor) && !(support && isAdmin(actor)))) throw unavailable();
  const [cycle, vehicle] = await Promise.all([ctx.db.get(thread.cycleId), ctx.db.get(thread.vehicleId)]);
  if (thread.version !== version || !["reserved", "awaiting_outcome"].includes(thread.status) ||
    !vehicle || vehicle.status !== "reserved" || vehicle.moderationRemovedAt !== undefined || vehicle.userId !== thread.sellerId ||
    !cycle || cycle.winner !== thread._id || cycle.closedAt !== undefined) throw conflict();
  return { actor, thread, cycle, vehicle };
}

export const cancel = mutation({
  args: { ...threadArgs, reason: v.string() },
  handler: async (ctx, { threadId, version, reason }) => {
    const { actor, thread } = await reservation(ctx, threadId, version);
    if (thread.status !== "reserved") throw conflict();
    const now = Date.now();
    const next = await note(ctx, thread, "canceled", "awaiting_outcome", now, { actorId: actor._id, reason: reasonText(reason) });
    // Preserve a scheduled or overdue follow-up while the seller still owes an outcome.
    await notify(ctx, thread, "canceled", next, [thread.sellerId, thread.buyerId], actor._id);
  },
});

async function extend(ctx: MutationCtx, threadId: Id<"offerThreads">, version: number, supportReason?: string) {
  const { actor, thread } = await reservation(ctx, threadId, version, supportReason !== undefined);
  const now = Date.now();
  if (thread.status !== "reserved" || thread.checkAt === undefined || now < thread.checkAt) throw conflict();
  const support = supportReason !== undefined;
  if (support ? !isAdmin(actor) || participant(thread, actor) || !thread.selfExtended : actor._id !== thread.sellerId || thread.selfExtended)
    throw unavailable();
  const kind = support ? "support_extended" : "renewed";
  const next = await note(ctx, thread, kind, "reserved", now, { actorId: actor._id, reason: support ? reasonText(supportReason) : undefined });
  const checkAt = now + REVIEW_MS;
  await ctx.db.patch(threadId, { selfExtended: true, checkAt, nextCheckAt: checkAt, needsReview: undefined });
  await notify(ctx, thread, kind, next, [thread.buyerId, thread.sellerId], actor._id);
  await ctx.scheduler.runAt(checkAt, internal.offers.checkReview, { threadId, checkAt });
}
export const renew = mutation({
  args: threadArgs, handler: async (ctx, { threadId, version }) => extend(ctx, threadId, version),
});
export const extendForSupport = mutation({
  args: { ...threadArgs, reason: v.string() },
  handler: async (ctx, { threadId, version, reason }) => extend(ctx, threadId, version, reason),
});

export const finish = mutation({
  args: { ...threadArgs, outcome: v.union(v.literal("sold"), v.literal("available")), reason: v.string() },
  handler: async (ctx, { threadId, version, outcome, reason }) => {
    const { actor, thread, cycle, vehicle } = await reservation(ctx, threadId, version, true);
    if (actor._id !== thread.sellerId && (!isAdmin(actor) || actor._id === thread.buyerId)) throw unavailable();
    const text = reasonText(reason);
    if (outcome === "available") {
      const seller = await ctx.db.get(thread.sellerId);
      if (!seller || seller.suspendedAt !== undefined) throw new Error("A suspended seller cannot reactivate a listing.");
    }
    const now = Date.now();
    await closeThread(ctx, thread, outcome === "sold" ? "sold" : "released", now, actor._id, text);
    await endCycle(ctx, cycle, now);
    await setDealStatus(ctx, vehicle, outcome === "sold" ? "sold" : "active", now, actor._id);
  },
});

async function expire(ctx: MutationCtx, thread: Thread, now: number) {
  if (thread.status !== "open") return;
  const closure = await effective(ctx, thread, now);
  if (closure) await closeThread(ctx, thread, closure.status, closure.at);
}
export const checkExpiry = internalMutation({
  args: { threadId: v.id("offerThreads"), proposalVersion: v.number() },
  handler: async (ctx, { threadId, proposalVersion }) => {
    const thread = await ctx.db.get(threadId);
    if (thread?.proposalVersion === proposalVersion) await expire(ctx, thread, Date.now());
  },
});

async function review(ctx: MutationCtx, thread: Thread, now: number) {
  if (!["reserved", "awaiting_outcome"].includes(thread.status) || thread.nextCheckAt === undefined || now < thread.nextCheckAt) return;
  const cycle = await ctx.db.get(thread.cycleId);
  if (!cycle || cycle.closedAt !== undefined || cycle.winner !== thread._id) return;
  const version = await note(ctx, thread, "review_due", thread.status, now);
  await ctx.db.patch(thread._id, { needsReview: true, nextCheckAt: undefined });
  await notify(ctx, thread, "review_due", version, [thread.sellerId]);
  // Failures configuring contacts never drop the review from the founder/backup work queue.
  const recipients = new Set((process.env.OFFER_REVIEWER_USER_IDS ?? "").split(",").map(s => s.trim()).filter(Boolean));
  for (const raw of recipients) {
    const id = ctx.db.normalizeId("users", raw);
    const reviewer = id && await ctx.db.get(id);
    if (reviewer && isAdmin(reviewer)) await offerNotice(ctx, thread, {
      userId: reviewer._id, category: "listings", kind: "offer_review_alert",
      message: "A reservation requires support follow-up. Open the private reservation review queue.",
      link: "/myAccount", dedupeKey: ["offer-review", thread._id, version, reviewer._id].join(":"),
    });
  }
}
export const checkReview = internalMutation({
  args: { threadId: v.id("offerThreads"), checkAt: v.number() },
  handler: async (ctx, { threadId, checkAt }) => {
    const thread = await ctx.db.get(threadId);
    if (thread?.nextCheckAt === checkAt) await review(ctx, thread, Date.now());
  },
});

export const reviewQueue = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, { paginationOpts }) => {
    await requireAdmin(ctx);
    const records = await ctx.db.query("offerThreads").withIndex("by_review", q => q.eq("needsReview", true)).paginate(pageSize(paginationOpts));
    return { ...records, page: records.page.map(thread => ({ threadId: thread._id, vehicleId: thread.vehicleId, status: thread.status, dueAt: thread.checkAt })) };
  },
});

async function purgeThread(ctx: MutationCtx, thread: Thread) {
  if (thread.purgeAt === undefined || thread.purgeAt > Date.now()) return;
  const actions = await ctx.db.query("offerActions").withIndex("by_thread_version", q => q.eq("threadId", thread._id)).take(50);
  const access = await ctx.db.query("offerSupportAccess").withIndex("by_thread", q => q.eq("threadId", thread._id)).take(50);
  for (const row of [...actions, ...access]) await ctx.db.delete(row._id);
  const notices = await ctx.db.query("offerNoticeRefs").withIndex("by_thread", q => q.eq("threadId", thread._id)).take(50);
  for (const ref of notices) {
    if (await ctx.db.get(ref.notificationId)) await ctx.db.delete(ref.notificationId);
    if (ref.deliveryId && await ctx.db.get(ref.deliveryId)) await ctx.db.delete(ref.deliveryId);
    await ctx.db.delete(ref._id);
  }
  if (actions.length < 50 && access.length < 50 && notices.length < 50) {
    await ctx.db.delete(thread._id);
    const cycle = await ctx.db.get(thread.cycleId);
    if (cycle?.closedAt !== undefined && !await ctx.db.query("offerThreads").withIndex("by_cycle_status", q => q.eq("cycleId", cycle._id)).first())
      await ctx.db.delete(cycle._id);
  }
  else await ctx.scheduler.runAfter(0, internal.offers.purgeClosedThread, { threadId: thread._id });
}
export const purgeClosedThread = internalMutation({
  args: { threadId: v.id("offerThreads") },
  handler: async (ctx, { threadId }) => {
    const thread = await ctx.db.get(threadId);
    if (thread) await purgeThread(ctx, thread);
  },
});

// Limit each transaction independently of the number of rounds, participants or open vehicles.
export const sweep = internalMutation({
  args: {}, handler: async ctx => {
    const now = Date.now();
    const expired = await ctx.db.query("offerThreads").withIndex("by_status_expiry", q => q.eq("status", "open").lte("expiresAt", now)).take(10);
    for (const thread of expired) await expire(ctx, thread, now);
    for (const status of ["reserved", "awaiting_outcome"] as const) {
      const due = await ctx.db.query("offerThreads").withIndex("by_status_check", q =>
        q.eq("status", status).gt("nextCheckAt", undefined).lte("nextCheckAt", now)).take(5);
      for (const thread of due) await review(ctx, thread, now);
    }
    const work = await ctx.db.query("offerCycles").withIndex("by_work", q => q.eq("needsClosure", true)).take(5);
    for (const cycle of work) {
      const pending = await ctx.db.query("offerThreads").withIndex("by_cycle_status", q => q.eq("cycleId", cycle._id).eq("status", "open")).take(10);
      for (const thread of pending) await expire(ctx, thread, now);
      if (pending.length < 10) {
        const remaining = await ctx.db.query("offerThreads").withIndex("by_cycle_status", q => q.eq("cycleId", cycle._id)).first();
        if (remaining) await ctx.db.patch(cycle._id, { needsClosure: undefined });
        else await ctx.db.delete(cycle._id);
      }
    }
    const purge = await ctx.db.query("offerThreads").withIndex("by_purge", q => q.gt("purgeAt", undefined).lte("purgeAt", now)).take(5);
    for (const thread of purge) await purgeThread(ctx, thread);
    const limits = await ctx.db.query("offerRateLimits").withIndex("by_reset", q => q.lte("resetsAt", now)).take(50);
    for (const row of limits) await ctx.db.delete(row._id);
  },
});
