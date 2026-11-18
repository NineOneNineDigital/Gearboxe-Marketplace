import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { syncDiscovery } from "./lib/discoveryIndex";
import { onOfferListingTransition } from "./lib/offerListing";
import { removeMedia } from "./mediaRecords";

const phases = ["vehicles", "wanted", "photoPublicSelections", "ownershipUploadLeases", "vinDecodeLimits", "trustRateLimits", "userBlocks", "photoRequestUploads", "wantedReplyUploads", "comparisons", "favorites", "savedSearches", "recentViews", "notifications", "listingNotifications", "emailOutbox", "vehicleMedia", "done"] as const;
type Phase = typeof phases[number];
const phaseValidator = v.union(...phases.map(phase => v.literal(phase)));

// Recovery entry point for deployment operators when a scheduled page fails.
// Starting at the first phase is safe because every phase is repeatable and
// public reads already hide content owned by the tombstone.
export const restart = internalMutation({
  args: { clerkUserId: v.string(), reason: v.string() },
  handler: async (ctx, { clerkUserId, reason }) => {
    const detail = reason.trim();
    if (detail.length < 10 || detail.length > 500) throw new Error("A recovery reason of 10–500 characters is required");
    const user = await ctx.db.query("users").withIndex("byExternalId", q => q.eq("externalId", clerkUserId)).unique();
    if (!user || user.deletedAt === undefined) throw new Error("Deleted account not found");
    await ctx.db.insert("adminAuditLog", {
      action: "account_deletion_cleanup_restarted", targetUserId: user._id,
      source: "operator_cli", reason: detail, createdAt: Date.now(),
    });
    await ctx.scheduler.runAfter(0, internal.accountDeletion.cleanup, { userId: user._id, phase: "vehicles", cursor: null });
    return { scheduled: true };
  },
});

async function continueAt(ctx: MutationCtx, userId: Id<"users">, phase: Phase, isDone: boolean, cursor: string) {
  if (!isDone) {
    await ctx.scheduler.runAfter(0, internal.accountDeletion.cleanup, { userId, phase, cursor });
    return;
  }
  const next = phases[phases.indexOf(phase) + 1];
  if (next && next !== "done") await ctx.scheduler.runAfter(0, internal.accountDeletion.cleanup, { userId, phase: next, cursor: null });
}

// Bounded, repeatable cleanup. Public reads inspect the user tombstone, so no
// listing or request is exposed while these pages are still processing.
export const cleanup = internalMutation({
  args: { userId: v.id("users"), phase: phaseValidator, cursor: v.union(v.string(), v.null()) },
  handler: async (ctx, { userId, phase, cursor }) => {
    const user = await ctx.db.get(userId);
    if (!user || user.deletedAt === undefined || phase === "done") return;
    if (phase === "vehicles") {
      const page = await ctx.db.query("vehicles").withIndex("by_user", q => q.eq("userId", userId)).paginate({ cursor, numItems: 1 });
      for (const vehicle of page.page) {
        // A reserved winner must be closed before archival so the buyer is not
        // left with an accepted deal that can never reach an outcome.
        await onOfferListingTransition(ctx, vehicle, "archived", { moderation: true });
        // Keep the row for offer references, but remove its public content and
        // all public media. Private conversation attachments are separate.
        await ctx.db.patch(vehicle._id, { status: "archived", moderationRemovedAt: user.deletedAt,
          photos: [], media: [], contactInfo: "", description: "", vin: undefined, vinKey: undefined,
          lienPayoffPlan: undefined, location: undefined, updatedAt: Date.now() });
        for (const ref of vehicle.media ?? []) {
          const media = await ctx.db.get(ref.id);
          if (media?.vehicleId === vehicle._id) await removeMedia(ctx, media);
        }
        await syncDiscovery(ctx, vehicle._id);
      }
      await continueAt(ctx, userId, phase, page.isDone, page.continueCursor);
      return;
    }
    if (phase === "wanted") {
      const page = await ctx.db.query("wantedRequests").withIndex("by_user_created", q => q.eq("userId", userId)).paginate({ cursor, numItems: 20 });
      for (const row of page.page) await ctx.db.patch(row._id, { status: "deleted", deletedAt: user.deletedAt,
        title: "", maxBudget: 0, zip: "", area: "", radiusMiles: undefined, make: undefined,
        model: undefined, yearMin: undefined, yearMax: undefined, maxMileage: undefined,
        transmission: undefined, details: undefined, updatedAt: Date.now() });
      await continueAt(ctx, userId, phase, page.isDone, page.continueCursor);
      return;
    }
    if (phase === "photoPublicSelections") {
      const page = await ctx.db.query("photoPublicSelections").withIndex("by_seller", q => q.eq("sellerId", userId)).paginate({ cursor, numItems: 30 });
      for (const row of page.page) if (row.status === "pending") await ctx.db.patch(row._id, {
        status: "stale", reason: "Seller account deleted", reviewedAt: Date.now(),
      });
      await continueAt(ctx, userId, phase, page.isDone, page.continueCursor);
      return;
    }
    if (phase === "ownershipUploadLeases") {
      const page = await ctx.db.query("ownershipUploadLeases").withIndex("by_user", q => q.eq("userId", userId)).paginate({ cursor, numItems: 50 });
      for (const row of page.page) await ctx.db.delete(row._id);
      await continueAt(ctx, userId, phase, page.isDone, page.continueCursor);
      return;
    }
    if (phase === "vinDecodeLimits") {
      const page = await ctx.db.query("vinDecodeLimits").withIndex("by_user", q => q.eq("userId", userId)).paginate({ cursor, numItems: 50 });
      for (const row of page.page) await ctx.db.delete(row._id);
      await continueAt(ctx, userId, phase, page.isDone, page.continueCursor);
      return;
    }
    if (phase === "trustRateLimits") {
      const page = await ctx.db.query("trustRateLimits").withIndex("by_user_action", q => q.eq("userId", userId)).paginate({ cursor, numItems: 50 });
      for (const row of page.page) await ctx.db.delete(row._id);
      await continueAt(ctx, userId, phase, page.isDone, page.continueCursor);
      return;
    }
    if (phase === "userBlocks") {
      const page = await ctx.db.query("userBlocks").withIndex("by_user", q => q.eq("userId", userId)).paginate({ cursor, numItems: 50 });
      for (const row of page.page) await ctx.db.delete(row._id);
      await continueAt(ctx, userId, phase, page.isDone, page.continueCursor);
      return;
    }
    if (phase === "photoRequestUploads") {
      const page = await ctx.db.query("photoRequestPhotos").withIndex("by_user_request", q => q.eq("userId", userId)).paginate({ cursor, numItems: 20 });
      for (const row of page.page) {
        // A photo attached to a message remains participant-only history.
        if (row.entryId) continue;
        for (const storageId of new Set([row.sourceId, row.detailId].filter(id => id !== undefined)))
          await ctx.storage.delete(storageId);
        await ctx.db.delete(row._id);
      }
      await continueAt(ctx, userId, phase, page.isDone, page.continueCursor);
      return;
    }
    if (phase === "wantedReplyUploads") {
      const page = await ctx.db.query("wantedReplyPhotos").withIndex("by_user_request", q => q.eq("userId", userId)).paginate({ cursor, numItems: 20 });
      for (const row of page.page) {
        if (row.messageId) continue;
        for (const storageId of new Set([row.sourceId, row.detailId].filter(id => id !== undefined)))
          await ctx.storage.delete(storageId);
        await ctx.db.delete(row._id);
      }
      await continueAt(ctx, userId, phase, page.isDone, page.continueCursor);
      return;
    }
    if (phase === "emailOutbox") {
      const page = await ctx.db.query("emailOutbox").withIndex("by_user", q => q.eq("userId", userId)).paginate({ cursor, numItems: 30 });
      for (const row of page.page) await ctx.db.patch(row._id, { status: ["pending", "sending"].includes(row.status) ? "skipped" : row.status,
        recipientEmail: undefined, unsubscribeToken: undefined, leaseToken: undefined, leaseExpiresAt: undefined,
        updatedAt: Date.now() });
      await continueAt(ctx, userId, phase, page.isDone, page.continueCursor);
      return;
    }
    if (phase === "comparisons") {
      const page = await ctx.db.query("comparisons").withIndex("by_user", q => q.eq("userId", userId)).paginate({ cursor, numItems: 50 });
      for (const row of page.page) await ctx.db.delete(row._id);
      await continueAt(ctx, userId, phase, page.isDone, page.continueCursor);
      return;
    }
    if (phase === "favorites") {
      const page = await ctx.db.query("favorites").withIndex("by_user", q => q.eq("userId", userId)).paginate({ cursor, numItems: 50 });
      for (const row of page.page) await ctx.db.delete(row._id);
      await continueAt(ctx, userId, phase, page.isDone, page.continueCursor);
      return;
    }
    if (phase === "savedSearches") {
      const page = await ctx.db.query("savedSearches").withIndex("by_user", q => q.eq("userId", userId)).paginate({ cursor, numItems: 50 });
      for (const row of page.page) await ctx.db.delete(row._id);
      await continueAt(ctx, userId, phase, page.isDone, page.continueCursor);
      return;
    }
    if (phase === "recentViews") {
      const page = await ctx.db.query("recentViews").withIndex("by_user_time", q => q.eq("userId", userId)).paginate({ cursor, numItems: 50 });
      for (const row of page.page) await ctx.db.delete(row._id);
      await continueAt(ctx, userId, phase, page.isDone, page.continueCursor);
      return;
    }
    if (phase === "notifications") {
      const page = await ctx.db.query("notifications").withIndex("by_user", q => q.eq("userId", userId)).paginate({ cursor, numItems: 50 });
      for (const row of page.page) await ctx.db.delete(row._id);
      await continueAt(ctx, userId, phase, page.isDone, page.continueCursor);
      return;
    }
    if (phase === "listingNotifications") {
      const page = await ctx.db.query("listingNotifications").withIndex("by_user", q => q.eq("userId", userId)).paginate({ cursor, numItems: 50 });
      for (const row of page.page) await ctx.db.delete(row._id);
      await continueAt(ctx, userId, phase, page.isDone, page.continueCursor);
      return;
    }
    if (phase === "vehicleMedia") {
      const page = await ctx.db.query("vehicleMedia").withIndex("by_user", q => q.eq("userId", userId)).paginate({ cursor, numItems: 20 });
      // Also remove media whose listing reference was missed by an old or
      // partially completed media array. Conversation photos use other tables.
      for (const row of page.page) await removeMedia(ctx, row);
      await continueAt(ctx, userId, phase, page.isDone, page.continueCursor);
    }
  },
});
