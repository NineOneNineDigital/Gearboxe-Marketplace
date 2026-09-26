"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Footer } from "@/components/ui/footer";
import { Navbar } from "@/components/ui/navbar";
import { api } from "@/convex/_generated/api";
import { useUser } from "@clerk/nextjs";
import { useConvexAuth, useQuery } from "convex/react";
import {
  Car,
  ChevronRight,
  Clock,
  MessageCircle,
  Search,
  User,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { useState } from "react";

export default function MessagesPage() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { user } = useUser();
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "unread" | "recent">(
    "all"
  );

  // Always call hooks to maintain hook order
  const currentUser = useQuery(
    api.users.getUser,
    user?.id ? { clerkId: user.id } : "skip"
  );
  const conversations = useQuery(
    api.messages.getConversations,
    currentUser?._id ? { userId: currentUser._id } : "skip"
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    redirect("/sign-in");
  }

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 1) {
      return "Just now";
    } else if (diffInHours < 24) {
      return date.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
    } else if (diffInHours < 168) {
      // 7 days
      return date.toLocaleDateString("en-US", {
        weekday: "short",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
    } else {
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
    }
  };

  const getStatusColor = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 1) return "bg-green-500";
    if (diffInHours < 24) return "bg-blue-500";
    return "bg-gray-400";
  };

  const filteredConversations =
    conversations?.filter((conversation) => {
      const matchesSearch =
        conversation.vehicleTitle
          ?.toLowerCase()
          .includes(searchQuery.toLowerCase()) ||
        conversation.otherUserName
          ?.toLowerCase()
          .includes(searchQuery.toLowerCase());

      if (filterStatus === "unread") {
        return matchesSearch && conversation.unreadCount > 0;
      } else if (filterStatus === "recent") {
        const diffInHours =
          (Date.now() - conversation.lastMessage.createdAt) / (1000 * 60 * 60);
        return matchesSearch && diffInHours < 24;
      }

      return matchesSearch;
    }) || [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex flex-col">
      <Navbar />

      <div className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Enhanced Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 mb-2">
                Messages
              </h1>
              <p className="text-gray-600 text-lg">
                Connect with potential buyers and sellers
              </p>
            </div>
            <div className="flex items-center space-x-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search conversations..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent w-64"
                />
              </div>
              <div className="flex bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setFilterStatus("all")}
                  className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                    filterStatus === "all"
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setFilterStatus("unread")}
                  className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                    filterStatus === "unread"
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  Unread
                </button>
                <button
                  onClick={() => setFilterStatus("recent")}
                  className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                    filterStatus === "recent"
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  Recent
                </button>
              </div>
            </div>
          </div>

          {/* Stats */}
          {conversations && conversations.length > 0 && (
            <div className="flex items-center space-x-6 text-sm text-gray-600">
              <div className="flex items-center space-x-2">
                <MessageCircle className="h-4 w-4" />
                <span>{conversations.length} conversations</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-primary rounded-full"></div>
                <span>
                  {conversations.filter((c) => c.unreadCount > 0).length} unread
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Enhanced Conversations List */}
        {filteredConversations.length > 0 ? (
          <div className="space-y-4">
            {filteredConversations.map((conversation) => (
              <Card
                key={`${conversation.vehicleId}-${conversation.otherUserId}`}
                className="overflow-hidden hover:shadow-xl transition-all duration-300 cursor-pointer border-0 shadow-md hover:scale-[1.02] group"
              >
                <Link
                  href={`/myAccount/messages/${conversation.vehicleId}/${conversation.otherUserId}`}
                  className="block"
                >
                  <CardContent className="p-6">
                    <div className="flex items-center space-x-4">
                      {/* Avatar with status indicator */}
                      <div className="relative flex-shrink-0">
                        <div className="w-14 h-14 bg-gradient-to-br from-primary/20 to-primary/10 rounded-full flex items-center justify-center">
                          <Car className="h-7 w-7 text-primary" />
                        </div>
                        <div
                          className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white ${getStatusColor(conversation.lastMessage.createdAt)}`}
                        ></div>
                      </div>

                      {/* Conversation details */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center space-x-3">
                            <h3 className="text-lg font-semibold text-gray-900 truncate">
                              {conversation.vehicleTitle ||
                                "Vehicle Conversation"}
                            </h3>
                            {conversation.unreadCount > 0 && (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary text-white animate-pulse">
                                {conversation.unreadCount}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center space-x-2">
                            <div className="flex items-center space-x-1 text-xs text-gray-500">
                              <Clock className="h-3 w-3" />
                              <span>
                                {formatTime(conversation.lastMessage.createdAt)}
                              </span>
                            </div>
                            <ChevronRight className="h-4 w-4 text-gray-400 group-hover:text-primary transition-colors" />
                          </div>
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2 text-sm text-gray-600">
                            <User className="h-4 w-4" />
                            <span className="truncate">
                              {conversation.otherUserName || "Unknown User"}
                            </span>
                          </div>
                        </div>

                        <p className="text-sm text-gray-600 truncate mt-2 leading-relaxed">
                          {conversation.lastMessage.content}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Link>
              </Card>
            ))}
          </div>
        ) : conversations && conversations.length > 0 ? (
          <Card className="border-0 shadow-md">
            <CardContent className="text-center py-16">
              <Search className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                No conversations match your search
              </h3>
              <p className="text-gray-600 mb-6">
                Try adjusting your search terms or filters.
              </p>
              <Button
                variant="outline"
                onClick={() => {
                  setSearchQuery("");
                  setFilterStatus("all");
                }}
              >
                Clear Filters
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-0 shadow-md">
            <CardContent className="text-center py-20">
              <div className="w-24 h-24 bg-gradient-to-br from-primary/20 to-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <MessageCircle className="h-12 w-12 text-primary" />
              </div>
              <h3 className="text-2xl font-semibold text-gray-900 mb-3">
                No conversations yet
              </h3>
              <p className="text-gray-600 mb-8 max-w-md mx-auto leading-relaxed">
                Messages from potential buyers will appear here when they
                contact you about your listings. Start by listing your vehicle
                to begin conversations!
              </p>
              <div className="flex items-center justify-center space-x-4">
                <Button asChild className="text-white">
                  <Link href="/myAccount/new-listing">
                    <Car className="h-4 w-4 mr-2" />
                    List Your Vehicle
                  </Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/vehicles">Browse Vehicles</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <Footer />
    </div>
  );
}
