"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useToast } from "@/hooks/useToast";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { Check, CheckCheck, MessageCircle, Send } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

interface MessageThreadProps {
  vehicleId: string;
  recipientId: string;
  recipientName?: string;
  conversationId?: string;
}

export function MessageThread({
  vehicleId,
  recipientId,
  recipientName,
  conversationId,
}: MessageThreadProps) {
  const { user: convexUser } = useCurrentUser();
  const [newMessage, setNewMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const olderScroll = useRef<{ height: number; top: number } | null>(null);
  const latestMessage = useRef<string | undefined>(undefined);
  const atBottom = useRef(true);
  const foundConversation = useQuery(api.conversations.getConversationByParticipants,
    convexUser ? { vehicleId: vehicleId as Id<"vehicles">, otherUserId: recipientId as Id<"users"> } : "skip");
  const threadId = conversationId ?? foundConversation?._id;
  const contact = useQuery(api.conversations.getContactState,
    convexUser ? { otherUserId: recipientId as Id<"users"> } : "skip");
  const { results, status, loadMore } = usePaginatedQuery(
    api.messages.getMessagesByConversation,
    convexUser && threadId ? { conversationId: threadId as Id<"conversations"> } : "skip",
    { initialNumItems: 30 }
  );
  const messages = [...results].reverse();
  const sendMessage = useMutation(api.messages.sendMessage);
  const markConversationAsRead = useMutation(api.messages.markConversationAsRead);

  useEffect(() => {
    if (!convexUser || !threadId) return;
    const messageIds = results.filter(message => message.recipientId === convexUser._id && !message.read).slice(0, 50).map(message => message._id);
    if (messageIds.length) void markConversationAsRead({ conversationId: threadId as Id<"conversations">, messageIds }).catch(() => {
      toast({ title: "Unable to mark messages as read", variant: "destructive" });
    });
  }, [results, convexUser, threadId, markConversationAsRead, toast]);

  useLayoutEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller) return;
    if (olderScroll.current && status !== "LoadingMore") {
      scroller.scrollTop = olderScroll.current.top + scroller.scrollHeight - olderScroll.current.height;
      olderScroll.current = null;
    } else if (!olderScroll.current && latestMessage.current !== results[0]?._id && (atBottom.current || results[0]?.senderId === convexUser?._id)) {
      messagesEndRef.current?.scrollIntoView({ behavior: latestMessage.current ? "smooth" : "instant" });
    }
    latestMessage.current = results[0]?._id;
  }, [results, status, convexUser?._id]);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !convexUser || !contact?.canContact || isLoading) return;

    setIsLoading(true);
    try {
      await sendMessage({
        recipientId: recipientId as Id<"users">,
        vehicleId: vehicleId as Id<"vehicles">,
        content: newMessage.trim(),
      });
      setNewMessage("");
      toast({
        title: "Message sent!",
        description: "Your message has been sent successfully.",
      });
    } catch (error) {
      console.error("Error sending message:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to send message. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  if (!convexUser) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <MessageCircle className="h-12 w-12 mx-auto text-gray-400 mb-4" />
          <p className="text-gray-600">Please sign in to send messages</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-[600px] flex flex-col">
      <CardHeader className="pb-3 border-b border-gray-200">
        <CardTitle className="text-lg flex items-center space-x-2">
          <MessageCircle className="h-5 w-5 text-primary" />
          <span>Messages {recipientName && `with ${recipientName}`}</span>
        </CardTitle>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col space-y-4 overflow-hidden p-0">
        {/* Messages */}
        <div ref={scrollRef} onScroll={event => {
            const node = event.currentTarget;
            atBottom.current = node.scrollHeight - node.scrollTop - node.clientHeight < 100;
          }} className="flex-1 overflow-y-auto space-y-4 p-4">
          {(status === "CanLoadMore" || status === "LoadingMore") && <Button variant="outline" size="sm" disabled={status === "LoadingMore"} onClick={() => {
            if (scrollRef.current) olderScroll.current = { height: scrollRef.current.scrollHeight, top: scrollRef.current.scrollTop };
            loadMore(30);
          }}>{status === "LoadingMore" ? "Loading…" : "Load older messages"}</Button>}
          {status === "LoadingFirstPage" && threadId && <p role="status">Loading messages…</p>}
          {messages && messages.length > 0 ? (
            messages.map((message) => {
              const isOwnMessage = message.senderId === convexUser._id;
              return (
                <div
                  key={message._id}
                  className={`flex ${isOwnMessage ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-xs px-4 py-3 rounded-2xl shadow-sm ${
                      isOwnMessage
                        ? "bg-primary text-white rounded-br-md"
                        : "bg-gray-100 text-gray-900 rounded-bl-md"
                    }`}
                  >
                    <p className="text-sm leading-relaxed">{message.content}</p>
                    <div className="flex items-center justify-between mt-2">
                      <p
                        className={`text-xs ${
                          isOwnMessage
                            ? "text-primary-foreground/70"
                            : "text-gray-500"
                        }`}
                      >
                        {formatTime(message.createdAt)}
                      </p>
                      {isOwnMessage && (
                        <div className="ml-2">
                          {message.read ? (
                            <CheckCheck className="h-3 w-3 text-primary-foreground/70" />
                          ) : (
                            <Check className="h-3 w-3 text-primary-foreground/70" />
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-center text-gray-500 py-12">
              <MessageCircle className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p className="text-lg font-medium mb-2">No messages yet</p>
              <p className="text-sm">
                Start the conversation by sending a message below!
              </p>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Message Input */}
        <div className="border-t border-gray-200 bg-gray-50 p-4">
          {contact?.canContact === false && <p className="mb-2 text-sm" role="status">Messaging is unavailable between these accounts.</p>}
          <div className="flex space-x-2">
            <Textarea
              placeholder="Type your message..."
              aria-label="Message"
              maxLength={2000}
              disabled={!contact?.canContact || isLoading}
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              className="flex-1 min-h-[44px] max-h-32 resize-none rounded-lg border-gray-300 focus:border-primary focus:ring-primary"
            />
            <Button
              onClick={handleSendMessage}
              disabled={!newMessage.trim() || isLoading || !contact?.canContact}
              size="sm"
              className="px-4 py-2 rounded-lg"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
          {isLoading && (
            <p className="text-xs text-gray-500 mt-2 text-center">
              Sending message...
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
