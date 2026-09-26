"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Footer } from "@/components/ui/footer";
import { Navbar } from "@/components/ui/navbar";
import { api } from "@/convex/_generated/api";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useToast } from "@/hooks/useToast";
import { useAuth } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import { Eye, Heart, SortAsc } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { useState } from "react";

export default function FavoritesPage() {
  const { isLoading, isAuthenticated, user } = useCurrentUser();
  const { isSignedIn, isLoaded: authLoaded } = useAuth();
  const [sortBy, setSortBy] = useState<
    "newest" | "oldest" | "price-low" | "price-high"
  >("newest");
  const { toast } = useToast();

  // Always call hooks to maintain hook order
  const favorites = useQuery(
    api.favorites.getFavoritesByUser,
    user?._id ? { userId: user._id } : "skip"
  );
  const removeFavorite = useMutation(api.favorites.removeFavorite);

  // Show loading while auth is being determined
  if (!authLoaded || isLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading favorites...</p>
        </div>
      </div>
    );
  }

  // Only redirect if Clerk auth is not loaded or user is not signed in
  if (!isSignedIn) {
    redirect("/sign-in");
  }

  // Show loading while Convex user data is being fetched
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

  const handleRemoveFavorite = async (vehicleId: string) => {
    try {
      const vehicle = favorites?.find((v) => v._id === vehicleId);
      await removeFavorite({
        userId: user._id,
        vehicleId: vehicleId as any,
      });
      toast({
        title: "Removed from favorites",
        description: vehicle
          ? `${vehicle.title} has been removed from your favorites`
          : "Vehicle removed from favorites",
      });
    } catch (error) {
      console.error("Error removing favorite:", error);
      toast({
        title: "Error",
        description: "Failed to remove from favorites. Please try again.",
        variant: "destructive",
      });
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);
  };

  const formatMileage = (mileage: number) => {
    return new Intl.NumberFormat("en-US").format(mileage);
  };

  // Sort favorites based on selected sort option
  const sortedFavorites = favorites
    ? [...favorites].sort((a, b) => {
        switch (sortBy) {
          case "newest":
            return b.createdAt - a.createdAt;
          case "oldest":
            return a.createdAt - b.createdAt;
          case "price-low":
            return a.price - b.price;
          case "price-high":
            return b.price - a.price;
          default:
            return 0;
        }
      })
    : [];

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Navbar />

      <div className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">My Favorites</h1>
              <p className="text-gray-600">
                {favorites
                  ? `${favorites.length} vehicles saved`
                  : "Vehicles you've saved for later"}
              </p>
            </div>

            {/* Controls */}
            {favorites && favorites.length > 0 && (
              <div className="flex items-center space-x-4 mt-4 sm:mt-0">
                {/* Sort Dropdown */}
                <div className="flex items-center space-x-2">
                  <SortAsc className="h-4 w-4 text-gray-500" />
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="text-sm text-gray-900 border border-gray-300 rounded-lg px-3 py-2 bg-white hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-colors"
                  >
                    <option value="newest">Newest First</option>
                    <option value="oldest">Oldest First</option>
                    <option value="price-low">Price: Low to High</option>
                    <option value="price-high">Price: High to Low</option>
                  </select>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Favorites Grid */}
        {sortedFavorites && sortedFavorites.length > 0 ? (
          <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {sortedFavorites.map((vehicle) => (
              <Card
                key={vehicle._id}
                className="overflow-hidden hover:shadow-lg transition-shadow"
              >
                <div className="relative">
                  {vehicle.photos.length > 0 ? (
                    <img
                      src={vehicle.photos[0]}
                      alt={vehicle.title}
                      className="w-full object-cover h-48"
                    />
                  ) : (
                    <div className="w-full bg-gray-200 flex items-center justify-center h-48">
                      <span className="text-gray-500">No Image</span>
                    </div>
                  )}

                  {/* Remove from favorites button */}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveFavorite(vehicle._id)}
                    className="absolute top-2 right-2 bg-white/90 hover:bg-white text-red-600 hover:text-red-700"
                  >
                    <Heart className="h-4 w-4 fill-current" />
                  </Button>
                </div>

                <CardContent className="p-4">
                  <div>
                    <h3 className="font-semibold text-lg line-clamp-1 mb-2">
                      {vehicle.title}
                    </h3>
                    <p className="text-sm text-gray-600 mb-2">
                      {vehicle.year} {vehicle.make} {vehicle.model}
                    </p>
                    <div className="flex justify-between items-center text-sm text-gray-600 mb-4">
                      <span>{formatMileage(vehicle.mileage)} miles</span>
                      <span className="font-semibold text-primary text-lg">
                        {formatPrice(vehicle.price)}
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button asChild className="w-full text-white">
                      <Link href={`/vehicles/${vehicle._id}`}>
                        <Eye className="h-4 w-4 mr-1" />
                        View Details
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="w-full">
            <Card>
              <CardContent className="text-center py-16">
                <div className="text-gray-400 mb-4">
                  <Heart className="h-16 w-16 mx-auto" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  No favorites yet
                </h3>
                <p className="text-gray-600 mb-6">
                  Start browsing vehicles and save your favorites for easy
                  access
                </p>
                <Button asChild className="text-white">
                  <Link href="/vehicles">
                    <Eye className="h-4 w-4 mr-2" />
                    Browse Vehicles
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
}
