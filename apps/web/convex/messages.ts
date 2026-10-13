import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { enqueueNotification } from "./notifications";
import { assertCanContact, consumeRateLimit } from "./lib/trustGuards";
import { mutation, query } from "./_generated/server";
import {
  isConversationParticipant,
  requireCurrentUser,
} from "./lib/authorization";

export const sendMessage = mutation({
  args: {
    recipientId: v.id("users"),
    vehicleId: v.id("vehicles"),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const currentUser = await requireCurrentUser(ctx);
    await assertCanContact(ctx, currentUser._id, args.recipientId);
    await consumeRateLimit(ctx, currentUser._id, "message");
    const content = args.content.trim();
    if (!content || content.length > 2_000) {
      throw new Error("Message must contain between 1 and 2,000 characters");
    }
    if (currentUser._id === args.recipientId) {
      throw new Error("You cannot message yourself");
    }
    const recent = await ctx.db.query("messages").withIndex("by_sender", q => q.eq("senderId", currentUser._id)).order("desc").take(30);
    if (recent.some(message => message.content === content && message.createdAt > Date.now() - 60_000)) throw new Error("Wait before sending the same message again");
    const vehicle = await ctx.db.get(args.vehicleId);
    if (!vehicle) {
      throw new Error("Vehicle is not available");
    }
    if (
      vehicle.userId !== currentUser._id &&
      vehicle.userId !== args.recipientId
    ) {
      throw new Error("The vehicle seller must be part of the conversation");
    }

    const [participant1Id, participant2Id] =
      currentUser._id < args.recipientId
        ? [currentUser._id, args.recipientId]
        : [args.recipientId, currentUser._id];
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
      if (vehicle.status !== "approved" && vehicle.status !== "active") throw new Error("This listing no longer accepts new conversations");
      await consumeRateLimit(ctx, currentUser._id, "conversation");
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
      senderId: currentUser._id,
      recipientId: args.recipientId,
      content,
      read: false,
      createdAt: Date.now(),
    });

    await ctx.db.patch(conversation._id, { lastMessageAt: Date.now() });

    await enqueueNotification(ctx, {
      userId: args.recipientId, category: "messages", kind: "new_message",
      message: "You have a new message about a vehicle.", vehicleId: args.vehicleId,
      conversationId: conversation._id, sourceUserId: currentUser._id, dedupeKey: `message:${messageId}`,
      link: `/myAccount/messages/${args.vehicleId}/${currentUser._id}`,
    });
    return messageId;
  },
});

export const getMessagesByConversation = query({
  args: { conversationId: v.id("conversations"), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const currentUser = await requireCurrentUser(ctx);
    const conversation = await ctx.db.get(args.conversationId);
    if (
      !conversation ||
      !isConversationParticipant(conversation, currentUser._id)
    ) {
      throw new Error("Conversation not found");
    }
    if (!Number.isInteger(args.paginationOpts.numItems) || args.paginationOpts.numItems < 1) throw new Error("Invalid page size");
    return await ctx.db
      .query("messages")
      .withIndex("by_conversation", (q) =>
        q.eq("conversationId", args.conversationId)
      )
      .order("desc")
      .paginate({ ...args.paginationOpts, numItems: Math.max(1, Math.min(50, args.paginationOpts.numItems)) });
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
  args: {},
  handler: async (ctx) => {
    const user = await requireCurrentUser(ctx);
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_recipient_read", (q) => q.eq("recipientId", user._id).eq("read", false))
      .collect();

    return messages.length;
  },
});

export const markConversationAsRead = mutation({
  args: { conversationId: v.id("conversations"), messageIds: v.array(v.id("messages")) },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    const conversation = await ctx.db.get(args.conversationId);
    if (
      !conversation ||
      !isConversationParticipant(conversation, user._id)
    ) {
      throw new Error("Conversation not found");
    }
    if (args.messageIds.length > 50) throw new Error("Read at most 50 messages at once");
    let marked = 0;
    for (const messageId of new Set(args.messageIds)) {
      const message = await ctx.db.get(messageId);
      if (message?.conversationId === conversation._id && message.recipientId === user._id && !message.read) {
        await ctx.db.patch(message._id, { read: true });
        marked++;
      }
    }

    return marked;
  },
});
