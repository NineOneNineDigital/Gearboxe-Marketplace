import { defineTable } from "convex/server";
import { v } from "convex/values";

export const offerStatus = v.union(
  v.literal("open"), v.literal("reserved"), v.literal("awaiting_outcome"),
  v.literal("expired"), v.literal("declined"), v.literal("withdrawn"),
  v.literal("sold"), v.literal("released"), v.literal("listing_closed"),
);

export const offerTables = {
  offerCycles: defineTable({
    vehicleId: v.id("vehicles"), winner: v.optional(v.id("offerThreads")),
    closedAt: v.optional(v.number()), needsClosure: v.optional(v.literal(true)),
  }).index("by_vehicle_closed", ["vehicleId", "closedAt"]).index("by_work", ["needsClosure"]),
  offerThreads: defineTable({
    vehicleId: v.id("vehicles"), cycleId: v.id("offerCycles"), conversationId: v.id("conversations"),
    sellerId: v.id("users"), buyerId: v.id("users"), requestId: v.string(), initialPriceCents: v.number(),
    status: offerStatus, version: v.number(), proposalVersion: v.number(), senderId: v.id("users"),
    priceCents: v.number(), expiresAt: v.number(), createdAt: v.number(),
    acceptedAt: v.optional(v.number()), checkAt: v.optional(v.number()), nextCheckAt: v.optional(v.number()), needsReview: v.optional(v.literal(true)),
    selfExtended: v.optional(v.boolean()), closedAt: v.optional(v.number()), purgeAt: v.optional(v.number()),
  }).index("by_buyer_request", ["buyerId", "requestId"])
    .index("by_cycle_buyer_status", ["cycleId", "buyerId", "status"])
    .index("by_cycle_status", ["cycleId", "status"])
    .index("by_conversation", ["conversationId"])
    .index("by_status_expiry", ["status", "expiresAt"])
    .index("by_status_check", ["status", "nextCheckAt"])
    .index("by_review", ["needsReview"]).index("by_purge", ["purgeAt"]),
  offerActions: defineTable({
    threadId: v.id("offerThreads"), version: v.number(), proposalVersion: v.number(), kind: v.string(),
    status: offerStatus, actorId: v.optional(v.id("users")), priceCents: v.optional(v.number()),
    reason: v.optional(v.string()), at: v.number(),
  }).index("by_thread_version", ["threadId", "version"]),
  offerNoticeRefs: defineTable({
    threadId: v.id("offerThreads"), notificationId: v.id("notifications"), deliveryId: v.optional(v.id("emailOutbox")),
  }).index("by_thread", ["threadId"]),
  offerSupportAccess: defineTable({
    threadId: v.id("offerThreads"), actorId: v.id("users"), reason: v.string(), at: v.number(),
  }).index("by_thread", ["threadId"]),
  offerRateLimits: defineTable({ key: v.string(), resetsAt: v.number(), count: v.number() })
    .index("by_key", ["key"]).index("by_reset", ["resetsAt"]),
};
