import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import { syncDiscovery } from "./discoveryIndex";
import { availabilityClock, AVAILABILITY_REMINDER_MS, nextRevision, recordListingStatusHistory } from "./listingLifecycle";
import { notifyListingFollowers } from "../notifications";
import { consumeRateLimit } from "./trustGuards";
import { currentCycle, closeThread } from "./offerRecords";

type Vehicle = Doc<"vehicles">;

export function acceptsOffers(vehicle: Vehicle | null, now: number): vehicle is Vehicle {
  return !!vehicle && ["active", "approved"].includes(vehicle.status) && vehicle.moderationRemovedAt === undefined &&
    (vehicle.availabilityDueAt === undefined || now < vehicle.availabilityDueAt);
}

export async function endCycle(ctx: MutationCtx, cycle: Doc<"offerCycles">, at: number) {
  await ctx.db.patch(cycle._id, { closedAt: at, needsClosure: true, winner: undefined });
}

// Invoke before every existing status writer. Manual reservations remain independent.
export async function onOfferListingTransition(ctx: MutationCtx, vehicle: Vehicle, nextStatus: Vehicle["status"],
  options: { moderation?: boolean; effectiveAt?: number } = {}) {
  if (vehicle.status === nextStatus || !["active", "approved", "reserved"].includes(vehicle.status)) return;
  const cycle = await currentCycle(ctx, vehicle._id);
  if (!cycle || nextStatus === "reserved") return;
  if (cycle.winner && !options.moderation) throw new Error("Finish the current reservation in its private offer before changing this listing.");
  const transitionAt = options.effectiveAt ?? Date.now();
  const at = ["active", "approved"].includes(vehicle.status)
    ? Math.min(transitionAt, vehicle.availabilityDueAt ?? transitionAt)
    : transitionAt;
  if (cycle.winner) {
    const thread = await ctx.db.get(cycle.winner);
    if (thread) await closeThread(ctx, thread, "listing_closed", at);
  }
  await endCycle(ctx, cycle, at);
}

// A listing transition shared with discovery and availability, with no buyer identity or terms on the public document.
export async function setDealStatus(ctx: MutationCtx, vehicle: Vehicle, status: "reserved" | "active" | "sold", now: number, actorId: Id<"users">) {
  const clock = status === "active" ? availabilityClock(now) : { availabilityDueAt: undefined, availabilityNextCheckAt: undefined };
  const reason = status === "reserved" ? "Reserved after a structured offer was accepted"
    : status === "sold" ? "Marked sold after offer closeout" : "Available after offer closeout";
  const history = await recordListingStatusHistory(ctx, vehicle, status, reason, now, actorId);
  await ctx.db.patch(vehicle._id, {
    ...clock, ...history, status, updatedAt: nextRevision(vehicle), availabilityExpiredAt: undefined,
  });
  if (clock.availabilityDueAt !== undefined) {
    const dueAt = clock.availabilityDueAt;
    for (const at of [dueAt - AVAILABILITY_REMINDER_MS, dueAt])
      await ctx.scheduler.runAt(at, internal.vehicles.checkAvailability, { id: vehicle._id, dueAt });
  }
  await syncDiscovery(ctx, vehicle._id);
  await notifyListingFollowers(ctx, vehicle._id, status, now);
}

export async function conversationForOffer(ctx: MutationCtx, vehicleId: Id<"vehicles">, buyer: Id<"users">, seller: Id<"users">, now: number) {
  const [participant1Id, participant2Id] = buyer < seller ? [buyer, seller] : [seller, buyer];
  const existing = await ctx.db.query("conversations").withIndex("by_vehicle_participants", q =>
    q.eq("vehicleId", vehicleId).eq("participant1Id", participant1Id).eq("participant2Id", participant2Id)).first();
  if (existing) return existing._id;
  await consumeRateLimit(ctx, buyer, "conversation");
  return ctx.db.insert("conversations", { vehicleId, participant1Id, participant2Id, lastMessageAt: now, createdAt: now });
}
