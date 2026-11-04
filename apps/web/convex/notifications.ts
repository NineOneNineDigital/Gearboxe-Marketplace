import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { safeNotificationPath } from "./lib/emailPolicy";
import { getCurrentUser, requireAdmin } from "./lib/authorization";

export const defaultPreferences = { emailEnabled: true, messages: true, listings: true, favorites: true, events: true };
const categories = ["messages", "listings", "favorites", "events"] as const;
type Category = typeof categories[number];
async function account(ctx: QueryCtx | MutationCtx) {
  const user = await getCurrentUser(ctx);
  if (!user) throw new Error("Authentication required");
  return user;
}

interface NotificationInput {
  userId: Id<"users">;
  category: Category;
  kind: string;
  message: string;
  link: string;
  dedupeKey: string;
  vehicleId?: Id<"vehicles">;
  conversationId?: Id<"conversations">;
  registrationId?: Id<"registrations">;
  sourceUserId?: Id<"users">;
  email?: boolean;
}

// Called only by trusted domain mutations. Notification + outbox are committed
// with the originating change, so rolled-back payments/messages never send mail.
export async function enqueueNotification(ctx: MutationCtx, input: NotificationInput) {
  const existing = await ctx.db.query("notifications").withIndex("by_dedupe", q => q.eq("dedupeKey", input.dedupeKey)).unique();
  if (existing) return existing._id;
  if (!safeNotificationPath(input.link) || !categories.includes(input.category)) throw new Error("Invalid notification link or category");
  const user = await ctx.db.get(input.userId);
  if (!user) return null;
  const { email, sourceUserId, ...fields } = input;
  const now = Date.now();
  const id = await ctx.db.insert("notifications", { ...fields, createdAt: now });
  const prefs = user.notificationPreferences ?? defaultPreferences;
  if (email !== false && prefs.emailEnabled && prefs[input.category]) {
    const outbox = await ctx.db.query("emailOutbox").withIndex("by_event", q => q.eq("eventKey", input.dedupeKey)).unique();
    if (!outbox) {
      const deliveryId = await ctx.db.insert("emailOutbox", {
        userId: input.userId, sourceUserId, conversationId: input.conversationId,
        category: input.category, eventKey: input.dedupeKey,
        subject: subject(input.kind), message: emailMessage(input.kind), path: input.link,
        status: "pending", attempts: 0, nextAttemptAt: now, createdAt: now, updatedAt: now,
      });
      await ctx.scheduler.runAfter(0, internal.emailDelivery.deliver, { id: deliveryId });
    }
  }
  return id;
}
function subject(kind: string) {
  if (kind === "new_message") return "You have a new Gearboxe message";
  if (kind === "active") return "Your Gearboxe listing is approved";
  if (kind === "rejected") return "Your Gearboxe listing needs changes";
  if (kind === "event_payment") return "Your Gearboxe event payment is confirmed";
  if (kind === "event_checkin") return "Your Gearboxe event check-in is confirmed";
  if (kind === "event_refund") return "Your Gearboxe event payment was refunded";
  if (kind === "event_cancellation") return "Your Gearboxe event was cancelled";
  if (kind === "event_waitlist") return "A Gearboxe event place is available";
  return "A Gearboxe listing update";
}
function emailMessage(kind: string) {
  // Email deliberately excludes message content, VIN, contact details, private
  // moderator reasons and event admission/QR credentials.
  if (kind === "new_message") return "You received a new message. Sign in to read it and reply.";
  if (kind === "active") return "Your listing was approved and is now available on Gearboxe.";
  if (kind === "rejected") return "Your listing needs changes. Sign in to review the moderator feedback.";
  if (kind === "event_payment") return "Your event registration payment was confirmed. Sign in to view your registration.";
  if (kind === "event_checkin") return "You were checked in to your Gearboxe event.";
  if (kind === "event_refund") return "Your event payment refund was confirmed. Sign in to view the payment details.";
  if (kind === "event_cancellation") return "Your event was cancelled. Sign in to view your registration and refund status.";
  if (kind === "event_waitlist") return "A place is reserved for your waitlisted vehicle for a limited time. Sign in to review the event rules, fee, and checkout deadline.";
  if (kind === "new_favorite") return "A shopper saved your listing. Sign in to view listing activity.";
  return "A listing you follow has changed status. Sign in to view the update.";
}

export async function notifySeller(ctx: MutationCtx, userId: Id<"users">, vehicleId: Id<"vehicles">, kind: string, message: string) {
  // Retain the legacy inbox through migration; new UI uses the unified inbox.
  const legacyId = await ctx.db.insert("listingNotifications", { userId, vehicleId, kind, message, createdAt: Date.now() });
  await enqueueNotification(ctx, { userId, vehicleId, category: "listings", kind, message,
    link: `/myAccount/my-listings#listing-${vehicleId}`, dedupeKey: `listing:${legacyId}`,
    email: ["active", "rejected", "moderation"].includes(kind) });
}

export async function notifyListingFollowers(ctx: MutationCtx, vehicleId: Id<"vehicles">, kind: string, revision: number) {
  if (!["active", "reserved", "sold", "withdrawn", "archived"].includes(kind)) return;
  await ctx.scheduler.runAfter(0, internal.notifications.notifyFollowers, { vehicleId, kind, revision, cursor: null });
}
export const notifyFollowers = internalMutation({
  args: { vehicleId: v.id("vehicles"), kind: v.string(), revision: v.number(), cursor: v.union(v.string(), v.null()) },
  handler: async (ctx, args) => {
    const vehicle = await ctx.db.get(args.vehicleId);
    if (!vehicle) return;
    const page = await ctx.db.query("favorites").withIndex("by_vehicle", q => q.eq("vehicleId", args.vehicleId)).paginate({ cursor: args.cursor, numItems: 50 });
    for (const favorite of page.page) {
      if (favorite.userId === vehicle.userId) continue;
      await enqueueNotification(ctx, { userId: favorite.userId, sourceUserId: vehicle.userId, category: "favorites", kind: "listing_status",
        message: `A saved listing was marked ${args.kind}.`, vehicleId: vehicle._id,
        link: "/myAccount/favorites", dedupeKey: `favorite-status:${vehicle._id}:${args.revision}:${favorite.userId}` });
    }
    if (!page.isDone) await ctx.scheduler.runAfter(0, internal.notifications.notifyFollowers, { ...args, cursor: page.continueCursor });
  },
});

export const list = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const user = await account(ctx);
    if (!Number.isInteger(args.paginationOpts.numItems) || args.paginationOpts.numItems < 1) throw new Error("Invalid page size");
    return ctx.db.query("notifications").withIndex("by_user", q => q.eq("userId", user._id)).order("desc").paginate({ ...args.paginationOpts, numItems: Math.min(50, args.paginationOpts.numItems) });
  },
});
export const legacyList = query({ args: {}, handler: async ctx => {
  const user = await account(ctx);
  return ctx.db.query("listingNotifications").withIndex("by_user", q => q.eq("userId", user._id)).order("desc").take(50);
} });
export const markRead = mutation({
  args: { id: v.id("notifications") },
  handler: async (ctx, { id }) => {
    const user = await account(ctx);
    const notification = await ctx.db.get(id);
    if (!notification || notification.userId !== user._id) throw new Error("Notification not found");
    if (notification.readAt === undefined) await ctx.db.patch(id, { readAt: Date.now() });
  },
});
const preferenceArgs = { emailEnabled: v.boolean(), messages: v.boolean(), listings: v.boolean(), favorites: v.boolean(), events: v.boolean() };
export const preferences = query({ args: {}, handler: async ctx => {
  const user = await account(ctx);
  const suppression = await ctx.db.query("emailSuppressions").withIndex("by_email", q => q.eq("email", user.email.trim().toLowerCase())).unique();
  return { ...(user.notificationPreferences ?? defaultPreferences), emailSuppressed: !!suppression };
} });
export const updatePreferences = mutation({ args: preferenceArgs, handler: async (ctx, args) => {
  const user = await account(ctx);
  await ctx.db.patch(user._id, { notificationPreferences: args });
} });
export const adminDeliveries = query({ args: { paginationOpts: paginationOptsValidator }, handler: async (ctx, args) => {
  await requireAdmin(ctx);
  const page = await ctx.db.query("emailOutbox").order("desc").paginate({ ...args.paginationOpts, numItems: Math.max(1, Math.min(50, args.paginationOpts.numItems)) });
  // Do not return unsubscribe capabilities or recipient contact values.
  return { ...page, page: page.page.map(row => ({ _id: row._id, userId: row.userId, category: row.category, status: row.status, attempts: row.attempts, providerId: row.providerId, lastError: row.lastError, nextAttemptAt: row.nextAttemptAt, createdAt: row.createdAt, updatedAt: row.updatedAt })) };
} });

// Operator-only resumable migration. Historical entries never enqueue email.
export const backfillLegacy = internalMutation({ args: { cursor: v.union(v.string(), v.null()) }, handler: async (ctx, { cursor }) => {
  const page = await ctx.db.query("listingNotifications").paginate({ cursor, numItems: 50 });
  for (const row of page.page) {
    const existing = await ctx.db.query("notifications").withIndex("by_dedupe", q => q.eq("dedupeKey", `listing:${row._id}`)).unique();
    if (existing) continue;
    const id = await enqueueNotification(ctx, { userId: row.userId, vehicleId: row.vehicleId, category: "listings", kind: row.kind, message: row.message, link: `/myAccount/my-listings#listing-${row.vehicleId}`, dedupeKey: `listing:${row._id}`, email: false });
    if (id) await ctx.db.patch(id, { createdAt: row.createdAt, readAt: row.readAt });
  }
  return { isDone: page.isDone, continueCursor: page.continueCursor };
} });
