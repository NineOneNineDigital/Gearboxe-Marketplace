import { v } from "convex/values";
import { action, internalMutation, internalQuery, mutation } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { requireCurrentUser } from "./lib/authorization";
import { assertCanContact } from "./lib/trustGuards";
import { wantedIsPublic } from "./lib/wantedPolicy";

const UPLOAD_LEASE_MS = 60 * 60 * 1000;
const ABANDONED_MS = 24 * 60 * 60 * 1000;

export const beginUpload = action({
  args: { requestId: v.id("wantedRequests"), conversationId: v.optional(v.id("wantedConversations")) },
  handler: async (ctx, args): Promise<{ photoId: Id<"wantedReplyPhotos">; uploadUrl: string }> =>
    ctx.runAction(internal.wantedMediaProcessing.issueUpload, args),
});

export const finalizeUpload = action({
  args: { photoId: v.id("wantedReplyPhotos"), storageId: v.id("_storage") },
  handler: async (ctx, args): Promise<{ photoId: Id<"wantedReplyPhotos"> }> => {
    await ctx.runMutation(internal.wantedMedia.claimProcessing, args);
    return ctx.runAction(internal.wantedMediaProcessing.processUpload, args);
  },
});

export const deleteUpload = mutation({ args: { photoId: v.id("wantedReplyPhotos") }, handler: async (ctx, { photoId }) => {
  const user = await requireCurrentUser(ctx);
  const row = await ctx.db.get(photoId);
  if (!row || row.userId !== user._id || row.messageId) throw new Error("Photo unavailable");
  await removePhoto(ctx, row);
} });

export const createLease = internalMutation({
  args: { requestId: v.id("wantedRequests"), conversationId: v.optional(v.id("wantedConversations")), token: v.string() },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    const request = await ctx.db.get(args.requestId);
    if (!request) throw new Error("Wanted request unavailable");
    if (args.conversationId) {
      const thread = await ctx.db.get(args.conversationId);
      if (!thread || thread.requestId !== request._id || (thread.buyerId !== user._id && thread.sellerId !== user._id)) throw new Error("Conversation unavailable");
      if (thread.dismissedAt !== undefined) throw new Error("This conversation is paused until the buyer reopens it");
      await assertCanContact(ctx, user._id, thread.buyerId === user._id ? thread.sellerId : thread.buyerId);
    } else {
      if (!wantedIsPublic(request, Date.now()) || request.userId === user._id) throw new Error("Wanted request unavailable");
      await assertCanContact(ctx, user._id, request.userId);
    }
    const rows = await ctx.db.query("wantedReplyPhotos").withIndex("by_user_request", q => q.eq("userId", user._id).eq("requestId", request._id)).collect();
    if (rows.filter(row => !row.messageId && row.expiresAt > Date.now()).length >= 10) throw new Error("Attach or remove unused photos before uploading more");
    const now = Date.now();
    return ctx.db.insert("wantedReplyPhotos", { userId: user._id, requestId: request._id, conversationId: args.conversationId,
      token: args.token, status: "awaiting", createdAt: now, expiresAt: now + ABANDONED_MS });
  },
});

export const claimUpload = internalMutation({ args: { token: v.string() }, handler: async (ctx, { token }) => {
  await requireCurrentUser(ctx);
  const row = await ctx.db.query("wantedReplyPhotos").withIndex("by_token", q => q.eq("token", token)).unique();
  if (!row || row.status !== "awaiting" || row.createdAt + UPLOAD_LEASE_MS < Date.now()) throw new Error("Upload link expired");
  const user = await requireCurrentUser(ctx);
  if (row.userId !== user._id) throw new Error("Upload unavailable");
  await ctx.db.patch(row._id, { status: "uploading" });
  return row._id;
} });

export const recordSource = internalMutation({ args: { photoId: v.id("wantedReplyPhotos"), storageId: v.id("_storage") }, handler: async (ctx, { photoId, storageId }) => {
  const row = await ctx.db.get(photoId);
  if (!row || row.status !== "uploading" || row.expiresAt < Date.now()) throw new Error("Upload expired");
  await ctx.db.patch(photoId, { sourceId: storageId, status: "uploaded" });
} });

export const claimProcessing = internalMutation({ args: { photoId: v.id("wantedReplyPhotos"), storageId: v.id("_storage") }, handler: async (ctx, { photoId, storageId }) => {
  const user = await requireCurrentUser(ctx);
  const row = await ctx.db.get(photoId);
  if (!row || row.userId !== user._id || row.sourceId !== storageId || row.status !== "uploaded" || row.expiresAt < Date.now()) throw new Error("Upload unavailable");
  await ctx.db.patch(photoId, { status: "processing" });
} });

export const complete = internalMutation({ args: { photoId: v.id("wantedReplyPhotos"), detailId: v.id("_storage") }, handler: async (ctx, { photoId, detailId }) => {
  const row = await ctx.db.get(photoId);
  if (!row || row.status !== "processing" || !row.sourceId) throw new Error("Upload unavailable");
  await ctx.storage.delete(row.sourceId);
  await ctx.db.patch(photoId, { detailId, sourceId: undefined, status: "ready", token: "" });
  return { photoId };
} });

export const discard = internalMutation({ args: { photoId: v.id("wantedReplyPhotos") }, handler: async (ctx, { photoId }) => {
  const row = await ctx.db.get(photoId);
  if (row && !row.messageId) await removePhoto(ctx, row);
} });

async function removePhoto(ctx: MutationCtx, row: Doc<"wantedReplyPhotos">) {
  if (row.sourceId) await ctx.storage.delete(row.sourceId);
  if (row.detailId) await ctx.storage.delete(row.detailId);
  await ctx.db.delete(row._id);
}

export async function attachPhotos(ctx: MutationCtx, ids: Id<"wantedReplyPhotos">[], userId: Id<"users">, requestId: Id<"wantedRequests">, conversationId: Id<"wantedConversations">) {
  if (ids.length > 10 || new Set(ids).size !== ids.length) throw new Error("Attach at most 10 different photos per message");
  for (const id of ids) {
    const row = await ctx.db.get(id);
    if (!row || row.userId !== userId || row.requestId !== requestId || (row.conversationId && row.conversationId !== conversationId) || row.status !== "ready" || !row.detailId || row.messageId || row.expiresAt < Date.now()) throw new Error("Photo unavailable");
    await ctx.db.patch(id, { conversationId, expiresAt: Number.MAX_SAFE_INTEGER });
  }
  return ids;
}

export const authorizePhoto = internalQuery({ args: { photoId: v.id("wantedReplyPhotos") }, handler: async (ctx, { photoId }) => {
  const user = await requireCurrentUser(ctx);
  const row = await ctx.db.get(photoId);
  if (!row?.messageId || !row.conversationId || !row.detailId) throw new Error("Photo unavailable");
  const thread = await ctx.db.get(row.conversationId);
  if (!thread || (thread.buyerId !== user._id && thread.sellerId !== user._id)) throw new Error("Photo unavailable");
  const message = await ctx.db.get(row.messageId);
  if (!message || message.conversationId !== thread._id || !message.photoIds.includes(photoId)) throw new Error("Photo unavailable");
  return row.detailId;
} });

export const cleanup = internalMutation({ args: {}, handler: async ctx => {
  const expired = await ctx.db.query("wantedReplyPhotos").withIndex("by_expiry", q => q.lt("expiresAt", Date.now())).take(100);
  for (const row of expired) if (!row.messageId) await removePhoto(ctx, row);
} });
