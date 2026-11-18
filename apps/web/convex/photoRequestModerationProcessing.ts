"use node";

import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { processImage } from "./lib/imageProcessing";
import type { Id } from "./_generated/dataModel";

export const copyForPublic = internalAction({ args: { sourceId: v.id("_storage") }, handler: async (ctx, { sourceId }): Promise<{ detailId: Id<"_storage">; thumbnailId: Id<"_storage"> }> => {
  const source = await ctx.storage.get(sourceId);
  if (!source) throw new Error("Private photo unavailable");
  const processed = await processImage(new Uint8Array(await source.arrayBuffer()), "image/webp");
  let detailId: Id<"_storage"> | undefined;
  try {
    detailId = await ctx.storage.store(new Blob([new Uint8Array(processed.detail)], { type: "image/webp; gearboxe=vehicle-media" }));
    const thumbnailId = await ctx.storage.store(new Blob([new Uint8Array(processed.thumbnail)], { type: "image/webp; gearboxe=vehicle-media" }));
    return { detailId, thumbnailId };
  } catch (error) {
    if (detailId) await ctx.storage.delete(detailId);
    throw error;
  }
} });

export const discardCopy = internalAction({ args: { detailId: v.id("_storage"), thumbnailId: v.id("_storage") }, handler: async (ctx, { detailId, thumbnailId }) => {
  await Promise.all([ctx.storage.delete(detailId), ctx.storage.delete(thumbnailId)]);
} });
