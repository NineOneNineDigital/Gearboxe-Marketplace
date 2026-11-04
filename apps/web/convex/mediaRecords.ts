import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { requireCurrentUser } from "./lib/authorization";
import { internal } from "./_generated/api";
import type { MutationCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";

export async function removeMedia(ctx: MutationCtx, media: Doc<"vehicleMedia">) {
  for (const id of [media.sourceId, media.thumbnailId, media.detailId]) {
    if (id) await ctx.storage.delete(id);
  }
  await ctx.db.delete(media._id);
}

export const createLease = internalMutation({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const user = await requireCurrentUser(ctx);
    const pending = await ctx.db.query("vehicleMedia").withIndex("by_user", q => q.eq("userId", user._id)).collect();
    if (pending.filter(m => !m.vehicleId && m.expiresAt > Date.now()).length >= 30) throw new Error("Remove unused uploads before adding more photos");
    return ctx.db.insert("vehicleMedia", { userId: user._id, token, status: "awaiting", createdAt: Date.now(), expiresAt: Date.now() + 24 * 60 * 60 * 1000 });
  },
});

export const claimUpload = internalMutation({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const media = await ctx.db.query("vehicleMedia").withIndex("by_token", q => q.eq("token", token)).unique();
    if (!media || media.status !== "awaiting" || Date.now() - media.createdAt > 60 * 60 * 1000) throw new Error("Upload link expired; retry the upload");
    await ctx.db.patch(media._id, { status: "uploading" });
    return media._id;
  },
});

export const recordSource = internalMutation({
  args: { mediaId: v.id("vehicleMedia"), storageId: v.id("_storage") },
  handler: async (ctx, { mediaId, storageId }) => {
    const media = await ctx.db.get(mediaId);
    if (!media || media.status !== "uploading" || media.expiresAt < Date.now()) throw new Error("Upload expired; retry");
    await ctx.db.patch(mediaId, { sourceId: storageId, status: "uploaded" });
  },
});

export const claimProcessing = internalMutation({
  args: { mediaId: v.id("vehicleMedia"), storageId: v.id("_storage") },
  handler: async (ctx, { mediaId, storageId }) => {
    const user = await requireCurrentUser(ctx);
    const media = await ctx.db.get(mediaId);
    if (!media || media.userId !== user._id || media.sourceId !== storageId || media.status !== "uploaded" || media.expiresAt < Date.now()) throw new Error("Upload unavailable; retry the upload");
    await ctx.db.patch(mediaId, { status: "processing" });
  },
});

export const recordVariant = internalMutation({
  args: { mediaId: v.id("vehicleMedia"), storageId: v.id("_storage"), kind: v.union(v.literal("thumbnail"), v.literal("detail")) },
  handler: async (ctx, { mediaId, storageId, kind }) => {
    const media = await ctx.db.get(mediaId);
    if (!media || media.status !== "processing") throw new Error("Upload cancelled");
    await ctx.db.patch(mediaId, kind === "thumbnail" ? { thumbnailId: storageId } : { detailId: storageId });
  },
});

export const complete = internalMutation({
  args: { mediaId: v.id("vehicleMedia") },
  handler: async (ctx, { mediaId }) => {
    const media = await ctx.db.get(mediaId);
    if (!media || media.status !== "processing" || !media.thumbnailId || !media.detailId) throw new Error("Upload cancelled");
    const url = await ctx.storage.getUrl(media.detailId);
    const thumbnailUrl = await ctx.storage.getUrl(media.thumbnailId);
    if (!url || !thumbnailUrl) throw new Error("Photo storage unavailable");
    if (media.sourceId) await ctx.storage.delete(media.sourceId);
    await ctx.db.patch(mediaId, { sourceId: undefined, token: "", status: "ready" });
    return { id: mediaId, url, thumbnailUrl };
  },
});

export const discard = internalMutation({
  args: { mediaId: v.id("vehicleMedia") },
  handler: async (ctx, { mediaId }) => {
    const media = await ctx.db.get(mediaId);
    if (media && !media.vehicleId) await removeMedia(ctx, media);
  },
});

// Batched cleanup of abandoned tickets, original files and generated variants.
export const cleanup = internalMutation({
  args: {},
  handler: async ctx => {
    const expired = await ctx.db.query("vehicleMedia").withIndex("by_expiry", q => q.lt("expiresAt", Date.now())).take(100);
    for (const media of expired) {
      if (!media.vehicleId) await removeMedia(ctx, media);
      else await ctx.db.patch(media._id, { expiresAt: Number.MAX_SAFE_INTEGER });
    }
    await ctx.scheduler.runAfter(0, internal.mediaRecords.cleanupStorage, { cursor: null });
  },
});

// Sweep only media files tagged by our upload pipeline. This also catches a
// process interrupted between storage.store() and recording the storage ID,
// without deleting storage used by other application features.
export const cleanupStorage = internalMutation({
  args: { cursor: v.union(v.string(), v.null()) },
  handler: async (ctx, { cursor }) => {
    const page = await ctx.db.system.query("_storage").paginate({ cursor, numItems: 100 });
    for (const file of page.page) {
      if (!file.contentType?.endsWith("; gearboxe=vehicle-media") || file._creationTime > Date.now() - 24 * 60 * 60 * 1000) continue;
      const references = await Promise.all([
        ctx.db.query("vehicleMedia").withIndex("by_source", q => q.eq("sourceId", file._id)).first(),
        ctx.db.query("vehicleMedia").withIndex("by_thumbnail", q => q.eq("thumbnailId", file._id)).first(),
        ctx.db.query("vehicleMedia").withIndex("by_detail", q => q.eq("detailId", file._id)).first(),
      ]);
      if (references.every(ref => ref === null)) await ctx.storage.delete(file._id);
    }
    if (!page.isDone) await ctx.scheduler.runAfter(0, internal.mediaRecords.cleanupStorage, { cursor: page.continueCursor });
  },
});
