import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
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
    phone: v.optional(v.string()),
    bio: v.optional(v.string()),
    location: v.optional(v.string()),
    profileImageUrl: v.optional(v.string()),
  }).index("byExternalId", ["externalId"]),

  orgMemberships: defineTable({
    userId: v.id("users"),
    clerkOrgId: v.string(),
    orgRole: v.string(),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_org", ["clerkOrgId"])
    .index("by_user_org", ["userId", "clerkOrgId"]),

  vehicles: defineTable({
    userId: v.id("users"),
    eventId: v.optional(v.id("events")),
    title: v.string(),
    make: v.string(),
    model: v.string(),
    year: v.number(),
    mileage: v.number(),
    price: v.number(),
    vin: v.optional(v.string()),
    photos: v.array(v.string()),
    description: v.string(),
    contactInfo: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("approved"),
      v.literal("rejected")
    ),
    saleStatus: v.optional(
      v.union(
        v.literal("available"),
        v.literal("salePending"),
        v.literal("sold")
      )
    ),
    paymentStatus: v.optional(
      v.union(v.literal("pending"), v.literal("completed"), v.literal("failed"))
    ),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_status", ["status"])
    .index("by_make_model", ["make", "model"])
    .index("by_price_range", ["price"])
    .index("by_event", ["eventId"]),

  events: defineTable({
    clerkOrgId: v.string(),
    name: v.string(),
    date: v.number(),
    location: v.string(),
    address: v.string(),
    capacity: v.number(),
    description: v.string(),
    vendorPrice: v.number(), // Price to charge sellers for event registration (in cents)
    createdAt: v.number(),
  })
    .index("by_org", ["clerkOrgId"])
    .index("by_date", ["date"]),

  registrations: defineTable({
    eventId: v.id("events"),
    vehicleId: v.id("vehicles"),
    userId: v.id("users"),
    paymentStatus: v.union(
      v.literal("pending"),
      v.literal("completed"),
      v.literal("failed")
    ),
    stripePaymentId: v.optional(v.string()),
    qrCodeData: v.optional(v.string()),
    checkedIn: v.boolean(),
    checkedInAt: v.optional(v.number()),
    checkedInBy: v.optional(v.id("users")),
    expiresAt: v.optional(v.number()), // Expiration time for pending registrations
    createdAt: v.number(),
  })
    .index("by_event", ["eventId"])
    .index("by_vehicle", ["vehicleId"])
    .index("by_user", ["userId"])
    .index("by_payment_status", ["paymentStatus"])
    .index("by_qr_code", ["qrCodeData"]),

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
    .index("by_recipient", ["recipientId"]),

  favorites: defineTable({
    userId: v.id("users"),
    vehicleId: v.id("vehicles"),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_vehicle", ["vehicleId"])
    .index("by_user_vehicle", ["userId", "vehicleId"]),

  vehicleAnalytics: defineTable({
    vehicleId: v.id("vehicles"),
    views: v.number(),
    shares: v.number(),
  }).index("by_vehicle", ["vehicleId"]),

  orgConversations: defineTable({
    clerkOrgId: v.string(),
    eventId: v.id("events"),
    userId: v.id("users"),
    lastMessageAt: v.number(),
    createdAt: v.number(),
  })
    .index("by_org", ["clerkOrgId"])
    .index("by_org_event", ["clerkOrgId", "eventId"])
    .index("by_user", ["userId"])
    .index("by_event_user", ["eventId", "userId"]),

  orgMessages: defineTable({
    conversationId: v.id("orgConversations"),
    senderId: v.id("users"),
    senderRole: v.union(v.literal("admin"), v.literal("vendor")),
    content: v.string(),
    read: v.boolean(),
    createdAt: v.number(),
  }).index("by_conversation", ["conversationId"]),

  eventAnnouncements: defineTable({
    clerkOrgId: v.string(),
    eventId: v.id("events"),
    authorId: v.id("users"),
    title: v.string(),
    content: v.string(),
    createdAt: v.number(),
  })
    .index("by_event", ["eventId"])
    .index("by_org", ["clerkOrgId"]),

  announcementReads: defineTable({
    userId: v.id("users"),
    announcementId: v.id("eventAnnouncements"),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_announcement", ["userId", "announcementId"]),

  orgStripeSettings: defineTable({
    clerkOrgId: v.string(),
    stripeAccountId: v.string(),
    onboardingComplete: v.boolean(),
    platformFeeType: v.union(v.literal("percentage"), v.literal("fixed")),
    platformFeeValue: v.number(),
    createdAt: v.number(),
  })
    .index("by_org", ["clerkOrgId"])
    .index("by_stripe_account", ["stripeAccountId"]),

  waitlist: defineTable({
    email: v.string(),
    createdAt: v.number(),
  }).index("by_email", ["email"]),
});
