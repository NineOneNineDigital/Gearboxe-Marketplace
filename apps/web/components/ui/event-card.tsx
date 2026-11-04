"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { ArrowUpRight, Calendar, MapPin, Users } from "lucide-react";
import Link from "next/link";

interface Event {
  _id: string;
  name: string;
  date: number;
  location: string;
  address: string;
  capacity: number;
  description: string;
  cancelledAt?: number;
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
  const isUpcoming = event.date > Date.now() && !event.cancelledAt;

  return (
    <Card className="group overflow-hidden border-border bg-card transition-[transform,box-shadow,border-color] duration-300 hover:-translate-y-1 hover:border-primary/35 hover:shadow-[0_20px_50px_hsl(var(--midnight)/0.12)]">
      <div className="market-grid flex min-h-28 items-end border-b border-white/10 bg-[hsl(var(--midnight))] p-5 text-[hsl(var(--bone))]">
        <div>
          <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-[hsl(var(--chrome))]">Gearboxe Market Event</p>
          <p className="market-metric mt-2 text-2xl font-semibold text-white">
            {new Date(event.date).toLocaleDateString("en-US", { month: "short", day: "2-digit" })}
          </p>
        </div>
      </div>
      <CardContent className="p-6">
        <div className="space-y-4">
          <div>
            <h3 className="line-clamp-1 text-xl font-semibold">{event.name}</h3>
            {event.city && (
              <p className="mt-1 text-sm text-muted-foreground">
                {event.city.name}, {event.city.state}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center space-x-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4 text-primary" />
              <span>{date}</span>
            </div>
            <div className="flex items-center space-x-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4 opacity-0" />
              <span>{time}</span>
            </div>
            <div className="flex items-center space-x-2 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4 text-primary" />
              <span className="line-clamp-1">{event.location}</span>
            </div>
            <div className="flex items-center space-x-2 text-sm text-muted-foreground">
              <Users className="h-4 w-4 text-primary" />
              <span>Capacity: {event.capacity} vendors</span>
            </div>
          </div>

          {event.description && (
            <p className="line-clamp-3 border-t border-border pt-4 text-sm leading-6 text-muted-foreground">
              {event.description}
            </p>
          )}
        </div>
      </CardContent>

      <CardFooter className="p-6 pt-0 flex gap-2">
        <Button variant="outline" asChild className="flex-1">
          <Link href={`/events/${event._id}`}>View details</Link>
        </Button>
        {showRegister && isUpcoming && (
          <Button asChild>
            <Link href={`/events/${event._id}/register`}>Register <ArrowUpRight className="h-4 w-4" /></Link>
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
