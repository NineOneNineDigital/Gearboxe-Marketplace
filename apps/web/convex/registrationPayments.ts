"use node";

import Stripe from "stripe";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { action, internalAction } from "./_generated/server";
import type { ActionCtx } from "./_generated/server";

function stripeClient() {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error("Payment processing is not configured");
  return new Stripe(process.env.STRIPE_SECRET_KEY);
}
function applicationOrigin() {
  const url = new URL(process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "");
  const local = process.env.MARKETPLACE_ENV === "development" && ["localhost", "127.0.0.1"].includes(url.hostname) && url.protocol === "http:";
  if ((!local && url.protocol !== "https:") || url.username || url.password || url.pathname !== "/" || url.search || url.hash) throw new Error("Payment application origin is invalid");
  return url.origin;
}

async function findUnboundSession(stripe: Stripe, reservation: { _id: string; createdAt: number; expiresAt: number }) {
  const sessions = stripe.checkout.sessions.list({ created: { gte: Math.floor(reservation.createdAt / 1000) - 60, lte: Math.floor(reservation.expiresAt / 1000) + 60 }, limit: 100 });
  let inspected = 0;
  for await (const session of sessions) {
    if (session.metadata?.reservationId === reservation._id) return session.id;
    if (++inspected >= 1000) throw new Error("Checkout recovery requires another reconciliation attempt");
  }
  return undefined;
}

async function providerRefundState(stripe: Stripe, paymentId: string, amount: number | null, amountRefunded = 0) {
  // Pending refunds can exist before charge.amount_refunded changes; inspect them before granting admission.
  const refunds = await stripe.refunds.list({ payment_intent: paymentId, limit: 100 });
  const active = refunds.data.filter(refund => !["failed", "canceled"].includes(refund.status || ""));
  const full = active.find(refund => refund.amount === amount);
  return { stripeRefundId: full?.id, state: full ? "full" as const : active.length > 0 || amountRefunded > 0 || refunds.has_more ? "partial" as const : undefined };
}

async function reconcileSession(ctx: ActionCtx, stripe: Stripe, sessionId: string) {
  // Always fetch provider state independently; neither the browser nor webhook claims authorize payment.
  const session = await stripe.checkout.sessions.retrieve(sessionId, { expand: ["payment_intent.latest_charge"] });
  const reservationId = session.metadata?.reservationId as Id<"eventReservations"> | undefined;
  if (!reservationId) throw new Error("Missing payment reservation");
  const reservation = await ctx.runQuery(internal.eventBookings.getReservation, { reservationId });
  if (!reservation) throw new Error("Payment reservation not found");
  const metadataMatches = session.metadata?.eventId === reservation.eventId && session.metadata?.vehicleId === reservation.vehicleId && session.metadata?.userId === reservation.userId;
  if (session.payment_status === "paid") {
    const intent = typeof session.payment_intent === "object" ? session.payment_intent : null;
    if (!session.payment_intent) throw new Error("Missing payment intent");
    const charge = intent && typeof intent.latest_charge === "object" ? intent.latest_charge : null;
    const paymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent.id;
    const refundState = await providerRefundState(stripe, paymentIntentId, session.amount_total, charge?.amount_refunded);
    return await ctx.runMutation(internal.eventBookings.recordPayment, {
      reservationId, stripeSessionId: session.id,
      stripePaymentId: paymentIntentId,
      amount: session.amount_total ?? -1, currency: session.currency ?? "", metadataValid: metadataMatches,
      providerRefundState: refundState.state, stripeRefundId: refundState.stripeRefundId,
      stripeCustomerId: typeof session.customer === "string" ? session.customer : session.customer?.id,
      stripeChargeId: charge?.id, receiptUrl: charge?.receipt_url ?? undefined, qrCodeData: crypto.randomUUID(),
    });
  }
  if (session.status === "expired") await ctx.runMutation(internal.eventBookings.releaseReservation, { reservationId, stripeSessionId: session.id, reason: "stripe_session_expired" });
  return null;
}

export const createCheckout = action({
  args: { eventId: v.id("events"), vehicleId: v.id("vehicles"), acceptRules: v.optional(v.boolean()) },
  handler: async (ctx, args): Promise<{ url: string; sessionId: string; reservationId: Id<"eventReservations"> }> => {
    const stripe = stripeClient();
    const origin = applicationOrigin();
    const reservation = await ctx.runMutation(api.eventBookings.reserve, args);
    if (reservation.stripeSessionId) {
      const existing = await stripe.checkout.sessions.retrieve(reservation.stripeSessionId);
      if (existing.status === "open" && existing.url) return { url: existing.url, sessionId: existing.id, reservationId: reservation._id };
      await reconcileSession(ctx, stripe, existing.id);
      throw new Error("Checkout already completed or expired. Refresh your registrations.");
    }
    // Stable snapshot arguments plus idempotency recover creation after connection timeouts.
    if (reservation.expiresAt <= Date.now()) throw new Error("Checkout reservation expired; refresh your registrations");
    await ctx.runMutation(internal.eventBookings.markCheckoutAttempt, { reservationId: reservation._id });
    const session = await stripe.checkout.sessions.create({
      mode: "payment", payment_method_types: ["card"], customer_creation: "always",
      customer_email: reservation.customerEmail,
      payment_intent_data: { receipt_email: reservation.customerEmail },
      line_items: [{ price_data: { currency: reservation.currency, unit_amount: reservation.amount, product_data: { name: `Vehicle registration - ${reservation.eventName}`, description: reservation.vehicleName } }, quantity: 1 }],
      expires_at: Math.floor(reservation.expiresAt / 1000),
      success_url: `${origin}/myAccount/registrations?payment=success&reservationId=${reservation._id}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/myAccount/registrations?payment=cancelled&reservationId=${reservation._id}`,
      metadata: { reservationId: reservation._id, userId: reservation.userId, eventId: reservation.eventId, vehicleId: reservation.vehicleId },
    }, { idempotencyKey: `event-registration:${reservation._id}` });
    if (session.status !== "open") {
      await reconcileSession(ctx, stripe, session.id);
      throw new Error("Checkout already completed or expired. Refresh your registrations.");
    }
    if (!session.url) throw new Error("Checkout URL unavailable");
    try {
      await ctx.runMutation(internal.eventBookings.attachSession, { reservationId: reservation._id, stripeSessionId: session.id, checkoutUrl: session.url });
    } catch (error) {
      // Expire at Stripe before allowing any hold release when binding fails.
      if (session.status === "open") await stripe.checkout.sessions.expire(session.id);
      await reconcileSession(ctx, stripe, session.id);
      throw error;
    }
    return { url: session.url, sessionId: session.id, reservationId: reservation._id };
  },
});

export const refreshCheckout = action({
  args: { reservationId: v.id("eventReservations") },
  handler: async (ctx, args): Promise<unknown> => {
    const reservation = await ctx.runQuery(api.eventBookings.getOwnedReservation, args);
    if (!reservation) throw new Error("Reservation not found");
    if (reservation.stripeSessionId) await reconcileSession(ctx, stripeClient(), reservation.stripeSessionId);
    return await ctx.runQuery(api.eventBookings.getOwnedReservation, args);
  },
});

export const cancelCheckout = action({
  args: { reservationId: v.id("eventReservations") },
  handler: async (ctx, args): Promise<unknown> => {
    const reservation = await ctx.runQuery(api.eventBookings.getOwnedReservation, args);
    if (!reservation) throw new Error("Reservation not found");
    const stripe = stripeClient();
    const sessionId = reservation.stripeSessionId || await findUnboundSession(stripe, reservation);
    if (!sessionId) throw new Error("Checkout is still being created. Retry after refreshing.");
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.status === "open") await stripe.checkout.sessions.expire(session.id);
    await reconcileSession(ctx, stripe, session.id);
    return await ctx.runQuery(api.eventBookings.getOwnedReservation, args);
  },
});

async function processWebhook(ctx: ActionCtx, eventId: string) {
  const row = await ctx.runMutation(internal.paymentWebhookRecords.claim, { eventId });
  if (!row) return;
  try {
    const stripe = stripeClient();
    if (row.type.startsWith("checkout.session.")) await reconcileSession(ctx, stripe, row.objectId);
    if (row.type.startsWith("refund.")) {
      const refund = await stripe.refunds.retrieve(row.objectId);
      const paymentId = typeof refund.payment_intent === "string" ? refund.payment_intent : refund.payment_intent?.id;
      if (paymentId) await ctx.runMutation(internal.eventBookings.refundObserved, { stripePaymentId: paymentId, stripeRefundId: refund.id, amount: refund.amount, currency: refund.currency, status: refund.status || "pending" });
    }
    await ctx.runMutation(internal.paymentWebhookRecords.finish, { eventId });
  } catch {
    await ctx.runMutation(internal.paymentWebhookRecords.finish, { eventId, error: "stripe_reconciliation_failed" });
    throw new Error("Payment reconciliation failed; retry queued");
  }
}
export const receiveWebhook = action({
  args: { body: v.string(), signature: v.string() },
  handler: async (ctx, args) => {
    if (!process.env.STRIPE_WEBHOOK_SECRET || args.body.length > 262_144) throw new Error("Invalid payment webhook");
    const event = stripeClient().webhooks.constructEvent(args.body, args.signature, process.env.STRIPE_WEBHOOK_SECRET);
    const supported = ["checkout.session.completed", "checkout.session.expired", "checkout.session.async_payment_succeeded", "checkout.session.async_payment_failed", "refund.updated", "refund.created", "refund.failed"];
    if (!supported.includes(event.type)) return;
    const object = event.data.object as { id: string };
    await ctx.runMutation(internal.paymentWebhookRecords.record, { eventId: event.id, type: event.type, objectId: object.id });
    await processWebhook(ctx, event.id);
  },
});

async function migrateLegacy(ctx: ActionCtx, registrationId: Id<"registrations">) {
  const row = await ctx.runMutation(internal.eventBookings.claimLegacyMigration, { registrationId });
  if (!row) return;
  try {
    if (!row.stripePaymentId) throw new Error("Missing legacy payment reference");
    const stripe = stripeClient();
    const session = await stripe.checkout.sessions.retrieve(row.stripePaymentId, { expand: ["payment_intent.latest_charge"] });
    if (session.payment_status !== "paid" || !session.payment_intent) throw new Error("Legacy payment requires operator reconciliation");
    const intent = typeof session.payment_intent === "object" ? session.payment_intent : null;
    const paymentId = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent.id;
    const charge = intent && typeof intent.latest_charge === "object" ? intent.latest_charge : null;
    const refundState = await providerRefundState(stripe, paymentId, session.amount_total, charge?.amount_refunded);
    await ctx.runMutation(internal.eventBookings.linkLegacyPayment, {
      registrationId: row._id, stripeSessionId: session.id, stripePaymentId: paymentId,
      amount: session.amount_total ?? -1, currency: session.currency ?? "",
      stripeCustomerId: typeof session.customer === "string" ? session.customer : session.customer?.id,
      stripeChargeId: charge?.id, receiptUrl: charge?.receipt_url ?? undefined,
      metadataUserId: session.metadata?.userId ?? "", metadataEventId: session.metadata?.eventId ?? "", metadataVehicleId: session.metadata?.vehicleId ?? "",
      providerRefundState: refundState.state, stripeRefundId: refundState.stripeRefundId,
    });
  } catch {
    await ctx.runMutation(internal.eventBookings.finishLegacyMigration, { registrationId, attempt: row.legacyMigrationAttempts ?? 0, error: "stripe_legacy_payment_reconciliation_failed" });
  }
}

export const migrateLegacyPayment = internalAction({
  args: { registrationId: v.id("registrations") },
  handler: async (ctx, args) => migrateLegacy(ctx, args.registrationId),
});

export const sweep = internalAction({ args: {}, handler: async ctx => {
  const stripe = stripeClient();
  const due = await ctx.runQuery(internal.paymentWebhookRecords.due, {});
  for (const row of due) { try { await processWebhook(ctx, row.eventId); } catch { /* recorded for retry/operator review */ } }
  const work = await ctx.runQuery(internal.eventBookings.listWork, {});
  for (const registration of work.legacyMigrations) await migrateLegacy(ctx, registration._id);
  for (const workReservation of work.reservations) {
    const reservation = await ctx.runQuery(internal.eventBookings.getReservation, { reservationId: workReservation._id });
    if (!reservation || reservation.status !== "held") continue;
    try {
      await ctx.runMutation(internal.eventBookings.deferReservationReconcile, { reservationId: reservation._id });
      let sessionId = reservation.stripeSessionId;
      if (!sessionId) {
        // A lost response may leave an unbound session. Search all recent customer sessions before release.
        sessionId = await findUnboundSession(stripe, reservation);
        if (!sessionId) {
          if (reservation.expiresAt > Date.now()) continue;
          // Exact configured provider expiry is already past; no session can still take payment.
          await ctx.runMutation(internal.eventBookings.releaseReservation, { reservationId: reservation._id, reason: "unbound_checkout_expired", expectedExpiresAt: reservation.expiresAt });
          continue;
        }
      }
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      if (session.status === "open" && (session.expires_at * 1000 <= Date.now() || reservation.cancellationRequestedAt !== undefined)) await stripe.checkout.sessions.expire(sessionId);
      await reconcileSession(ctx, stripe, sessionId);
    } catch {
      // Keep the capacity hold until authoritative reconciliation succeeds, with operator visibility.
      await ctx.runMutation(internal.eventBookings.markReservationError, { reservationId: reservation._id, error: "stripe_checkout_reconciliation_failed" });
    }
  }
  for (const payment of work.refunds) {
    const leaseToken = crypto.randomUUID();
    const job = await ctx.runMutation(internal.eventBookings.claimRefund, { paymentRecordId: payment._id, leaseToken });
    if (!job) continue;
    try {
      let refund: Stripe.Refund | undefined = job.stripeRefundId ? await stripe.refunds.retrieve(job.stripeRefundId) : undefined;
      if (refund && ["failed", "canceled"].includes(refund.status || "") && (job.refundGeneration ?? 0) > 0) {
        const existing = await stripe.refunds.list({ payment_intent: job.stripePaymentId, limit: 100 });
        const other = existing.data.find(row => row.id !== refund!.id && !["failed", "canceled"].includes(row.status || ""));
        if (other) {
          if (other.amount !== job.amount || existing.has_more) throw new Error("Refund requires operator reconciliation");
          refund = other;
        } else {
          if (existing.has_more) throw new Error("Refund requires operator reconciliation");
          refund = undefined;
        }
      }
      if (!refund) refund = await stripe.refunds.create({ payment_intent: job.stripePaymentId, amount: job.amount, reason: "requested_by_customer", metadata: { paymentRecordId: job._id } }, { idempotencyKey: `event-refund:${job._id}${job.refundGeneration ? `:${job.refundGeneration}` : ""}` });
      const refundPaymentId = typeof refund.payment_intent === "string" ? refund.payment_intent : refund.payment_intent?.id;
      if (refund.amount !== job.amount || refund.currency !== job.currency || refundPaymentId !== job.stripePaymentId) {
        await ctx.runMutation(internal.eventBookings.failRefund, { paymentRecordId: job._id, leaseToken, error: "stripe_refund_amount_requires_operator_reconciliation" });
        continue;
      }
      await ctx.runMutation(internal.eventBookings.completeRefund, { paymentRecordId: job._id, leaseToken, stripeRefundId: refund.id, status: refund.status || "pending" });
    } catch {
      await ctx.runMutation(internal.eventBookings.failRefund, { paymentRecordId: job._id, leaseToken, error: "stripe_refund_request_failed" });
    }
  }
} });
