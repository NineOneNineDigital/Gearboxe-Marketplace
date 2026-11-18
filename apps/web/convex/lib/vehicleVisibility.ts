import type { Doc } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

export function isPublicVehicleStatus(status: Doc<"vehicles">["status"]) {
  return status === "active" || status === "approved" || status === "reserved";
}

export function isPublicVehicle(vehicle: Doc<"vehicles">, now = Date.now()) {
  return vehicle.moderationRemovedAt === undefined && isPublicVehicleStatus(vehicle.status) &&
    (vehicle.status === "reserved" || vehicle.availabilityDueAt === undefined || now < vehicle.availabilityDueAt);
}

// A Clerk deletion tombstones the seller before the bounded listing cleanup
// finishes. Public reads must hide those listings immediately.
export async function isPublicVehicleFromActiveSeller(ctx: QueryCtx | MutationCtx, vehicle: Doc<"vehicles">, now = Date.now()) {
  if (!isPublicVehicle(vehicle, now)) return false;
  const seller = await ctx.db.get(vehicle.userId);
  return !!seller && seller.deletedAt === undefined;
}

export function normalizeVehicleStatus(vehicle: Doc<"vehicles">): Doc<"vehicles"> {
  return vehicle.status === "approved" ? { ...vehicle, status: "active" } : vehicle;
}

// Public listings omit seller contact information and internal moderation notes.
export function publicVehicle(vehicle: Doc<"vehicles">): Doc<"vehicles"> {
  return { ...normalizeVehicleStatus(vehicle), contactInfo: "", lienPayoffPlan: undefined, ownershipRole: undefined, ownershipAttestedAt: undefined, location: vehicle.location ? { city: vehicle.location.city, state: vehicle.location.state } : undefined, moderationRemovedAt: undefined, moderationReason: undefined, moderationHistory: [], availabilityHistory: undefined, availabilityConfirmedAt: undefined, availabilityExpiredAt: undefined, availabilityNextCheckAt: undefined, draftRequestId: undefined, vinKey: undefined, viewCount: undefined, discoverySitemapShard: undefined };
}
