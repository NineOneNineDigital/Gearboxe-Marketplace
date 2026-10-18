"use client";

import { api } from "@/convex/_generated/api";
import { useConvexAuth, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function PortalHome() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const isAdmin = useQuery(api.users.isAdmin, isAuthenticated ? {} : "skip");
  const events = useQuery(api.eventOperations.assignedEvents, isAuthenticated && isAdmin === false ? {} : "skip");

  useEffect(() => {
    if (isAdmin === true) router.replace("/admin");
    else if (events) router.replace(events.length ? "/staff/events" : "/access-denied");
  }, [events, isAdmin, router]);

  return <main className="market-shell flex flex-1 items-center justify-center" role="status">{isLoading ? "Signing in…" : "Opening your workspace…"}</main>;
}
