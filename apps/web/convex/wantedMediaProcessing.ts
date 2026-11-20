"use node";

import { randomUUID } from "node:crypto";
import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { processImage } from "./lib/imageProcessing";
import type { Id } from "./_generated/dataModel";

export const issueUpload = internalAction({ args: { requestId: v.id("wantedRequests"), conversationId: v.optional(v.id("wantedConversations")) }, handler: async (ctx, args): Promise<{ photoId: Id<"wantedReplyPhotos">; uploadUrl: string }> => {
  const site = process.env.CONVEX_SITE_URL;
  if (!site || !process.env.APP_URL) throw new Error("Private photo uploads are not configured");
  const token = randomUUID();
  const photoId = await ctx.runMutation(internal.wantedMedia.createLease, { ...args, token });
  return { photoId, uploadUrl: `${site}/wanted-media/upload?token=${token}` };
} });

export const processUpload = internalAction({ args: { photoId: v.id("wantedReplyPhotos"), storageId: v.id("_storage") }, handler: async (ctx, { photoId, storageId }): Promise<{ photoId: Id<"wantedReplyPhotos"> }> => {
  let detailId: Id<"_storage"> | undefined;
  try {
    const source = await ctx.storage.get(storageId);
    if (!source) throw new Error("Photo unavailable");
    const processed = await processImage(new Uint8Array(await source.arrayBuffer()), source.type.split(";")[0]);
    detailId = await ctx.storage.store(new Blob([new Uint8Array(processed.detail)], { type: "image/webp; gearboxe=wanted-private-media" }));
    return await ctx.runMutation(internal.wantedMedia.complete, { photoId, detailId });
  } catch {
    if (detailId) await ctx.storage.delete(detailId);
    await ctx.runMutation(internal.wantedMedia.discard, { photoId });
    throw new Error("Photo could not be processed. Use a valid JPEG, PNG or WebP image and retry.");
  }
} });
