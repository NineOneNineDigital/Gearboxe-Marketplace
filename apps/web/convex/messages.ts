import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import {
  isConversationParticipant,
  requireCurrentUser,
  requireSelf,
} from "./lib/authorization";

export const sendMessage = mutation({
  args: {
    senderId: v.id("users"),
    recipientId: v.id("users"),
    vehicleId: v.id("vehicles"),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const currentUser = await requireCurrentUser(ctx);
    if (currentUser._id !== args.senderId) {
      throw new Error("Messages can only be sent from your own account");
    }
    const content = args.content.trim();
    if (!content || content.length > 2_000) {
      throw new Error("Message must contain between 1 and 2,000 characters");
    }
    if (args.senderId === args.recipientId) {
      throw new Error("You cannot message yourself");
    }
    const vehicle = await ctx.db.get(args.vehicleId);
    if (!vehicle || vehicle.status !== "approved") {
      throw new Error("Vehicle is not available");
    }
    if (
      vehicle.userId !== args.senderId &&
      vehicle.userId !== args.recipientId
    ) {
      throw new Error("The vehicle seller must be part of the conversation");
    }

    const [participant1Id, participant2Id] =
      args.senderId < args.recipientId
        ? [args.senderId, args.recipientId]
        : [args.recipientId, args.senderId];
    let conversation = await ctx.db
      .query("conversations")
      .withIndex("by_vehicle_participants", (q) =>
        q
          .eq("vehicleId", args.vehicleId)
          .eq("participant1Id", participant1Id)
          .eq("participant2Id", participant2Id)
      )
      .first();
    if (!conversation) {
      const conversationId = await ctx.db.insert("conversations", {
        vehicleId: args.vehicleId,
        participant1Id,
        participant2Id,
        lastMessageAt: Date.now(),
        createdAt: Date.now(),
      });
      conversation = await ctx.db.get(conversationId);
    }
    if (!conversation) throw new Error("Unable to create conversation");

    // Insert message
    const messageId = await ctx.db.insert("messages", {
      conversationId: conversation._id,
      senderId: args.senderId,
      recipientId: args.recipientId,
      content,
      read: false,
      createdAt: Date.now(),
    });

    await ctx.db.patch(conversation._id, { lastMessageAt: Date.now() });

    return messageId;
  },
});

export const getMessagesByConversation = query({
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
    return await ctx.db
      .query("messages")
      .withIndex("by_conversation", (q) =>
        q.eq("conversationId", args.conversationId)
      )
      .order("asc")
      .collect();
  },
});

export const getMessagesByVehicle = query({
  args: { vehicleId: v.id("vehicles") },
  handler: async (ctx, args) => {
    const currentUser = await requireCurrentUser(ctx);
    // Get all conversations for this vehicle
    const conversations = await ctx.db
      .query("conversations")
      .withIndex("by_vehicle", (q) => q.eq("vehicleId", args.vehicleId))
      .collect();
    const visibleConversations = conversations.filter((conversation) =>
      isConversationParticipant(conversation, currentUser._id)
    );

    // Get all messages from these conversations
    const allMessages = [];
    for (const conversation of visibleConversations) {
      const messages = await ctx.db
        .query("messages")
        .withIndex("by_conversation", (q) =>
          q.eq("conversationId", conversation._id)
        )
        .collect();
      allMessages.push(...messages);
    }

    return allMessages.sort((a, b) => a.createdAt - b.createdAt);
  },
});

// This function is now deprecated - use conversations.getConversationsByUser instead
export const getConversations = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    await requireSelf(ctx, args.userId);
    const conversations1 = await ctx.db
      .query("conversations")
      .withIndex("by_participant1", (q) => q.eq("participant1Id", args.userId))
      .collect();
    const conversations2 = await ctx.db
      .query("conversations")
      .withIndex("by_participant2", (q) => q.eq("participant2Id", args.userId))
      .collect();
    return await Promise.all(
      [...conversations1, ...conversations2]
        .sort((a, b) => b.lastMessageAt - a.lastMessageAt)
        .map(async (conversation) => {
          const otherUserId =
            conversation.participant1Id === args.userId
              ? conversation.participant2Id
              : conversation.participant1Id;
          const [vehicle, otherUser, messages] = await Promise.all([
            ctx.db.get(conversation.vehicleId),
            ctx.db.get(otherUserId),
            ctx.db
              .query("messages")
              .withIndex("by_conversation", (q) =>
                q.eq("conversationId", conversation._id)
              )
              .collect(),
          ]);
          const lastMessage = messages.sort(
            (a, b) => b.createdAt - a.createdAt
          )[0];
          return {
            _id: conversation._id,
            vehicleId: conversation.vehicleId,
            otherUserId,
            vehicleTitle: vehicle?.title || "Unknown Vehicle",
            otherUserName: otherUser?.name || "Unknown User",
            lastMessage: lastMessage ?? null,
            unreadCount: messages.filter(
              (message) =>
                message.recipientId === args.userId && !message.read
            ).length,
            lastMessageAt: conversation.lastMessageAt,
          };
        })
    );
  },
});

export const markAsRead = mutation({
  args: { messageId: v.id("messages") },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    const message = await ctx.db.get(args.messageId);
    if (!message || message.recipientId !== user._id) {
      throw new Error("Message not found");
    }
    await ctx.db.patch(message._id, { read: true });
  },
});

export const getUnreadCount = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    await requireSelf(ctx, args.userId);
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_recipient", (q) => q.eq("recipientId", args.userId))
      .collect();

    return messages.filter((message) => !message.read).length;
  },
});

export const markConversationAsRead = mutation({
  args: { conversationId: v.id("conversations"), userId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await requireSelf(ctx, args.userId);
    const conversation = await ctx.db.get(args.conversationId);
    if (
      !conversation ||
      !isConversationParticipant(conversation, user._id)
    ) {
      throw new Error("Conversation not found");
    }
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_conversation", (q) =>
        q.eq("conversationId", args.conversationId)
      )
      .filter((q) =>
        q.and(
          q.eq(q.field("recipientId"), args.userId),
          q.eq(q.field("read"), false)
        )
      )
      .collect();

    // Mark all unread messages as read
    for (const message of messages) {
      await ctx.db.patch(message._id, { read: true });
    }

    return messages.length;
  },
});
