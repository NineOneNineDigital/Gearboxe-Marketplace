import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { listingRevision } from "./listingLifecycle";

type ReadCtx = QueryCtx | MutationCtx;

export function listingReview(ctx: ReadCtx, vehicleId: Id<"vehicles">) {
  return ctx.db.query("ownershipReviewCases").withIndex("by_vehicle", q => q.eq("vehicleId", vehicleId)).unique();
}

export function reviewTriggers(vehicle: Doc<"vehicles">, previous?: Doc<"ownershipReviewCases"> | null) {
  const triggers = new Set(previous?.triggers);
  if (vehicle.ownershipRole === "authorized") triggers.add("authorized_seller");
  if (vehicle.lienStatus === "outstanding" || vehicle.lienStatus === "uncertain") triggers.add("lien");
  if (vehicle.titleStatus && vehicle.titleStatus !== "clean") triggers.add("title");
  if (vehicle.vehicleCategory === "specialty") triggers.add("specialty_eligibility");
  return [...triggers];
}

// Retain a submitted risk indication across edits. A correction can resolve the
// concern during review, but changing a disclosure cannot erase the review.
export async function rememberReviewTriggers(ctx: MutationCtx, vehicle: Doc<"vehicles">) {
  const row = await listingReview(ctx, vehicle._id);
  const triggers = reviewTriggers(vehicle, row);
  if (!triggers.length) return;
  if (!row) await ctx.db.insert("ownershipReviewCases", { vehicleId: vehicle._id, triggers });
  else if (triggers.length !== row.triggers.length) await ctx.db.patch(row._id, { triggers });
}

export function documentRequired(triggers: string[], row: Doc<"ownershipReviewCases"> | null) {
  return triggers.includes("authorized_seller") || !!row?.request;
}

export function currentEvidence(vehicle: Doc<"vehicles">, document: Doc<"ownershipDocuments"> | null) {
  return !!document && document.vehicleId === vehicle._id && document.userId === vehicle.userId &&
    document.status === "verified" && document.reviewerId !== vehicle.userId &&
    !!document.reviewedAt && !!document.reviewerId && !!vehicle.vin && document.vehicleVin === vehicle.vin &&
    document.expiresAt > Date.now();
}

export async function reviewCleared(ctx: ReadCtx, vehicle: Doc<"vehicles">, row: Doc<"ownershipReviewCases"> | null) {
  if (!row || row.clearedRevision !== listingRevision(vehicle) || !row.reviewerId || row.reviewerId === vehicle.userId) return false;
  if (vehicle.lienStatus === "uncertain") return false;
  if (row.documentId) return currentEvidence(vehicle, await ctx.db.get(row.documentId));
  return !documentRequired(reviewTriggers(vehicle, row), row);
}

export async function assertPublicationReview(ctx: MutationCtx, vehicle: Doc<"vehicles">) {
  if (!vehicle.ownershipRole) throw new Error("Declare titled ownership or authorization in Trust & safety before publication");
  if (vehicle.lienStatus === "uncertain") throw new Error("The seller must clarify the lien status before publication");
  const row = await listingReview(ctx, vehicle._id);
  if (reviewTriggers(vehicle, row).length && !await reviewCleared(ctx, vehicle, row)) {
    throw new Error("Complete enhanced review for the current listing before publication");
  }
}
