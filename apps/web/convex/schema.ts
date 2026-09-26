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
  }).index("byExternalId", ["externalId"]),

  cities: defineTable({
    name: v.string(),
    state: v.string(),
    slug: v.string(),
    active: v.boolean(),
    createdAt: v.number(),
  }).index("by_slug", ["slug"]),

  vehicles: defineTable({
    userId: v.id("users"),
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
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_status", ["status"])
    .index("by_make_model", ["make", "model"])
    .index("by_price_range", ["price"]),

  events: defineTable({
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
    createdAt: v.number(),
  })
    .index("by_event", ["eventId"])
    .index("by_vehicle", ["vehicleId"])
    .index("by_user", ["userId"])
    .index("by_payment_status", ["paymentStatus"]),

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
});
