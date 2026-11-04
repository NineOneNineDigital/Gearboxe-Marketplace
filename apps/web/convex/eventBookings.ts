import { v } from "convex/values";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { getCurrentUser, requireAdmin, requireCurrentUser } from "./lib/authorization";
import { acceptsNewRegistrations, canRefundEvent, eventFee, RESERVATION_MS } from "./lib/eventPaymentPolicy";
import { enqueueNotification } from "./notifications";
import { eventForViewer } from "./lib/eventVisibility";
import { rosterSearchText } from "./lib/eventOperationsPolicy";

type ReadCtx = MutationCtx | QueryCtx;
const approved = (vehicle: Doc<"vehicles">) => vehicle.status === "approved" || vehicle.status === "active";
const activeRegistration = (row: Doc<"registrations">) => row.paymentStatus === "completed" || row.paymentStatus === "refund_pending";
export async function ensureInventory(ctx: MutationCtx, eventId: Id<"events">) {
  const existing = await ctx.db.query("eventInventories").withIndex("by_event", q => q.eq("eventId", eventId)).unique();
  if (existing) { if (existing.initializationStatus === "migrating") throw new Error("Event inventory migration is in progress"); return existing; }
  const legacy = await ctx.db.query("registrations").withIndex("by_event", q => q.eq("eventId", eventId)).take(1001);
  if (legacy.length > 1000) throw new Error("Event inventory requires an operator migration before new bookings");
  const id = await ctx.db.insert("eventInventories", { eventId, held: 0, confirmed: legacy.filter(activeRegistration).length, attended: legacy.filter(row => row.checkedIn).length, waiting: 0 });
  return (await ctx.db.get(id))!;
}
async function activeForVehicle(ctx: ReadCtx, eventId: Id<"events">, vehicleId: Id<"vehicles">) {
  return await ctx.db.query("registrations").withIndex("by_event_vehicle_status", q => q.eq("eventId", eventId).eq("vehicleId", vehicleId).eq("paymentStatus", "completed")).first()
    ?? await ctx.db.query("registrations").withIndex("by_event_vehicle_status", q => q.eq("eventId", eventId).eq("vehicleId", vehicleId).eq("paymentStatus", "refund_pending")).first();
}
async function owned(ctx: ReadCtx, reservationId: Id<"eventReservations">) {
  // Suspended users can still view receipts and cancel an existing booking.
  const user = await getCurrentUser(ctx);
  if (!user) throw new Error("Authentication required");
  const reservation = await ctx.db.get(reservationId);
  if (!reservation || reservation.userId !== user._id) throw new Error("Reservation not found");
  return reservation;
}
async function registrationRows(ctx: ReadCtx, userId: Id<"users">) {
  const rows = await ctx.db.query("registrations").withIndex("by_user", q => q.eq("userId", userId)).order("desc").take(100);
  return Promise.all(rows.map(async registration => {
    const event = await ctx.db.get(registration.eventId);
    return { ...registration, event: event ? await eventForViewer(ctx, event) : null, vehicle: await ctx.db.get(registration.vehicleId), canRefund: !!event && registration.paymentStatus === "completed" && !registration.checkedIn && canRefundEvent(event) && !!registration.paymentRecordId };
  }));
}
export const getMine = query({ args: {}, handler: async ctx => {
  const user = await getCurrentUser(ctx); if (!user) throw new Error("Authentication required");
  return { payments: await ctx.db.query("eventPayments").withIndex("by_user", q => q.eq("userId", user._id)).order("desc").take(100), registrations: await registrationRows(ctx, user._id), reservations: await ctx.db.query("eventReservations").withIndex("by_user", q => q.eq("userId", user._id)).order("desc").take(100) };
} });
export const getOffer = query({ args: { eventId: v.id("events") }, handler: async (ctx, { eventId }) => {
  const user = await requireCurrentUser(ctx);
  const event = await ctx.db.get(eventId); if (!event) throw new Error("Event not found");
  const counter = await ctx.db.query("eventInventories").withIndex("by_event", q => q.eq("eventId", eventId)).unique();
  const legacy = counter ? [] : await ctx.db.query("registrations").withIndex("by_event", q => q.eq("eventId", eventId)).take(1001);
  const available = counter?.initializationStatus === "migrating" || legacy.length > 1000 ? 0 : Math.max(0, event.capacity - (counter ? counter.confirmed + counter.held : legacy.filter(activeRegistration).length));
  return { event: await eventForViewer(ctx, event), amount: eventFee(event), currency: "usd", reservationDurationMs: RESERVATION_MS, available: acceptsNewRegistrations(event) ? available : 0, registrationOpen: acceptsNewRegistrations(event),
    waitlist: (await ctx.db.query("eventWaitlist").withIndex("by_user", q => q.eq("userId", user._id)).order("desc").take(100)).filter(row => row.eventId === eventId), waiting: counter?.waiting ?? 0,
    vehicles: (await ctx.db.query("vehicles").withIndex("by_user", q => q.eq("userId", user._id)).take(200)).filter(approved),
    reservations: (await ctx.db.query("eventReservations").withIndex("by_user", q => q.eq("userId", user._id)).take(100)).filter(row => row.eventId === eventId),
    registrations: (await registrationRows(ctx, user._id)).filter(row => row.eventId === eventId) };
} });
export const getOwnedReservation = query({ args: { reservationId: v.id("eventReservations") }, handler: async (ctx, args) => {
  const reservation = await owned(ctx, args.reservationId);
  const event = await ctx.db.get(reservation.eventId);
  return { ...reservation, event: event ? await eventForViewer(ctx, event) : null, vehicle: await ctx.db.get(reservation.vehicleId), registration: reservation.registrationId ? await ctx.db.get(reservation.registrationId) : null };
} });
export const getStatus = getOwnedReservation;
export const getReservation = internalQuery({ args: { reservationId: v.id("eventReservations") }, handler: async (ctx, args) => {
  const reservation = await ctx.db.get(args.reservationId); if (!reservation) return null;
  const [user, event, vehicle] = await Promise.all([ctx.db.get(reservation.userId), ctx.db.get(reservation.eventId), ctx.db.get(reservation.vehicleId)]);
  return { ...reservation, customerEmail: reservation.customerEmail ?? user?.email, eventName: reservation.eventName ?? event?.name, vehicleName: reservation.vehicleName ?? vehicle?.title, eventCancelledAt: event?.cancelledAt };
} });
export const reserve = mutation({ args: { eventId: v.id("events"), vehicleId: v.id("vehicles"), acceptRules: v.optional(v.boolean()) }, handler: async (ctx, args) => {
  const user = await requireCurrentUser(ctx); const now = Date.now();
  const event = await ctx.db.get(args.eventId); const vehicle = await ctx.db.get(args.vehicleId);
  if (!event || event.cancelledAt !== undefined || event.date <= now) throw new Error("Event is no longer accepting registrations");
  if (!vehicle || vehicle.userId !== user._id || !approved(vehicle)) throw new Error("Select your approved vehicle");
  const registration = await activeForVehicle(ctx, event._id, vehicle._id);
  if (registration) throw new Error("Vehicle already registered for this event");
  const holds = await ctx.db.query("eventReservations").withIndex("by_event_vehicle", q => q.eq("eventId", event._id).eq("vehicleId", vehicle._id)).order("desc").take(100);
  const current = holds.find(row => row.status === "held");
  if (current) {
    if (current.userId !== user._id) throw new Error("Vehicle already has another owner’s reservation");
    if (current.cancellationRequestedAt !== undefined) throw new Error("Previous checkout cancellation is processing");
    if (current.expiresAt <= now) throw new Error("Previous checkout is expiring. Please try again shortly.");
    const claimPatch = current.waitlistId && current.waitlistClaimedAt === undefined && !current.checkoutCreateAttemptAt && !current.stripeSessionId ? { waitlistClaimedAt: now, expiresAt: now + RESERVATION_MS } : {};
    if (current.rulesSnapshot?.trim() && !current.rulesAcceptedAt) {
      if (!args.acceptRules) throw new Error("Accept the event rules before payment");
      await ctx.db.patch(current._id, { rulesAcceptedAt: now });
    }
    if ("waitlistClaimedAt" in claimPatch) await ctx.db.patch(current._id, claimPatch);
    return { ...current, ...claimPatch, rulesAcceptedAt: current.rulesAcceptedAt ?? (args.acceptRules ? now : undefined), customerEmail: current.customerEmail ?? user.email, eventName: current.eventName ?? event.name, vehicleName: current.vehicleName ?? vehicle.title };
  }
  if (!acceptsNewRegistrations(event, now)) throw new Error("Event registration deadline has passed");
  const userHolds = await ctx.db.query("eventReservations").withIndex("by_user_status", q => q.eq("userId", user._id).eq("status", "held")).take(5);
  if (userHolds.length >= 5) throw new Error("Finish or cancel your existing checkouts first");
  // Every booking writes the same event counter. Convex's serializable transaction
  // retry prevents two simultaneous buyers from consuming the last space.
  const counter = await ensureInventory(ctx, event._id);
  if (counter.held + counter.confirmed >= event.capacity) throw new Error("Event is full");
  const queued = await ctx.db.query("eventWaitlist").withIndex("by_event_status", q => q.eq("eventId", event._id).eq("status", "waiting")).first();
  if (queued) { throw new Error("Spaces are being offered to the waitlist. Join the waitlist to reserve your place."); }
  if (event.eventRules?.trim() && !args.acceptRules) throw new Error("Accept the event rules before payment");
  const id = await ctx.db.insert("eventReservations", { eventId: args.eventId, vehicleId: args.vehicleId, rulesSnapshot: event.eventRules, rulesAcceptedAt: args.acceptRules ? now : undefined, userId: user._id, customerEmail: user.email, eventName: event.name, vehicleName: vehicle.title, status: "held", amount: eventFee(event), currency: "usd", expiresAt: now + RESERVATION_MS, nextReconcileAt: now + 60_000, createdAt: now, updatedAt: now });
  await ctx.db.patch(counter._id, { held: counter.held + 1 });
  return { ...(await ctx.db.get(id))!, customerEmail: user.email, eventName: event.name, vehicleName: vehicle.title };
} });
export const attachSession = internalMutation({ args: { reservationId: v.id("eventReservations"), stripeSessionId: v.string(), checkoutUrl: v.string(), stripeCustomerId: v.optional(v.string()) }, handler: async (ctx, args) => {
  const row = await ctx.db.get(args.reservationId); if (!row || row.status !== "held") throw new Error("Reservation is no longer active");
  if (row.stripeSessionId && row.stripeSessionId !== args.stripeSessionId) throw new Error("Reservation already has a checkout session");
  await ctx.db.patch(row._id, { stripeSessionId: args.stripeSessionId, checkoutUrl: args.checkoutUrl, nextReconcileAt: Date.now(), stripeCustomerId: args.stripeCustomerId, updatedAt: Date.now() });
} });
export const releaseReservation = internalMutation({ args: { reservationId: v.id("eventReservations"), reason: v.string(), stripeSessionId: v.optional(v.string()), expectedExpiresAt: v.optional(v.number()) }, handler: async (ctx, args) => {
  const row = await ctx.db.get(args.reservationId); if (!row || row.status !== "held" || (args.stripeSessionId && row.stripeSessionId && row.stripeSessionId !== args.stripeSessionId)) return;
  if (args.expectedExpiresAt !== undefined && row.expiresAt !== args.expectedExpiresAt) return;
  // Call only after Stripe confirms expiry/no payment; elapsed local time alone
  // cannot prove an in-flight or delayed payment did not succeed.
  const counter = await ensureInventory(ctx, row.eventId);
  await ctx.db.patch(counter._id, { held: Math.max(0, counter.held - 1) });
  await ctx.db.patch(row._id, { status: "expired", lastError: args.reason.slice(0, 300), updatedAt: Date.now(), checkoutUrl: undefined });
  await ctx.scheduler.runAfter(0, internal.eventWaitlist.promote, { eventId: row.eventId });
} });
export const recordPayment = internalMutation({ args: { reservationId: v.id("eventReservations"), stripeSessionId: v.string(), stripePaymentId: v.string(), stripeCustomerId: v.optional(v.string()), stripeChargeId: v.optional(v.string()), receiptUrl: v.optional(v.string()), amount: v.number(), currency: v.string(), qrCodeData: v.string(), metadataValid: v.optional(v.boolean()), providerRefundState: v.optional(v.union(v.literal("full"), v.literal("partial"))), stripeRefundId: v.optional(v.string()) }, handler: async (ctx, args) => {
  const prior = await ctx.db.query("eventPayments").withIndex("by_payment", q => q.eq("stripePaymentId", args.stripePaymentId)).unique();
  if (prior) return { registrationId: prior.registrationId, paymentRecordId: prior._id, refundRequired: prior.status.startsWith("refund") };
  const reservation = await ctx.db.get(args.reservationId); if (!reservation) throw new Error("Unknown payment reservation requires operator reconciliation");
  const now = Date.now(); const [event, vehicle, user] = await Promise.all([ctx.db.get(reservation.eventId), ctx.db.get(reservation.vehicleId), ctx.db.get(reservation.userId)]);
  const duplicate = await activeForVehicle(ctx, reservation.eventId, reservation.vehicleId);
  const counter = await ensureInventory(ctx, reservation.eventId);
  const valid = (!reservation.rulesSnapshot?.trim() || reservation.rulesAcceptedAt !== undefined) && counter.held > 0 && !args.providerRefundState && args.metadataValid !== false && reservation.status === "held" && (!reservation.stripeSessionId || reservation.stripeSessionId === args.stripeSessionId) && args.amount === reservation.amount && args.currency === reservation.currency && event && counter.confirmed < event.capacity && event.cancelledAt === undefined && event.date > now && vehicle && vehicle.userId === reservation.userId && approved(vehicle) && user && user.suspendedAt === undefined && !duplicate;
  const paymentRecordId = await ctx.db.insert("eventPayments", { reservationId: reservation._id, eventId: reservation.eventId, vehicleId: reservation.vehicleId, userId: reservation.userId, stripeSessionId: args.stripeSessionId, stripePaymentId: args.stripePaymentId, stripeCustomerId: args.stripeCustomerId, stripeChargeId: args.stripeChargeId, receiptUrl: args.receiptUrl, amount: args.amount, currency: args.currency, status: valid ? "paid" : args.providerRefundState === "partial" ? "refund_failed" : "refund_pending", stripeRefundId: args.stripeRefundId, lastError: args.providerRefundState === "partial" ? "partial_refund_requires_reconciliation" : undefined, refundReason: valid ? undefined : duplicate ? "duplicate_payment" : "invalid_or_expired_registration", attempts: 0, nextAttemptAt: now, createdAt: now, updatedAt: now });
  if (!valid) {
    if (reservation.status === "held" && (!reservation.stripeSessionId || reservation.stripeSessionId === args.stripeSessionId)) await ctx.db.patch(reservation._id, { status: "refund_pending", updatedAt: now, checkoutUrl: undefined });
    return { registrationId: duplicate?._id, paymentRecordId, refundRequired: true };
  }
  const registrationId = await ctx.db.insert("registrations", { eventId: reservation.eventId, vehicleId: reservation.vehicleId, userId: reservation.userId, reservationId: reservation._id, paymentRecordId, stripePaymentId: args.stripePaymentId, stripeCustomerId: args.stripeCustomerId, receiptUrl: args.receiptUrl, paymentStatus: "completed", qrCodeData: args.qrCodeData, checkedIn: false, rosterSearch: rosterSearchText(user.name ?? "", `${vehicle.year ?? ""} ${vehicle.make ?? ""} ${vehicle.model ?? ""}`), createdAt: now });
  await ctx.db.patch(paymentRecordId, { registrationId });
  await ctx.db.patch(reservation._id, { status: "paid", registrationId, stripeSessionId: args.stripeSessionId, stripeCustomerId: args.stripeCustomerId, updatedAt: now, checkoutUrl: undefined });
  await ctx.db.patch(counter._id, { held: Math.max(0, counter.held - 1), confirmed: counter.confirmed + 1 });
  await enqueueNotification(ctx, { userId: reservation.userId, category: "events", kind: "event_payment", message: `Your registration for ${event.name} is confirmed. View your receipt and admission details.`, vehicleId: reservation.vehicleId, registrationId, link: "/myAccount/registrations", dedupeKey: `payment:${registrationId}` });
  return { registrationId, paymentRecordId, refundRequired: false };
} });
export const requestRefund = mutation({ args: { registrationId: v.id("registrations") }, handler: async (ctx, args) => {
  const user = await getCurrentUser(ctx); if (!user) throw new Error("Authentication required");
  const row = await ctx.db.get(args.registrationId); if (!row || row.userId !== user._id) throw new Error("Registration not found");
  if (row.paymentStatus === "refund_pending" || row.paymentStatus === "refunded") return;
  const event = await ctx.db.get(row.eventId);
  if (row.paymentStatus !== "completed" || row.checkedIn || !event || !canRefundEvent(event)) throw new Error("Refunds are available through seven calendar days before the event, before check-in");
  if (!row.paymentRecordId) throw new Error("Contact support to refund this legacy registration");
  const payment = await ctx.db.get(row.paymentRecordId); if (!payment || payment.status !== "paid") throw new Error("Payment cannot be refunded automatically. Contact support.");
  const now = Date.now();
  await ctx.db.patch(payment._id, { status: "refund_pending", refundReason: "seller_cancellation", nextAttemptAt: now, updatedAt: now });
  await ctx.db.patch(row._id, { paymentStatus: "refund_pending", refundRequestedAt: now, qrCodeData: undefined });
} });
export const listWork = internalQuery({ args: {}, handler: async ctx => {
  const now = Date.now();
  const reservations = [...await ctx.db.query("eventReservations").withIndex("by_status_expiry", q => q.eq("status", "held").lte("expiresAt", now)).take(25), ...await ctx.db.query("eventReservations").withIndex("by_status_cancel", q => q.eq("status", "held").gt("cancellationRequestedAt", 0)).take(25), ...await ctx.db.query("eventReservations").withIndex("by_status_reconcile", q => q.eq("status", "held").lte("nextReconcileAt", now)).take(25)];
  return { legacyMigrations: (await ctx.db.query("registrations").withIndex("by_legacy_migration", q => q.eq("paymentStatus", "refund_pending").eq("paymentRecordId", undefined).lte("legacyMigrationNextAttemptAt", now)).take(25)).filter(row => (row.legacyMigrationAttempts ?? 0) < 8), reservations: [...new Map(reservations.map(row => [row._id, row])).values()], refunds: [
    ...await ctx.db.query("eventPayments").withIndex("by_status_due", q => q.eq("status", "refund_pending").lte("nextAttemptAt", now)).take(25),
    ...await ctx.db.query("eventPayments").withIndex("by_status_lease", q => q.eq("status", "refund_processing").lte("leaseExpiresAt", now)).take(25) ] };
} });
export const claimRefund = internalMutation({ args: { paymentRecordId: v.id("eventPayments"), leaseToken: v.string() }, handler: async (ctx, args) => {
  const row = await ctx.db.get(args.paymentRecordId); const now = Date.now();
  if (!row || (row.status !== "refund_pending" && row.status !== "refund_processing") || row.nextAttemptAt > now || (row.status === "refund_processing" && (row.leaseExpiresAt ?? 0) > now)) return null;
  const patch = { status: "refund_processing", leaseToken: args.leaseToken, leaseExpiresAt: now + 5 * 60_000, attempts: row.attempts + 1, updatedAt: now };
  await ctx.db.patch(row._id, patch); return { ...row, ...patch };
} });
export const completeRefund = internalMutation({ args: { paymentRecordId: v.id("eventPayments"), stripeRefundId: v.string(), status: v.string(), leaseToken: v.string() }, handler: async (ctx, args) => {
  const row = await ctx.db.get(args.paymentRecordId); if (!row || row.status !== "refund_processing" || row.leaseToken !== args.leaseToken) return;
  const now = Date.now(); const succeeded = args.status === "succeeded";
  await ctx.db.patch(row._id, { stripeRefundId: args.stripeRefundId, refundStatus: args.status, refundAmount: succeeded ? row.amount : undefined, status: succeeded ? "refunded" : ["failed", "canceled"].includes(args.status) ? "refund_failed" : "refund_pending", nextAttemptAt: now + 60_000, updatedAt: now, leaseToken: undefined, leaseExpiresAt: undefined });
  if (!succeeded) return;
  if (row.registrationId) {
    const registration = await ctx.db.get(row.registrationId);
    if (registration && activeRegistration(registration)) {
      const counter = await ensureInventory(ctx, row.eventId);
      await ctx.db.patch(counter._id, { confirmed: Math.max(0, counter.confirmed - 1) });
      await ctx.db.patch(registration._id, { paymentStatus: "refunded", stripeRefundId: args.stripeRefundId, cancelledAt: now, qrCodeData: undefined });
    }
  }
  const reservation = await ctx.db.get(row.reservationId);
  if (reservation && (!reservation.stripeSessionId || reservation.stripeSessionId === row.stripeSessionId) && ((reservation.status === "refund_pending" && !reservation.registrationId) || reservation.status === "held" || (reservation.status === "paid" && reservation.registrationId === row.registrationId))) {
    if (reservation.status === "held" || (reservation.status === "refund_pending" && !reservation.registrationId)) { const counter = await ensureInventory(ctx, row.eventId); await ctx.db.patch(counter._id, { held: Math.max(0, counter.held - 1) }); }
    await ctx.db.patch(reservation._id, { status: "refunded", updatedAt: now, checkoutUrl: undefined });
  }
  await ctx.scheduler.runAfter(0, internal.eventWaitlist.promote, { eventId: row.eventId });
  await enqueueNotification(ctx, { userId: row.userId, category: "events", kind: "event_refund", message: "Your event payment was refunded. View the payment details in your registrations.", link: "/myAccount/registrations", dedupeKey: `refund:${row._id}` });
} });
export const failRefund = internalMutation({ args: { paymentRecordId: v.id("eventPayments"), error: v.string(), leaseToken: v.string() }, handler: async (ctx, args) => {
  const row = await ctx.db.get(args.paymentRecordId); if (!row || row.status !== "refund_processing" || row.leaseToken !== args.leaseToken) return;
  const now = Date.now();
  await ctx.db.patch(row._id, { status: row.attempts >= 8 ? "refund_failed" : "refund_pending", lastError: args.error.slice(0, 300), nextAttemptAt: now + Math.min(3_600_000, 60_000 * 2 ** row.attempts), updatedAt: now, leaseToken: undefined, leaseExpiresAt: undefined });
} });
export const paymentOperations = query({ args: {}, handler: async ctx => {
  await requireAdmin(ctx);
  return { failedRefunds: await ctx.db.query("eventPayments").withIndex("by_status_due", q => q.eq("status", "refund_failed")).take(100), pendingRefunds: await ctx.db.query("eventPayments").withIndex("by_status_due", q => q.eq("status", "refund_pending")).take(100), processingRefunds: await ctx.db.query("eventPayments").withIndex("by_status_due", q => q.eq("status", "refund_processing")).take(100), paidReconciliationFailures: await ctx.db.query("eventPayments").withIndex("by_status_error", q => q.eq("status", "paid").gt("lastError", "")).take(100), legacyMigrationFailures: await ctx.db.query("registrations").withIndex("by_legacy_error", q => q.eq("paymentStatus", "refund_pending").eq("paymentRecordId", undefined).gt("legacyMigrationError", "")).take(100), heldReconciliationFailures: await ctx.db.query("eventReservations").withIndex("by_status_error", q => q.eq("status", "held").gt("lastError", "")).take(100) };
} });
export const retryRefund = mutation({ args: { paymentRecordId: v.id("eventPayments"), reason: v.string() }, handler: async (ctx, args) => {
  const actor = await requireAdmin(ctx); const row = await ctx.db.get(args.paymentRecordId); if (!row || row.status !== "refund_failed" || !args.reason.trim()) throw new Error("Failed refund and reason required");
  await ctx.db.patch(row._id, { status: "refund_pending", nextAttemptAt: Date.now(), updatedAt: Date.now(), attempts: 0, refundGeneration: (row.refundGeneration ?? 0) + 1 });
  await ctx.db.insert("adminAuditLog", { actorId: actor._id, targetUserId: row.userId, action: "retry_event_refund", source: "eventBookings", reason: args.reason.trim().slice(0, 1000), createdAt: Date.now() });
} });

export const cancelEvent = mutation({ args: { eventId: v.id("events"), reason: v.string() }, handler: async (ctx, args) => {
  const actor = await requireAdmin(ctx); const event = await ctx.db.get(args.eventId);
  if (!event || !args.reason.trim() || args.reason.length > 1000) throw new Error("Event and cancellation reason required");
  if (event.cancelledAt !== undefined) return;
  await ctx.db.patch(event._id, { cancelledAt: Date.now(), cancellationReason: args.reason.trim() });
  await ctx.db.insert("adminAuditLog", { actorId: actor._id, action: "cancel_event", source: "eventBookings", reason: `${event._id}: ${args.reason.trim()}`, createdAt: Date.now() });
  await ctx.scheduler.runAfter(0, internal.eventBookings.cancelEventBatch, { eventId: event._id, phase: "registrations", cursor: null });
} });
export const cancelEventBatch = internalMutation({ args: { eventId: v.id("events"), phase: v.union(v.literal("registrations"), v.literal("reservations")), cursor: v.union(v.string(), v.null()) }, handler: async (ctx, args) => {
  const event = await ctx.db.get(args.eventId); if (!event || event.cancelledAt === undefined) return;
  const now = Date.now();
  if (args.phase === "registrations") {
    const page = await ctx.db.query("registrations").withIndex("by_event", q => q.eq("eventId", args.eventId)).paginate({ cursor: args.cursor, numItems: 50 });
    for (const row of page.page) {
      if (row.paymentStatus !== "completed") continue;
      if (row.paymentRecordId) {
        const payment = await ctx.db.get(row.paymentRecordId);
        if (payment?.status === "paid") await ctx.db.patch(payment._id, { status: "refund_pending", refundReason: "event_cancellation", nextAttemptAt: now, updatedAt: now });
      } else if (row.stripePaymentId) {
        await ctx.scheduler.runAfter(0, internal.registrationPayments.migrateLegacyPayment, { registrationId: row._id });
      }
      // Legacy registrations require operator reconciliation; all canceled-event
      // QR credentials are invalid immediately regardless of payment vintage.
      await ctx.db.patch(row._id, { paymentStatus: "refund_pending", refundRequestedAt: now, qrCodeData: undefined, ...(!row.paymentRecordId ? { legacyMigrationAttempts: 0, legacyMigrationNextAttemptAt: now, legacyMigrationError: row.stripePaymentId ? undefined : "missing_legacy_payment_reference" } : {}) });
      await enqueueNotification(ctx, { userId: row.userId, category: "events", kind: "event_cancellation", message: `Your event was canceled. ${row.paymentRecordId ? "Your refund is being processed." : "Support will arrange your refund."}`, link: "/myAccount/registrations", registrationId: row._id, dedupeKey: `event-canceled:${row._id}` });
    }
    await ctx.scheduler.runAfter(0, internal.eventBookings.cancelEventBatch, { eventId: args.eventId, phase: page.isDone ? "reservations" : "registrations", cursor: page.isDone ? null : page.continueCursor });
  } else {
    const page = await ctx.db.query("eventReservations").withIndex("by_event_vehicle", q => q.eq("eventId", args.eventId)).paginate({ cursor: args.cursor, numItems: 50 });
    for (const row of page.page) if (row.status === "held") await ctx.db.patch(row._id, { cancellationRequestedAt: now, updatedAt: now });
    if (!page.isDone) await ctx.scheduler.runAfter(0, internal.eventBookings.cancelEventBatch, { eventId: args.eventId, phase: "reservations", cursor: page.continueCursor });
  }
} });
export const refundObserved = internalMutation({ args: { stripePaymentId: v.string(), stripeRefundId: v.string(), amount: v.number(), currency: v.string(), status: v.optional(v.string()) }, handler: async (ctx, args) => {
  const row = await ctx.db.query("eventPayments").withIndex("by_payment", q => q.eq("stripePaymentId", args.stripePaymentId)).unique();
  if (!row) throw new Error("Payment mapping is not available yet; retry refund reconciliation");
  if (row.status === "refunded") return;
  if (args.status === "failed" || args.status === "canceled") { await ctx.db.patch(row._id, { lastError: "External refund failed; operator reconciliation required", updatedAt: Date.now() }); return; }
  if (row.amount !== args.amount || row.currency !== args.currency || (row.stripeRefundId && row.stripeRefundId !== args.stripeRefundId)) {
    await ctx.db.patch(row._id, { lastError: "External or partial refund requires operator reconciliation", updatedAt: Date.now() });
    return;
  }
  if (row.status === "refund_processing") return;
  await ctx.db.patch(row._id, { stripeRefundId: args.stripeRefundId, status: "refund_pending", refundReason: row.refundReason ?? "external_refund", nextAttemptAt: Date.now(), updatedAt: Date.now() });
  if (row.registrationId) {
    const registration = await ctx.db.get(row.registrationId);
    if (registration && activeRegistration(registration)) await ctx.db.patch(registration._id, { paymentStatus: "refund_pending", qrCodeData: undefined, refundRequestedAt: Date.now() });
  }
} });

// Operator-only bounded migration for large legacy events. Inventory initialization
// takes an exclusive event counter lock; bookings resume only after the final page.
export const startInventoryBackfill = internalMutation({ args: { eventId: v.id("events") }, handler: async (ctx, args) => {
  const event = await ctx.db.get(args.eventId); if (!event) throw new Error("Event not found");
  const existing = await ctx.db.query("eventInventories").withIndex("by_event", q => q.eq("eventId", args.eventId)).unique();
  if (existing) return;
  await ctx.db.insert("eventInventories", { eventId: args.eventId, held: 0, confirmed: 0, attended: 0, waiting: 0, initializationStatus: "migrating" });
  await ctx.scheduler.runAfter(0, internal.eventBookings.backfillInventory, { eventId: args.eventId, cursor: null });
} });
export const backfillInventory = internalMutation({ args: { eventId: v.id("events"), cursor: v.union(v.string(), v.null()) }, handler: async (ctx, args) => {
  const counter = await ctx.db.query("eventInventories").withIndex("by_event", q => q.eq("eventId", args.eventId)).unique();
  if (!counter || counter.initializationStatus !== "migrating" || (counter.migrationCursor ?? null) !== args.cursor) return;
  const page = await ctx.db.query("registrations").withIndex("by_event", q => q.eq("eventId", args.eventId)).paginate({ cursor: args.cursor, numItems: 100 });
  await ctx.db.patch(counter._id, { confirmed: counter.confirmed + page.page.filter(activeRegistration).length, attended: (counter.attended ?? 0) + page.page.filter(row => row.checkedIn).length, initializationStatus: page.isDone ? "ready" : "migrating", migrationCursor: page.isDone ? undefined : page.continueCursor });
  if (!page.isDone) await ctx.scheduler.runAfter(0, internal.eventBookings.backfillInventory, { eventId: args.eventId, cursor: page.continueCursor });
} });
export const deferReservationReconcile = internalMutation({ args: { reservationId: v.id("eventReservations") }, handler: async (ctx, args) => {
  const row = await ctx.db.get(args.reservationId); if (!row || row.status !== "held") return;
  await ctx.db.patch(row._id, { nextReconcileAt: Date.now() + 60_000 });
} });
export const markReservationError = internalMutation({ args: { reservationId: v.id("eventReservations"), error: v.string() }, handler: async (ctx, args) => {
  const row = await ctx.db.get(args.reservationId); if (!row || row.status !== "held") return;
  await ctx.db.patch(row._id, { lastError: args.error.slice(0, 300), updatedAt: Date.now() });
} });
// Operator recovery of pre-reservation Checkout payments. Provider references and
// original metadata must be independently retrieved and verified by the action.
export const getLegacyRegistration = internalQuery({ args: { registrationId: v.id("registrations") }, handler: async (ctx, args) => {
  const row = await ctx.db.get(args.registrationId);
  if (!row || row.paymentRecordId || !activeRegistration(row) || !row.stripePaymentId) return null;
  const user = await ctx.db.get(row.userId); const event = await ctx.db.get(row.eventId); const vehicle = await ctx.db.get(row.vehicleId);
  return { ...row, customerEmail: user?.email, eventName: event?.name, vehicleName: vehicle?.title };
} });
export const linkLegacyPayment = internalMutation({ args: { registrationId: v.id("registrations"), stripeSessionId: v.string(), stripePaymentId: v.string(), stripeCustomerId: v.optional(v.string()), stripeChargeId: v.optional(v.string()), receiptUrl: v.optional(v.string()), amount: v.number(), currency: v.string(), metadataUserId: v.string(), metadataEventId: v.string(), metadataVehicleId: v.string(), providerRefundState: v.optional(v.union(v.literal("full"), v.literal("partial"))), stripeRefundId: v.optional(v.string()) }, handler: async (ctx, args) => {
  const row = await ctx.db.get(args.registrationId); if (!row || row.paymentRecordId || !activeRegistration(row)) return;
  if (row.stripePaymentId !== args.stripeSessionId || row.userId !== args.metadataUserId || row.eventId !== args.metadataEventId || row.vehicleId !== args.metadataVehicleId || !Number.isSafeInteger(args.amount) || args.amount < 1 || args.currency !== "usd") throw new Error("Legacy payment metadata does not match registration");
  const existing = await ctx.db.query("eventPayments").withIndex("by_payment", q => q.eq("stripePaymentId", args.stripePaymentId)).unique();
  if (existing) throw new Error("Legacy payment is already linked; operator reconciliation required");
  const [event, user, vehicle] = await Promise.all([ctx.db.get(row.eventId), ctx.db.get(row.userId), ctx.db.get(row.vehicleId)]);
  if (!event || !user || !vehicle) throw new Error("Legacy registration references are missing");
  await ensureInventory(ctx, row.eventId); // Initializes counts including this existing registration; adds no space.
  const now = Date.now(); const refund = !!args.providerRefundState || event.cancelledAt !== undefined || row.paymentStatus === "refund_pending";
  const reservationId = await ctx.db.insert("eventReservations", { eventId: row.eventId, vehicleId: row.vehicleId, userId: row.userId, status: "paid", amount: args.amount, currency: args.currency, stripeSessionId: args.stripeSessionId, stripeCustomerId: args.stripeCustomerId, registrationId: row._id, customerEmail: user.email, eventName: event.name, vehicleName: vehicle.title, expiresAt: row.createdAt, createdAt: row.createdAt, updatedAt: now });
  const paymentRecordId = await ctx.db.insert("eventPayments", { reservationId, eventId: row.eventId, vehicleId: row.vehicleId, userId: row.userId, registrationId: row._id, stripeSessionId: args.stripeSessionId, stripePaymentId: args.stripePaymentId, stripeCustomerId: args.stripeCustomerId, stripeChargeId: args.stripeChargeId, receiptUrl: args.receiptUrl, amount: args.amount, currency: args.currency, status: args.providerRefundState === "partial" ? "refund_failed" : refund ? "refund_pending" : "paid", stripeRefundId: args.stripeRefundId, lastError: args.providerRefundState === "partial" ? "partial_refund_requires_reconciliation" : undefined, refundReason: refund ? "event_cancellation" : undefined, attempts: 0, nextAttemptAt: now, createdAt: row.createdAt, updatedAt: now });
  await ctx.db.patch(row._id, { rosterSearch: rosterSearchText(user.name ?? "", `${vehicle.year ?? ""} ${vehicle.make ?? ""} ${vehicle.model ?? ""}`), reservationId, paymentRecordId, stripePaymentId: args.stripePaymentId, stripeCustomerId: args.stripeCustomerId, receiptUrl: args.receiptUrl, legacyMigrationError: undefined, legacyMigrationNextAttemptAt: undefined, ...(refund ? { paymentStatus: "refund_pending" as const, qrCodeData: undefined, refundRequestedAt: now } : {}) });
} });
export const claimLegacyMigration = internalMutation({ args: { registrationId: v.id("registrations") }, handler: async (ctx, args) => {
  const row = await ctx.db.get(args.registrationId); const now = Date.now();
  if (!row || row.paymentRecordId || !activeRegistration(row) || (row.legacyMigrationAttempts ?? 0) >= 8 || (row.legacyMigrationNextAttemptAt ?? 0) > now) return null;
  const attempt = (row.legacyMigrationAttempts ?? 0) + 1;
  const patch = { legacyMigrationAttempts: attempt, legacyMigrationNextAttemptAt: attempt >= 8 ? Number.MAX_SAFE_INTEGER : now + 5 * 60_000, legacyMigrationError: attempt >= 8 ? row.legacyMigrationError ?? "legacy_migration_retry_limit_reached" : row.legacyMigrationError };
  await ctx.db.patch(row._id, patch); return { ...row, ...patch };
} });
export const finishLegacyMigration = internalMutation({ args: { registrationId: v.id("registrations"), error: v.string(), attempt: v.number() }, handler: async (ctx, args) => {
  const row = await ctx.db.get(args.registrationId);
  if (!row || row.paymentRecordId || row.legacyMigrationAttempts !== args.attempt) return;
  await ctx.db.patch(row._id, { legacyMigrationError: args.error.slice(0, 300), legacyMigrationNextAttemptAt: args.attempt >= 8 ? Number.MAX_SAFE_INTEGER : Date.now() + Math.min(3_600_000, 60_000 * 2 ** args.attempt) });
} });
export const retryLegacyMigration = mutation({ args: { registrationId: v.id("registrations"), reason: v.string() }, handler: async (ctx, args) => {
  const actor = await requireAdmin(ctx); const row = await ctx.db.get(args.registrationId);
  if (!row || row.paymentRecordId || row.paymentStatus !== "refund_pending" || !args.reason.trim() || args.reason.length > 1000) throw new Error("Pending legacy refund and reason required");
  await ctx.db.patch(row._id, { legacyMigrationAttempts: 0, legacyMigrationNextAttemptAt: Date.now(), legacyMigrationError: undefined });
  await ctx.db.insert("adminAuditLog", { actorId: actor._id, targetUserId: row.userId, action: "retry_legacy_event_payment", source: "eventBookings", reason: `${row._id}: ${args.reason.trim()}`, createdAt: Date.now() });
} });

// Persist provider-create intent before making the network call; an unattached
// session may still charge, so local cancellation must not release its inventory.
export const markCheckoutAttempt = internalMutation({ args: { reservationId: v.id("eventReservations") }, handler: async (ctx, args) => {
  const row = await ctx.db.get(args.reservationId);
  if (!row || row.status !== "held" || row.expiresAt <= Date.now() || row.cancellationRequestedAt !== undefined) throw new Error("Reservation is no longer accepting checkout");
  if (!row.checkoutCreateAttemptAt) await ctx.db.patch(row._id, { checkoutCreateAttemptAt: Date.now() });
} });
