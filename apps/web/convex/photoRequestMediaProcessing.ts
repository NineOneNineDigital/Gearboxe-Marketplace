"use node";

import { randomUUID } from "node:crypto";
import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { processImage } from "./lib/imageProcessing";
import type { Id } from "./_generated/dataModel";

export const issueUpload = internalAction({ args: { requestId: v.id("photoRequests") }, handler: async (ctx, { requestId }): Promise<{ photoId: Id<"photoRequestPhotos">; uploadUrl: string }> => {
  const site = process.env.CONVEX_SITE_URL;
  if (!site || !process.env.APP_URL) throw new Error("Private photo uploads are not configured");
  const token = randomUUID();
  const photoId = await ctx.runMutation(internal.photoRequestMedia.createLease, { requestId, token });
  return { photoId, uploadUrl: `${site}/photo-request-media/upload?token=${token}` };
} });

export const processUpload = internalAction({ args: { photoId: v.id("photoRequestPhotos"), storageId: v.id("_storage") }, handler: async (ctx, { photoId, storageId }): Promise<{ photoId: Id<"photoRequestPhotos"> }> => {
  let detailId: Id<"_storage"> | undefined;
  try {
    const source = await ctx.storage.get(storageId);
    if (!source) throw new Error("Photo unavailable");
    const processed = await processImage(new Uint8Array(await source.arrayBuffer()), source.type.split(";")[0]);
    detailId = await ctx.storage.store(new Blob([new Uint8Array(processed.detail)], { type: "image/webp; gearboxe=photo-request-private" }));
    return await ctx.runMutation(internal.photoRequestMedia.complete, { photoId, detailId });
  } catch {
    if (detailId) await ctx.storage.delete(detailId);
    await ctx.runMutation(internal.photoRequestMedia.discard, { photoId });
    throw new Error("Photo could not be processed. Use a valid JPEG, PNG or WebP image and retry.");
  }
} });
