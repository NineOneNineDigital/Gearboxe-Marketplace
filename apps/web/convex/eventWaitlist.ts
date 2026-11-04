import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { requireCurrentUser, getCurrentUser } from "./lib/authorization";
import { acceptsNewRegistrations, eventFee, RESERVATION_MS } from "./lib/eventPaymentPolicy";
import { ensureInventory } from "./eventBookings";
import { enqueueNotification } from "./notifications";

const approved = (vehicle: Doc<"vehicles">) => vehicle.status === "approved" || vehicle.status === "active";
async function registered(ctx: MutationCtx, eventId: Id<"events">, vehicleId: Id<"vehicles">) {
  for (const status of ["completed", "refund_pending"] as const) {
    if (await ctx.db.query("registrations").withIndex("by_event_vehicle_status", q => q.eq("eventId", eventId).eq("vehicleId", vehicleId).eq("paymentStatus", status)).first()) return true;
  }
  return false;
}
async function held(ctx: MutationCtx, eventId: Id<"events">, vehicleId: Id<"vehicles">) {
  return (await ctx.db.query("eventReservations").withIndex("by_event_vehicle", q => q.eq("eventId", eventId).eq("vehicleId", vehicleId)).order("desc").take(100)).some(row => row.status === "held");
}
export const getMine = query({ args: {}, handler: async ctx => {
  const user = await getCurrentUser(ctx); if (!user) throw new Error("Authentication required");
  return await ctx.db.query("eventWaitlist").withIndex("by_user", q => q.eq("userId", user._id)).order("desc").take(100);
} });
export const join = mutation({ args: { eventId: v.id("events"), vehicleId: v.id("vehicles") }, handler: async (ctx, args) => {
  const user = await requireCurrentUser(ctx); const now = Date.now();
  const [event, vehicle] = await Promise.all([ctx.db.get(args.eventId), ctx.db.get(args.vehicleId)]);
  if (!event || !acceptsNewRegistrations(event, now)) throw new Error("Event is no longer accepting registrations");
  if (!vehicle || vehicle.userId !== user._id || !approved(vehicle)) throw new Error("Select your approved vehicle");
  if (!user.email?.trim()) throw new Error("Add a contact email before joining the waitlist");
  const existing = await ctx.db.query("eventWaitlist").withIndex("by_event_vehicle", q => q.eq("eventId", args.eventId).eq("vehicleId", args.vehicleId)).order("desc").take(100);
  const active = existing.find(row => row.status === "waiting" || row.status === "offered"); if (active) return active._id;
  if (await registered(ctx, args.eventId, args.vehicleId) || await held(ctx, args.eventId, args.vehicleId)) throw new Error("Vehicle already registered or reserved");
  const mine = [...await ctx.db.query("eventWaitlist").withIndex("by_user_status", q => q.eq("userId", user._id).eq("status", "waiting")).take(5), ...await ctx.db.query("eventWaitlist").withIndex("by_user_status", q => q.eq("userId", user._id).eq("status", "offered")).take(5)];
  if (mine.length >= 5) throw new Error("Leave an existing waitlist before joining another");
  const inventory = await ensureInventory(ctx, args.eventId);
  const queue = await ctx.db.query("eventWaitlist").withIndex("by_event_status", q => q.eq("eventId", args.eventId).eq("status", "waiting")).first();
  if (inventory.held + inventory.confirmed < event.capacity && !queue) throw new Error("Spaces are available. Register your vehicle directly.");
  const id = await ctx.db.insert("eventWaitlist", { ...args, userId: user._id, status: "waiting", createdAt: now, updatedAt: now });
  await ctx.db.patch(inventory._id, { waiting: (inventory.waiting ?? 0) + 1 });
  await ctx.scheduler.runAfter(0, internal.eventWaitlist.promote, { eventId: args.eventId });
  return id;
} });
export const leave = mutation({ args: { waitlistId: v.id("eventWaitlist") }, handler: async (ctx, args) => {
  const user = await getCurrentUser(ctx); if (!user) throw new Error("Authentication required");
  const row = await ctx.db.get(args.waitlistId); if (!row || row.userId !== user._id) throw new Error("Waitlist entry not found");
  if (row.status === "offered") {
    const reservation = row.reservationId ? await ctx.db.get(row.reservationId) : null;
    if (reservation?.status === "held") {
      if (reservation.waitlistClaimedAt !== undefined || reservation.checkoutCreateAttemptAt !== undefined || reservation.stripeSessionId) {
        await ctx.db.patch(reservation._id, { cancellationRequestedAt: Date.now(), updatedAt: Date.now() });
      } else {
        const inventory = await ensureInventory(ctx, row.eventId);
        await ctx.db.patch(inventory._id, { held: Math.max(0, inventory.held - 1) });
        await ctx.db.patch(reservation._id, { status: "expired", updatedAt: Date.now() });
      }
    }
    await ctx.db.patch(row._id, { status: "left", updatedAt: Date.now() });
    await ctx.scheduler.runAfter(0, internal.eventWaitlist.promote, { eventId: row.eventId });
    return;
  }
  if (row.status !== "waiting") return;
  const inventory = await ensureInventory(ctx, row.eventId);
  await ctx.db.patch(row._id, { status: "left", updatedAt: Date.now() });
  await ctx.db.patch(inventory._id, { waiting: Math.max(0, (inventory.waiting ?? 0) - 1) });
  await ctx.scheduler.runAfter(0, internal.eventWaitlist.promote, { eventId: row.eventId });
} });

// One atomic, bounded FIFO pass. This writes the same inventory row as direct
// booking, so concurrent promotions and payments cannot consume the same space.
export const promote = internalMutation({ args: { eventId: v.id("events") }, handler: async (ctx, { eventId }) => {
  const event = await ctx.db.get(eventId); if (!event) return;
  const inventory = await ensureInventory(ctx, eventId); const now = Date.now();
  const waiting = await ctx.db.query("eventWaitlist").withIndex("by_event_status", q => q.eq("eventId", eventId).eq("status", "waiting")).order("asc").take(25);
  let count = inventory.waiting ?? 0, slots = event.capacity - inventory.held - inventory.confirmed, promoted = 0, examined = 0;
  for (const row of waiting) {
    if (acceptsNewRegistrations(event, now) && slots <= 0) break;
    examined++;
    const [user, vehicle] = await Promise.all([ctx.db.get(row.userId), ctx.db.get(row.vehicleId)]);
    const eligible = acceptsNewRegistrations(event, now) && user && user.suspendedAt === undefined && user.email?.trim() && vehicle && vehicle.userId === row.userId && approved(vehicle) && !await registered(ctx, eventId, row.vehicleId) && !await held(ctx, eventId, row.vehicleId);
    if (!eligible || !user || !vehicle) {
      await ctx.db.patch(row._id, { status: "ineligible", updatedAt: now }); count = Math.max(0, count - 1); continue;
    }
    // Limit concurrent checkouts per account; a busy account keeps its position,
    // while the sweep revisits it without promoting later vehicles ahead of it.
    const userHolds = await ctx.db.query("eventReservations").withIndex("by_user_status", q => q.eq("userId", user._id).eq("status", "held")).take(5);
    if (userHolds.length >= 5) break;
    const reservationId = await ctx.db.insert("eventReservations", { eventId, waitlistId: row._id, vehicleId: row.vehicleId, userId: user._id, customerEmail: user.email, eventName: event.name, vehicleName: vehicle.title, rulesSnapshot: event.eventRules, status: "held", amount: eventFee(event), currency: "usd", expiresAt: now + RESERVATION_MS, nextReconcileAt: now + 60_000, createdAt: now, updatedAt: now });
    await ctx.db.patch(row._id, { status: "offered", reservationId, offeredAt: now, updatedAt: now });
    count = Math.max(0, count - 1); slots--; promoted++;
    await enqueueNotification(ctx, { userId: user._id, category: "events", kind: "event_waitlist", message: `A space at ${event.name} is reserved for your vehicle for 35 minutes. Complete payment to confirm your registration.`, link: `/events/${eventId}/register?vehicleId=${vehicle._id}`, vehicleId: vehicle._id, dedupeKey: `waitlist-offer:${row._id}` });
  }
  if (promoted || count !== inventory.waiting) await ctx.db.patch(inventory._id, { held: inventory.held + promoted, waiting: count });
  if (examined === 25 && (!acceptsNewRegistrations(event, now) || slots > 0)) await ctx.scheduler.runAfter(0, internal.eventWaitlist.promote, { eventId });
} });

// Rotate through waiting events instead of repeatedly selecting the oldest full
// event. Untouched offers expire locally; attempted checkouts require provider proof.
export const sweep = internalMutation({ args: {}, handler: async ctx => {
  const now = Date.now(); const events = new Set<Id<"events">>();
  const waiting = await ctx.db.query("eventWaitlist").withIndex("by_status_updated", q => q.eq("status", "waiting")).order("asc").take(50);
  for (const row of waiting) { await ctx.db.patch(row._id, { updatedAt: now }); events.add(row.eventId); }
  const offered = await ctx.db.query("eventWaitlist").withIndex("by_status_updated", q => q.eq("status", "offered").lte("updatedAt", now - 60_000)).order("asc").take(50);
  for (const row of offered) {
    const reservation = row.reservationId ? await ctx.db.get(row.reservationId) : null;
    // An untouched invitation cannot have a Stripe session. Reading the claim
    // and create-intent markers inside this transaction serializes against
    // checkout claims; any attempted provider call keeps its capacity locked.
    if (reservation?.status === "held" && reservation.waitlistId === row._id && reservation.expiresAt <= now && reservation.waitlistClaimedAt === undefined && reservation.checkoutCreateAttemptAt === undefined && !reservation.stripeSessionId) {
      const inventory = await ensureInventory(ctx, row.eventId);
      await ctx.db.patch(inventory._id, { held: Math.max(0, inventory.held - 1) });
      await ctx.db.patch(reservation._id, { status: "expired", updatedAt: now, lastError: "waitlist_invitation_expired" });
      await ctx.db.patch(row._id, { status: "expired", updatedAt: now });
      events.add(row.eventId);
      continue;
    }
    const status = reservation?.registrationId ? "registered" : reservation && (reservation.status === "held" || reservation.status === "refund_pending") ? "offered" : "expired";
    await ctx.db.patch(row._id, { status, updatedAt: now }); events.add(row.eventId);
  }
  for (const eventId of events) await ctx.scheduler.runAfter(0, internal.eventWaitlist.promote, { eventId });
} });
