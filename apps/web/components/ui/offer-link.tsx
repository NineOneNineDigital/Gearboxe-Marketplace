"use client";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Resolve opaque notification links only through the participant-authorized query. */
export function OfferLink({ threadId, userId }: { threadId: string; userId: Id<"users"> }) {
  const offer = useQuery(api.offers.get, { threadId });
  const router = useRouter();
  useEffect(() => {
    if (!offer) return;
    const other = offer.buyerId === userId ? offer.sellerId : offer.buyerId;
    router.replace(`/myAccount/messages/${offer.vehicleId}/${other}`);
  }, [offer, router, userId]);
  if (offer === undefined || offer) return <p role="status">Opening offer…</p>;
  return <p role="status">This offer is unavailable or you do not have access to it.</p>;
}
