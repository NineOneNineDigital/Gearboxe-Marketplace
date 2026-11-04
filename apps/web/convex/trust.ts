import { v } from "convex/values";
import { internal } from "./_generated/api";
import { mutation, query, internalMutation } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { getCurrentUser, requireAdmin, requireCurrentUser } from "./lib/authorization";
import { consumeRateLimit } from "./lib/trustGuards";
import { DOCUMENT_RETENTION_MS, suspiciousIndicators, trustReason, trustText } from "./lib/trustPolicy";
import { assertSubmitReady, nextRevision } from "./lib/listingLifecycle";
import { notifySeller, notifyListingFollowers } from "./notifications";
import { syncDiscovery } from "./lib/discoveryIndex";
async function supportUser(ctx: QueryCtx | MutationCtx) {
  const user = await getCurrentUser(ctx);
  if (!user)
    throw new Error("Authentication required");
  return user;
}
async function audit(ctx: MutationCtx, actorId: Id<"users">, action: string, reason: string, target: {
  targetUserId?: Id<"users">;
  vehicleId?: Id<"vehicles">;
  reportId?: Id<"trustReports">;
} = {}) {
  await ctx.db.insert("adminAuditLog", {
    actorId, action, reason, source: "moderation", createdAt: Date.now(), ...target
  });
}
async function changeListingStatus(ctx: MutationCtx, vehicle: import("./_generated/dataModel").Doc<"vehicles">, actorId: Id<"users">, status: "archived" | "pending", reason: string) {
  const entry = {
    fromStatus: vehicle.status, toStatus: status, reason, actorId, createdAt: Date.now()
  };
  await ctx.db.patch(vehicle._id, {
    status, moderationRemovedAt: status === "archived" ? Date.now() : undefined, moderationReason: reason, updatedAt: nextRevision(vehicle), moderationHistory: [...(vehicle.moderationHistory ?? []), entry]
  });
  await ctx.db.insert("vehicleModerationLog", { vehicleId: vehicle._id, ...entry });
  await notifySeller(ctx, vehicle.userId, vehicle._id, "moderation", `Your listing was ${status === "archived" ? "taken down" : "returned for review"}. Reason: ${reason}. Visit Safety & support to appeal.`);
  await notifyListingFollowers(ctx, vehicle._id, status, entry.createdAt);
  await syncDiscovery(ctx, vehicle._id);
}
const reportArgs = { reason: v.string(), details: v.string() };

export const reportListing = mutation({
  args: { vehicleId: v.id("vehicles"), ...reportArgs },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    const vehicle = await ctx.db.get(args.vehicleId);
    if (!vehicle || vehicle.userId === user._id || !["active", "approved", "reserved", "sold"].includes(vehicle.status))
      throw new Error("Listing unavailable");
    await consumeRateLimit(ctx, user._id, "report");
    return ctx.db.insert("trustReports", {
      reporterId: user._id, targetUserId: vehicle.userId, vehicleId: vehicle._id, reason: trustReason(args.reason), details: trustText(args.details, "Report details"), status: "open", createdAt: Date.now(), updatedAt: Date.now()
    });
  }
});

export const reportUser = mutation({
  args: { targetUserId: v.id("users"), ...reportArgs },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    if (args.targetUserId === user._id || !await ctx.db.get(args.targetUserId))
      throw new Error("Choose another existing user");
    await consumeRateLimit(ctx, user._id, "report");
    return ctx.db.insert("trustReports", {
      reporterId: user._id, targetUserId: args.targetUserId, reason: trustReason(args.reason), details: trustText(args.details, "Report details"), status: "open", createdAt: Date.now(), updatedAt: Date.now()
    });
  }
});

export const setBlock = mutation({
  args: { targetUserId: v.id("users"), blocked: v.boolean() },
  handler: async (ctx, args) => {
    const user = await supportUser(ctx);
    if (args.targetUserId === user._id || !await ctx.db.get(args.targetUserId))
      throw new Error("Choose another existing user");
    const existing = await ctx.db.query("userBlocks").withIndex("by_pair", q => q.eq("userId", user._id).eq("blockedUserId", args.targetUserId)).unique();
    if (args.blocked && !existing)
      await ctx.db.insert("userBlocks", {
        userId: user._id, blockedUserId: args.targetUserId, createdAt: Date.now()
      });
    if (!args.blocked && existing)
      await ctx.db.delete(existing._id);
  }
});

export const attestOwnership = mutation({
  args: { vehicleId: v.id("vehicles") },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    const vehicle = await ctx.db.get(args.vehicleId);
    if (!vehicle || vehicle.userId !== user._id)
      throw new Error("Listing unavailable");
    await ctx.db.patch(vehicle._id, { ownershipAttestedAt: Date.now() });
  }
});

export const getMySafety = query({
  args: {},
  handler: async (ctx) => {
    const user = await supportUser(ctx);
    const [blocks, reports, appeals, documents, identity] = await Promise.all([
      ctx.db.query("userBlocks").withIndex("by_user", q => q.eq("userId", user._id)).collect(),
      ctx.db.query("trustReports").withIndex("by_reporter", q => q.eq("reporterId", user._id)).collect(),
      ctx.db.query("trustAppeals").withIndex("by_user", q => q.eq("userId", user._id)).collect(),
      ctx.db.query("ownershipDocuments").withIndex("by_user", q => q.eq("userId", user._id)).collect(),
      ctx.db.query("identityReviews").withIndex("by_user", q => q.eq("userId", user._id)).unique(),
    ]);
    return {
      user: {
        emailVerified: !!user.emailVerified, phoneVerified: !!user.phoneVerified, suspendedAt: user.suspendedAt, suspensionReason: user.suspensionReason
      },
      blocks: await Promise.all(blocks.map(async (block) => ({ ...block, name: (await ctx.db.get(block.blockedUserId))?.name ?? "Deleted account" }))), reports, appeals,
      documents: documents.map(({ storageId: _storageId, ...document }) => { void _storageId; return document; }), identity
    };
  }
});

export const requestIdentityReview = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireCurrentUser(ctx);
    const existing = await ctx.db.query("identityReviews").withIndex("by_user", q => q.eq("userId", user._id)).unique();
    if (existing && existing.status !== "rejected")
      return existing._id;
    await consumeRateLimit(ctx, user._id, "support");
    if (existing) {
      await ctx.db.patch(existing._id, {
        status: "pending", updatedAt: Date.now(), reviewerId: undefined, reason: undefined
      });
      return existing._id;
    }
    return ctx.db.insert("identityReviews", {
      userId: user._id, status: "pending", createdAt: Date.now(), updatedAt: Date.now()
    });
  }
});

export const submitAppeal = mutation({
  args: { reportId: v.optional(v.id("trustReports")), message: v.string() },
  handler: async (ctx, args) => {
    const user = await supportUser(ctx);
    if (args.reportId) {
      const report = await ctx.db.get(args.reportId);
      if (!report || (report.targetUserId !== user._id && report.reporterId !== user._id))
        throw new Error("Case unavailable");
    }
    await consumeRateLimit(ctx, user._id, "support");
    return ctx.db.insert("trustAppeals", {
      userId: user._id, reportId: args.reportId, message: trustText(args.message, "Appeal or support message"), status: "open", createdAt: Date.now(), updatedAt: Date.now()
    });
  }
});

export const adminQueue = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const [reportGroups, appealGroups, documents, identities] = await Promise.all([
      Promise.all((["escalated", "open", "reviewing"] as const).map(status =>
        ctx.db.query("trustReports")
          .withIndex("by_status", q => q.eq("status", status))
          .order("asc").take(100))),
      Promise.all((["open", "reviewing"] as const).map(status =>
        ctx.db.query("trustAppeals")
          .withIndex("by_status", q => q.eq("status", status))
          .order("asc").take(100))),
      ctx.db.query("ownershipDocuments").withIndex("by_status", q => q.eq("status", "pending")).order("asc").take(100),
      ctx.db.query("identityReviews").withIndex("by_status", q => q.eq("status", "pending")).order("asc").take(100),
    ]);
    const reports = await Promise.all(reportGroups.flat().map(async report => {
      const user = await ctx.db.get(report.targetUserId);
      // Three matching records suffice for the indicator; never load a target
      // account's entire reporting history for each queue row.
      const targetReports = await Promise.all((["open", "reviewing", "escalated"] as const).map(status =>
        ctx.db.query("trustReports").withIndex("by_target_status", q => q.eq("targetUserId", report.targetUserId).eq("status", status)).take(3)));
      return {
        ...report,
        indicators: suspiciousIndicators({
          accountAgeMs: Date.now() - (user?.createdAt ?? Date.now()),
          openReports: targetReports.flat().length,
          emailVerified: user?.emailVerified,
          phoneVerified: user?.phoneVerified,
        }),
      };
    }));
    return {
      reports,
      appeals: appealGroups.flat(),
      documents: documents.map(({ storageId: _storageId, ...document }) => {
        void _storageId;
        return document;
      }),
      identities,
    };
  },
});

export const caseNotes = query({
  args: { reportId: v.id("trustReports") },
  handler: async (ctx, args) => { await requireAdmin(ctx); return ctx.db.query("trustNotes").withIndex("by_report", q => q.eq("reportId", args.reportId)).collect(); }
});

export const auditLog = query({
  args: {},
  handler: async (ctx) => { await requireAdmin(ctx); return ctx.db.query("adminAuditLog").order("desc").take(200); }
});

export const moderateReport = mutation({
  args: {
    reportId: v.id("trustReports"), status: v.union(v.literal("reviewing"), v.literal("resolved"), v.literal("dismissed"), v.literal("escalated")), reason: v.string(), note: v.string()
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    if (!await ctx.db.get(args.reportId))
      throw new Error("Case unavailable");
    const reason = trustReason(args.reason);
    const note = trustText(args.note, "Moderation note");
    await ctx.db.patch(args.reportId, { status: args.status, updatedAt: Date.now() });
    await ctx.db.insert("trustNotes", {
      reportId: args.reportId, adminId: admin._id, note, reason, createdAt: Date.now()
    });
    await audit(ctx, admin._id, `report_${args.status}`, reason, { reportId: args.reportId });
  }
});

export const setSuspension = mutation({
  args: {
    targetUserId: v.id("users"), suspended: v.boolean(), reason: v.string()
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const target = await ctx.db.get(args.targetUserId);
    const reason = trustReason(args.reason);
    if (!target || target.role !== "user")
      throw new Error("Only regular user accounts can be suspended here");
    await ctx.db.patch(target._id, {
      suspendedAt: args.suspended ? Date.now() : undefined, suspensionReason: args.suspended ? reason : undefined
    });
    if (args.suspended)
      for (const vehicle of await ctx.db.query("vehicles").withIndex("by_user", q => q.eq("userId", target._id)).collect())
        if (["active", "approved", "pending", "reserved"].includes(vehicle.status)) {
          await changeListingStatus(ctx, vehicle, admin._id, "archived", reason);
          await audit(ctx, admin._id, "suspension_listing_takedown", reason, { targetUserId: target._id, vehicleId: vehicle._id });
        }
    await audit(ctx, admin._id, args.suspended ? "user_suspended" : "user_reinstated", reason, { targetUserId: target._id });
  }
});

export const takedownListing = mutation({
  args: { vehicleId: v.id("vehicles"), reason: v.string() },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const vehicle = await ctx.db.get(args.vehicleId);
    if (!vehicle)
      throw new Error("Listing unavailable");
    const reason = trustReason(args.reason);
    await changeListingStatus(ctx, vehicle, admin._id, "archived", reason);
    await audit(ctx, admin._id, "listing_takedown", reason, { vehicleId: vehicle._id, targetUserId: vehicle.userId });
  }
});

export const resolveAppeal = mutation({
  args: { appealId: v.id("trustAppeals"), response: v.string() },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const appeal = await ctx.db.get(args.appealId);
    if (!appeal)
      throw new Error("Appeal unavailable");
    const response = trustText(args.response, "Support response");
    await ctx.db.patch(appeal._id, {
      status: "resolved", response, updatedAt: Date.now()
    });
    await audit(ctx, admin._id, "appeal_resolved", "Support response issued", { targetUserId: appeal.userId, reportId: appeal.reportId });
  }
});

export const reviewIdentity = mutation({
  args: {
    reviewId: v.id("identityReviews"), verified: v.boolean(), reason: v.string()
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const review = await ctx.db.get(args.reviewId);
    if (!review)
      throw new Error("Review unavailable");
    const reason = trustText(args.reason, "Review reason");
    await ctx.db.patch(review._id, {
      status: args.verified ? "verified" : "rejected", reviewerId: admin._id, reason, updatedAt: Date.now()
    });
    await audit(ctx, admin._id, "identity_reviewed", args.verified ? "verified" : "rejected", { targetUserId: review.userId });
  }
});

export const reviewDocument = mutation({
  args: {
    documentId: v.id("ownershipDocuments"), verified: v.boolean(), reason: v.string()
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const document = await ctx.db.get(args.documentId);
    if (!document || document.expiresAt < Date.now())
      throw new Error("Document unavailable");
    const reason = trustText(args.reason, "Review reason");
    await ctx.db.patch(document._id, {
      status: args.verified ? "verified" : "rejected", reviewerId: admin._id, reason, reviewedAt: Date.now()
    });
    await audit(ctx, admin._id, "ownership_document_reviewed", args.verified ? "verified" : "rejected", { targetUserId: document.userId, vehicleId: document.vehicleId });
  }
});

export const createDocumentUpload = mutation({
  args: { vehicleId: v.optional(v.id("vehicles")) },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    if (args.vehicleId) {
      const vehicle = await ctx.db.get(args.vehicleId);
      if (!vehicle || vehicle.userId !== user._id)
        throw new Error("Listing unavailable");
    }
    await consumeRateLimit(ctx, user._id, "document");
    const token = crypto.randomUUID();
    await ctx.db.insert("ownershipUploadLeases", {
      userId: user._id, vehicleId: args.vehicleId, token, used: false, expiresAt: Date.now() + 600000
    });
    return {
      token, uploadUrl: `${process.env.CONVEX_SITE_URL}/trust/document`, retentionDays: DOCUMENT_RETENTION_MS / 86400000
    };
  }
});

export const cleanupDocuments = internalMutation({
  args: {},
  handler: async (ctx) => {
    const expired = await ctx.db.query("ownershipDocuments").withIndex("by_expiry", q => q.lt("expiresAt", Date.now())).take(100);
    for (const document of expired) {
      await ctx.storage.delete(document.storageId);
      await ctx.db.delete(document._id);
    }
    const leases = await ctx.db.query("ownershipUploadLeases").withIndex("by_expiry", q => q.lt("expiresAt", Date.now())).take(100);
    for (const lease of leases)
      await ctx.db.delete(lease._id);
    if (expired.length === 100 || leases.length === 100)
      await ctx.scheduler.runAfter(0, internal.trust.cleanupDocuments, {});
    await ctx.scheduler.runAfter(0, internal.trust.cleanupDocumentStorage, { cursor: null });
  }
});

export const restoreListing = mutation({
  args: { vehicleId: v.id("vehicles"), reason: v.string() },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const vehicle = await ctx.db.get(args.vehicleId);
    if (!vehicle || vehicle.status !== "archived")
      throw new Error("Only archived listings can be restored for review");
    const reason = trustText(args.reason, "Restoration reason");
    await assertSubmitReady(ctx, vehicle);
    await changeListingStatus(ctx, vehicle, admin._id, "pending", reason);
    await audit(ctx, admin._id, "listing_restored_for_review", "Restored for moderation review", { vehicleId: vehicle._id, targetUserId: vehicle.userId });
  }
});

export const cleanupDocumentStorage = internalMutation({
  args: { cursor: v.union(v.string(), v.null()) },
  handler: async (ctx, { cursor }) => {
    const page = await ctx.db.system.query("_storage").paginate({ cursor, numItems: 100 });
    for (const file of page.page) {
      if (!file.contentType?.endsWith("; gearboxe=ownership-document") || file._creationTime > Date.now() - 86400000)
        continue;
      const reference = await ctx.db.query("ownershipDocuments").withIndex("by_storage", q => q.eq("storageId", file._id)).first();
      if (!reference)
        await ctx.storage.delete(file._id);
    }
    if (!page.isDone)
      await ctx.scheduler.runAfter(0, internal.trust.cleanupDocumentStorage, { cursor: page.continueCursor });
  }
});
