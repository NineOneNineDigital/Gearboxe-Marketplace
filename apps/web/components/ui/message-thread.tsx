"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useToast } from "@/hooks/useToast";
import { useUser } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import { Check, CheckCheck, MessageCircle, Send } from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface Message {
  _id: string;
  senderId: string;
  recipientId: string;
  content: string;
  read: boolean;
  createdAt: number;
  sender?: {
    name: string;
  };
}

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
  const { user } = useUser();
  const { user: convexUser } = useCurrentUser();
  const [newMessage, setNewMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const messages = useQuery(
    conversationId
      ? api.messages.getMessagesByConversation
      : api.messages.getMessagesByVehicle,
    conversationId
      ? { conversationId: conversationId as any }
      : { vehicleId: vehicleId as any }
  );
  const sendMessage = useMutation(api.messages.sendMessage);
  const markAsRead = useMutation(api.messages.markAsRead);
  const markConversationAsRead = useMutation(
    api.messages.markConversationAsRead
  );

  useEffect(() => {
    // Mark messages as read when component mounts
    if (messages && convexUser && conversationId) {
      // Use the new conversation-based mark as read
      markConversationAsRead({
        conversationId: conversationId as any,
        userId: convexUser._id as any,
      });
    } else if (messages && convexUser) {
      // Fallback to individual message marking
      messages.forEach((message) => {
        if (message.recipientId === convexUser._id && !message.read) {
          markAsRead({ messageId: message._id });
        }
      });
    }
  }, [
    messages,
    convexUser,
    markAsRead,
    markConversationAsRead,
    conversationId,
  ]);

  useEffect(() => {
    // Scroll to bottom when new messages arrive
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !convexUser) return;

    setIsLoading(true);
    try {
      await sendMessage({
        senderId: convexUser._id as any,
        recipientId: recipientId as any,
        vehicleId: vehicleId as any,
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
        description: "Failed to send message. Please try again.",
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
        <div className="flex-1 overflow-y-auto space-y-4 p-4">
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
          <div className="flex space-x-2">
            <Textarea
              placeholder="Type your message..."
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
              disabled={!newMessage.trim() || isLoading}
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
