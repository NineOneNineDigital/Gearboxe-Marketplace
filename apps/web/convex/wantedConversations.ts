import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { mutation, query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { requireCurrentUser } from "./lib/authorization";
import { assertCanContact, assertNoRecentDuplicateMessage, consumeRateLimit } from "./lib/trustGuards";
import { enqueueNotification } from "./notifications";
import { trustReason, trustText } from "./lib/trustPolicy";
import { wantedIsPublic } from "./lib/wantedPolicy";
import { attachPhotos } from "./wantedMedia";

const photoIds = v.optional(v.array(v.id("wantedReplyPhotos")));
const messageText = (value: string) => {
  const content = value.trim();
  if (!content || content.length > 2_000) throw new Error("Message must contain between 1 and 2,000 characters");
  return content;
};
const label = (value: string, name: string, max = 60) => {
  const text = value.trim();
  if (!text || text.length > max) throw new Error(`${name} must contain between 1 and ${max} characters`);
  return text;
};
const integer = (value: number, name: string, min: number, max: number) => {
  if (!Number.isInteger(value) || value < min || value > max) throw new Error(`Enter a valid ${name.toLowerCase()}`);
  return value;
};
const participant = (row: Doc<"wantedConversations">, userId: Id<"users">) => row.buyerId === userId || row.sellerId === userId;
async function threadFor(ctx: QueryCtx | MutationCtx, conversationId: Id<"wantedConversations">, userId: Id<"users">) {
  const row = await ctx.db.get(conversationId);
  if (!row || !participant(row, userId)) throw new Error("Conversation unavailable");
  return row;
}
function snapshot(request: Doc<"wantedRequests">) {
  const { title, maxBudget, area, radiusMiles, make, model, yearMin, yearMax, maxMileage, transmission, details } = request;
  return { title, maxBudget, area, radiusMiles, make, model, yearMin, yearMax, maxMileage, transmission, details };
}
async function notify(ctx: MutationCtx, recipientId: Id<"users">, senderId: Id<"users">, conversationId: Id<"wantedConversations">, messageId: Id<"wantedMessages">) {
  await enqueueNotification(ctx, { userId: recipientId, sourceUserId: senderId, category: "messages", kind: "new_message",
    message: "You have a new private wanted-request message.", link: `/myAccount/wanted-messages/${conversationId}`,
    dedupeKey: `wanted-message:${messageId}` });
}

export const replyToRequest = mutation({
  args: { requestId: v.id("wantedRequests"), year: v.number(), make: v.string(), model: v.string(), askingPrice: v.number(), mileage: v.number(), city: v.string(), state: v.string(), message: v.string(), photoIds },
  handler: async (ctx, args) => {
    const seller = await requireCurrentUser(ctx);
    const request = await ctx.db.get(args.requestId);
    if (!request || !wantedIsPublic(request, Date.now()) || request.userId === seller._id) throw new Error("Wanted request unavailable");
    await assertCanContact(ctx, seller._id, request.userId);
    const existing = await ctx.db.query("wantedConversations").withIndex("by_request_seller", q => q.eq("requestId", request._id).eq("sellerId", seller._id)).unique();
    if (existing) throw new Error("Continue in your existing conversation");
    const content = messageText(args.message);
    await assertNoRecentDuplicateMessage(ctx, seller._id, content);
    const vehicle = { year: integer(args.year, "Year", 1900, 2100), make: label(args.make, "Make"), model: label(args.model, "Model"),
      askingPrice: integer(args.askingPrice, "Asking price", 1, 100_000_000), mileage: integer(args.mileage, "Mileage", 0, 1_000_000),
      city: label(args.city, "City"), state: label(args.state, "State", 2).toUpperCase() };
    if (!/^[A-Z]{2}$/.test(vehicle.state)) throw new Error("Enter a two-letter state");
    await consumeRateLimit(ctx, seller._id, "message");
    await consumeRateLimit(ctx, seller._id, "conversation");
    const now = Date.now();
    const conversationId = await ctx.db.insert("wantedConversations", { requestId: request._id, buyerId: request.userId, sellerId: seller._id,
      requestSnapshot: snapshot(request), sellerVehicle: vehicle, lastMessageAt: now, createdAt: now });
    const attached = await attachPhotos(ctx, args.photoIds ?? [], seller._id, request._id, conversationId);
    const messageId = await ctx.db.insert("wantedMessages", { conversationId, senderId: seller._id, recipientId: request.userId,
      content, photoIds: attached, read: false, createdAt: now });
    await ctx.db.patch(conversationId, { lastMessageAt: now });
    for (const id of attached) await ctx.db.patch(id, { messageId });
    await notify(ctx, request.userId, seller._id, conversationId, messageId);
    return conversationId;
  },
});

export const send = mutation({
  args: { conversationId: v.id("wantedConversations"), content: v.string(), photoIds },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    const thread = await threadFor(ctx, args.conversationId, user._id);
    if (thread.dismissedAt !== undefined) throw new Error("This conversation is paused until the buyer reopens it");
    const recipientId = thread.buyerId === user._id ? thread.sellerId : thread.buyerId;
    await assertCanContact(ctx, user._id, recipientId);
    const content = messageText(args.content);
    await assertNoRecentDuplicateMessage(ctx, user._id, content);
    await consumeRateLimit(ctx, user._id, "message");
    const attached = await attachPhotos(ctx, args.photoIds ?? [], user._id, thread.requestId, thread._id);
    const now = Date.now();
    const messageId = await ctx.db.insert("wantedMessages", { conversationId: thread._id, senderId: user._id, recipientId,
      content, photoIds: attached, read: false, createdAt: now });
    await ctx.db.patch(thread._id, { lastMessageAt: now });
    for (const id of attached) await ctx.db.patch(id, { messageId });
    await notify(ctx, recipientId, user._id, thread._id, messageId);
    return messageId;
  },
});

export const listMine = query({ args: {}, handler: async ctx => {
  const user = await requireCurrentUser(ctx);
  const [asBuyer, asSeller] = await Promise.all([
    ctx.db.query("wantedConversations").withIndex("by_buyer", q => q.eq("buyerId", user._id)).collect(),
    ctx.db.query("wantedConversations").withIndex("by_seller", q => q.eq("sellerId", user._id)).collect(),
  ]);
  return Promise.all([...asBuyer, ...asSeller].sort((a, b) => b.lastMessageAt - a.lastMessageAt).map(async row => {
    const otherUserId = row.buyerId === user._id ? row.sellerId : row.buyerId;
    const [other, last, unread] = await Promise.all([
      ctx.db.get(otherUserId),
      ctx.db.query("wantedMessages").withIndex("by_conversation", q => q.eq("conversationId", row._id)).order("desc").first(),
      ctx.db.query("wantedMessages").withIndex("by_conversation_recipient_read", q => q.eq("conversationId", row._id).eq("recipientId", user._id).eq("read", false)).collect(),
    ]);
    return { _id: row._id, requestId: row.requestId, role: row.buyerId === user._id ? "buyer" as const : "seller" as const,
      otherUserName: other && other.deletedAt === undefined ? (row.buyerId === user._id ? (other.name || "Seller") : "Buyer") : "Deleted account", requestSnapshot: row.requestSnapshot, sellerVehicle: row.sellerVehicle,
      lastMessageAt: row.lastMessageAt, dismissed: row.dismissedAt !== undefined, lastMessage: last ? { content: last.content, createdAt: last.createdAt } : null, unreadCount: unread.length };
  }));
} });

export const getThread = query({ args: { conversationId: v.id("wantedConversations") }, handler: async (ctx, { conversationId }) => {
  const user = await requireCurrentUser(ctx);
  const thread = await threadFor(ctx, conversationId, user._id);
  const otherUserId = thread.buyerId === user._id ? thread.sellerId : thread.buyerId;
  const other = await ctx.db.get(otherUserId);
  const ownBlock = await ctx.db.query("userBlocks").withIndex("by_pair", q => q.eq("userId", user._id).eq("blockedUserId", otherUserId)).unique();
  let canContact = false;
  if (thread.dismissedAt === undefined) {
    try { await assertCanContact(ctx, user._id, otherUserId); canContact = true; } catch { /* Hide block direction and deleted status. */ }
  }
  const { _id, requestId, requestSnapshot, sellerVehicle, createdAt, lastMessageAt } = thread;
  return { conversation: { _id, requestId, requestSnapshot, sellerVehicle, createdAt, lastMessageAt, role: thread.buyerId === user._id ? "buyer" as const : "seller" as const },
    otherUserName: other && other.deletedAt === undefined ? (thread.buyerId === user._id ? (other.name || "Seller") : "Buyer") : "Deleted account", canContact, blocked: !!ownBlock, dismissed: thread.dismissedAt !== undefined };
} });

export const dismiss = mutation({ args: { conversationId: v.id("wantedConversations") }, handler: async (ctx, { conversationId }) => {
  const buyer = await requireCurrentUser(ctx);
  const thread = await threadFor(ctx, conversationId, buyer._id);
  if (thread.buyerId !== buyer._id) throw new Error("Only the buyer can pass on a response");
  if (thread.dismissedAt !== undefined) return;
  const now = Date.now();
  await ctx.db.patch(conversationId, { dismissedAt: now });
  await enqueueNotification(ctx, { userId: thread.sellerId, sourceUserId: buyer._id, category: "messages", kind: "wanted_passed",
    message: "The buyer passed on your wanted-request response.", link: `/myAccount/wanted-messages/${conversationId}`,
    dedupeKey: `wanted-pass:${conversationId}:${now}` });
} });

export const reopen = mutation({ args: { conversationId: v.id("wantedConversations") }, handler: async (ctx, { conversationId }) => {
  const buyer = await requireCurrentUser(ctx);
  const thread = await threadFor(ctx, conversationId, buyer._id);
  if (thread.buyerId !== buyer._id) throw new Error("Only the buyer can reopen a response");
  if (thread.dismissedAt === undefined) return;
  await assertCanContact(ctx, buyer._id, thread.sellerId);
  await ctx.db.patch(conversationId, { dismissedAt: undefined });
} });

export const listMessages = query({ args: { conversationId: v.id("wantedConversations"), paginationOpts: paginationOptsValidator }, handler: async (ctx, args) => {
  const user = await requireCurrentUser(ctx);
  await threadFor(ctx, args.conversationId, user._id);
  if (!Number.isInteger(args.paginationOpts.numItems) || args.paginationOpts.numItems < 1) throw new Error("Invalid page size");
  const result = await ctx.db.query("wantedMessages").withIndex("by_conversation", q => q.eq("conversationId", args.conversationId))
    .order("desc").paginate({ ...args.paginationOpts, numItems: Math.min(50, args.paginationOpts.numItems) });
  return { ...result, page: result.page.map(message => ({ _id: message._id, content: message.content, photoIds: message.photoIds, read: message.read, createdAt: message.createdAt, isMine: message.senderId === user._id })) };
} });

export const setBlock = mutation({ args: { conversationId: v.id("wantedConversations"), blocked: v.boolean() }, handler: async (ctx, args) => {
  const user = await requireCurrentUser(ctx);
  const thread = await threadFor(ctx, args.conversationId, user._id);
  const otherUserId = thread.buyerId === user._id ? thread.sellerId : thread.buyerId;
  const existing = await ctx.db.query("userBlocks").withIndex("by_pair", q => q.eq("userId", user._id).eq("blockedUserId", otherUserId)).unique();
  if (args.blocked && !existing) await ctx.db.insert("userBlocks", { userId: user._id, blockedUserId: otherUserId, createdAt: Date.now() });
  if (!args.blocked && existing) await ctx.db.delete(existing._id);
} });

export const markRead = mutation({ args: { conversationId: v.id("wantedConversations"), messageIds: v.array(v.id("wantedMessages")) }, handler: async (ctx, args) => {
  const user = await requireCurrentUser(ctx);
  await threadFor(ctx, args.conversationId, user._id);
  if (args.messageIds.length > 100) throw new Error("Read at most 100 messages at once");
  let count = 0;
  for (const id of new Set(args.messageIds)) {
    const message = await ctx.db.get(id);
    if (message?.conversationId === args.conversationId && message.recipientId === user._id && !message.read) {
      await ctx.db.patch(id, { read: true }); count++;
    }
  }
  return count;
} });

export const report = mutation({ args: { conversationId: v.id("wantedConversations"), reason: v.string(), details: v.string() }, handler: async (ctx, args) => {
  const user = await requireCurrentUser(ctx);
  const thread = await threadFor(ctx, args.conversationId, user._id);
  const targetUserId = thread.buyerId === user._id ? thread.sellerId : thread.buyerId;
  await consumeRateLimit(ctx, user._id, "report");
  const now = Date.now();
  return ctx.db.insert("trustReports", { reporterId: user._id, targetUserId, wantedRequestId: thread.requestId,
    reason: trustReason(args.reason), details: trustText(args.details, "Report details"), status: "open", createdAt: now, updatedAt: now });
} });
