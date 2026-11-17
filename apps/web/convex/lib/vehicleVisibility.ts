import type { Doc } from "../_generated/dataModel";

export function isPublicVehicleStatus(status: Doc<"vehicles">["status"]) {
  return status === "active" || status === "approved" || status === "reserved";
}

export function isPublicVehicle(vehicle: Doc<"vehicles">, now = Date.now()) {
  return vehicle.moderationRemovedAt === undefined && isPublicVehicleStatus(vehicle.status) &&
    (vehicle.status === "reserved" || vehicle.availabilityDueAt === undefined || now < vehicle.availabilityDueAt);
}

export function normalizeVehicleStatus(vehicle: Doc<"vehicles">): Doc<"vehicles"> {
  return vehicle.status === "approved" ? { ...vehicle, status: "active" } : vehicle;
}

// Public listings omit seller contact information and internal moderation notes.
export function publicVehicle(vehicle: Doc<"vehicles">): Doc<"vehicles"> {
  return { ...normalizeVehicleStatus(vehicle), contactInfo: "", lienPayoffPlan: undefined, ownershipRole: undefined, ownershipAttestedAt: undefined, location: vehicle.location ? { city: vehicle.location.city, state: vehicle.location.state } : undefined, moderationRemovedAt: undefined, moderationReason: undefined, moderationHistory: [], availabilityHistory: undefined, availabilityConfirmedAt: undefined, availabilityExpiredAt: undefined, availabilityNextCheckAt: undefined, draftRequestId: undefined, vinKey: undefined, viewCount: undefined, discoverySitemapShard: undefined };
}
