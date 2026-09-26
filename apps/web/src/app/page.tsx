"use client";

import { Button } from "@/components/ui/button";
import { EventCard } from "@/components/ui/event-card";
import { Footer } from "@/components/ui/footer";
import { Navbar } from "@/components/ui/navbar";
import { VehicleCard } from "@/components/ui/vehicle-card";
import { vehicleResults } from "@/lib/vehicle-results";
import { api } from "@/convex/_generated/api";
import { useConvexAuth, useQuery } from "convex/react";
import { Calendar, Car, Star, Users } from "lucide-react";
import Link from "next/link";

export default function HomePage() {
  const { isAuthenticated } = useConvexAuth();
  const upcomingEvents = useQuery(api.events.getUpcomingEvents);
  const featuredVehicles = vehicleResults(
    useQuery(api.vehicles.getVehicles, { status: "approved" })
  );

  // Get the next upcoming event
  const nextEvent = upcomingEvents?.[0];

  // Get featured vehicles (first 6 approved vehicles)
  const displayVehicles = featuredVehicles?.slice(0, 6) || [];

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Navbar />

      {/* Main Content */}
      <div className="flex-1">
        {/* Hero Section */}
        <section className="relative bg-gradient-to-br from-primary/20 via-primary/10 to-primary/5 py-24 overflow-hidden">
          {/* Background decorative elements */}
          <div className="absolute inset-0 bg-grid-pattern opacity-5"></div>
          <div className="absolute top-10 left-10 w-72 h-72 bg-primary/10 rounded-full blur-3xl"></div>
          <div className="absolute bottom-10 right-10 w-96 h-96 bg-primary/5 rounded-full blur-3xl"></div>

          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center">
              <div className="inline-flex items-center px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-8">
                <Car className="w-4 h-4 mr-2" />
                Trusted by car enthusiasts nationwide
              </div>

              <h1 className="text-5xl md:text-7xl font-bold text-gray-900 mb-6 leading-tight">
                Find Your Next
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-primary/70 block">
                  Dream Car
                </span>
              </h1>

              <p className="text-xl text-gray-600 mb-10 max-w-3xl mx-auto leading-relaxed">
                Connect with local car sellers and buyers at our exclusive
                monthly popup events. Browse premium vehicles, attend curated
                events, and find the perfect car that matches your lifestyle.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
                <Button
                  asChild
                  size="lg"
                  className="text-lg px-10 py-4 shadow-lg hover:shadow-xl transition-all duration-300 text-white"
                >
                  <Link href="/vehicles" className="flex items-center">
                    <Car className="w-5 h-5 mr-2" />
                    Browse Vehicles
                  </Link>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  size="lg"
                  className="text-lg px-10 py-4 border-2 hover:bg-primary hover:text-white transition-all duration-300"
                >
                  <Link href="/events" className="flex items-center">
                    <Calendar className="w-5 h-5 mr-2" />
                    View Events
                  </Link>
                </Button>
              </div>

              {/* Trust indicators */}
              <div className="flex flex-wrap justify-center items-center gap-8 text-sm text-gray-500">
                <div className="flex items-center">
                  <Star className="w-4 h-4 text-yellow-500 mr-1" />
                  <span>4.9/5 Rating</span>
                </div>
                <div className="flex items-center">
                  <Users className="w-4 h-4 text-primary mr-1" />
                  <span>1,200+ Members</span>
                </div>
                <div className="flex items-center">
                  <Calendar className="w-4 h-4 text-primary mr-1" />
                  <span>Monthly Events</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Next Event Section */}
        {nextEvent && (
          <section className="py-20 bg-white">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="text-center mb-16">
                <div className="inline-flex items-center px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
                  <Calendar className="w-4 h-4 mr-2" />
                  Don't Miss Out
                </div>

                <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
                  Next Upcoming Event
                </h2>
                <p className="text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed">
                  Join us at our next exclusive car market event. Connect with
                  fellow enthusiasts, discover amazing vehicles, and be part of
                  the community.
                </p>
              </div>

              <div className="max-w-3xl mx-auto">
                <div className="transform hover:scale-105 transition-all duration-300">
                  <EventCard event={nextEvent} showRegister={true} />
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Featured Vehicles */}
        <section className="py-20 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <div className="inline-flex items-center px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
                <Star className="w-4 h-4 mr-2" />
                Curated Selection
              </div>

              <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
                Featured Vehicles
              </h2>
              <p className="text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed">
                Handpicked premium vehicles from our community of trusted
                sellers. Each car is carefully vetted for quality and
                authenticity.
              </p>
            </div>

            {featuredVehicles === undefined ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="animate-pulse">
                    <div className="bg-gray-200 rounded-lg h-48 mb-4"></div>
                    <div className="space-y-2">
                      <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                      <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                      <div className="h-3 bg-gray-200 rounded w-1/3"></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : displayVehicles.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
                {displayVehicles.map((vehicle) => (
                  <div
                    key={vehicle._id}
                    className="transform hover:scale-105 transition-all duration-300"
                  >
                    <VehicleCard vehicle={vehicle} />
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-20 bg-gray-50 rounded-2xl border border-gray-200">
                <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-8">
                  <Car className="h-12 w-12 text-primary" />
                </div>
                <h3 className="text-2xl font-semibold text-gray-900 mb-4">
                  No vehicles available yet
                </h3>
                <p className="text-gray-600 mb-8 max-w-md mx-auto">
                  We're working on bringing you amazing vehicles from our
                  community. Check back soon or attend our next event to see
                  what's available.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Button
                    asChild
                    variant="outline"
                    className="border-2 hover:bg-primary hover:text-white transition-all duration-300"
                  >
                    <Link href="/events" className="flex items-center">
                      <Calendar className="w-4 h-4 mr-2" />
                      Attend Next Event
                    </Link>
                  </Button>
                  <Button
                    asChild
                    className="bg-primary hover:bg-primary/90 text-white"
                  >
                    <Link
                      href="/myAccount/new-listing"
                      className="flex items-center"
                    >
                      <Car className="w-4 h-4 mr-2" />
                      List Your Vehicle
                    </Link>
                  </Button>
                </div>
              </div>
            )}

            {displayVehicles.length > 0 && (
              <div className="text-center">
                <Button
                  asChild
                  variant="outline"
                  size="lg"
                  className="text-lg px-8 py-4 border-2 hover:bg-primary hover:text-white transition-all duration-300"
                >
                  <Link href="/vehicles" className="flex items-center">
                    <Car className="w-5 h-5 mr-2" />
                    View All Vehicles
                  </Link>
                </Button>
              </div>
            )}
          </div>
        </section>

        {/* CTA Section */}
        <section className="relative py-24 bg-gradient-to-br from-primary via-primary to-primary/90 overflow-hidden">
          {/* Background decorative elements */}
          <div className="absolute inset-0 bg-grid-pattern opacity-10"></div>
          <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-r from-white/5 to-transparent"></div>

          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <div className="inline-flex items-center px-4 py-2 rounded-full bg-white/20 text-white text-sm font-medium mb-8">
              <Star className="w-4 h-4 mr-2" />
              Join Our Community
            </div>

            <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
              Ready to Sell Your Car?
            </h2>
            <p className="text-xl text-white/90 mb-12 max-w-3xl mx-auto leading-relaxed">
              Join our exclusive community of car enthusiasts and showcase your
              vehicle at our curated events. Get direct exposure to serious
              buyers and sell your car faster than traditional methods.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
              {isAuthenticated ? (
                <Button
                  asChild
                  size="lg"
                  variant="secondary"
                  className="text-lg px-10 py-4 shadow-lg hover:shadow-xl transition-all duration-300"
                >
                  <Link
                    href="/myAccount/new-listing"
                    className="flex items-center"
                  >
                    <Car className="w-5 h-5 mr-2" />
                    List Your Car
                  </Link>
                </Button>
              ) : (
                <Button
                  asChild
                  size="lg"
                  variant="secondary"
                  className="text-lg px-10 py-4 shadow-lg hover:shadow-xl transition-all duration-300"
                >
                  <Link href="/sign-up" className="flex items-center">
                    <Users className="w-5 h-5 mr-2" />
                    Get Started
                  </Link>
                </Button>
              )}

              <Button
                asChild
                size="lg"
                variant="outline"
                className="text-lg px-10 py-4 border-2 border-white text-white hover:bg-white hover:text-primary transition-all duration-300"
              >
                <Link href="/events" className="flex items-center">
                  <Calendar className="w-5 h-5 mr-2" />
                  Attend Event
                </Link>
              </Button>
            </div>

            {/* Benefits */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
              <div className="text-center">
                <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Users className="h-8 w-8 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">
                  Direct Access
                </h3>
                <p className="text-white/80 text-sm">
                  Connect directly with serious buyers
                </p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Calendar className="h-8 w-8 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">
                  Curated Events
                </h3>
                <p className="text-white/80 text-sm">
                  Monthly events with verified sellers
                </p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Star className="h-8 w-8 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">
                  Quality Assured
                </h3>
                <p className="text-white/80 text-sm">
                  All vehicles are pre-screened
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>

      <Footer />
    </div>
  );
}
