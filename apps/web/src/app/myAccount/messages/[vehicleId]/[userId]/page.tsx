"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Footer } from "@/components/ui/footer";
import { MessageThread } from "@/components/ui/message-thread";
import { Navbar } from "@/components/ui/navbar";
import { api } from "@/convex/_generated/api";
import { useUser } from "@clerk/nextjs";
import { useConvexAuth, useQuery } from "convex/react";
import { ArrowLeft, Car, User } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { use } from "react";

interface ConversationPageProps {
  params: Promise<{
    vehicleId: string;
    userId: string;
  }>;
}

export default function ConversationPage({ params }: ConversationPageProps) {
  const { vehicleId, userId } = use(params);
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { user } = useUser();

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

  // Always call hooks to maintain hook order
  const currentUser = useQuery(
    api.users.getUser,
    user?.id ? { clerkId: user.id } : "skip"
  );
  const vehicle = useQuery(
    api.vehicles.getVehicleById,
    vehicleId ? { id: vehicleId as any } : "skip"
  );
  const otherUser = useQuery(
    api.users.getUserById,
    userId ? { id: userId as any } : "skip"
  );

  // Get conversation by participants
  const conversation = useQuery(
    api.conversations.getConversationByParticipants,
    currentUser?._id && vehicleId && userId
      ? {
          vehicleId: vehicleId as any,
          participant1Id: currentUser._id as any,
          participant2Id: userId as any,
        }
      : "skip"
  );

  if (!isAuthenticated || !user) {
    redirect("/sign-in");
  }

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Navbar />

      <div className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center space-x-2 text-sm text-gray-600 mb-4">
            <Link
              href="/myAccount/messages"
              className="hover:text-primary transition-colors flex items-center"
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Messages
            </Link>
            <span>/</span>
            <span className="font-medium">Conversation</span>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Conversation {otherUser && `with ${otherUser.name}`}
              </h1>
            </div>
            {vehicle && (
              <Button asChild variant="outline">
                <Link href={`/vehicles/${vehicle._id}`}>
                  <Car className="h-4 w-4 mr-2" />
                  View Vehicle
                </Link>
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Vehicle Info Sidebar */}
          {vehicle && (
            <div className="lg:col-span-1">
              <Card className="mb-6 shadow-sm hover:shadow-md transition-shadow duration-200">
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg font-semibold text-gray-900">
                    Vehicle Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-6">
                    <div className="text-center">
                      <h3 className="font-bold text-xl text-gray-900 mb-2">
                        {vehicle.year} {vehicle.make} {vehicle.model}
                      </h3>
                      <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium text-gray-600">
                            Mileage
                          </span>
                          <span className="text-sm font-semibold text-gray-900">
                            {vehicle.mileage.toLocaleString()} miles
                          </span>
                        </div>
                        <div className="border-t border-gray-200 pt-3">
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-medium text-gray-600">
                              Price
                            </span>
                            <span className="font-bold text-primary text-xl">
                              {formatPrice(vehicle.price)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Vehicle Owner Sidebar */}
              {otherUser && (
                <Card className="shadow-sm hover:shadow-md transition-shadow duration-200">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-lg font-semibold text-gray-900">
                      Vehicle Owner
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="space-y-6">
                      <div className="text-center">
                        <div className="w-16 h-16 bg-gradient-to-br from-primary/20 to-primary/10 rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
                          <User className="h-8 w-8 text-primary" />
                        </div>
                        <h3 className="font-bold text-lg text-gray-900 mb-3">
                          {otherUser.name}
                        </h3>
                        <div className="bg-gray-50 rounded-lg p-4">
                          <div className="flex items-center justify-center space-x-2 text-sm text-gray-600">
                            <span className="font-medium">Member since</span>
                            <span className="font-semibold text-gray-900">
                              {new Date(otherUser.createdAt).toLocaleDateString(
                                "en-US",
                                {
                                  year: "numeric",
                                  month: "long",
                                }
                              )}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Message Thread */}
          <div className="lg:col-span-3">
            <MessageThread
              vehicleId={vehicleId as any}
              recipientId={userId as any}
              recipientName={otherUser?.name || "User"}
              conversationId={conversation?._id}
            />
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
