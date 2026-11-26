import { v } from "convex/values";
import { action, internalMutation, mutation } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { isAdmin, requireCurrentUser } from "./lib/authorization";
import { assertCanContact } from "./lib/trustGuards";

const ABANDONED_MS = 24 * 60 * 60 * 1000;
const UPLOAD_LEASE_MS = 60 * 60 * 1000;
const activeRequest = (status: Doc<"photoRequests">["status"]) => status === "requested" || status === "followup";

export const beginUpload = action({
  args: { requestId: v.id("photoRequests") },
  handler: async (ctx, args): Promise<{ photoId: Id<"photoRequestPhotos">; uploadUrl: string }> =>
    ctx.runAction(internal.photoRequestMediaProcessing.issueUpload, args),
});

export const finalizeUpload = action({
  args: { photoId: v.id("photoRequestPhotos"), storageId: v.id("_storage") },
  handler: async (ctx, args): Promise<{ photoId: Id<"photoRequestPhotos"> }> => {
    await ctx.runMutation(internal.photoRequestMedia.claimProcessing, args);
    return ctx.runAction(internal.photoRequestMediaProcessing.processUpload, args);
  },
});

async function removePhoto(ctx: MutationCtx, row: Doc<"photoRequestPhotos">) {
  if (row.sourceId) await ctx.storage.delete(row.sourceId);
  if (row.detailId) await ctx.storage.delete(row.detailId);
  await ctx.db.delete(row._id);
}

export const deleteUpload = mutation({ args: { photoId: v.id("photoRequestPhotos") }, handler: async (ctx, { photoId }) => {
  const user = await requireCurrentUser(ctx);
  const row = await ctx.db.get(photoId);
  if (!row || row.userId !== user._id || row.entryId) throw new Error("Photo unavailable");
  await removePhoto(ctx, row);
} });

export const createLease = internalMutation({ args: { requestId: v.id("photoRequests"), token: v.string() }, handler: async (ctx, args) => {
  const seller = await requireCurrentUser(ctx);
  const request = await ctx.db.get(args.requestId);
  if (!request || request.sellerId !== seller._id || !activeRequest(request.status)) throw new Error("Photo request unavailable");
  await assertCanContact(ctx, seller._id, request.buyerId);
  const pending = await ctx.db.query("photoRequestPhotos").withIndex("by_user_request", q => q.eq("userId", seller._id).eq("requestId", request._id)).collect();
  if (pending.filter(row => !row.entryId && row.expiresAt > Date.now()).length >= 10) throw new Error("Attach or remove unused photos before uploading more");
  const now = Date.now();
  return ctx.db.insert("photoRequestPhotos", { userId: seller._id, requestId: request._id, token: args.token,
    status: "awaiting", createdAt: now, expiresAt: now + ABANDONED_MS });
} });

export const claimUpload = internalMutation({ args: { token: v.string() }, handler: async (ctx, { token }) => {
  const seller = await requireCurrentUser(ctx);
  const row = await ctx.db.query("photoRequestPhotos").withIndex("by_token", q => q.eq("token", token)).unique();
  if (!row || row.userId !== seller._id || row.status !== "awaiting" || row.createdAt + UPLOAD_LEASE_MS < Date.now()) throw new Error("Upload unavailable");
  await ctx.db.patch(row._id, { status: "uploading" });
  return row._id;
} });

export const recordSource = internalMutation({ args: { photoId: v.id("photoRequestPhotos"), storageId: v.id("_storage") }, handler: async (ctx, { photoId, storageId }) => {
  const row = await ctx.db.get(photoId);
  if (!row || row.status !== "uploading" || row.expiresAt < Date.now()) throw new Error("Upload expired");
  const owner = await ctx.db.get(row.userId);
  if (!owner || owner.deletedAt !== undefined) throw new Error("Upload unavailable");
  await ctx.db.patch(photoId, { sourceId: storageId, status: "uploaded" });
} });

export const claimProcessing = internalMutation({ args: { photoId: v.id("photoRequestPhotos"), storageId: v.id("_storage") }, handler: async (ctx, { photoId, storageId }) => {
  const seller = await requireCurrentUser(ctx);
  const row = await ctx.db.get(photoId);
  if (!row || row.userId !== seller._id || row.sourceId !== storageId || row.status !== "uploaded" || row.expiresAt < Date.now()) throw new Error("Upload unavailable");
  await ctx.db.patch(photoId, { status: "processing" });
} });

export const complete = internalMutation({ args: { photoId: v.id("photoRequestPhotos"), detailId: v.id("_storage") }, handler: async (ctx, { photoId, detailId }) => {
  const row = await ctx.db.get(photoId);
  if (!row || row.status !== "processing" || !row.sourceId) throw new Error("Upload unavailable");
  const owner = await ctx.db.get(row.userId);
  if (!owner || owner.deletedAt !== undefined) throw new Error("Upload unavailable");
  await ctx.storage.delete(row.sourceId);
  await ctx.db.patch(photoId, { detailId, sourceId: undefined, status: "ready", token: "" });
  return { photoId };
} });

export const discard = internalMutation({ args: { photoId: v.id("photoRequestPhotos") }, handler: async (ctx, { photoId }) => {
  const row = await ctx.db.get(photoId);
  if (row && !row.entryId) await removePhoto(ctx, row);
} });

export async function attachPhotos(ctx: MutationCtx, ids: Id<"photoRequestPhotos">[], sellerId: Id<"users">, requestId: Id<"photoRequests">) {
  if (ids.length > 10 || new Set(ids).size !== ids.length) throw new Error("Attach at most 10 different photos per reply");
  for (const id of ids) {
    const row = await ctx.db.get(id);
    if (!row || row.userId !== sellerId || row.requestId !== requestId || row.status !== "ready" || !row.detailId || row.entryId || row.expiresAt < Date.now()) throw new Error("Photo unavailable");
  }
  return ids;
}

export const authorizePhoto = internalMutation({ args: { photoId: v.id("photoRequestPhotos") }, handler: async (ctx, { photoId }) => {
  const user = await requireCurrentUser(ctx);
  const row = await ctx.db.get(photoId);
  if (!row?.entryId || !row.detailId) throw new Error("Photo unavailable");
  const request = await ctx.db.get(row.requestId);
  if (!request || (!isAdmin(user) && request.buyerId !== user._id && request.sellerId !== user._id)) throw new Error("Photo unavailable");
  const entry = await ctx.db.get(row.entryId);
  if (!entry || entry.requestId !== request._id || !(entry.photoIds ?? []).includes(photoId)) throw new Error("Photo unavailable");
  if (isAdmin(user) && request.buyerId !== user._id && request.sellerId !== user._id) {
    await ctx.db.insert("adminAuditLog", { actorId: user._id, targetUserId: request.sellerId, vehicleId: request.vehicleId,
      action: "photo_request_private_photo_accessed", source: "moderation", reason: `Authenticated access to private photo ${photoId}`, createdAt: Date.now() });
  }
  return row.detailId;
} });

export const cleanup = internalMutation({ args: {}, handler: async ctx => {
  const expired = await ctx.db.query("photoRequestPhotos").withIndex("by_expiry", q => q.lt("expiresAt", Date.now())).take(100);
  for (const row of expired) if (!row.entryId) await removePhoto(ctx, row);
  await ctx.scheduler.runAfter(0, internal.photoRequestMedia.cleanupStorage, { cursor: null });
} });

// Storage may succeed just before the action or HTTP upload is interrupted.
// Sweep only old blobs tagged for this private flow and absent from both row references.
export const cleanupStorage = internalMutation({
  args: { cursor: v.union(v.string(), v.null()) },
  handler: async (ctx, { cursor }) => {
    const page = await ctx.db.system.query("_storage").paginate({ cursor, numItems: 100 });
    for (const file of page.page) {
      if (!file.contentType?.endsWith("; gearboxe=photo-request-private") || file._creationTime > Date.now() - ABANDONED_MS) continue;
      const references = await Promise.all([
        ctx.db.query("photoRequestPhotos").withIndex("by_source", q => q.eq("sourceId", file._id)).first(),
        ctx.db.query("photoRequestPhotos").withIndex("by_detail", q => q.eq("detailId", file._id)).first(),
      ]);
      if (references.every(ref => ref === null)) await ctx.storage.delete(file._id);
    }
    if (!page.isDone) await ctx.scheduler.runAfter(0, internal.photoRequestMedia.cleanupStorage, { cursor: page.continueCursor });
  },
});
