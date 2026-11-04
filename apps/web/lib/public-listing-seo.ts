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
  mileage: number;
  mileageUnit?: "mi" | "km";
  location?: { city: string; state: string };
  photoUrl?: string;
  updatedAt?: number;
}

const metadataVehicle = makeFunctionReference<"query", { id: string }, PublicListingMetadata | null>("discovery:metadataVehicle");

// Request-scoped deduplication prevents separate metadata and JSON-LD requests.
// No persistent cache: withdrawing a listing also withdraws its public metadata.
export const getPublicListingMetadata = cache(async (id: string) => {
  try {
    return { available: true as const, vehicle: await fetchQuery(metadataVehicle, { id }) };
  } catch {
    // Avoid printing request payloads or credentials while preserving an operational signal.
    console.warn("Public listing metadata could not be loaded from Convex");
    return { available: false as const, vehicle: null };
  }
});
