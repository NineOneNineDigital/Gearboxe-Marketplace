"use client";

import { popupPaymentsEnabled } from "@/convex/lib/environment";
import { OfferSubmit } from "@/components/ui/offer-submit";
import { SafetyControls } from "@/components/ui/safety-controls";
import { VehicleDetails } from "@/components/ui/vehicle-details";
import { isTrustedImageUrl } from "@/lib/trusted-images";
import { VehiclePhotoCarousel } from "@/components/ui/vehicle-photo-carousel";
import { Button } from "@/components/ui/button";
import { Footer } from "@/components/ui/footer";
import { Navbar } from "@/components/ui/navbar";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useToast } from "@/hooks/useToast";
import { recordLocalView } from "@/lib/recently-viewed";
import { useAuth } from "@clerk/nextjs";
import { isAvailableNow, useAvailabilityBoundary } from "@/lib/use-availability-boundary";
import { discoveryUrl } from "@/lib/discovery-url";
import type { SharedListing } from "@/lib/public-listing-seo";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { makeFunctionReference } from "convex/server";
import {
  Calendar,
  Car,
  ChevronLeft,
  Clock,
  Copy,
  Gauge,
  Heart,
  Mail,
  MapPin,
  Share2,
  User,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

interface VehiclePageProps {
  id: string;
}

const sharedListingQuery = makeFunctionReference<"query", { id: string }, SharedListing>("discovery:sharedListing");

export default function VehicleDetailClient({ id }: VehiclePageProps) {
  const { isAuthenticated, isLoading: isAuthLoading } = useConvexAuth();
  const { isLoaded: clerkAuthLoaded, isSignedIn } = useAuth();
  const { user: convexUser } = useCurrentUser();
  const accountPending = !clerkAuthLoaded || isAuthLoading || ((isSignedIn || isAuthenticated) && !convexUser);
  const [isFavorited, setIsFavorited] = useState(false);
  const [isFavoriteLoading, setIsFavoriteLoading] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const { toast } = useToast();

  const sharedListing = useQuery(sharedListingQuery, { id });
  const vehicle = useQuery(api.vehicles.getPublicVehicleById,
    sharedListing?.kind === "available" ? { id: id as Id<"vehicles"> } : "skip");
  const seller = useQuery(
    api.users.getUserById,
    vehicle?.userId ? { id: vehicle.userId } : "skip"
  );
  const relatedVehicles = useQuery(api.discovery.related, vehicle?._id ? { id: vehicle._id } : "skip");
  const addFavorite = useMutation(api.favorites.addFavorite);
  const recordView = useMutation(api.vehicles.recordView);
  const recordRecent = useMutation(api.recentViews.record);
  const removeFavorite = useMutation(api.favorites.removeFavorite);
  const isFavoritedQuery = useQuery(
    api.favorites.isFavorited,
    isAuthenticated && convexUser?._id && vehicle?._id
      ? { vehicleId: vehicle._id }
      : "skip"
  );

  const availabilityVehicles = useMemo(() => vehicle ? [vehicle, ...(relatedVehicles ?? [])] : relatedVehicles ?? [], [vehicle, relatedVehicles]);
  const availabilityNow = useAvailabilityBoundary(availabilityVehicles);
  const filteredRelatedVehicles = (relatedVehicles ?? []).filter(candidate => isAvailableNow(candidate, availabilityNow));
  const viewVehicleId = vehicle?._id;
  const viewVehicleStatus = vehicle?.status;
  useEffect(() => {
    if (viewVehicleId && viewVehicleStatus && ["active", "approved", "reserved"].includes(viewVehicleStatus)) recordLocalView(viewVehicleId);
  }, [viewVehicleId, viewVehicleStatus]);
  useEffect(() => {
    if (convexUser?._id && viewVehicleId && viewVehicleStatus && ["active", "approved", "reserved"].includes(viewVehicleStatus)) void recordRecent({ id: viewVehicleId }).catch(() => undefined);
  }, [convexUser?._id, viewVehicleId, viewVehicleStatus, recordRecent]);

  useEffect(() => {
    if (!viewVehicleId || !viewVehicleStatus || isAuthLoading || !["active", "approved", "reserved"].includes(viewVehicleStatus)) return;
    try {
      const key = "gearboxe-listing-view-session";
      let visitorKey = sessionStorage.getItem(key);
      if (!visitorKey) { visitorKey = crypto.randomUUID(); sessionStorage.setItem(key, visitorKey); }
      void recordView({ id: viewVehicleId, visitorKey }).catch(() => undefined);
    } catch { /* Browsing remains available when storage or analytics is unavailable. */ }
  }, [viewVehicleId, viewVehicleStatus, isAuthLoading, recordView]);

  // Update favorite state when query result changes
  useEffect(() => {
    if (isFavoritedQuery !== undefined) {
      setIsFavorited(isFavoritedQuery);
    }
  }, [isFavoritedQuery]);

  useEffect(() => {
    // Close share menu when clicking outside
    const handleClickOutside = (e: MouseEvent) => {
      if (showShareMenu) {
        const target = e.target as Element;
        if (!target.closest("[data-share-menu]")) {
          setShowShareMenu(false);
        }
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showShareMenu]);

  // Loading state
  if (sharedListing?.kind === "sold") {
    const similar = discoveryUrl({ make: sharedListing.make, model: sharedListing.model, state: sharedListing.location?.state });
    return <div className="market-page min-h-screen flex flex-col">
      <Navbar />
      <main className="market-shell flex-1 py-16 sm:py-24">
        <div className="mx-auto max-w-xl rounded-2xl border border-black/10 bg-white p-8 text-center sm:p-12">
          <Car className="mx-auto mb-5 h-10 w-10 text-primary" aria-hidden="true" />
          <h1 className="text-3xl font-semibold">This car has sold</h1>
          <p className="mt-5 text-xl">{sharedListing.year} {sharedListing.make} {sharedListing.model}</p>
          {sharedListing.location && <p className="mt-2 text-sm text-gray-600">{sharedListing.location.city}, {sharedListing.location.state}</p>}
          <Button asChild className="mt-8"><Link href={similar}>Browse similar cars</Link></Button>
        </div>
      </main>
      <Footer />
    </div>;
  }

  if (sharedListing?.kind === "unavailable") {
    return <div className="market-page min-h-screen flex flex-col">
      <Navbar />
      <main className="market-shell flex-1 py-16 sm:py-24 text-center">
        <h1 className="text-3xl font-semibold">Listing unavailable</h1>
        <Button asChild className="mt-8"><Link href="/vehicles">Browse cars</Link></Button>
      </main>
      <Footer />
    </div>;
  }

  if (sharedListing === undefined || vehicle === undefined) {
    return (
      <div className="market-page min-h-screen flex flex-col">
        <Navbar />
        <div className="market-shell flex-1 py-8 sm:py-10">
          <div className="animate-pulse">
            <div className="h-6 bg-gray-200 rounded w-1/4 mb-6"></div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-8">
                <div className="bg-white rounded-xl p-6">
                  <div className="h-8 bg-gray-200 rounded w-3/4 mb-4"></div>
                  <div className="h-6 bg-gray-200 rounded w-1/2 mb-4"></div>
                  <div className="h-12 bg-gray-200 rounded w-1/3"></div>
                </div>
                <div className="bg-white rounded-xl h-96"></div>
              </div>
              <div className="space-y-6">
                <div className="bg-white rounded-xl p-6 h-64"></div>
                <div className="bg-white rounded-xl p-6 h-48"></div>
              </div>
            </div>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  if (!vehicle || !isAvailableNow(vehicle, availabilityNow)) {
    return notFound();
  }

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

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast({
        title: "Link copied!",
        description: "Vehicle link has been copied to your clipboard",
      });
      setShowShareMenu(false);
    } catch (error) {
      console.error("Error copying link:", error);
      toast({
        title: "Error",
        description: "Failed to copy link. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleShareEmail = () => {
    const subject = `Check out this ${vehicle.year} ${vehicle.make} ${vehicle.model}`;
    const body = `I found this vehicle on Car Market and thought you might be interested:\n\n${vehicle.title}\n${vehicle.year} ${vehicle.make} ${vehicle.model}\nPrice: ${formatPrice(vehicle.price)}\n\nView it here: ${window.location.href}`;
    const mailtoLink = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(mailtoLink);
    setShowShareMenu(false);
  };

  const handleFavoriteToggle = async () => {
    if (!convexUser?.emailVerified || !vehicle || isFavoriteLoading) return;

    setIsFavoriteLoading(true);
    try {
      if (isFavorited) {
        await removeFavorite({
          vehicleId: vehicle._id,
        });
        setIsFavorited(false);
        toast({
          title: "Removed from favorites",
          description: `${vehicle.title} has been removed from your favorites`,
        });
      } else {
        await addFavorite({
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
      setIsFavoriteLoading(false);
    }
  };

  // Loading state
  if (vehicle === undefined) {
    return (
      <div className="market-page min-h-screen flex flex-col">
        <Navbar />
        <div className="market-shell flex-1 py-8 sm:py-10">
          <div className="animate-pulse">
            <div className="h-6 bg-gray-200 rounded w-1/4 mb-6"></div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-8">
                <div className="bg-white rounded-xl p-6">
                  <div className="h-8 bg-gray-200 rounded w-3/4 mb-4"></div>
                  <div className="h-6 bg-gray-200 rounded w-1/2 mb-4"></div>
                  <div className="h-12 bg-gray-200 rounded w-1/3"></div>
                </div>
                <div className="bg-white rounded-xl h-96"></div>
              </div>
              <div className="space-y-6">
                <div className="bg-white rounded-xl p-6 h-64"></div>
                <div className="bg-white rounded-xl p-6 h-48"></div>
              </div>
            </div>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  if (!vehicle) {
    return notFound();
  }

  return (
    <>


      <div className="market-page min-h-screen flex flex-col">
        <Navbar />

        <div className="market-shell flex-1 py-8 sm:py-10">
          {/* Breadcrumb */}
          <div className="flex items-center space-x-2 text-sm text-gray-600 mb-6">
            <Link
              href="/vehicles"
              className="hover:text-primary transition-colors flex items-center"
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Vehicles
            </Link>
            <span>/</span>
            <span className="font-medium">{vehicle.title}</span>
          </div>

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
            {/* Main Content */}
            <div className="flex min-w-0 flex-col gap-6">
              {/* Vehicle Header */}
              <div className="order-2 rounded-xl border border-black/10 bg-white p-6 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between mb-4">
                  <div className="flex-1">
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">
                      {vehicle.title}
                    </h1>
                    {vehicle.status === "reserved" && <p className="mb-3 inline-flex rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-sm font-semibold text-amber-950">Reserved</p>}
                    <p className="text-xl text-gray-600 mb-4">
                      {vehicle.year} {vehicle.make} {vehicle.model}
                    </p>
                    <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
                      <div className="flex items-center space-x-1">
                        <Gauge className="h-4 w-4" />
                        <span>{formatMileage(vehicle.mileage)} {vehicle.mileageUnit ?? "mi"}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Calendar className="h-4 w-4" />
                        <span>{vehicle.year}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Clock className="h-4 w-4" />
                        <span>Listed {formatDate(vehicle.createdAt)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Listing actions */}
                  <div className="flex items-center space-x-2 mt-4 sm:mt-0">
                    <div className="relative" data-share-menu>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowShareMenu(!showShareMenu)}
                        className="flex items-center bg-primary border-primary hover:bg-primary/90 text-white hover:text-white transition-all duration-200 shadow-sm hover:shadow-md"
                      >
                        <Share2 className="h-4 w-4 mr-2" />
                        Share
                      </Button>

                      {/* Share Menu Dropdown */}
                      {showShareMenu && (
                        <div className="absolute top-full right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 z-50 overflow-hidden">
                          <div className="p-3 border-b border-gray-100">
                            <h3 className="text-sm font-semibold text-gray-900">
                              Share this vehicle
                            </h3>
                            <p className="text-xs text-gray-600 mt-1">
                              {vehicle.title}
                            </p>
                          </div>

                          <div className="p-2">
                            {/* Copy Link */}
                            <button
                              onClick={handleCopyLink}
                              className="w-full flex items-center space-x-3 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-md transition-colors"
                            >
                              <Copy className="h-4 w-4 text-green-500" />
                              <span>Copy link</span>
                            </button>

                            {/* Email */}
                            <button
                              onClick={handleShareEmail}
                              className="w-full flex items-center space-x-3 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-md transition-colors"
                            >
                              <Mail className="h-4 w-4 text-red-500" />
                              <span>Email</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                    {convexUser?.emailVerified ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleFavoriteToggle}
                        disabled={isFavoriteLoading}
                        className="flex items-center"
                      >
                        <Heart
                          className={`h-4 w-4 mr-2 transition-colors ${
                            isFavorited ? "fill-red-500 text-red-500" : ""
                          } ${isFavoriteLoading ? "opacity-50" : ""}`}
                        />
                        {isFavorited ? "Saved" : "Save"}
                      </Button>
                    ) : accountPending ? (
                      <Button variant="outline" size="sm" disabled><Heart className="mr-2 h-4 w-4" />Finishing account setup…</Button>
                    ) : (
                      <Button asChild variant="outline" size="sm">
                        <Link href={convexUser ? `/myAccount/safety?next=${encodeURIComponent(`/vehicles/${vehicle._id}`)}` : `/sign-in?next=${encodeURIComponent(`/vehicles/${vehicle._id}`)}`}>
                          <Heart className="mr-2 h-4 w-4" />{convexUser ? "Verify email to save" : "Sign in to save"}
                        </Link>
                      </Button>
                    )}
                  </div>
                </div>

              </div>

              <VehiclePhotoCarousel
                key={vehicle._id}
                photos={vehicle.photos}
                thumbnailPhotos={vehicle.thumbnailPhotos}
                captions={vehicle.photoCaptions}
                title={vehicle.title}
                vehicleLabel={`${vehicle.year} ${vehicle.make} ${vehicle.model}`}
                className="order-1"
              />

              <div className="order-3">
                <VehicleDetails vehicle={vehicle} />
              </div>
            </div>

            {/* Sidebar */}
            <div className="space-y-6 lg:sticky lg:top-5 lg:self-start">
              <div className="rounded-xl border border-black/10 bg-white p-6 shadow-[0_16px_44px_hsl(var(--midnight)/0.08)]">
                <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.13em] text-muted-foreground">Asking price</p>
                <p className="market-metric mt-2 text-4xl font-semibold tracking-[-0.05em] text-[hsl(var(--midnight))]">
                  {formatPrice(vehicle.price)}
                </p>
                {vehicle.status === "reserved" && <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-950">This vehicle is Reserved under a nonbinding agreement in principle and is not available for a new offer. It may become available again. You can ask the seller about availability.</p>}
                <div className="my-5 border-t border-black/10" />
                {convexUser?.emailVerified ? (
                  <Button asChild size="lg" className="w-full">
                    <Link href={`/myAccount/messages/${vehicle._id}/${vehicle.userId}`}>
                      <Mail className="h-4 w-4" /> {vehicle.status === "reserved" ? "Ask about availability" : "Message seller"}
                    </Link>
                  </Button>
                ) : convexUser ? (
                  <Button asChild size="lg" className="w-full">
                    <Link href={`/myAccount/safety?next=${encodeURIComponent(`/myAccount/messages/${vehicle._id}/${vehicle.userId}`)}`}>Verify email to message seller</Link>
                  </Button>
                ) : accountPending ? (
                  <div role="status" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">Your account is finishing setup. This page will update when it is ready. If it takes more than a few minutes, contact <a className="underline" href="mailto:Help@gearboxe.com">support</a>.</div>
                ) : (
                  <Button asChild size="lg" className="w-full">
                    <Link href={`/sign-in?next=${encodeURIComponent(`/myAccount/messages/${vehicle._id}/${vehicle.userId}`)}`}>Sign in to contact seller</Link>
                  </Button>
                )}
                {process.env.NEXT_PUBLIC_OFFERS_ENABLED === "true" && vehicle.status !== "reserved" && convexUser?._id !== vehicle.userId && (
                  convexUser?.emailVerified ? <OfferSubmit vehicleId={vehicle._id} sellerId={vehicle.userId} /> :
                    convexUser ? <Button asChild variant="outline" size="lg" className="mt-3 w-full"><Link href={`/myAccount/safety?next=${encodeURIComponent(`/vehicles/${vehicle._id}?offer=1`)}`}>Verify email to make an offer</Link></Button> :
                      !accountPending && <Button asChild variant="outline" size="lg" className="mt-3 w-full"><Link href={`/sign-in?next=${encodeURIComponent(`/vehicles/${vehicle._id}?offer=1`)}`}>Sign in to make an offer</Link></Button>
                )}
                <p className="mt-4 text-center text-[11px] leading-5 text-muted-foreground">
                  Gearboxe Market connects buyers and private sellers directly.
                </p>
                <SafetyControls vehicleId={vehicle._id} targetUserId={vehicle.userId} />
              </div>

              {/* Seller Info */}
              {seller && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                  <div className="flex items-center space-x-3 mb-4">
                    <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                      <User className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">
                        {seller.name}
                      </h3>
                      <p className="text-sm text-gray-600">{vehicle.sellerType === "dealer" ? "Dealer" : vehicle.sellerType === "private" ? "Private seller" : "Seller"}</p>
                    </div>
                  </div>

                  <div className="space-y-3 mb-6">
                    <div className="flex flex-wrap gap-2 text-xs">
                      {seller.emailVerified && <span className="rounded-full bg-green-50 px-2 py-1 text-green-800">Email verified</span>}
                      {seller.phoneVerified && <span className="rounded-full bg-green-50 px-2 py-1 text-green-800">Phone verified</span>}
                      {seller.identityVerified && <span className="rounded-full bg-green-50 px-2 py-1 text-green-800">Identity reviewed</span>}
                      {vehicle.ownershipAttestedAt && <span className="rounded-full bg-gray-100 px-2 py-1 text-gray-700">Ownership attested</span>}
                    </div>
                    <div className="flex items-center space-x-2 text-sm text-gray-600">
                      <MapPin className="h-4 w-4" />
                      <span>{vehicle.location ? `${vehicle.location.city}, ${vehicle.location.state}` : "Location not provided"}</span>
                    </div>
                  </div>

                  <p className="border-t border-gray-100 pt-4 text-xs leading-5 text-gray-500">
                    Verification and seller attestations do not guarantee ownership or a safe transaction. Ask about ownership history, maintenance, condition, and availability before arranging a meeting.
                  </p>
                </div>
              )}

              {/* Related Vehicles */}
              {filteredRelatedVehicles.length > 0 && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                  <h3 className="font-semibold text-gray-900 mb-4">
                    Similar Vehicles
                  </h3>
                  <div className="space-y-4">
                    {filteredRelatedVehicles.map((relatedVehicle) => (
                      <Link
                        key={relatedVehicle._id}
                        href={`/vehicles/${relatedVehicle._id}`}
                        className="block group"
                      >
                        <div className="flex space-x-3 p-3 rounded-lg hover:bg-gray-50 transition-colors">
                          {isTrustedImageUrl(relatedVehicle.thumbnailPhotos?.[0] ?? relatedVehicle.photos[0] ?? "") ? (
                            <Image
                              src={relatedVehicle.thumbnailPhotos?.[0] ?? relatedVehicle.photos[0]}
                              alt={relatedVehicle.title}
                              width={80}
                              height={60}
                              className="w-20 h-15 object-cover rounded-lg"
                            />
                          ) : (
                            <div className="w-20 h-15 bg-gray-200 rounded-lg flex items-center justify-center">
                              <Car className="h-6 w-6 text-gray-400" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-gray-900 group-hover:text-primary transition-colors truncate">
                              {relatedVehicle.title}
                            </h4>
                            {relatedVehicle.status === "reserved" && <span className="mt-1 inline-block rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-950">Reserved</span>}
                            <p className="text-sm text-gray-600">
                              {relatedVehicle.year} {relatedVehicle.make}{" "}
                              {relatedVehicle.model}
                            </p>
                            <p className="text-sm font-semibold text-primary">
                              {formatPrice(relatedVehicle.price)}
                            </p>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                  <Button asChild variant="outline" className="w-full mt-4">
                    <Link href="/vehicles">View All Vehicles</Link>
                  </Button>
                </div>
              )}

              {popupPaymentsEnabled() && <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
                <Calendar aria-hidden="true" className="mb-4 h-6 w-6 text-primary" />
                <h3 className="font-semibold text-foreground">Meet sellers in person</h3>
                <p className="mt-2 mb-4 text-sm leading-6 text-muted-foreground">
                  Explore upcoming Gearboxe markets to see vehicles and meet local sellers.
                </p>
                <Button asChild variant="outline" className="w-full">
                  <Link href="/events">View all events</Link>
                </Button>
              </div>}
            </div>
          </div>
        </div>

        <Footer />


      </div>
    </>
  );
}
