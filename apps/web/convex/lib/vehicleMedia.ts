import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { removeMedia } from "../mediaRecords";
import { MAX_PHOTOS } from "./mediaPolicy";

export const mediaReference = v.object({ id: v.id("vehicleMedia"), caption: v.string() });
type Reference = { id: Id<"vehicleMedia">; caption: string };

// New uploads must be ready, owned by the seller and exclusive to this listing.
// Legacy references can be retained or removed, never injected into a new record.
export async function attachMedia(ctx: MutationCtx, vehicleId: Id<"vehicles">, ownerId: Id<"users">, photos: string[], refs: Reference[], previous?: Doc<"vehicles">) {
  if (photos.length + refs.length > MAX_PHOTOS || new Set(refs.map(r => r.id)).size !== refs.length) throw new Error("At most 30 distinct photos are allowed");
  if (photos.some(url => !previous?.photos.includes(url))) throw new Error("Upload new photos through the photo uploader");
  for (const ref of refs) {
    if (ref.caption.length > 200) throw new Error("Photo captions must be at most 200 characters");
    const media = await ctx.db.get(ref.id);
    if (!media || media.userId !== ownerId || media.status !== "ready" || !media.detailId || !media.thumbnailId || (media.vehicleId && media.vehicleId !== vehicleId) || (!media.vehicleId && media.expiresAt < Date.now())) throw new Error("Photo is unavailable or does not belong to this seller");
    await ctx.db.patch(ref.id, { vehicleId, expiresAt: Number.MAX_SAFE_INTEGER });
  }
  for (const old of previous?.media ?? []) {
    if (!refs.some(ref => ref.id === old.id)) {
      const media = await ctx.db.get(old.id);
      if (media?.vehicleId === vehicleId) await removeMedia(ctx, media);
    }
  }
}

export async function resolveVehicleMedia(ctx: QueryCtx, vehicle: Doc<"vehicles">) {
  const media = await Promise.all((vehicle.media ?? []).map(async ref => {
    const record = await ctx.db.get(ref.id);
    if (!record || record.status !== "ready" || record.vehicleId !== vehicle._id || !record.detailId || !record.thumbnailId) return null;
    const [url, thumbnailUrl] = await Promise.all([ctx.storage.getUrl(record.detailId), ctx.storage.getUrl(record.thumbnailId)]);
    return url && thumbnailUrl ? { ...ref, url, thumbnailUrl } : null;
  }));
  const ready = media.filter(m => m !== null);
  return {
    ...vehicle, media: ready,
    legacyPhotos: vehicle.photos,
    photos: [...vehicle.photos, ...ready.map(m => m.url)],
    thumbnailPhotos: [...vehicle.photos, ...ready.map(m => m.thumbnailUrl)],
    photoCaptions: [...vehicle.photos.map(() => ""), ...ready.map(m => m.caption)],
  };
}
