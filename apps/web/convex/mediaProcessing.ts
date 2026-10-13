"use node";

import { randomUUID } from "node:crypto";
import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { processImage } from "./lib/imageProcessing";
import type { Id } from "./_generated/dataModel";

export const issueUpload = internalAction({
  args: {},
  handler: async (ctx): Promise<{ mediaId: Id<"vehicleMedia">; uploadUrl: string }> => {
    const token = randomUUID();
    const site = process.env.CONVEX_SITE_URL;
    if (!site || !process.env.APP_URL) throw new Error("Media uploads are not configured");
    const mediaId = await ctx.runMutation(internal.mediaRecords.createLease, { token });
    return { mediaId, uploadUrl: `${site}/vehicle-media/upload?token=${token}` };
  },
});

export const processUpload = internalAction({
  args: { mediaId: v.id("vehicleMedia"), storageId: v.id("_storage") },
  handler: async (ctx, { mediaId, storageId }): Promise<{ id: Id<"vehicleMedia">; url: string; thumbnailUrl: string }> => {
    const user = await ctx.runQuery(api.users.current, {});
    if (!user) throw new Error("Authentication required");
    const created: Id<"_storage">[] = [];
    try {
      const original = await ctx.storage.get(storageId);
      if (!original) throw new Error("Uploaded photo no longer exists; retry");
      const variants = await processImage(new Uint8Array(await original.arrayBuffer()), original.type.split(";")[0]);
      for (const kind of ["thumbnail", "detail"] as const) {
        const id = await ctx.storage.store(new Blob([new Uint8Array(variants[kind])], { type: "image/webp; gearboxe=vehicle-media" }));
        created.push(id);
        await ctx.runMutation(internal.mediaRecords.recordVariant, { mediaId, storageId: id, kind });
      }
      return await ctx.runMutation(internal.mediaRecords.complete, { mediaId });
    } catch {
      for (const id of created) await ctx.storage.delete(id);
      await ctx.runMutation(internal.mediaRecords.discard, { mediaId });
      throw new Error("Photo could not be processed. Use a valid JPEG, PNG or WebP image and retry.");
    }
  },
});
