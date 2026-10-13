import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { assertSellerTrust } from "./trustGuards";
import { validateVehicle } from "./vehicleValidation";

export function listingRevision(vehicle: Doc<"vehicles">) { return vehicle.updatedAt ?? vehicle.createdAt; }
export function nextRevision(vehicle?: Doc<"vehicles">) { return Math.max(Date.now(), vehicle ? listingRevision(vehicle) + 1 : 0); }
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
  if (vehicle.photos.length || !vehicle.media?.length) throw new Error("Upload at least one permanent photo and replace all external or temporary photos before submitting");
  if (new Set(vehicle.media.map(ref => ref.id)).size !== vehicle.media.length) throw new Error("Photo references must be distinct");
  for (const ref of vehicle.media) {
    const media = await ctx.db.get(ref.id);
    if (!media || media.userId !== vehicle.userId || media.vehicleId !== vehicle._id || media.status !== "ready" || !media.thumbnailId || !media.detailId) throw new Error("All listing photos must finish uploading and processing before submission");
    const [thumbnail, detail] = await Promise.all([ctx.db.system.get(media.thumbnailId), ctx.db.system.get(media.detailId)]);
    if (!thumbnail || !detail) throw new Error("A stored listing photo is missing. Replace it before submitting");
  }
  await assertSellerTrust(ctx, vehicle);
  if (await duplicateVin(ctx, vehicle.vin!, vehicle._id)) throw new Error("This VIN already has a submitted or available listing. Withdraw the existing listing or contact support.");
}
