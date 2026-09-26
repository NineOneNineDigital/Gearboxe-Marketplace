"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Calendar, MapPin, Users } from "lucide-react";
import Link from "next/link";

interface Event {
  _id: string;
  name: string;
  date: number;
  location: string;
  address: string;
  capacity: number;
  description: string;
  city?: {
    name: string;
    state: string;
  };
}

interface EventCardProps {
  event: Event;
  showRegister?: boolean;
}

export function EventCard({ event, showRegister = true }: EventCardProps) {
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

  return (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow">
      <CardContent className="p-6">
        <div className="space-y-4">
          <div>
            <h3 className="font-semibold text-xl line-clamp-1">{event.name}</h3>
            {event.city && (
              <p className="text-sm text-gray-600">
                {event.city.name}, {event.city.state}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center space-x-2 text-sm text-gray-600">
              <Calendar className="h-4 w-4" />
              <span>{date}</span>
            </div>
            <div className="flex items-center space-x-2 text-sm text-gray-600">
              <Calendar className="h-4 w-4 opacity-0" />
              <span>{time}</span>
            </div>
            <div className="flex items-center space-x-2 text-sm text-gray-600">
              <MapPin className="h-4 w-4" />
              <span className="line-clamp-1">{event.location}</span>
            </div>
            <div className="flex items-center space-x-2 text-sm text-gray-600">
              <Users className="h-4 w-4" />
              <span>Capacity: {event.capacity} vendors</span>
            </div>
          </div>

          {event.description && (
            <p className="text-sm text-gray-700 line-clamp-3">
              {event.description}
            </p>
          )}
        </div>
      </CardContent>

      <CardFooter className="p-6 pt-0 flex gap-2">
        <Button variant="outline" asChild className="flex-1">
          <Link href={`/events/${event._id}`}>View Details</Link>
        </Button>
        {showRegister && isUpcoming && (
          <Button asChild className="text-white">
            <Link href={`/events/${event._id}`}>Register</Link>
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
