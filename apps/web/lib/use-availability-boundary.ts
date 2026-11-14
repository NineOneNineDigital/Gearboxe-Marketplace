"use client";

import { useEffect, useState } from "react";

type Availability = { status: string; availabilityDueAt?: number };

export function isAvailableNow(vehicle: Availability, now: number) {
  return vehicle.status === "reserved" || vehicle.availabilityDueAt === undefined || now < vehicle.availabilityDueAt;
}

// Convex reruns queries when data changes, not when wall time crosses a deadline.
export function useAvailabilityBoundary(vehicles: readonly Availability[], leadMs = 0) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const nextDue = vehicles
      .filter(vehicle => vehicle.status !== "reserved" && vehicle.availabilityDueAt !== undefined)
      .flatMap(vehicle => [vehicle.availabilityDueAt! - leadMs, vehicle.availabilityDueAt!])
      .filter(boundary => boundary > now)
      .reduce((earliest, boundary) => Math.min(earliest, boundary), Number.POSITIVE_INFINITY);
    if (!Number.isFinite(nextDue)) return;
    const timer = window.setTimeout(() => setNow(Date.now()), Math.min(Math.max(0, nextDue - Date.now()) + 1, 2_147_483_647));
    return () => window.clearTimeout(timer);
  }, [vehicles, now, leadMs]);

  useEffect(() => {
    const refresh = () => setNow(Date.now());
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, []);

  return now;
}
