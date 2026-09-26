"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Footer } from "@/components/ui/footer";
import { Navbar } from "@/components/ui/navbar";
import { VehicleCard } from "@/components/ui/vehicle-card";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@clerk/nextjs";
import { useConvexAuth, useQuery } from "convex/react";
import { Calendar, Clock, MapPin, Users } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

interface EventPageProps {
  params: {
    id: string;
  };
}

export default function EventPage({ params }: EventPageProps) {
  const { isAuthenticated } = useConvexAuth();
  const { isSignedIn } = useAuth();
  const event = useQuery(api.events.getEventById, { id: params.id as any });
  const registrations = useQuery(api.registrations.getRegistrationsByEvent, {
    eventId: params.id as any,
  });

  if (!event) {
    return notFound();
  }

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return {
      date: date.toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
      time: date.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }),
    };
  };

  const { date, time } = formatDate(event.date);
  const isUpcoming = event.date > Date.now();
  const registeredVehicles =
    registrations?.map((reg) => reg.vehicle).filter(Boolean) || [];

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Navbar />

      <div className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Event Header */}
        <div className="mb-8">
          <div className="flex items-center space-x-2 text-sm text-gray-600 mb-4">
            <Link
              href="/events"
              className="hover:text-primary transition-colors"
            >
              Events
            </Link>
            <span>/</span>
            <span>{event.name}</span>
          </div>

          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            {event.name}
          </h1>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center space-x-2">
                  <Calendar className="h-5 w-5" />
                  <span>Event Details</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center space-x-2 text-gray-600">
                  <Calendar className="h-4 w-4" />
                  <span>{date}</span>
                </div>
                <div className="flex items-center space-x-2 text-gray-600">
                  <Clock className="h-4 w-4" />
                  <span>{time}</span>
                </div>
                <div className="flex items-center space-x-2 text-gray-600">
                  <MapPin className="h-4 w-4" />
                  <span>{event.location}</span>
                </div>
                <div className="flex items-center space-x-2 text-gray-600">
                  <Users className="h-4 w-4" />
                  <span>Capacity: {event.capacity} vendors</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">About This Event</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">{event.description}</p>
                <div className="mt-4">
                  <p className="text-sm text-gray-500">
                    <strong>Address:</strong> {event.address}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Registration CTA */}
        {isUpcoming && (
          <div className="bg-primary rounded-lg p-8 text-center text-white mb-12">
            <h2 className="text-2xl font-bold mb-4">Ready to Sell Your Car?</h2>
            <p className="text-primary-foreground/90 mb-6 max-w-2xl mx-auto">
              Register as a vendor and showcase your vehicle to hundreds of
              potential buyers. Get exposure and sell your car faster at our
              community event.
            </p>
            {isAuthenticated || isSignedIn ? (
              <Button asChild size="lg" variant="secondary">
                <Link href="/myAccount/new-listing">Register as Vendor</Link>
              </Button>
            ) : (
              <Button asChild size="lg" variant="secondary">
                <Link href="/sign-up">Sign Up to Register</Link>
              </Button>
            )}
          </div>
        )}

        {/* Registered Vehicles */}
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            Registered Vehicles ({registeredVehicles.length})
          </h2>

          {registeredVehicles.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {registeredVehicles.map((vehicle) => (
                <VehicleCard key={vehicle._id} vehicle={vehicle} />
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="text-center py-12">
                <p className="text-gray-600">
                  No vehicles registered yet. Check back closer to the event
                  date!
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Event Status */}
        {!isUpcoming && (
          <div className="mt-12 bg-gray-50 rounded-lg p-8 text-center">
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              Event Completed
            </h3>
            <p className="text-gray-600">
              This event has already taken place. Check out our upcoming events
              for the next opportunity.
            </p>
            <Button asChild variant="outline" className="mt-4">
              <Link href="/events">View Upcoming Events</Link>
            </Button>
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
}
