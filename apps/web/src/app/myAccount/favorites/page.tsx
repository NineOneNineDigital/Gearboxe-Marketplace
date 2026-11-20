"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Footer } from "@/components/ui/footer";
import { Navbar } from "@/components/ui/navbar";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useToast } from "@/hooks/useToast";
import { useAuth } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import { Eye, Heart, SortAsc } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { isTrustedImageUrl } from "@/lib/trusted-images";
import { redirect } from "next/navigation";
import { useEffect, useState } from "react";

export default function FavoritesPage() {
  const { isLoading, user } = useCurrentUser();
  const { isSignedIn, isLoaded: authLoaded } = useAuth();
  const [sortBy, setSortBy] = useState<
    "newest" | "oldest" | "price-low" | "price-high"
  >("newest");
  const { toast } = useToast();
  const [selectedIds, setSelectedIds] = useState<Id<"vehicles">[]>([]);
  const [comparisonBusy, setComparisonBusy] = useState(false);
  const [comparisonMessage, setComparisonMessage] = useState("");

  // Always call hooks to maintain hook order
  const favorites = useQuery(
    api.favorites.getFavoritesByUser,
    user?._id ? {} : "skip"
  );
  const removeFavorite = useMutation(api.favorites.removeFavorite);
  const createComparison = useMutation(api.comparisons.create);
  const revokeComparison = useMutation(api.comparisons.revoke);
  const comparisons = useQuery(api.comparisons.listMine, user?._id ? {} : "skip");

  useEffect(() => {
    if (!favorites) return;
    setSelectedIds(previous => {
      const visible = previous.filter(id => favorites.some((vehicle: { _id: Id<"vehicles"> }) => vehicle._id === id));
      return visible.length === previous.length ? previous : visible;
    });
  }, [favorites]);

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
      const vehicle = favorites?.find((v: { _id: Id<"vehicles">; title: string }) => v._id === vehicleId);
      await removeFavorite({
        vehicleId: vehicleId as Id<"vehicles">,
      });
      setSelectedIds(previous => previous.filter(id => id !== vehicleId));
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

  function toggleComparison(id: Id<"vehicles">) {
    setComparisonMessage("");
    setSelectedIds(previous => previous.includes(id) ? previous.filter(value => value !== id)
      : previous.length < 4 ? [...previous, id] : previous);
  }

  async function makeComparison() {
    if (selectedIds.length < 2 || selectedIds.length > 4) return;
    setComparisonBusy(true); setComparisonMessage("");
    try {
      const result = await createComparison({ vehicleIds: selectedIds });
      setSelectedIds([]);
      try {
        await navigator.clipboard.writeText(new URL(`/compare/${result.token}`, window.location.origin).href);
        setComparisonMessage("Comparison link created and copied. Its car selection stays fixed even if your favorites change.");
      } catch {
        setComparisonMessage("Comparison link created. Copy it from your links below. Its car selection stays fixed even if your favorites change.");
      }
    } catch (error) {
      setComparisonMessage(error instanceof Error ? error.message : "Could not create the comparison link.");
    } finally { setComparisonBusy(false); }
  }

  async function deleteComparison(id: Id<"comparisons">) {
    setComparisonBusy(true); setComparisonMessage("");
    try { await revokeComparison({ id }); setComparisonMessage("Comparison link deleted. Its public URL no longer works."); }
    catch (error) { setComparisonMessage(error instanceof Error ? error.message : "Could not delete the comparison link."); }
    finally { setComparisonBusy(false); }
  }

  async function copyComparison(token: string) {
    try {
      await navigator.clipboard.writeText(new URL(`/compare/${token}`, window.location.origin).href);
      setComparisonMessage("Comparison link copied.");
    } catch {
      setComparisonMessage("Could not copy the link. Open the comparison and copy its address from your browser.");
    }
  }

  return (
    <div className="market-page min-h-screen flex flex-col">
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
                    onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
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

        <section className="mb-8 rounded-xl border bg-white p-5" aria-labelledby="compare-favorites-title">
          <h2 id="compare-favorites-title" className="text-xl font-semibold">Compare and share cars</h2>
          <p className="mt-2 text-sm text-gray-600">Choose two to four saved cars. A link keeps exactly those cars; prices and availability update when someone opens it. Private listings will be hidden.</p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button type="button" disabled={comparisonBusy || selectedIds.length < 2 || selectedIds.length > 4} onClick={() => void makeComparison()}>{comparisonBusy ? "Working…" : `Create link for ${selectedIds.length} cars`}</Button>
            {selectedIds.length > 0 && <Button type="button" variant="outline" disabled={comparisonBusy} onClick={() => setSelectedIds([])}>Clear selection</Button>}
          </div>
          {selectedIds.length === 4 && <p className="mt-2 text-sm text-gray-600">Four cars selected. Remove one to choose another.</p>}
          {comparisonMessage && <p role="status" className="mt-3 text-sm">{comparisonMessage}</p>}
          {comparisons === undefined ? <p role="status" className="mt-4 text-sm">Loading your comparison links…</p> : comparisons.length > 0 && <div className="mt-5">
            <h3 className="font-medium">Your links</h3>
            <ul className="mt-2 space-y-2">{comparisons.map((comparison: { id: Id<"comparisons">; token: string; vehicleIds: Id<"vehicles">[]; createdAt: number }) => <li key={comparison.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3 text-sm">
              <div><Link className="font-medium underline" href={`/compare/${comparison.token}`}>View comparison</Link><p className="text-gray-600">{comparison.vehicleIds.length} cars · Created {new Date(comparison.createdAt).toLocaleDateString()}</p></div>
              <div className="flex gap-2">
                <Button type="button" size="sm" variant="outline" onClick={() => void copyComparison(comparison.token)}>Copy link</Button>
                <Button type="button" size="sm" variant="outline" disabled={comparisonBusy} onClick={() => void deleteComparison(comparison.id)}>Delete link</Button>
              </div>
            </li>)}</ul>
          </div>}
        </section>

        {/* Favorites Grid */}
        {sortedFavorites && sortedFavorites.length > 0 ? (
          <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {sortedFavorites.map((vehicle) => (
              <Card
                key={vehicle._id}
                className="overflow-hidden hover:shadow-lg transition-shadow"
              >
                <div className="relative">
                  {vehicle.status === "reserved" && <span className="absolute left-2 top-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-950">Reserved</span>}
                  {isTrustedImageUrl(vehicle.thumbnailPhotos?.[0] ?? vehicle.photos[0] ?? "") ? (
                    <Image
                      width={800}
                      height={600}
                      src={vehicle.thumbnailPhotos?.[0] ?? vehicle.photos[0]}
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
                  <label className="mb-3 flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={selectedIds.includes(vehicle._id)} disabled={!selectedIds.includes(vehicle._id) && selectedIds.length >= 4} onChange={() => toggleComparison(vehicle._id)} aria-label={`Select ${vehicle.title} for comparison`} />Compare this car</label>
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
