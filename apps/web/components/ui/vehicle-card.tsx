"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { api } from "@/convex/_generated/api";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useToast } from "@/hooks/useToast";
import { useMutation, useQuery } from "convex/react";
import { Heart } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

interface Vehicle {
  _id: string;
  title: string;
  make: string;
  model: string;
  year: number;
  mileage: number;
  price: number;
  photos: string[];
  status: "pending" | "approved" | "rejected";
}

interface VehicleCardProps {
  vehicle: Vehicle;
  showFavorite?: boolean;
}

export function VehicleCard({
  vehicle,
  showFavorite = true,
}: VehicleCardProps) {
  const { user: convexUser } = useCurrentUser();
  const [isFavorited, setIsFavorited] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const addFavorite = useMutation(api.favorites.addFavorite);
  const removeFavorite = useMutation(api.favorites.removeFavorite);
  const isFavoritedQuery = useQuery(
    api.favorites.isFavorited,
    convexUser?._id
      ? { userId: convexUser._id, vehicleId: vehicle._id as any }
      : "skip"
  );

  // Update local state when query result changes
  useEffect(() => {
    if (isFavoritedQuery !== undefined) {
      setIsFavorited(isFavoritedQuery);
    }
  }, [isFavoritedQuery]);

  const handleFavoriteToggle = async () => {
    if (!convexUser || isLoading) return;

    setIsLoading(true);
    try {
      if (isFavorited) {
        await removeFavorite({
          userId: convexUser._id,
          vehicleId: vehicle._id as any,
        });
        setIsFavorited(false);
        toast({
          title: "Removed from favorites",
          description: `${vehicle.title} has been removed from your favorites`,
        });
      } else {
        await addFavorite({
          userId: convexUser._id,
          vehicleId: vehicle._id as any,
        });
        setIsFavorited(true);
        toast({
          title: "Added to favorites",
          description: `${vehicle.title} has been added to your favorites`,
        });
      }
    } catch (error) {
      console.error("Error toggling favorite:", error);
      toast({
        title: "Error",
        description: "Failed to update favorites. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
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

  return (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow bg-white border-gray-200">
      <div className="relative">
        {vehicle.photos.length > 0 ? (
          <Image
            src={vehicle.photos[0]}
            alt={vehicle.title}
            width={400}
            height={300}
            className="w-full h-48 object-cover"
          />
        ) : (
          <div className="w-full h-48 bg-gray-100 flex items-center justify-center">
            <span className="text-gray-500">No Image</span>
          </div>
        )}

        {showFavorite && convexUser && (
          <Button
            size="icon"
            variant="ghost"
            className="absolute top-2 right-2 bg-white/80 hover:bg-white"
            onClick={handleFavoriteToggle}
            disabled={isLoading}
          >
            <Heart
              className={`h-4 w-4 transition-colors ${
                isFavorited ? "fill-red-500 text-red-500" : "text-gray-600"
              } ${isLoading ? "opacity-50" : ""}`}
            />
          </Button>
        )}
      </div>

      <CardContent className="p-4">
        <div className="space-y-2">
          <h3 className="font-semibold text-lg line-clamp-1 text-gray-900">
            {vehicle.title}
          </h3>
          <p className="text-sm text-gray-600">
            {vehicle.year} {vehicle.make} {vehicle.model}
          </p>
          <div className="flex justify-between items-center text-sm text-gray-600">
            <span>{formatMileage(vehicle.mileage)} miles</span>
            <span className="font-semibold text-primary text-lg">
              {formatPrice(vehicle.price)}
            </span>
          </div>
        </div>
      </CardContent>

      <CardFooter className="p-4 pt-0">
        <Button asChild className="w-full text-white">
          <Link href={`/vehicles/${vehicle._id}`}>View Details</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
