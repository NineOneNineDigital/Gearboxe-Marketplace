import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { mutation, query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { requireCurrentUser } from "./lib/authorization";
import { currentCycle } from "./lib/offerRecords";
import { assertBuyerEmailVerified, assertCanContact, assertNoRecentDuplicateMessage, consumeRateLimit } from "./lib/trustGuards";
import { isPublicVehicleFromActiveSeller } from "./lib/vehicleVisibility";
import { enqueueNotification } from "./notifications";
import { attachPhotos } from "./photoRequestMedia";

type Context = QueryCtx | MutationCtx;
type Vehicle = Doc<"vehicles">;
type Request = Doc<"photoRequests">;
const openStatus = (status: Request["status"]) => status === "requested" || status === "replied" || status === "followup";
const unavailable = () => new Error("Photo request unavailable");

function requestedViews(values: string[]) {
  if (!Array.isArray(values) || values.length < 1 || values.length > 10) throw new Error("Choose between 1 and 10 photo views");
  const views = values.map(value => value.trim());
  if (views.some(value => value.length < 3 || value.length > 120)) throw new Error("Each requested view must contain 3–120 characters");
  if (new Set(views.map(value => value.toLowerCase())).size !== views.length) throw new Error("Requested views must be distinct");
  return views;
}
function message(value: string, max = 2_000) {
  const content = value.trim();
  if (!content || content.length > max) throw new Error(`Message must contain between 1 and ${max} characters`);
  return content;
}
function openingContent(views: string[], note?: string) { return `${views.join("\n")}${note ? `\n${note}` : ""}`; }
async function pairFor(ctx: Context, vehicleId: Id<"vehicles">, buyerId: Id<"users">) {
  return ctx.db.query("photoRequestPairs").withIndex("by_vehicle_buyer", q => q.eq("vehicleId", vehicleId).eq("buyerId", buyerId)).unique();
}
async function requestFor(ctx: Context, requestId: Id<"photoRequests">, userId: Id<"users">) {
  const row = await ctx.db.get(requestId);
  if (!row || (row.buyerId !== userId && row.sellerId !== userId)) throw unavailable();
  return row;
}
async function buyerCanRequest(ctx: Context, vehicle: Vehicle, buyerId: Id<"users">) {
  if (!await isPublicVehicleFromActiveSeller(ctx, vehicle)) return false;
  if (vehicle.status !== "reserved") return true;
  const cycle = await currentCycle(ctx, vehicle._id);
  if (!cycle?.winner) return false; // A manual reservation has no accepted buyer.
  const winner = await ctx.db.get(cycle.winner);
  return !!winner && winner.vehicleId === vehicle._id && winner.buyerId === buyerId &&
    (winner.status === "reserved" || winner.status === "awaiting_outcome");
}
async function notice(ctx: MutationCtx, userId: Id<"users">, senderId: Id<"users">, row: Request, kind: string) {
  await enqueueNotification(ctx, { userId, sourceUserId: senderId, category: "messages", kind: "new_message",
    message: "There is an update to a private photo request.", vehicleId: row.vehicleId, conversationId: row.conversationId,
    link: `/myAccount/messages/${row.vehicleId}/${senderId}`, dedupeKey: `photo-request:${row._id}:${kind}:${row.updatedAt}` });
}

export const open = mutation({
  args: { vehicleId: v.id("vehicles"), views: v.array(v.string()), note: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const buyer = await requireCurrentUser(ctx);
    assertBuyerEmailVerified(buyer);
    const vehicle = await ctx.db.get(args.vehicleId);
    if (!vehicle || vehicle.userId === buyer._id || !await buyerCanRequest(ctx, vehicle, buyer._id)) throw unavailable();
    await assertCanContact(ctx, buyer._id, vehicle.userId);
    const pair = await pairFor(ctx, vehicle._id, buyer._id);
    if (pair?.disabledAt !== undefined) throw new Error("Photo requests are unavailable for this listing");
    if (pair?.openRequestId) throw new Error("Continue in your open photo request");
    const views = requestedViews(args.views);
    const note = args.note?.trim() || undefined;
    if (note && note.length > 1_000) throw new Error("Note must be 1,000 characters or fewer");
    const content = openingContent(views, note);
    await assertNoRecentDuplicateMessage(ctx, buyer._id, content);
    await consumeRateLimit(ctx, buyer._id, "message");

    const [participant1Id, participant2Id] = buyer._id < vehicle.userId ? [buyer._id, vehicle.userId] : [vehicle.userId, buyer._id];
    let conversation = await ctx.db.query("conversations").withIndex("by_vehicle_participants", q =>
      q.eq("vehicleId", vehicle._id).eq("participant1Id", participant1Id).eq("participant2Id", participant2Id)).unique();
    const now = Date.now();
    if (!conversation) {
      await consumeRateLimit(ctx, buyer._id, "conversation");
      const id = await ctx.db.insert("conversations", { vehicleId: vehicle._id, participant1Id, participant2Id, lastMessageAt: now, createdAt: now });
      conversation = await ctx.db.get(id);
    }
    if (!conversation) throw new Error("Unable to create conversation");
    const requestId = await ctx.db.insert("photoRequests", { vehicleId: vehicle._id, conversationId: conversation._id,
      buyerId: buyer._id, sellerId: vehicle.userId, status: "requested", views, note, createdAt: now, updatedAt: now });
    if (pair) await ctx.db.patch(pair._id, { openRequestId: requestId, updatedAt: now });
    else await ctx.db.insert("photoRequestPairs", { vehicleId: vehicle._id, buyerId: buyer._id, openRequestId: requestId, updatedAt: now });
    await ctx.db.insert("photoRequestEntries", { requestId, senderId: buyer._id, kind: "request", content, views, createdAt: now });
    await ctx.db.patch(conversation._id, { lastMessageAt: now });
    const row = await ctx.db.get(requestId);
    if (row) await notice(ctx, vehicle.userId, buyer._id, row, "opened");
    return { requestId, conversationId: conversation._id };
  },
});

export const reply = mutation({ args: { requestId: v.id("photoRequests"), content: v.string(), photoIds: v.optional(v.array(v.id("photoRequestPhotos"))) }, handler: async (ctx, args) => {
  const seller = await requireCurrentUser(ctx);
  const row = await requestFor(ctx, args.requestId, seller._id);
  if (row.sellerId !== seller._id || !["requested", "followup"].includes(row.status)) throw unavailable();
  await assertCanContact(ctx, seller._id, row.buyerId);
  const content = message(args.content);
  await assertNoRecentDuplicateMessage(ctx, seller._id, content);
  await consumeRateLimit(ctx, seller._id, "message");
  const attached = await attachPhotos(ctx, args.photoIds ?? [], seller._id, row._id);
  const now = Date.now();
  const entryId = await ctx.db.insert("photoRequestEntries", { requestId: row._id, senderId: seller._id, kind: "reply", content, photoIds: attached, createdAt: now });
  for (const photoId of attached) await ctx.db.patch(photoId, { entryId, expiresAt: Number.MAX_SAFE_INTEGER });
  await ctx.db.patch(row._id, { status: "replied", updatedAt: now });
  await ctx.db.patch(row.conversationId, { lastMessageAt: now });
  await notice(ctx, row.buyerId, seller._id, { ...row, updatedAt: now }, "replied");
} });

export const followUp = mutation({ args: { requestId: v.id("photoRequests"), content: v.string() }, handler: async (ctx, args) => {
  const buyer = await requireCurrentUser(ctx);
  assertBuyerEmailVerified(buyer);
  const row = await requestFor(ctx, args.requestId, buyer._id);
  if (row.buyerId !== buyer._id || row.status !== "replied") throw unavailable();
  const pair = await pairFor(ctx, row.vehicleId, buyer._id);
  if (!pair || pair.openRequestId !== row._id) throw unavailable();
  const vehicle = await ctx.db.get(row.vehicleId);
  if (!vehicle || !await buyerCanRequest(ctx, vehicle, buyer._id)) throw unavailable();
  await assertCanContact(ctx, buyer._id, row.sellerId);
  const content = message(args.content);
  await assertNoRecentDuplicateMessage(ctx, buyer._id, content);
  await consumeRateLimit(ctx, buyer._id, "message");
  const now = Date.now();
  await ctx.db.insert("photoRequestEntries", { requestId: row._id, senderId: buyer._id, kind: "followup", content, createdAt: now });
  await ctx.db.patch(row._id, { status: "followup", updatedAt: now });
  await ctx.db.patch(row.conversationId, { lastMessageAt: now });
  await notice(ctx, row.sellerId, buyer._id, { ...row, updatedAt: now }, "followup");
} });

async function finish(ctx: MutationCtx, row: Request, status: "declined" | "closed", actorId: Id<"users">) {
  const now = Date.now();
  await ctx.db.patch(row._id, { status, closedAt: now, updatedAt: now });
  const pair = await pairFor(ctx, row.vehicleId, row.buyerId);
  if (pair?.openRequestId === row._id) await ctx.db.patch(pair._id, { openRequestId: undefined, updatedAt: now });
  await notice(ctx, actorId === row.buyerId ? row.sellerId : row.buyerId, actorId, { ...row, updatedAt: now }, status);
}
export const decline = mutation({ args: { requestId: v.id("photoRequests") }, handler: async (ctx, { requestId }) => {
  const seller = await requireCurrentUser(ctx);
  const row = await requestFor(ctx, requestId, seller._id);
  if (row.sellerId !== seller._id || !openStatus(row.status)) throw unavailable();
  await finish(ctx, row, "declined", seller._id);
} });
export const close = mutation({ args: { requestId: v.id("photoRequests") }, handler: async (ctx, { requestId }) => {
  const user = await requireCurrentUser(ctx);
  const row = await requestFor(ctx, requestId, user._id);
  if (!openStatus(row.status)) throw unavailable();
  await finish(ctx, row, "closed", user._id);
} });

export const setDisabled = mutation({ args: { vehicleId: v.id("vehicles"), buyerId: v.id("users"), disabled: v.boolean() }, handler: async (ctx, args) => {
  const seller = await requireCurrentUser(ctx);
  const vehicle = await ctx.db.get(args.vehicleId);
  if (!vehicle || vehicle.userId !== seller._id) throw unavailable();
  const pair = await pairFor(ctx, args.vehicleId, args.buyerId);
  if (!pair) {
    if (!args.disabled || args.buyerId === seller._id) throw unavailable();
    const [participant1Id, participant2Id] = seller._id < args.buyerId ? [seller._id, args.buyerId] : [args.buyerId, seller._id];
    const conversation = await ctx.db.query("conversations").withIndex("by_vehicle_participants", q =>
      q.eq("vehicleId", args.vehicleId).eq("participant1Id", participant1Id).eq("participant2Id", participant2Id)).unique();
    if (!conversation) throw unavailable();
    const now = Date.now();
    await ctx.db.insert("photoRequestPairs", { vehicleId: args.vehicleId, buyerId: args.buyerId, disabledAt: now, updatedAt: now });
    return;
  }
  await ctx.db.patch(pair._id, { disabledAt: args.disabled ? Date.now() : undefined, updatedAt: Date.now() });
} });

export const getForConversation = query({ args: { conversationId: v.id("conversations") }, handler: async (ctx, { conversationId }) => {
  const user = await requireCurrentUser(ctx);
  const conversation = await ctx.db.get(conversationId);
  if (!conversation || (conversation.participant1Id !== user._id && conversation.participant2Id !== user._id)) return null;
  const vehicle = await ctx.db.get(conversation.vehicleId);
  if (!vehicle || (vehicle.userId !== conversation.participant1Id && vehicle.userId !== conversation.participant2Id)) return null;
  const buyerId = vehicle.userId === conversation.participant1Id ? conversation.participant2Id : conversation.participant1Id;
  const role = vehicle.userId === user._id ? "seller" as const : "buyer" as const;
  const pair = await pairFor(ctx, vehicle._id, buyerId);
  let canContact = false;
  if (role === "buyer") {
    try { await assertCanContact(ctx, user._id, vehicle.userId); canContact = true; } catch { /* Do not reveal block direction. */ }
  }
  return { role, vehicleId: vehicle._id, buyerId, disabled: pair?.disabledAt !== undefined,
    canOpen: role === "buyer" && !!user.emailVerified && canContact && !pair?.openRequestId && pair?.disabledAt === undefined && await buyerCanRequest(ctx, vehicle, buyerId),
  };
} });

export const listHistory = query({ args: { conversationId: v.id("conversations"), paginationOpts: paginationOptsValidator }, handler: async (ctx, args) => {
  const user = await requireCurrentUser(ctx);
  const conversation = await ctx.db.get(args.conversationId);
  if (!conversation || (conversation.participant1Id !== user._id && conversation.participant2Id !== user._id)) throw unavailable();
  if (!Number.isInteger(args.paginationOpts.numItems) || args.paginationOpts.numItems < 1) throw new Error("Invalid page size");
  const result = await ctx.db.query("photoRequests").withIndex("by_conversation_created", q => q.eq("conversationId", args.conversationId))
    .order("desc").paginate({ ...args.paginationOpts, numItems: Math.min(25, args.paginationOpts.numItems) });
  return { ...result, page: result.page.map(row => ({ _id: row._id, status: row.status, views: row.views, note: row.note, createdAt: row.createdAt, updatedAt: row.updatedAt })) };
} });

export const listEntries = query({ args: { requestId: v.id("photoRequests"), paginationOpts: paginationOptsValidator }, handler: async (ctx, args) => {
  const user = await requireCurrentUser(ctx);
  const row = await requestFor(ctx, args.requestId, user._id);
  if (!Number.isInteger(args.paginationOpts.numItems) || args.paginationOpts.numItems < 1) throw new Error("Invalid page size");
  const result = await ctx.db.query("photoRequestEntries").withIndex("by_request_created", q => q.eq("requestId", row._id))
    .order("desc").paginate({ ...args.paginationOpts, numItems: Math.min(50, args.paginationOpts.numItems) });
  return { ...result, page: result.page.map(entry => ({ _id: entry._id, kind: entry.kind, content: entry.content, views: entry.views, photoIds: entry.photoIds ?? [],
    senderRole: entry.senderId === row.buyerId ? "buyer" as const : "seller" as const, createdAt: entry.createdAt })) };
} });

export const getEligibility = query({ args: { vehicleId: v.id("vehicles"), buyerId: v.optional(v.id("users")) }, handler: async (ctx, args) => {
  const user = await requireCurrentUser(ctx);
  const vehicle = await ctx.db.get(args.vehicleId);
  if (!vehicle) return { canOpen: false, reason: "Listing unavailable", disabled: false };
  if (args.buyerId && vehicle.userId !== user._id) throw unavailable();
  const buyerId = args.buyerId ?? user._id;
  const pair = await pairFor(ctx, vehicle._id, buyerId);
  const disabled = pair?.disabledAt !== undefined;
  if (args.buyerId) return { canOpen: false, reason: "Seller controls", disabled, openRequestId: pair?.openRequestId };
  if (vehicle.userId === buyerId) return { canOpen: false, reason: "Your listing", disabled, openRequestId: pair?.openRequestId };
  if (!user.emailVerified) return { canOpen: false, reason: "Verify your email to request photos", disabled, openRequestId: pair?.openRequestId };
  if (disabled) return { canOpen: false, reason: "Seller disabled photo requests", disabled, openRequestId: pair?.openRequestId };
  if (pair?.openRequestId) return { canOpen: false, reason: "Continue in the open request", disabled, openRequestId: pair.openRequestId };
  try { await assertCanContact(ctx, buyerId, vehicle.userId); }
  catch { return { canOpen: false, reason: "Messaging unavailable", disabled, openRequestId: pair?.openRequestId }; }
  if (!await isPublicVehicleFromActiveSeller(ctx, vehicle)) return { canOpen: false, reason: "Listing unavailable", disabled, openRequestId: pair?.openRequestId };
  if (vehicle.status === "reserved") {
    const cycle = await currentCycle(ctx, vehicle._id);
    if (!cycle?.winner) return { canOpen: false, reason: "Photo requests pause during this reservation", disabled, openRequestId: pair?.openRequestId };
    const winner = await ctx.db.get(cycle.winner);
    if (!winner || winner.buyerId !== buyerId || winner.vehicleId !== vehicle._id || !["reserved", "awaiting_outcome"].includes(winner.status))
      return { canOpen: false, reason: "Only the accepted buyer may request photos while reserved", disabled, openRequestId: pair?.openRequestId };
  }
  return { canOpen: true, reason: undefined, disabled, openRequestId: undefined };
} });
