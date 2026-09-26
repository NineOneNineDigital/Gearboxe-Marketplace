import { api } from "@/convex/_generated/api";
import { stripe } from "@/lib/stripe";
import { ConvexHttpClient } from "convex/browser";
import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "No signature" }, { status: 400 });
  }

  let event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as any;

    try {
      const { userId, eventId, vehicleId } = session.metadata;

      // Generate QR code data
      const qrCodeData = `${userId}-${eventId}-${vehicleId}-${Date.now()}`;

      // Generate QR code image
      const qrCodeImage = await QRCode.toDataURL(qrCodeData);

      // Create registration record
      await convex.mutation(api.registrations.createRegistration, {
        eventId,
        vehicleId,
        userId,
        stripePaymentId: session.id,
        qrCodeData,
      });

      console.log("Registration created successfully:", {
        userId,
        eventId,
        vehicleId,
        sessionId: session.id,
      });
    } catch (error) {
      console.error("Error processing payment completion:", error);
      return NextResponse.json(
        { error: "Failed to process payment" },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ received: true });
}
