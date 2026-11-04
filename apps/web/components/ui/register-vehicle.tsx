"use client";

import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import { useQuery } from "convex/react";
import Link from "next/link";
import { useState } from "react";

export function RegisterVehicle({ vehicleId }: { vehicleId: string }) {
  const events = useQuery(api.events.getUpcomingEvents);
  const [eventId, setEventId] = useState("");
  return <div className="mt-3 space-y-2">
    <label htmlFor={`event-${vehicleId}`} className="block text-sm font-medium">Register this vehicle</label>
    <select id={`event-${vehicleId}`} className="w-full rounded-md border bg-white p-2 text-sm" value={eventId} onChange={(event) => setEventId(event.target.value)} disabled={!events?.length}><option value="">{events === undefined ? "Loading events…" : events.length ? "Choose an upcoming event" : "No upcoming events"}</option>{events?.map((event) => <option key={event._id} value={event._id}>{event.name} · {new Date(event.date).toLocaleDateString()}</option>)}</select>
    {eventId && <Button asChild variant="outline" size="sm" className="w-full"><Link href={`/events/${eventId}/register?vehicleId=${vehicleId}`}>Continue registration</Link></Button>}
  </div>;
}
