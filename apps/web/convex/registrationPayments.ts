"use node";

import Stripe from "stripe";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { action } from "./_generated/server";

export const fulfillCheckout = action({
  args: { checkoutSessionId: v.string() },
  handler: async (ctx, { checkoutSessionId }): Promise<Id<"registrations">> => {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    const expectedAmount = Number(process.env.EVENT_REGISTRATION_PRICE_CENTS);
    if (!secretKey || !Number.isSafeInteger(expectedAmount) || expectedAmount <= 0) {
      throw new Error("Payment processing is not configured");
    }

    const stripe = new Stripe(secretKey);
    const session = await stripe.checkout.sessions.retrieve(checkoutSessionId);
    if (
      session.payment_status !== "paid" ||
      session.currency !== "usd" ||
      session.amount_total !== expectedAmount
    ) {
      throw new Error("Checkout session has not been paid in full");
    }
    const { userId, eventId, vehicleId } = session.metadata ?? {};
    if (!userId || !eventId || !vehicleId) {
      throw new Error("Checkout session metadata is incomplete");
    }

    return await ctx.runMutation(internal.registrations.completeRegistration, {
      eventId: eventId as Id<"events">,
      vehicleId: vehicleId as Id<"vehicles">,
      userId: userId as Id<"users">,
      stripePaymentId: session.id,
      qrCodeData: crypto.randomUUID(),
    });
  },
});
