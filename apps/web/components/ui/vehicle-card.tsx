"use client";

import { CheckAvailabilityDialog } from "@/components/ui/check-availability-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useToast } from "@/hooks/useToast";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "convex/react";
import { ArrowUpRight, Gauge, Heart, MapPin, UserRound } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

interface VehicleCardProps {
  vehicle: Doc<"vehicles">;
  showFavorite?: boolean;
  layout?: "grid" | "list";
  showAvailability?: boolean;
}

export function VehicleCard({
  vehicle,
  showFavorite = true,
  layout = "grid",
  showAvailability = false,
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
      ? { userId: convexUser._id, vehicleId: vehicle._id }
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
          vehicleId: vehicle._id,
        });
        setIsFavorited(false);
        toast({
          title: "Removed from favorites",
          description: `${vehicle.title} has been removed from your favorites`,
        });
      } else {
        await addFavorite({
          userId: convexUser._id,
          vehicleId: vehicle._id,
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
    <Card
      className={cn(
        "group relative overflow-hidden border-border bg-card",
        showAvailability
          ? "ring-1 ring-transparent transition-[border-color,box-shadow] duration-200 motion-reduce:transition-none hover:border-primary hover:ring-primary"
          : "transition-[transform,box-shadow,border-color] duration-300 hover:-translate-y-1 hover:border-primary/35 hover:shadow-[0_20px_50px_hsl(var(--midnight)/0.13)]",
        layout === "list" && "md:grid md:grid-cols-[300px_1fr]"
      )}
    >
      {showAvailability && <Link
        href={`/vehicles/${vehicle._id}`}
        aria-label={`View ${vehicle.title}`}
        className="absolute inset-0 z-10 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
      ><span className="sr-only">{vehicle.title}</span></Link>}
      <div className="relative overflow-hidden bg-[hsl(var(--midnight))]">
        {vehicle.photos.length > 0 ? (
          <Image
            src={vehicle.photos[0]}
            alt={vehicle.title}
            width={400}
            height={300}
            className={cn(
              "w-full object-cover",
              !showAvailability && "transition-transform duration-500 group-hover:scale-[1.035]",
              layout === "list" ? "h-60 md:h-full md:min-h-64" : showAvailability ? "h-60" : "h-56"
            )}
          />
        ) : (
          <div className={cn("market-grid flex w-full items-center justify-center bg-[hsl(var(--gunmetal))]", layout === "list" ? "h-60 md:h-full" : showAvailability ? "h-60" : "h-56")}>
            <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[hsl(var(--chrome))]">Photo coming soon</span>
          </div>
        )}

        {showFavorite && convexUser && (
          <Button
            size="icon"
            variant="ghost"
            className="absolute right-3 top-3 z-20 border border-white/20 bg-[hsl(var(--midnight)/0.72)] text-white backdrop-blur-md hover:bg-[hsl(var(--midnight))]"
            onClick={handleFavoriteToggle}
            disabled={isLoading}
            aria-label={isFavorited ? "Remove from favorites" : "Add to favorites"}
          >
            <Heart
              className={`h-4 w-4 transition-colors ${
                isFavorited ? "fill-[hsl(var(--coral))] text-[hsl(var(--coral))]" : "text-white"
              } ${isLoading ? "opacity-50" : ""}`}
            />
          </Button>
        )}
      </div>

      <div className="flex min-w-0 flex-col">
      <CardContent className={cn("p-5", layout === "list" && "md:p-6")}>
        <div className="space-y-4">
          <div>
            <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              {vehicle.year} · {vehicle.make}
            </p>
            <h3 className="mt-2 line-clamp-1 text-lg font-semibold text-foreground">
              {vehicle.model}
            </h3>
            <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
              {vehicle.title}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <UserRound className="h-3.5 w-3.5 text-primary" /> {vehicle.sellerType === "dealer" ? "Dealer" : vehicle.sellerType === "private" ? "Private seller" : "Seller"}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-primary" /> {vehicle.location ? `${vehicle.location.city}, ${vehicle.location.state}` : "Location not provided"}
              </span>
            </div>
          </div>
          <div className="flex items-end justify-between border-t border-border pt-4">
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Gauge className="h-3.5 w-3.5 text-primary" />
              <span className="market-metric">{formatMileage(vehicle.mileage)}</span> {vehicle.mileageUnit ?? "mi"}
            </span>
            <span className="market-metric text-xl font-semibold text-foreground">
              {formatPrice(vehicle.price)}
            </span>
          </div>
        </div>
      </CardContent>

      <CardFooter className={cn("mt-auto p-5 pt-0", layout === "list" && "md:px-6 md:pb-6")}>
        {showAvailability ? <CheckAvailabilityDialog vehicle={vehicle} /> : (
          <Button asChild variant="outline" className="w-full justify-between">
            <Link href={`/vehicles/${vehicle._id}`}>
              View vehicle <ArrowUpRight className="h-4 w-4" />
            </Link>
          </Button>
        )}
      </CardFooter>
      </div>
    </Card>
  );
}
