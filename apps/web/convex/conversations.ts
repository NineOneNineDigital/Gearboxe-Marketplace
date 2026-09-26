import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const getOrCreateConversation = mutation({
  args: {
    vehicleId: v.id("vehicles"),
    participant1Id: v.id("users"),
    participant2Id: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Ensure consistent ordering of participants
    const [participant1Id, participant2Id] =
      args.participant1Id < args.participant2Id
        ? [args.participant1Id, args.participant2Id]
        : [args.participant2Id, args.participant1Id];

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
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const conversations = await ctx.db
      .query("conversations")
      .withIndex("by_participant1", (q) => q.eq("participant1Id", args.userId))
      .collect();

    const conversations2 = await ctx.db
      .query("conversations")
      .withIndex("by_participant2", (q) => q.eq("participant2Id", args.userId))
      .collect();

    const allConversations = [...conversations, ...conversations2];

    // Get conversation details with unread counts
    const conversationsWithDetails = await Promise.all(
      allConversations.map(async (conversation) => {
        // Get the other participant
        const otherUserId =
          conversation.participant1Id === args.userId
            ? conversation.participant2Id
            : conversation.participant1Id;

        // Get vehicle details
        const vehicle = await ctx.db.get(conversation.vehicleId);

        // Get other user details
        const otherUser = await ctx.db.get(otherUserId);

        // Get unread message count
        const unreadMessages = await ctx.db
          .query("messages")
          .withIndex("by_conversation", (q) =>
            q.eq("conversationId", conversation._id)
          )
          .filter((q) =>
            q.and(
              q.eq(q.field("recipientId"), args.userId),
              q.eq(q.field("read"), false)
            )
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
    return await ctx.db.get(args.conversationId);
  },
});

export const updateLastMessageTime = mutation({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.conversationId, {
      lastMessageAt: Date.now(),
    });
  },
});

export const getConversationByParticipants = query({
  args: {
    vehicleId: v.id("vehicles"),
    participant1Id: v.id("users"),
    participant2Id: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Ensure consistent ordering of participants
    const [participant1Id, participant2Id] =
      args.participant1Id < args.participant2Id
        ? [args.participant1Id, args.participant2Id]
        : [args.participant2Id, args.participant1Id];

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
