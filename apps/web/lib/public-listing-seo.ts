import { fetchQuery } from "convex/nextjs";
import { makeFunctionReference } from "convex/server";
import { cache } from "react";
import type { Id } from "@/convex/_generated/dataModel";

export interface PublicListingMetadata {
  _id: Id<"vehicles">;
  title: string;
  year: number;
  make: string;
  model: string;
  trim?: string;
  price: number;
  status: "active" | "reserved";
  mileage: number;
  mileageUnit?: "mi" | "km";
  location?: { city: string; state: string };
  photoUrl?: string;
  updatedAt?: number;
}

export type SharedListing =
  | { kind: "unavailable" }
  | { kind: "sold"; year: number; make: string; model: string; location?: { city: string; state: string } }
  | { kind: "available"; vehicle: PublicListingMetadata };

const sharedListing = makeFunctionReference<"query", { id: string }, SharedListing>("discovery:sharedListing");

// Request-scoped deduplication prevents separate metadata and JSON-LD requests.
// No persistent cache: withdrawing a listing also withdraws its public metadata.
export const getSharedListing = cache(async (id: string): Promise<SharedListing> => {
  try {
    return await fetchQuery(sharedListing, { id });
  } catch {
    // Avoid printing request payloads or credentials while preserving an operational signal.
    console.warn("Shared listing could not be loaded from Convex");
    return { kind: "unavailable" };
  }
});
