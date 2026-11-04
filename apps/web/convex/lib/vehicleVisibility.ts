import type { Doc } from "../_generated/dataModel";

export function normalizeVehicleStatus(vehicle: Doc<"vehicles">): Doc<"vehicles"> {
  return vehicle.status === "approved" ? { ...vehicle, status: "active" } : vehicle;
}

// Public listings omit seller contact information and internal moderation notes.
export function publicVehicle(vehicle: Doc<"vehicles">): Doc<"vehicles"> {
  return { ...normalizeVehicleStatus(vehicle), contactInfo: "", location: vehicle.location ? { city: vehicle.location.city, state: vehicle.location.state } : undefined, moderationRemovedAt: undefined, moderationReason: undefined, moderationHistory: [], draftRequestId: undefined, vinKey: undefined, viewCount: undefined, discoverySitemapShard: undefined };
}
