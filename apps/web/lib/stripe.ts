import Stripe from "stripe";

let stripe: Stripe | undefined;

export function getStripe(): Stripe {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error("Stripe payments are not configured");
  }

  stripe ??= new Stripe(secretKey, { apiVersion: "2025-09-30.clover" });
  return stripe;
}

export const formatAmountForStripe = (amount: number): number => {
  return Math.round(amount * 100);
};

export const formatAmountFromStripe = (amount: number): number => {
  return amount / 100;
};
