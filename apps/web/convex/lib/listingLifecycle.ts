import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { MIN_PHOTOS, missingPhotoViews } from "./mediaPolicy";
import { assertSellerTrust } from "./trustGuards";
import { validateVehicle } from "./vehicleValidation";

export function listingRevision(vehicle: Doc<"vehicles">) { return vehicle.updatedAt ?? vehicle.createdAt; }
export function nextRevision(vehicle?: Doc<"vehicles">) { return Math.max(Date.now(), vehicle ? listingRevision(vehicle) + 1 : 0); }
export async function recordListingStatusHistory(ctx: MutationCtx, vehicle: Doc<"vehicles">, status: Doc<"vehicles">["status"], reason: string, at: number, actorId?: Id<"users">) {
  const entry = { fromStatus: vehicle.status, toStatus: status, reason, createdAt: at,
    ...(actorId ? { actorId } : { source: "system" as const }) };
  await ctx.db.insert("vehicleModerationLog", { vehicleId: vehicle._id, ...entry });
  return { moderationReason: reason, moderationHistory: [...(vehicle.moderationHistory ?? []), entry] };
}
export function assertRevision(vehicle: Doc<"vehicles">, expected?: number) {
  if (expected !== undefined && expected !== listingRevision(vehicle)) throw new Error("This listing changed in another session. Reload it before saving your changes.");
}

export async function duplicateVin(ctx: QueryCtx | MutationCtx, vin: string, excludeId?: Id<"vehicles">) {
  const key = vin.trim().toUpperCase();
  if (!key || key.length > 30) return false;
  const [indexed, legacy] = await Promise.all([
    ctx.db.query("vehicles").withIndex("by_vin_key", q => q.eq("vinKey", key)).collect(),
    // Older records remain discoverable before any operator backfill.
    ctx.db.query("vehicles").withIndex("by_vin_key", q => q.eq("vinKey", undefined)).collect(),
  ]);
  return [...indexed, ...legacy].some(vehicle => vehicle._id !== excludeId && vehicle.vin?.trim().toUpperCase() === key && ["pending", "active", "approved", "reserved"].includes(vehicle.status));
}

export async function assertSubmitReady(ctx: MutationCtx, vehicle: Doc<"vehicles">) {
  validateVehicle(vehicle, true);
  if (vehicle.photos.length) throw new Error("Replace all external or temporary photos with permanent photos before submitting");
  const mediaRefs = vehicle.media ?? [];
  if (new Set(mediaRefs.map(ref => ref.id)).size !== mediaRefs.length) throw new Error("Photo references must be distinct");
  const missing = missingPhotoViews(mediaRefs);
  if (mediaRefs.length < MIN_PHOTOS || missing.length) {
    throw new Error(`At least five distinct ready permanent photos are required. Missing views: ${missing.join(", ") || "none"}.`);
  }
  for (const ref of mediaRefs) {
    const media = await ctx.db.get(ref.id);
    if (!media || media.userId !== vehicle.userId || media.vehicleId !== vehicle._id || media.status !== "ready" || !media.thumbnailId || !media.detailId) throw new Error("All listing photos must finish uploading and processing before submission");
    const [thumbnail, detail] = await Promise.all([ctx.db.system.get(media.thumbnailId), ctx.db.system.get(media.detailId)]);
    if (!thumbnail || !detail) throw new Error("A stored listing photo is missing. Replace it before submitting");
  }
  await assertSellerTrust(ctx, vehicle);
  if (await duplicateVin(ctx, vehicle.vin!, vehicle._id)) throw new Error("This VIN already has a submitted or available listing. Withdraw the existing listing or contact support.");
}

// Fixed UTC durations: no calendar/time-zone or grace-period adjustment.
export const AVAILABILITY_INTERVAL_MS = 45 * 24 * 60 * 60 * 1000;
export const AVAILABILITY_REMINDER_MS = 7 * 24 * 60 * 60 * 1000;
export function availabilityClock(now: number) {
  const availabilityDueAt = now + AVAILABILITY_INTERVAL_MS;
  return { availabilityDueAt, availabilityNextCheckAt: availabilityDueAt - AVAILABILITY_REMINDER_MS };
}
