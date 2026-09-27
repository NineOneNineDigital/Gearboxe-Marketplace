"use client";

import { Button } from "@/components/ui/button";
import { Footer } from "@/components/ui/footer";
import { Navbar } from "@/components/ui/navbar";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useToast } from "@/hooks/useToast";
import { vehicleResults } from "@/lib/vehicle-results";
import { useAuth } from "@clerk/nextjs";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import {
  Calendar,
  Car,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  Gauge,
  Heart,
  Mail,
  MapPin,
  Share2,
  User,
  X,
} from "lucide-react";
import Head from "next/head";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { use, useCallback, useEffect, useState } from "react";

interface VehiclePageProps {
  params: Promise<{
    id: string;
  }>;
}

export default function VehiclePage({ params }: VehiclePageProps) {
  const { isAuthenticated } = useConvexAuth();
  const { isSignedIn } = useAuth();
  const { user: convexUser } = useCurrentUser();
  const unwrappedParams = use(params);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);
  const [isFavorited, setIsFavorited] = useState(false);
  const [isFavoriteLoading, setIsFavoriteLoading] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const { toast } = useToast();

  const vehicle = useQuery(api.vehicles.getVehicleById, {
    id: unwrappedParams.id as Id<"vehicles">,
  });
  const seller = useQuery(
    api.users.getUserById,
    vehicle?.userId ? { id: vehicle.userId } : "skip"
  );
  const vehicleEvent = useQuery(
    api.registrations.getRegistrationByVehicle,
    vehicle?._id ? { vehicleId: vehicle._id } : "skip"
  );
  const relatedVehicles = vehicleResults(
    useQuery(api.vehicles.getVehicles, {
      status: "approved",
      make: vehicle?.make,
    })
  );
  const addFavorite = useMutation(api.favorites.addFavorite);
  const removeFavorite = useMutation(api.favorites.removeFavorite);
  const isFavoritedQuery = useQuery(
    api.favorites.isFavorited,
    convexUser?._id && vehicle?._id
      ? { userId: convexUser._id, vehicleId: vehicle._id }
      : "skip"
  );

  // Filter out current vehicle from related vehicles
  const filteredRelatedVehicles =
    relatedVehicles?.filter((v) => v._id !== vehicle?._id).slice(0, 3) || [];

  useEffect(() => {
    // Set page title
    if (vehicle) {
      document.title = `${vehicle.title} - Car Market`;
    }
  }, [vehicle]);

  // Update favorite state when query result changes
  useEffect(() => {
    if (isFavoritedQuery !== undefined) {
      setIsFavorited(isFavoritedQuery);
    }
  }, [isFavoritedQuery]);

  const nextPhoto = useCallback(() => {
    if (!vehicle) return;
    setCurrentPhotoIndex((prev) =>
      prev === vehicle.photos.length - 1 ? 0 : prev + 1
    );
  }, [vehicle]);

  const prevPhoto = useCallback(() => {
    if (!vehicle) return;
    setCurrentPhotoIndex((prev) =>
      prev === 0 ? vehicle.photos.length - 1 : prev - 1
    );
  }, [vehicle]);

  useEffect(() => {
    // Keyboard navigation for photo modal
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isPhotoModalOpen) return;

      switch (e.key) {
        case "Escape":
          setIsPhotoModalOpen(false);
          break;
        case "ArrowLeft":
          prevPhoto();
          break;
        case "ArrowRight":
          nextPhoto();
          break;
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isPhotoModalOpen, prevPhoto, nextPhoto]);

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
    if (!convexUser || !vehicle || isFavoriteLoading) return;

    setIsFavoriteLoading(true);
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
      <Head>
        <title>{vehicle.title} - Car Market</title>
        <meta
          name="description"
          content={`${vehicle.year} ${vehicle.make} ${vehicle.model} for sale - ${formatPrice(vehicle.price)}. ${vehicle.description.substring(0, 160)}...`}
        />
        <meta property="og:title" content={`${vehicle.title} - Car Market`} />
        <meta
          property="og:description"
          content={`${vehicle.year} ${vehicle.make} ${vehicle.model} for sale - ${formatPrice(vehicle.price)}`}
        />
        <meta
          property="og:image"
          content={vehicle.photos[0] || "/placeholder-car.jpg"}
        />
        <meta
          property="og:url"
          content={`${typeof window !== "undefined" ? window.location.href : ""}`}
        />
        <meta name="twitter:card" content="summary_large_image" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Car",
              name: vehicle.title,
              brand: vehicle.make,
              model: vehicle.model,
              vehicleModelDate: vehicle.year,
              mileageFromOdometer: {
                "@type": "QuantitativeValue",
                value: vehicle.mileage,
                unitCode: "SMI",
              },
              offers: {
                "@type": "Offer",
                price: vehicle.price,
                priceCurrency: "USD",
              },
              description: vehicle.description,
              image: vehicle.photos,
            }),
          }}
        />
      </Head>

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
                    <p className="text-xl text-gray-600 mb-4">
                      {vehicle.year} {vehicle.make} {vehicle.model}
                    </p>
                    <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
                      <div className="flex items-center space-x-1">
                        <Gauge className="h-4 w-4" />
                        <span>{formatMileage(vehicle.mileage)} miles</span>
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
                    {convexUser && (
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
                    )}
                  </div>
                </div>

              </div>

              {/* Main Photo */}
              {vehicle.photos.length > 0 && (
                <div className="order-1 overflow-hidden rounded-xl border border-black/10 bg-white shadow-sm">
                  <div className="relative">
                    <Image
                      src={vehicle.photos[currentPhotoIndex]}
                      alt={`${vehicle.title} - Photo ${currentPhotoIndex + 1}`}
                      width={800}
                      height={500}
                      className="w-full h-96 object-cover cursor-pointer"
                      onClick={() => setIsPhotoModalOpen(true)}
                    />

                    {/* Photo Navigation */}
                    {vehicle.photos.length > 1 && (
                      <>
                        <Button
                          variant="outline"
                          size="icon"
                          className="absolute left-4 top-1/2 transform -translate-y-1/2 bg-gray-100 hover:bg-gray-200 border-gray-300 shadow-xl"
                          onClick={prevPhoto}
                        >
                          <ChevronLeft className="h-6 w-6 text-primary" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          className="absolute right-4 top-1/2 transform -translate-y-1/2 bg-gray-100 hover:bg-gray-200 border-gray-300 shadow-xl"
                          onClick={nextPhoto}
                        >
                          <ChevronRight className="h-6 w-6 text-primary" />
                        </Button>
                      </>
                    )}

                    {/* Photo Counter */}
                    <div className="absolute bottom-4 right-4 bg-black/70 text-white px-3 py-1 rounded-full text-sm">
                      {currentPhotoIndex + 1} / {vehicle.photos.length}
                    </div>
                  </div>

                  {/* Photo Thumbnails */}
                  {vehicle.photos.length > 1 && (
                    <div className="p-4 bg-gray-50">
                      <div className="flex space-x-2 overflow-x-auto">
                        {vehicle.photos.map((photo, index) => (
                          <button
                            key={index}
                            onClick={() => setCurrentPhotoIndex(index)}
                            className={`flex-shrink-0 w-20 h-16 rounded-lg overflow-hidden border-2 ${
                              index === currentPhotoIndex
                                ? "border-primary"
                                : "border-gray-200"
                            }`}
                          >
                            <Image
                              src={photo}
                              alt={`Thumbnail ${index + 1}`}
                              width={80}
                              height={64}
                              className="w-full h-full object-cover"
                            />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Vehicle Details */}
              <div className="order-3 rounded-xl border border-black/10 bg-white shadow-sm">
                <div className="p-6">
                  <h2 className="text-xl font-semibold text-gray-900">
                    Vehicle Details
                  </h2>
                </div>
                <div className="border-b border-gray-200"></div>
                <div className="p-6">
                  <div className="space-y-6">
                    {/* Vehicle Information */}
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">
                        Vehicle Information
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                          <div className="flex justify-between py-3 border-b border-gray-100">
                            <span className="text-sm font-medium text-gray-600">
                              Make
                            </span>
                            <span className="text-gray-900 font-medium">
                              {vehicle.make}
                            </span>
                          </div>
                          <div className="flex justify-between py-3 border-b border-gray-100">
                            <span className="text-sm font-medium text-gray-600">
                              Model
                            </span>
                            <span className="text-gray-900 font-medium">
                              {vehicle.model}
                            </span>
                          </div>
                          <div className="flex justify-between py-3 border-b border-gray-100">
                            <span className="text-sm font-medium text-gray-600">
                              Year
                            </span>
                            <span className="text-gray-900 font-medium">
                              {vehicle.year}
                            </span>
                          </div>
                        </div>
                        <div className="space-y-4">
                          <div className="flex justify-between py-3 border-b border-gray-100">
                            <span className="text-sm font-medium text-gray-600">
                              Mileage
                            </span>
                            <span className="text-gray-900 font-medium">
                              {formatMileage(vehicle.mileage)} miles
                            </span>
                          </div>
                          <div className="flex justify-between py-3 border-b border-gray-100">
                            <span className="text-sm font-medium text-gray-600">
                              Price
                            </span>
                            <span className="text-primary font-semibold text-lg">
                              {formatPrice(vehicle.price)}
                            </span>
                          </div>
                          {vehicle.vin && (
                            <div className="flex justify-between py-3 border-b border-gray-100">
                              <span className="text-sm font-medium text-gray-600">
                                VIN
                              </span>
                              <span className="text-gray-900 font-mono text-sm">
                                {vehicle.vin}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Description */}
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">
                        Description
                      </h3>
                      <div className="bg-gray-50 rounded-lg p-4">
                        <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">
                          {vehicle.description}
                        </p>
                      </div>
                    </div>

                    {/* Marketplace context */}
                    <div>
                      <h3 className="mb-4 text-lg font-semibold text-gray-900">
                        Buying context
                      </h3>
                      <div className="grid gap-3 sm:grid-cols-3">
                        <div className="flex items-center space-x-2 text-sm text-gray-600">
                          <User className="h-4 w-4 text-primary" />
                          <span>Private seller</span>
                        </div>
                        <div className="flex items-center space-x-2 text-sm text-gray-600">
                          <Mail className="h-4 w-4 text-primary" />
                          <span>Direct messaging</span>
                        </div>
                        <div className="flex items-center space-x-2 text-sm text-gray-600">
                          <Calendar className="h-4 w-4 text-primary" />
                          <span>In-person viewing</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Sidebar */}
            <div className="space-y-6 lg:sticky lg:top-5 lg:self-start">
              <div className="rounded-xl border border-black/10 bg-white p-6 shadow-[0_16px_44px_hsl(var(--midnight)/0.08)]">
                <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.13em] text-muted-foreground">Asking price</p>
                <p className="market-metric mt-2 text-4xl font-semibold tracking-[-0.05em] text-[hsl(var(--midnight))]">
                  {formatPrice(vehicle.price)}
                </p>
                <div className="my-5 border-t border-black/10" />
                {isAuthenticated || isSignedIn ? (
                  <Button asChild size="lg" className="w-full">
                    <Link href={`/myAccount/messages/${vehicle._id}/${vehicle.userId}`}>
                      <Mail className="h-4 w-4" /> Message seller
                    </Link>
                  </Button>
                ) : (
                  <Button asChild size="lg" className="w-full">
                    <Link href="/sign-in">Sign in to contact seller</Link>
                  </Button>
                )}
                <p className="mt-4 text-center text-[11px] leading-5 text-muted-foreground">
                  Gearboxe Market connects buyers and private sellers directly.
                </p>
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
                      <p className="text-sm text-gray-600">Private seller</p>
                    </div>
                  </div>

                  <div className="space-y-3 mb-6">
                    <div className="flex items-center space-x-2 text-sm text-gray-600">
                      <MapPin className="h-4 w-4" />
                      <span>Local Seller</span>
                    </div>
                  </div>

                  <p className="border-t border-gray-100 pt-4 text-xs leading-5 text-gray-500">
                    Ask about ownership history, maintenance, condition, and availability before arranging a meeting.
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
                          {relatedVehicle.photos.length > 0 ? (
                            <Image
                              src={relatedVehicle.photos[0]}
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

              {/* Upcoming Event */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h3 className="font-semibold text-gray-900 mb-4">
                  Upcoming Event
                </h3>
                {vehicleEvent?.event ? (
                  <div className="space-y-4">
                    <div className="flex items-start space-x-3">
                      <Calendar className="h-5 w-5 text-primary mt-0.5" />
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900">
                          {vehicleEvent.event.name}
                        </h4>
                        <p className="text-sm text-gray-600 mt-1">
                          {new Date(vehicleEvent.event.date).toLocaleDateString(
                            "en-US",
                            {
                              weekday: "long",
                              year: "numeric",
                              month: "long",
                              day: "numeric",
                            }
                          )}
                        </p>
                        <p className="text-sm text-gray-600">
                          {vehicleEvent.event.location}
                        </p>
                        <p className="text-sm text-gray-500 mt-1">
                          {vehicleEvent.event.address}
                        </p>
                      </div>
                    </div>
                    <div className="pt-2 border-t border-gray-100">
                      <p className="text-xs text-gray-600 mb-3">
                        This vehicle will be displayed at this event.
                      </p>
                      <Button asChild variant="outline" className="w-full">
                        <Link href="/events">View All Events</Link>
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <Calendar className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-sm text-gray-600 mb-4">
                      This vehicle is not currently registered for any events.
                    </p>
                    <Button asChild variant="outline" className="w-full">
                      <Link href="/events">View All Events</Link>
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <Footer />

        {/* Photo Modal */}
        {isPhotoModalOpen && vehicle.photos.length > 0 && (
          <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
            <div className="relative max-w-4xl max-h-full">
              <Button
                variant="outline"
                size="icon"
                className="absolute top-4 right-4 z-10 bg-gray-100 hover:bg-gray-200 border-gray-300 shadow-xl"
                onClick={() => setIsPhotoModalOpen(false)}
              >
                <X className="h-6 w-6 text-primary" />
              </Button>

              <div className="relative">
                <Image
                  src={vehicle.photos[currentPhotoIndex]}
                  alt={`${vehicle.title} - Photo ${currentPhotoIndex + 1}`}
                  width={1200}
                  height={800}
                  className="max-w-full max-h-[80vh] object-contain rounded-lg"
                />

                {vehicle.photos.length > 1 && (
                  <>
                    <Button
                      variant="outline"
                      size="icon"
                      className="absolute left-4 top-1/2 transform -translate-y-1/2 bg-gray-100 hover:bg-gray-200 border-gray-300 shadow-xl"
                      onClick={prevPhoto}
                    >
                      <ChevronLeft className="h-6 w-6 text-primary" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="absolute right-4 top-1/2 transform -translate-y-1/2 bg-gray-100 hover:bg-gray-200 border-gray-300 shadow-xl"
                      onClick={nextPhoto}
                    >
                      <ChevronRight className="h-6 w-6 text-primary" />
                    </Button>
                  </>
                )}
              </div>

              <div className="text-center mt-4 text-white">
                <p className="text-sm">
                  {currentPhotoIndex + 1} of {vehicle.photos.length}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
