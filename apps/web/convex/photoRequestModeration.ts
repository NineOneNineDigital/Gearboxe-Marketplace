import { v } from "convex/values";
import { action, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { requireAdmin, requireCurrentUser } from "./lib/authorization";
import { isPublicVehicle } from "./lib/vehicleVisibility";
import { listingRevision, nextRevision } from "./lib/listingLifecycle";
import { MAX_PHOTOS } from "./lib/mediaPolicy";

function captionText(value: string) {
  const text = value.trim();
  if (text.length > 200) throw new Error("Photo caption must be 200 characters or fewer");
  return text;
}

export const select = mutation({ args: { photoId: v.id("photoRequestPhotos"), caption: v.string() }, handler: async (ctx, { photoId, caption }) => {
  const seller = await requireCurrentUser(ctx);
  const photo = await ctx.db.get(photoId);
  if (!photo || photo.userId !== seller._id || !photo.entryId || !photo.detailId || photo.status !== "ready") throw new Error("Photo unavailable");
  const request = await ctx.db.get(photo.requestId);
  if (!request || request.sellerId !== seller._id) throw new Error("Photo unavailable");
  const entry = await ctx.db.get(photo.entryId);
  if (!entry || entry.requestId !== request._id || !(entry.photoIds ?? []).includes(photoId)) throw new Error("Photo unavailable");
  const vehicle = await ctx.db.get(request.vehicleId);
  if (!vehicle || vehicle.userId !== seller._id || !isPublicVehicle(vehicle)) throw new Error("Listing unavailable for public additions");
  const text = captionText(caption);
  const prior = await ctx.db.query("photoPublicSelections").withIndex("by_photo", q => q.eq("photoId", photoId)).unique();
  if (prior?.status === "approved") throw new Error("This photo is already public");
  const now = Date.now();
  if (prior) {
    await ctx.db.patch(prior._id, { caption: text, revision: prior.revision + 1, vehicleRevision: listingRevision(vehicle),
      status: "pending", reason: undefined, reviewerId: undefined, reviewedAt: undefined, createdAt: now });
    return prior._id;
  }
  return ctx.db.insert("photoPublicSelections", { photoId, requestId: request._id, vehicleId: vehicle._id, sellerId: seller._id,
    caption: text, revision: 1, vehicleRevision: listingRevision(vehicle), status: "pending", createdAt: now });
} });

export const mySelections = query({ args: { requestId: v.id("photoRequests") }, handler: async (ctx, { requestId }) => {
  const seller = await requireCurrentUser(ctx);
  const request = await ctx.db.get(requestId);
  if (!request || request.sellerId !== seller._id) throw new Error("Photo request unavailable");
  const rows = await ctx.db.query("photoPublicSelections").withIndex("by_request", q => q.eq("requestId", requestId)).collect();
  return rows.filter(row => row.sellerId === seller._id).map(row => ({ _id: row._id, photoId: row.photoId, caption: row.caption,
    status: row.status, reason: row.reason, createdAt: row.createdAt, reviewedAt: row.reviewedAt }));
} });

export const adminQueue = query({ args: {}, handler: async ctx => {
  await requireAdmin(ctx);
  const rows = await ctx.db.query("photoPublicSelections").withIndex("by_status", q => q.eq("status", "pending")).order("asc").take(50);
  return Promise.all(rows.map(async row => {
    const vehicle = await ctx.db.get(row.vehicleId);
    return { _id: row._id, photoId: row.photoId, caption: row.caption, revision: row.revision, createdAt: row.createdAt,
      vehicleId: row.vehicleId, vehicleTitle: vehicle?.title ?? "Listing unavailable", vehicleStatus: vehicle?.status ?? "unavailable" };
  }));
} });

export const reject = mutation({ args: { selectionId: v.id("photoPublicSelections"), reason: v.string() }, handler: async (ctx, { selectionId, reason }) => {
  const admin = await requireAdmin(ctx);
  const row = await ctx.db.get(selectionId);
  if (!row || row.status !== "pending") throw new Error("Selection changed; refresh the queue");
  const detail = reason.trim();
  if (detail.length < 5 || detail.length > 1000) throw new Error("Give a rejection reason of 5–1,000 characters");
  const now = Date.now();
  await ctx.db.patch(selectionId, { status: "rejected", reason: detail, reviewerId: admin._id, reviewedAt: now });
  await ctx.db.insert("adminAuditLog", { actorId: admin._id, targetUserId: row.sellerId, vehicleId: row.vehicleId,
    action: "photo_public_addition_rejected", source: "moderation", reason: detail, createdAt: now });
} });

export const approvalSnapshot = internalQuery({ args: { selectionId: v.id("photoPublicSelections") }, handler: async (ctx, { selectionId }) => {
  const admin = await requireAdmin(ctx);
  const row = await ctx.db.get(selectionId);
  if (!row || row.status !== "pending") throw new Error("Selection changed; refresh the queue");
  if (row.sellerId === admin._id) throw new Error("Another moderator must approve your photo");
  const seller = await ctx.db.get(row.sellerId);
  if (!seller || seller.deletedAt !== undefined) throw new Error("Seller account unavailable");
  const photo = await ctx.db.get(row.photoId);
  if (!photo?.detailId || !photo.entryId || photo.status !== "ready" || photo.requestId !== row.requestId) throw new Error("Private photo unavailable");
  return { detailId: photo.detailId, revision: row.revision, vehicleRevision: row.vehicleRevision };
} });

export const completeApproval = internalMutation({ args: { selectionId: v.id("photoPublicSelections"), revision: v.number(), vehicleRevision: v.number(), detailId: v.id("_storage"), thumbnailId: v.id("_storage") }, handler: async (ctx, args) => {
  const admin = await requireAdmin(ctx);
  const row = await ctx.db.get(args.selectionId);
  if (!row || row.status !== "pending" || row.revision !== args.revision || row.vehicleRevision !== args.vehicleRevision) return false;
  if (row.sellerId === admin._id) throw new Error("Another moderator must approve your photo");
  const photo = await ctx.db.get(row.photoId);
  const request = await ctx.db.get(row.requestId);
  const vehicle = await ctx.db.get(row.vehicleId);
  const seller = await ctx.db.get(row.sellerId);
  const valid = !!photo?.detailId && !!photo.entryId && photo.status === "ready" && photo.requestId === row.requestId &&
    !!request && request.sellerId === row.sellerId && request.vehicleId === row.vehicleId &&
    !!seller && seller.deletedAt === undefined &&
    !!vehicle && vehicle.userId === row.sellerId && isPublicVehicle(vehicle) && listingRevision(vehicle) === row.vehicleRevision &&
    vehicle.photos.length + (vehicle.media?.length ?? 0) < MAX_PHOTOS;
  if (!valid) {
    await ctx.db.patch(row._id, { status: "stale", reason: "Listing or private photo changed during review", reviewedAt: Date.now(), reviewerId: admin._id });
    return false;
  }
  const entry = await ctx.db.get(photo.entryId!);
  if (!entry || entry.requestId !== request!._id || !(entry.photoIds ?? []).includes(photo._id)) {
    await ctx.db.patch(row._id, { status: "stale", reason: "Private reply changed during review", reviewedAt: Date.now(), reviewerId: admin._id });
    return false;
  }
  const now = Date.now();
  const mediaId = await ctx.db.insert("vehicleMedia", { userId: row.sellerId, vehicleId: vehicle!._id, token: "", status: "ready",
    detailId: args.detailId, thumbnailId: args.thumbnailId, createdAt: now, expiresAt: Number.MAX_SAFE_INTEGER });
  await ctx.db.patch(vehicle!._id, { media: [...(vehicle!.media ?? []), { id: mediaId, caption: row.caption }], updatedAt: nextRevision(vehicle!) });
  await ctx.db.patch(row._id, { status: "approved", reviewerId: admin._id, reviewedAt: now, publicMediaId: mediaId });
  await ctx.db.insert("adminAuditLog", { actorId: admin._id, targetUserId: row.sellerId, vehicleId: row.vehicleId,
    action: "photo_public_addition_approved", source: "moderation", reason: `Approved selected private photo ${row.photoId}`, createdAt: now });
  return true;
} });

export const approve = action({ args: { selectionId: v.id("photoPublicSelections") }, handler: async (ctx, { selectionId }): Promise<boolean> => {
  const snapshot = await ctx.runQuery(internal.photoRequestModeration.approvalSnapshot, { selectionId });
  const copies: { detailId: Id<"_storage">; thumbnailId: Id<"_storage"> } = await ctx.runAction(internal.photoRequestModerationProcessing.copyForPublic, { sourceId: snapshot.detailId });
  try {
    const approved = await ctx.runMutation(internal.photoRequestModeration.completeApproval, { selectionId, revision: snapshot.revision,
      vehicleRevision: snapshot.vehicleRevision, ...copies });
    if (!approved) await ctx.runAction(internal.photoRequestModerationProcessing.discardCopy, copies);
    return approved;
  } catch (error) {
    await ctx.runAction(internal.photoRequestModerationProcessing.discardCopy, copies);
    throw error;
  }
} });
