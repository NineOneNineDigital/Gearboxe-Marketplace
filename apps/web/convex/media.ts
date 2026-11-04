import { v } from "convex/values";
import { action, mutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { requireCurrentUser } from "./lib/authorization";
import { removeMedia } from "./mediaRecords";
import type { Id } from "./_generated/dataModel";

export const beginUpload = action({
  args: {},
  handler: async (ctx): Promise<{ mediaId: Id<"vehicleMedia">; uploadUrl: string }> => ctx.runAction(internal.mediaProcessing.issueUpload, {}),
});

export const finalizeUpload = action({
  args: { mediaId: v.id("vehicleMedia"), storageId: v.id("_storage") },
  handler: async (ctx, args): Promise<{ id: Id<"vehicleMedia">; url: string; thumbnailUrl: string }> => {
    await ctx.runMutation(internal.mediaRecords.claimProcessing, args);
    return ctx.runAction(internal.mediaProcessing.processUpload, args);
  },
});

export const deleteUpload = mutation({
  args: { mediaId: v.id("vehicleMedia") },
  handler: async (ctx, { mediaId }) => {
    const user = await requireCurrentUser(ctx);
    const media = await ctx.db.get(mediaId);
    if (!media) return;
    if (media.userId !== user._id || media.vehicleId) throw new Error("Only your unattached uploads can be deleted here");
    await removeMedia(ctx, media);
  },
});
