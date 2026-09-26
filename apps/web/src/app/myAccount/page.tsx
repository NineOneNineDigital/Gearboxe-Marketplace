"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Footer } from "@/components/ui/footer";
import { Navbar } from "@/components/ui/navbar";
import { api } from "@/convex/_generated/api";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useAuth } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { Car, Eye, MessageCircle, Plus } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

export default function DashboardPage() {
  const { isLoading, isAuthenticated, user } = useCurrentUser();
  const { isSignedIn, isLoaded: authLoaded } = useAuth();

  // Always call hooks, but conditionally pass arguments
  const userVehicles = useQuery(
    api.vehicles.getVehiclesByUser,
    user?._id ? { userId: user._id } : "skip"
  );
  const unreadCount = useQuery(
    api.messages.getUnreadCount,
    user?._id ? { userId: user._id } : "skip"
  );

  // Show loading while auth is being determined
  if (!authLoaded || isLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  // Only redirect if Clerk auth is not loaded or user is not signed in
  if (!isSignedIn) {
    redirect("/sign-in");
  }

  // Show loading while Convex user data is being fetched
  // Don't redirect here - wait for user to be created/fetched
  if (!user) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-gray-600">Setting up your account...</p>
        </div>
      </div>
    );
  }

  const approvedVehicles =
    userVehicles?.filter((v) => v.status === "approved") || [];

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Navbar />

      <div className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Dashboard</h1>
          <p className="text-gray-600">
            Welcome back, {user?.name || "Seller"}!
          </p>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Button asChild size="lg" className="text-white h-20">
            <Link
              href="/myAccount/new-listing"
              className="flex flex-col items-center justify-center"
            >
              <Plus className="h-6 w-6 mb-2" />
              <span>List New Vehicle</span>
            </Link>
          </Button>

          <Button asChild variant="outline" size="lg" className="h-20">
            <Link
              href="/myAccount/my-listings"
              className="flex flex-col items-center justify-center"
            >
              <Eye className="h-6 w-6 mb-2" />
              <span>Manage Listings</span>
            </Link>
          </Button>

          <Button asChild variant="outline" size="lg" className="h-20">
            <Link
              href="/myAccount/messages"
              className="flex flex-col items-center justify-center"
            >
              <MessageCircle className="h-6 w-6 mb-2" />
              <span>Messages {unreadCount ? `(${unreadCount})` : ""}</span>
            </Link>
          </Button>
        </div>

        {/* Stats Summary */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">
                    Total Listings
                  </p>
                  <p className="text-2xl font-bold text-gray-900">
                    {userVehicles?.length || 0}
                  </p>
                </div>
                <Car className="h-8 w-8 text-primary" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">
                    Approved Listings
                  </p>
                  <p className="text-2xl font-bold text-gray-900">
                    {approvedVehicles.length}
                  </p>
                </div>
                <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                  <span className="text-green-600 font-bold text-sm">✓</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Listings */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Listings</CardTitle>
          </CardHeader>
          <CardContent>
            {userVehicles && userVehicles.length > 0 ? (
              <div className="space-y-4">
                {userVehicles.slice(0, 5).map((vehicle) => (
                  <div
                    key={vehicle._id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900">
                        {vehicle.title}
                      </h3>
                      <p className="text-sm text-gray-600">
                        {vehicle.year} {vehicle.make} {vehicle.model} • $
                        {vehicle.price.toLocaleString()}
                      </p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span
                        className={`px-2 py-1 text-xs rounded-full ${
                          vehicle.status === "approved"
                            ? "bg-green-100 text-green-800"
                            : vehicle.status === "pending"
                              ? "bg-yellow-100 text-yellow-800"
                              : "bg-red-100 text-red-800"
                        }`}
                      >
                        {vehicle.status}
                      </span>
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/vehicles/${vehicle._id}`}>View</Link>
                      </Button>
                    </div>
                  </div>
                ))}
                {userVehicles.length > 5 && (
                  <div className="text-center pt-4">
                    <Button asChild variant="outline">
                      <Link href="/myAccount/my-listings">
                        View All Listings
                      </Link>
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-12">
                <Car className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  No listings yet
                </h3>
                <p className="text-gray-600 mb-6">
                  Start by creating your first vehicle listing
                </p>
                <Button asChild className="text-white">
                  <Link href="/myAccount/new-listing">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Your First Listing
                  </Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Footer />
    </div>
  );
}
