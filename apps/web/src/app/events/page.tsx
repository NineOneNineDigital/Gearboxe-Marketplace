"use client";

import { EventCard } from "@/components/ui/event-card";
import { Footer } from "@/components/ui/footer";
import { Navbar } from "@/components/ui/navbar";
import { api } from "@/convex/_generated/api";
import { useQuery } from "convex/react";
import { Calendar, MapPin } from "lucide-react";

export default function EventsPage() {
  const upcomingEvents = useQuery(api.events.getUpcomingEvents);

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Navbar />

      <div className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Upcoming Events
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Join us at our monthly car market events. Meet sellers, browse
            vehicles, and find your next car in person.
          </p>
        </div>

        {/* Events Grid */}
        {upcomingEvents && upcomingEvents.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {upcomingEvents.map((event) => (
              <EventCard key={event._id} event={event} showRegister={true} />
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <Calendar className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              No Upcoming Events
            </h3>
            <p className="text-gray-600">
              Check back soon for our next car market event!
            </p>
          </div>
        )}

        {/* Event Info */}
        <div className="mt-16 bg-gray-50 rounded-lg p-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <h3 className="text-xl font-semibold text-gray-900 mb-4">
                What to Expect
              </h3>
              <ul className="space-y-2 text-gray-600">
                <li className="flex items-start space-x-2">
                  <span className="text-primary">•</span>
                  <span>Browse dozens of vehicles in one location</span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="text-primary">•</span>
                  <span>Meet sellers face-to-face</span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="text-primary">•</span>
                  <span>Test drive vehicles on-site</span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="text-primary">•</span>
                  <span>Get expert advice from our team</span>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="text-xl font-semibold text-gray-900 mb-4">
                Event Details
              </h3>
              <ul className="space-y-2 text-gray-600">
                <li className="flex items-center space-x-2">
                  <Calendar className="h-4 w-4 text-primary" />
                  <span>Monthly events on weekends</span>
                </li>
                <li className="flex items-center space-x-2">
                  <MapPin className="h-4 w-4 text-primary" />
                  <span>Various locations in the Raleigh area</span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="text-primary">•</span>
                  <span>Free admission for buyers</span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="text-primary">•</span>
                  <span>Food trucks and refreshments available</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
