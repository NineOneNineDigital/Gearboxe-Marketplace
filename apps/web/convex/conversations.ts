import { v } from "convex/values";
import { assertCanContact, consumeRateLimit } from "./lib/trustGuards";
import { mutation, query } from "./_generated/server";
import {
  getCurrentUser,
  isConversationParticipant,
  requireCurrentUser,
} from "./lib/authorization";

export const getOrCreateConversation = mutation({
  args: {
    vehicleId: v.id("vehicles"),
    otherUserId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const currentUser = await requireCurrentUser(ctx);
    if (currentUser._id === args.otherUserId) {
      throw new Error("A conversation requires two different participants");
    }
    await assertCanContact(ctx, currentUser._id, args.otherUserId);
    const vehicle = await ctx.db.get(args.vehicleId);
    if (!vehicle) {
      throw new Error("Vehicle is not available");
    }
    if (
      vehicle.userId !== currentUser._id &&
      vehicle.userId !== args.otherUserId
    ) {
      throw new Error("The vehicle seller must be part of the conversation");
    }
    // Ensure consistent ordering of participants
    const [participant1Id, participant2Id] =
      currentUser._id < args.otherUserId
        ? [currentUser._id, args.otherUserId]
        : [args.otherUserId, currentUser._id];

    // Check if conversation already exists
    const existingConversation = await ctx.db
      .query("conversations")
      .withIndex("by_vehicle_participants", (q) =>
        q
          .eq("vehicleId", args.vehicleId)
          .eq("participant1Id", participant1Id)
          .eq("participant2Id", participant2Id)
      )
      .first();

    if (existingConversation) {
      return existingConversation._id;
    }
    if (vehicle.status !== "approved" && vehicle.status !== "active") throw new Error("This listing no longer accepts new conversations");

    await consumeRateLimit(ctx, currentUser._id, "conversation");
    // Create new conversation
    return await ctx.db.insert("conversations", {
      vehicleId: args.vehicleId,
      participant1Id,
      participant2Id,
      lastMessageAt: Date.now(),
      createdAt: Date.now(),
    });
  },
});

export const getConversationsByUser = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireCurrentUser(ctx);
    const conversations = await ctx.db
      .query("conversations")
      .withIndex("by_participant1", (q) => q.eq("participant1Id", user._id))
      .collect();

    const conversations2 = await ctx.db
      .query("conversations")
      .withIndex("by_participant2", (q) => q.eq("participant2Id", user._id))
      .collect();

    const allConversations = [...conversations, ...conversations2];

    // Get conversation details with unread counts
    const conversationsWithDetails = await Promise.all(
      allConversations.map(async (conversation) => {
        // Get the other participant
        const otherUserId =
          conversation.participant1Id === user._id
            ? conversation.participant2Id
            : conversation.participant1Id;

        // Get vehicle details
        const vehicle = await ctx.db.get(conversation.vehicleId);

        // Get other user details
        const otherUser = await ctx.db.get(otherUserId);

        // Get unread message count
        const unreadMessages = await ctx.db
          .query("messages")
          .withIndex("by_conversation_recipient_read", (q) =>
            q.eq("conversationId", conversation._id).eq("recipientId", user._id).eq("read", false)
          )
          .collect();

        // Get last message
        const lastMessage = await ctx.db
          .query("messages")
          .withIndex("by_conversation", (q) =>
            q.eq("conversationId", conversation._id)
          )
          .order("desc")
          .first();

        return {
          _id: conversation._id,
          vehicleId: conversation.vehicleId,
          otherUserId,
          vehicleTitle: vehicle?.title || "Unknown Vehicle",
          otherUserName: otherUser?.name || "Unknown User",
          lastMessage,
          unreadCount: unreadMessages.length,
          lastMessageAt: conversation.lastMessageAt,
        };
      })
    );

    // Sort by last message time
    return conversationsWithDetails.sort(
      (a, b) => b.lastMessageAt - a.lastMessageAt
    );
  },
});

export const getConversationById = query({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    const currentUser = await requireCurrentUser(ctx);
    const conversation = await ctx.db.get(args.conversationId);
    if (
      !conversation ||
      !isConversationParticipant(conversation, currentUser._id)
    ) {
      return null;
    }
    return conversation;
  },
});

export const updateLastMessageTime = mutation({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    const currentUser = await requireCurrentUser(ctx);
    const conversation = await ctx.db.get(args.conversationId);
    if (
      !conversation ||
      !isConversationParticipant(conversation, currentUser._id)
    ) {
      throw new Error("Conversation not found");
    }
    await ctx.db.patch(args.conversationId, {
      lastMessageAt: Date.now(),
    });
  },
});

export const getConversationByParticipants = query({
  args: {
    vehicleId: v.id("vehicles"),
    otherUserId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const currentUser = await requireCurrentUser(ctx);
    // Ensure consistent ordering of participants
    const [participant1Id, participant2Id] =
      currentUser._id < args.otherUserId
        ? [currentUser._id, args.otherUserId]
        : [args.otherUserId, currentUser._id];

    return await ctx.db
      .query("conversations")
      .withIndex("by_vehicle_participants", (q) =>
        q
          .eq("vehicleId", args.vehicleId)
          .eq("participant1Id", participant1Id)
          .eq("participant2Id", participant2Id)
      )
      .first();
  },
});

// Keep a participant's thread usable after a listing closes without exposing
// draft specifications, new photos, private contact information or disclosures.
export const getVehicleContext = query({
  args: { vehicleId: v.id("vehicles"), otherUserId: v.id("users") },
  handler: async (ctx, { vehicleId, otherUserId }) => {
    const user = await requireCurrentUser(ctx);
    const [participant1Id, participant2Id] = user._id < otherUserId ? [user._id, otherUserId] : [otherUserId, user._id];
    const thread = await ctx.db.query("conversations").withIndex("by_vehicle_participants", q => q.eq("vehicleId", vehicleId).eq("participant1Id", participant1Id).eq("participant2Id", participant2Id)).first();
    if (!thread || !isConversationParticipant(thread, user._id)) return null;
    const vehicle = await ctx.db.get(vehicleId);
    if (!vehicle) return null;
    return { _id: vehicle._id, title: vehicle.title, year: vehicle.year, make: vehicle.make, model: vehicle.model, mileage: vehicle.mileage, mileageUnit: vehicle.mileageUnit, price: vehicle.price, status: vehicle.status };
  },
});

// Return only whether composing is allowed; never disclose who blocked whom.
export const getContactState = query({
  args: { otherUserId: v.id("users") },
  handler: async (ctx, { otherUserId }) => {
    const user = await getCurrentUser(ctx);
    if (!user || user.suspendedAt !== undefined) return { canContact: false };
    try {
      if (user._id === otherUserId) return { canContact: false };
      await assertCanContact(ctx, user._id, otherUserId);
      return { canContact: true };
    } catch {
      return { canContact: false };
    }
  },
});
