import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

import { optionalSpecificationFields, storedListingStatus, moderationEntry, decodedFields } from "./lib/vehicleSpecification";
import { discoveryFilters, discoverySort } from "./lib/discoveryPolicy";

const catalogFields = {
  vehicleId: v.id("vehicles"), makeKey: v.string(), modelKey: v.string(), state: v.string(),
  price: v.number(), year: v.number(), mileageMiles: v.number(), listedAt: v.number(), updatedAt: v.number(),
  searchWords: v.array(v.string()), latitude: v.optional(v.number()), longitude: v.optional(v.number()), sitemapShard: v.number(),
};

const notificationPreferences = v.object({ emailEnabled: v.boolean(), messages: v.boolean(), listings: v.boolean(), favorites: v.boolean(), events: v.boolean() });

export default defineSchema({
  eventStaff: defineTable({ eventId: v.id("events"), userId: v.id("users"), role: v.union(v.literal("checkin"), v.literal("manager")), assignedBy: v.id("users"), createdAt: v.number() }).index("by_event_user", ["eventId", "userId"]).index("by_user", ["userId"]).index("by_event", ["eventId"]),
  eventCheckinRequests: defineTable({ eventId: v.id("events"), registrationId: v.id("registrations"), actorId: v.id("users"), requestId: v.string(), expectedRevision: v.number(), resultRevision: v.number(), createdAt: v.number() }).index("by_actor_request", ["actorId", "requestId"]),
  eventIncidents: defineTable({ eventId: v.id("events"), registrationId: v.optional(v.id("registrations")), actorId: v.id("users"), reason: v.string(), severity: v.union(v.literal("low"), v.literal("medium"), v.literal("high"), v.literal("critical")), notes: v.string(), status: v.union(v.literal("open"), v.literal("escalated"), v.literal("resolved")), createdAt: v.number(), updatedAt: v.number() }).index("by_event", ["eventId"]),
  eventWaitlist: defineTable({ eventId: v.id("events"), vehicleId: v.id("vehicles"), userId: v.id("users"), status: v.union(v.literal("waiting"), v.literal("offered"), v.literal("registered"), v.literal("left"), v.literal("ineligible"), v.literal("expired")), reservationId: v.optional(v.id("eventReservations")), offeredAt: v.optional(v.number()), createdAt: v.number(), updatedAt: v.number() }).index("by_event_status", ["eventId", "status", "createdAt"]).index("by_user", ["userId"]).index("by_event_vehicle", ["eventId", "vehicleId"]).index("by_status_updated", ["status", "updatedAt"]).index("by_user_status", ["userId", "status"]),
  eventInventories: defineTable({ eventId: v.id("events"), held: v.number(), confirmed: v.number(), attended: v.optional(v.number()), attendanceInitializing: v.optional(v.boolean()), attendanceCursor: v.optional(v.string()), waiting: v.optional(v.number()), initializationStatus: v.optional(v.string()), migrationCursor: v.optional(v.string()) }).index("by_event", ["eventId"]),
  eventReservations: defineTable({ eventId: v.id("events"), vehicleId: v.id("vehicles"), userId: v.id("users"), status: v.string(), amount: v.number(), currency: v.string(), expiresAt: v.number(), createdAt: v.number(), updatedAt: v.number(), stripeSessionId: v.optional(v.string()), checkoutUrl: v.optional(v.string()), registrationId: v.optional(v.id("registrations")), lastError: v.optional(v.string()), stripeCustomerId: v.optional(v.string()), checkoutCreateAttemptAt: v.optional(v.number()), customerEmail: v.optional(v.string()), eventName: v.optional(v.string()), vehicleName: v.optional(v.string()), cancellationRequestedAt: v.optional(v.number()), nextReconcileAt: v.optional(v.number()), rulesSnapshot: v.optional(v.string()), rulesAcceptedAt: v.optional(v.number()), waitlistId: v.optional(v.id("eventWaitlist")), waitlistClaimedAt: v.optional(v.number()) }).index("by_event_vehicle", ["eventId", "vehicleId"]).index("by_user", ["userId"]).index("by_status_expiry", ["status", "expiresAt"]).index("by_session", ["stripeSessionId"]).index("by_status_cancel", ["status", "cancellationRequestedAt"]).index("by_user_status", ["userId", "status"]).index("by_status_reconcile", ["status", "nextReconcileAt"]).index("by_status_error", ["status", "lastError"]),
  eventPayments: defineTable({ reservationId: v.id("eventReservations"), eventId: v.id("events"), vehicleId: v.id("vehicles"), userId: v.id("users"), stripeSessionId: v.string(), stripePaymentId: v.string(), amount: v.number(), currency: v.string(), status: v.string(), createdAt: v.number(), updatedAt: v.number(), stripeCustomerId: v.optional(v.string()), stripeChargeId: v.optional(v.string()), receiptUrl: v.optional(v.string()), registrationId: v.optional(v.id("registrations")), stripeRefundId: v.optional(v.string()), refundReason: v.optional(v.string()), refundStatus: v.optional(v.string()), refundAmount: v.optional(v.number()), refundGeneration: v.optional(v.number()), lastError: v.optional(v.string()), attempts: v.number(), nextAttemptAt: v.number(), leaseToken: v.optional(v.string()), leaseExpiresAt: v.optional(v.number()) }).index("by_payment", ["stripePaymentId"]).index("by_session", ["stripeSessionId"]).index("by_status_due", ["status", "nextAttemptAt"]).index("by_registration", ["registrationId"]).index("by_status_lease", ["status", "leaseExpiresAt"]).index("by_user", ["userId"]).index("by_status_error", ["status", "lastError"]),
  stripeWebhookEvents: defineTable({ eventId: v.string(), type: v.string(), objectId: v.string(), status: v.string(), attempts: v.number(), nextAttemptAt: v.number(), createdAt: v.number(), updatedAt: v.number(), lastError: v.optional(v.string()) }).index("by_event", ["eventId"]).index("by_status_due", ["status", "nextAttemptAt"]),
  notifications: defineTable({ userId: v.id("users"), category: v.string(), kind: v.string(), message: v.string(), link: v.string(), dedupeKey: v.string(), vehicleId: v.optional(v.id("vehicles")), conversationId: v.optional(v.id("conversations")), registrationId: v.optional(v.id("registrations")), createdAt: v.number(), readAt: v.optional(v.number()) }).index("by_user", ["userId"]).index("by_dedupe", ["dedupeKey"]),
  emailOutbox: defineTable({ userId: v.id("users"), sourceUserId: v.optional(v.id("users")), conversationId: v.optional(v.id("conversations")), category: v.string(), eventKey: v.string(), subject: v.string(), message: v.string(), path: v.string(), status: v.string(), attempts: v.number(), nextAttemptAt: v.number(), createdAt: v.number(), updatedAt: v.number(), leaseToken: v.optional(v.string()), leaseExpiresAt: v.optional(v.number()), providerId: v.optional(v.string()), recipientEmail: v.optional(v.string()), lastError: v.optional(v.string()), unsubscribeToken: v.optional(v.string()) }).index("by_event", ["eventKey"]).index("by_status_due", ["status", "nextAttemptAt"]).index("by_status_lease", ["status", "leaseExpiresAt"]).index("by_provider", ["providerId"]).index("by_unsubscribe", ["unsubscribeToken"]).index("by_updated", ["updatedAt"]).index("by_status_updated", ["status", "updatedAt"]),
  emailSuppressions: defineTable({ email: v.string(), reason: v.string(), createdAt: v.number() }).index("by_email", ["email"]),
  emailWebhookEvents: defineTable({ eventKey: v.string(), createdAt: v.number(), providerId: v.string(), type: v.string(), recipientEmail: v.optional(v.string()), permanentBounce: v.boolean() }).index("by_event", ["eventKey"]).index("by_provider", ["providerId"]).index("by_created", ["createdAt"]),
  ownershipUploadLeases: defineTable({ userId: v.id("users"), vehicleId: v.optional(v.id("vehicles")), token: v.string(), expiresAt: v.number(), used: v.boolean() }).index("by_token", ["token"]).index("by_expiry", ["expiresAt"]),
  trustReports: defineTable({ reporterId: v.id("users"), targetUserId: v.id("users"), vehicleId: v.optional(v.id("vehicles")), reason: v.string(), details: v.string(), status: v.union(v.literal("open"), v.literal("reviewing"), v.literal("resolved"), v.literal("dismissed"), v.literal("escalated")), createdAt: v.number(), updatedAt: v.number() }).index("by_reporter", ["reporterId"]).index("by_status", ["status"]).index("by_target", ["targetUserId"]).index("by_target_status", ["targetUserId", "status"]),
  userBlocks: defineTable({ userId: v.id("users"), blockedUserId: v.id("users"), createdAt: v.number() }).index("by_pair", ["userId", "blockedUserId"]).index("by_user", ["userId"]),
  trustRateLimits: defineTable({ userId: v.id("users"), action: v.string(), windowStart: v.number(), count: v.number() }).index("by_user_action", ["userId", "action"]),
  trustNotes: defineTable({ reportId: v.id("trustReports"), adminId: v.id("users"), note: v.string(), reason: v.string(), createdAt: v.number() }).index("by_report", ["reportId"]),
  trustAppeals: defineTable({ userId: v.id("users"), reportId: v.optional(v.id("trustReports")), message: v.string(), status: v.union(v.literal("open"), v.literal("reviewing"), v.literal("resolved")), response: v.optional(v.string()), createdAt: v.number(), updatedAt: v.number() }).index("by_user", ["userId"]).index("by_status", ["status"]),
  ownershipDocuments: defineTable({ userId: v.id("users"), vehicleId: v.optional(v.id("vehicles")), storageId: v.id("_storage"), status: v.union(v.literal("pending"), v.literal("verified"), v.literal("rejected")), createdAt: v.number(), expiresAt: v.number(), reviewedAt: v.optional(v.number()), reviewerId: v.optional(v.id("users")), reason: v.optional(v.string()) }).index("by_user", ["userId"]).index("by_expiry", ["expiresAt"]).index("by_storage", ["storageId"]).index("by_status", ["status"]),
  identityReviews: defineTable({ userId: v.id("users"), status: v.union(v.literal("pending"), v.literal("verified"), v.literal("rejected")), createdAt: v.number(), updatedAt: v.number(), reviewerId: v.optional(v.id("users")), reason: v.optional(v.string()) }).index("by_user", ["userId"]).index("by_status", ["status"]),
  vehicleCatalog: defineTable(catalogFields).index("by_vehicle", ["vehicleId"]).index("by_sitemap_shard", ["sitemapShard"]),
  vehicleSearchTerms: defineTable({ ...catalogFields, token: v.string(), scope: v.string() })
    .index("by_vehicle", ["vehicleId"])
    .index("by_price", ["token", "scope", "price"])
    .index("by_mileage", ["token", "scope", "mileageMiles"])
    .index("by_year", ["token", "scope", "year"])
    .index("by_recency", ["token", "scope", "listedAt"]),
  discoveryCounters: defineTable({ key: v.string(), next: v.number() }).index("by_key", ["key"]),
  savedSearches: defineTable({ userId: v.id("users"), name: v.string(), filters: discoveryFilters, sort: discoverySort, createdAt: v.number() }).index("by_user", ["userId"]),
  recentViews: defineTable({ userId: v.id("users"), vehicleId: v.id("vehicles"), viewedAt: v.number() })
    .index("by_user_time", ["userId", "viewedAt"]).index("by_user_vehicle", ["userId", "vehicleId"]),
  listingNotifications: defineTable({
    userId: v.id("users"), vehicleId: v.id("vehicles"), kind: v.string(),
    message: v.string(), createdAt: v.number(), readAt: v.optional(v.number()),
  }).index("by_user", ["userId"]),
  listingViews: defineTable({
    vehicleId: v.id("vehicles"), visitorKey: v.string(), day: v.number(), createdAt: v.number(),
  }).index("by_vehicle_visitor_day", ["vehicleId", "visitorKey", "day"]).index("by_created", ["createdAt"]),
  vehicleMedia: defineTable({
    userId: v.id("users"),
    token: v.string(),
    status: v.union(v.literal("awaiting"), v.literal("uploading"), v.literal("uploaded"), v.literal("processing"), v.literal("ready")),
    createdAt: v.number(),
    expiresAt: v.number(),
    sourceId: v.optional(v.id("_storage")),
    thumbnailId: v.optional(v.id("_storage")),
    detailId: v.optional(v.id("_storage")),
    vehicleId: v.optional(v.id("vehicles")),
  }).index("by_token", ["token"]).index("by_user", ["userId"]).index("by_expiry", ["expiresAt"])
    .index("by_source", ["sourceId"]).index("by_thumbnail", ["thumbnailId"]).index("by_detail", ["detailId"]),
  vinDecodes: defineTable({ ...decodedFields, decodedAt: v.number() }).index("by_vin", ["vin"]).index("by_decoded", ["decodedAt"]),
  vinDecodeLimits: defineTable({ userId: v.id("users"), requestedAt: v.number() }).index("by_user", ["userId"]),
  vehicleModerationLog: defineTable({ vehicleId: v.id("vehicles"), ...moderationEntry.fields }).index("by_vehicle", ["vehicleId"]),
  // No public read/write functions: provisioning evidence is operator-only.
  adminAuditLog: defineTable({
    action: v.string(),
    targetUserId: v.optional(v.id("users")),
    actorId: v.optional(v.id("users")),
    vehicleId: v.optional(v.id("vehicles")),
    reportId: v.optional(v.id("trustReports")),
    source: v.string(),
    reason: v.string(),
    createdAt: v.number(),
  }),
  users: defineTable({
    notificationPreferences: v.optional(notificationPreferences),
    suspendedAt: v.optional(v.number()),
    suspensionReason: v.optional(v.string()),
    emailVerified: v.optional(v.boolean()),
    phoneVerified: v.optional(v.boolean()),
    phone: v.optional(v.string()),
    name: v.string(),
    // this is the Clerk ID, stored in the subject JWT field
    externalId: v.string(),
    email: v.string(),
    role: v.union(
      v.literal("user"),
      v.literal("admin"),
      v.literal("superAdmin")
    ),
    createdAt: v.number(),
  }).index("byExternalId", ["externalId"]).index("byEmail", ["email"]),

  cities: defineTable({
    name: v.string(),
    state: v.string(),
    slug: v.string(),
    active: v.boolean(),
    createdAt: v.number(),
  }).index("by_slug", ["slug"]),

  vehicles: defineTable({
    // Retain legacy deployment fields; current lifecycle uses registrations and status.
    eventId: v.optional(v.id("events")),
    saleStatus: v.optional(v.string()),
    userId: v.id("users"),
    title: v.string(),
    make: v.string(),
    model: v.string(),
    year: v.number(),
    mileage: v.number(),
    price: v.number(),
    vin: v.optional(v.string()),
    vinKey: v.optional(v.string()),
    ownershipAttestedAt: v.optional(v.number()),
    moderationRemovedAt: v.optional(v.number()),
    photos: v.array(v.string()),
    media: v.optional(v.array(v.object({ id: v.id("vehicleMedia"), caption: v.string() }))),
    description: v.string(),
    contactInfo: v.string(),
    ...optionalSpecificationFields,
    vinVerificationStatus: v.optional(v.union(v.literal("unverified"), v.literal("decoded"))),
    vinDecodedAt: v.optional(v.number()),
    moderationReason: v.optional(v.string()),
    moderationHistory: v.optional(v.array(moderationEntry)),
    status: storedListingStatus,
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
    viewCount: v.optional(v.number()),
    draftRequestId: v.optional(v.string()),
    discoverySitemapShard: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_user_draft_request", ["userId", "draftRequestId"])
    .index("by_vin_key", ["vinKey"])
    .index("by_status", ["status"])
    .index("by_make_model", ["make", "model"])
    .index("by_price_range", ["price"])
    .index("by_status_updated", ["status", "updatedAt"]),

  events: defineTable({
    eventRules: v.optional(v.string()), registrationDeadline: v.optional(v.number()), vendorInstructions: v.optional(v.string()),
    onSiteContact: v.optional(v.object({ name: v.string(), phone: v.string(), email: v.optional(v.string()) })),
    onSiteContactVisibility: v.optional(v.union(v.literal("vendors"), v.literal("public"))),
    registrationFeeCents: v.optional(v.number()),
    timeZone: v.optional(v.string()),
    cancelledAt: v.optional(v.number()),
    cancellationReason: v.optional(v.string()),
    cityId: v.id("cities"),
    name: v.string(),
    date: v.number(),
    location: v.string(),
    address: v.string(),
    capacity: v.number(),
    description: v.string(),
    createdAt: v.number(),
  })
    .index("by_city", ["cityId"])
    .index("by_date", ["date"]),

  registrations: defineTable({
    rosterSearch: v.optional(v.string()),
    checkinRevision: v.optional(v.number()), checkedInAt: v.optional(v.number()), checkedInBy: v.optional(v.id("users")),
    legacyMigrationAttempts: v.optional(v.number()),
    legacyMigrationNextAttemptAt: v.optional(v.number()),
    legacyMigrationError: v.optional(v.string()),
    reservationId: v.optional(v.id("eventReservations")), paymentRecordId: v.optional(v.id("eventPayments")), stripeCustomerId: v.optional(v.string()), receiptUrl: v.optional(v.string()), cancelledAt: v.optional(v.number()), refundRequestedAt: v.optional(v.number()), stripeRefundId: v.optional(v.string()),
    eventId: v.id("events"),
    vehicleId: v.id("vehicles"),
    userId: v.id("users"),
    paymentStatus: v.union(
      v.literal("pending"),
      v.literal("completed"),
      v.literal("failed"),
      v.literal("refund_pending"),
      v.literal("refunded")
    ),
    stripePaymentId: v.optional(v.string()),
    qrCodeData: v.optional(v.string()),
    checkedIn: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_event", ["eventId"])
    .index("by_event_qr", ["eventId", "qrCodeData"])
    .index("by_event_user_status", ["eventId", "userId", "paymentStatus"])
    .index("by_vehicle", ["vehicleId"])
    .index("by_vehicle_status", ["vehicleId", "paymentStatus"])
    .index("by_user", ["userId"])
    .index("by_payment_status", ["paymentStatus"])
     .index("by_event_vehicle", ["eventId", "vehicleId"])
    .index("by_event_vehicle_status", ["eventId", "vehicleId", "paymentStatus"])
    .index("by_legacy_migration", ["paymentStatus", "paymentRecordId", "legacyMigrationNextAttemptAt"])
    .index("by_legacy_error", ["paymentStatus", "paymentRecordId", "legacyMigrationError"])
    .index("by_stripe_payment", ["stripePaymentId"])
    .searchIndex("search_roster", { searchField: "rosterSearch", filterFields: ["eventId"] }),

  conversations: defineTable({
    vehicleId: v.id("vehicles"),
    participant1Id: v.id("users"),
    participant2Id: v.id("users"),
    lastMessageAt: v.number(),
    createdAt: v.number(),
  })
    .index("by_vehicle", ["vehicleId"])
    .index("by_participant1", ["participant1Id"])
    .index("by_participant2", ["participant2Id"])
    .index("by_participants", ["participant1Id", "participant2Id"])
    .index("by_vehicle_participants", [
      "vehicleId",
      "participant1Id",
      "participant2Id",
    ]),

  messages: defineTable({
    conversationId: v.id("conversations"),
    senderId: v.id("users"),
    recipientId: v.id("users"),
    content: v.string(),
    read: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_conversation", ["conversationId"])
    .index("by_sender", ["senderId"])
    .index("by_recipient", ["recipientId"])
    .index("by_recipient_read", ["recipientId", "read"])
    .index("by_conversation_recipient_read", ["conversationId", "recipientId", "read"]),

  favorites: defineTable({
    userId: v.id("users"),
    vehicleId: v.id("vehicles"),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_vehicle", ["vehicleId"])
    .index("by_user_vehicle", ["userId", "vehicleId"]),
});
